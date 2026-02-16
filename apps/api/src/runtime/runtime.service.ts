import { Injectable } from "@nestjs/common";
import type { ServerKind } from "@prisma/client";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface RuntimeServerDefinition {
  id: string;
  name: string;
  kind: ServerKind;
  mcVersion: string;
  port: number;
  memoryMinMb: number;
  memoryMaxMb: number;
  eulaAccepted: boolean;
}

export interface RuntimeServerInfo {
  serverDir: string;
  logFile: string;
  jarPath: string;
  jarExists: boolean;
  running: boolean;
  pid: number | null;
}

@Injectable()
export class RuntimeService {
  private static readonly VANILLA_MANIFEST_URL =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>();
  private readonly lastErrorByServer = new Map<string, string>();
  private readonly runtimeRoot = process.env.MINEPANEL_RUNTIME_DIR
    ? path.resolve(process.env.MINEPANEL_RUNTIME_DIR)
    : path.resolve(process.cwd(), "..", "..", "runtime-data");

  async provision(server: RuntimeServerDefinition): Promise<RuntimeServerInfo> {
    const info = await this.getRuntimeInfo(server.id);
    await fs.mkdir(info.serverDir, { recursive: true });
    await fs.mkdir(path.dirname(info.logFile), { recursive: true });

    await fs.writeFile(path.join(info.serverDir, "eula.txt"), `eula=${server.eulaAccepted}\n`, "utf8");
    await fs.writeFile(path.join(info.serverDir, "server.properties"), this.buildServerProperties(server), "utf8");
    await fs.appendFile(info.logFile, "", "utf8");

    return this.getRuntimeInfo(server.id);
  }

  async start(server: RuntimeServerDefinition): Promise<void> {
    await this.provision(server);

    const existing = this.processes.get(server.id);
    if (existing && !existing.killed) {
      return;
    }

    await this.ensureServerJar(server);
    this.assertJavaCompatible(server.mcVersion);
    this.lastErrorByServer.delete(server.id);

    const info = await this.getRuntimeInfo(server.id);
    if (!info.jarExists) {
      throw new Error(
        `No server.jar found at ${info.jarPath}. Add a jar there or set MINEPANEL_SERVER_JAR in environment.`
      );
    }

    const args = [
      `-Xms${server.memoryMinMb}M`,
      `-Xmx${server.memoryMaxMb}M`,
      "-jar",
      info.jarPath,
      "nogui"
    ];

    const child = spawn("java", args, {
      cwd: info.serverDir,
      stdio: "pipe"
    });

    this.processes.set(server.id, child);
    await this.appendLog(server.id, `[minepanel] starting server pid=${child.pid ?? "unknown"}\n`);

    child.stdout.on("data", async (chunk: Buffer) => {
      await this.appendLog(server.id, chunk.toString("utf8"));
    });

    child.stderr.on("data", async (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      this.captureLastErrorLine(server.id, text);
      await this.appendLog(server.id, text);
    });

    child.on("close", async (code) => {
      this.processes.delete(server.id);
      if (code !== 0 && !this.lastErrorByServer.has(server.id)) {
        this.lastErrorByServer.set(server.id, `process exited with code ${String(code)}`);
      }
      await this.appendLog(server.id, `[minepanel] process exited with code ${String(code)}\n`);
    });

    child.on("error", async (error: Error) => {
      this.processes.delete(server.id);
      this.lastErrorByServer.set(server.id, error.message);
      await this.appendLog(server.id, `[minepanel] process error: ${error.message}\n`);
    });

    await this.assertProcessStillRunning(server.id, child);
  }

  async stop(serverId: string): Promise<void> {
    const child = this.processes.get(serverId);
    if (!child) {
      return;
    }

    try {
      await this.appendLog(serverId, "[minepanel] > stop\n");
      await this.writeCommand(child, "stop");
    } catch (error: unknown) {
      await this.appendLog(
        serverId,
        `[minepanel] failed to send stop command: ${error instanceof Error ? error.message : "unknown error"}\n`
      );
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGTERM");
        }
        resolve();
      }, 10_000);

      child.once("close", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.lastErrorByServer.delete(serverId);
  }

  async sendCommand(serverId: string, command: string): Promise<void> {
    const child = this.processes.get(serverId);
    if (!child || child.killed || child.stdin.destroyed) {
      throw new Error("Server is not running");
    }

    const sanitizedCommand = this.sanitizeCommand(command);
    await this.appendLog(serverId, `[minepanel] > ${sanitizedCommand}\n`);
    await this.writeCommand(child, sanitizedCommand);
  }

  async getRuntimeInfo(serverId: string): Promise<RuntimeServerInfo> {
    const serverDir = path.join(this.runtimeRoot, "servers", serverId);
    const logFile = path.join(serverDir, "logs", "latest.log");
    const jarPath = process.env.MINEPANEL_SERVER_JAR
      ? path.resolve(process.env.MINEPANEL_SERVER_JAR)
      : path.join(serverDir, "server.jar");

    const jarExists = await this.fileExists(jarPath);
    const processRef = this.processes.get(serverId);

    return {
      serverDir,
      logFile,
      jarPath,
      jarExists,
      running: Boolean(processRef && !processRef.killed),
      pid: processRef?.pid ?? null
    };
  }

  async getLogs(serverId: string, lines = 100): Promise<string[]> {
    const info = await this.getRuntimeInfo(serverId);
    const hasLog = await this.fileExists(info.logFile);
    if (!hasLog) {
      return [];
    }

    const raw = await fs.readFile(info.logFile, "utf8");
    return raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .slice(-Math.max(1, Math.min(lines, 1000)));
  }

  async getServerProperties(serverId: string): Promise<Record<string, string>> {
    const propertiesPath = this.getServerPropertiesPath(serverId);
    const hasFile = await this.fileExists(propertiesPath);
    if (!hasFile) {
      throw new Error("server.properties file not found");
    }

    const raw = await fs.readFile(propertiesPath, "utf8");
    return this.parseProperties(raw);
  }

  async updateServerProperties(
    serverId: string,
    updates: Record<string, string>
  ): Promise<{ properties: Record<string, string>; changedKeys: string[] }> {
    const current = await this.getServerProperties(serverId);
    const next = { ...current };
    const changedKeys: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (next[key] !== value) {
        next[key] = value;
        changedKeys.push(key);
      }
    }

    if (changedKeys.length > 0) {
      const propertiesPath = this.getServerPropertiesPath(serverId);
      await fs.writeFile(propertiesPath, this.serializeProperties(next), "utf8");
    }

    return {
      properties: next,
      changedKeys
    };
  }

  private buildServerProperties(server: RuntimeServerDefinition): string {
    return [
      `server-port=${server.port}`,
      "motd=MinePanel Managed Server",
      "enable-command-block=false",
      "white-list=false",
      "online-mode=true",
      "difficulty=normal",
      "gamemode=survival",
      "max-players=20",
      `level-name=${server.name.replace(/\s+/g, "_")}`
    ].join("\n");
  }

  private getServerPropertiesPath(serverId: string): string {
    return path.join(this.runtimeRoot, "servers", serverId, "server.properties");
  }

  private parseProperties(raw: string): Record<string, string> {
    const parsed: Record<string, string> = {};

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (!key) {
        continue;
      }

      parsed[key] = value;
    }

    return parsed;
  }

  private serializeProperties(properties: Record<string, string>): string {
    return `${Object.entries(properties)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`;
  }

  private async ensureServerJar(server: RuntimeServerDefinition): Promise<void> {
    const info = await this.getRuntimeInfo(server.id);
    if (info.jarExists) {
      return;
    }

    if (process.env.MINEPANEL_SERVER_JAR) {
      throw new Error(`MINEPANEL_SERVER_JAR points to missing file: ${info.jarPath}`);
    }

    if (server.kind !== "vanilla") {
      throw new Error(`Automatic install is only enabled for Vanilla right now (received: ${server.kind})`);
    }

    await this.appendLog(server.id, `[minepanel] downloading vanilla ${server.mcVersion}\n`);
    const downloadUrl = await this.getVanillaServerDownloadUrl(server.mcVersion);
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`Failed to download server jar (${response.status})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(info.jarPath, buffer);
    await this.appendLog(server.id, `[minepanel] vanilla jar saved at ${info.jarPath}\n`);
  }

  private assertJavaCompatible(mcVersion: string): void {
    const requiredVersion = this.getRequiredJavaMajor(mcVersion);
    const detectedVersion = this.getInstalledJavaMajor();

    if (detectedVersion === null) {
      throw new Error(
        `Java ${requiredVersion}+ is required for Minecraft ${mcVersion}, but Java was not found in PATH.`
      );
    }

    if (detectedVersion < requiredVersion) {
      throw new Error(
        `Java ${requiredVersion}+ is required for Minecraft ${mcVersion}. Detected Java ${detectedVersion}.`
      );
    }
  }

  private getInstalledJavaMajor(): number | null {
    const result = spawnSync("java", ["-version"], {
      encoding: "utf8"
    });

    if (result.error) {
      return null;
    }

    const versionOutput = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
    const match = versionOutput.match(/version\s+"([^"]+)"/i);
    if (!match) {
      return null;
    }

    return this.parseJavaMajor(match[1]);
  }

  private parseJavaMajor(rawVersion: string): number | null {
    const clean = rawVersion.trim();
    if (!clean) {
      return null;
    }

    if (clean.startsWith("1.")) {
      const legacy = Number(clean.split(".")[1]);
      return Number.isFinite(legacy) ? legacy : null;
    }

    const modern = Number(clean.split(".")[0]);
    return Number.isFinite(modern) ? modern : null;
  }

  private getRequiredJavaMajor(mcVersion: string): number {
    const parts = mcVersion.split(".").map((part) => Number(part));
    const major = parts[0] ?? 0;
    const minor = parts[1] ?? 0;
    const patch = parts[2] ?? 0;

    if (major > 1) {
      return 21;
    }

    if (minor >= 21) {
      return 21;
    }

    if (minor === 20 && patch >= 5) {
      return 21;
    }

    if (minor >= 18) {
      return 17;
    }

    if (minor === 17) {
      return 16;
    }

    return 8;
  }

  private async assertProcessStillRunning(
    serverId: string,
    child: ChildProcessWithoutNullStreams
  ): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 1500);
    });

    if (child.exitCode !== null || !this.processes.has(serverId) || child.killed) {
      const reason = this.lastErrorByServer.get(serverId);
      throw new Error(reason ? `Minecraft process exited during startup: ${reason}` : "Minecraft process exited during startup");
    }
  }

  private captureLastErrorLine(serverId: string, chunk: string): void {
    const lastLine = chunk
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .at(-1);

    if (lastLine) {
      this.lastErrorByServer.set(serverId, lastLine);
    }
  }

  private async getVanillaServerDownloadUrl(version: string): Promise<string> {
    const manifestResponse = await fetch(RuntimeService.VANILLA_MANIFEST_URL);
    if (!manifestResponse.ok) {
      throw new Error(`Could not fetch Mojang manifest (${manifestResponse.status})`);
    }

    const manifestJson = (await manifestResponse.json()) as {
      versions: Array<{ id: string; url: string }>;
    };

    const versionEntry = manifestJson.versions.find((entry) => entry.id === version);
    if (!versionEntry) {
      throw new Error(`Vanilla version not found: ${version}`);
    }

    const versionResponse = await fetch(versionEntry.url);
    if (!versionResponse.ok) {
      throw new Error(`Could not fetch version metadata (${versionResponse.status})`);
    }

    const versionJson = (await versionResponse.json()) as {
      downloads?: { server?: { url?: string } };
    };

    const serverUrl = versionJson.downloads?.server?.url;
    if (!serverUrl) {
      throw new Error(`No server download available for version ${version}`);
    }

    return serverUrl;
  }

  private async appendLog(serverId: string, content: string): Promise<void> {
    const info = await this.getRuntimeInfo(serverId);
    await fs.mkdir(path.dirname(info.logFile), { recursive: true });
    await fs.appendFile(info.logFile, content, "utf8");
  }

  private async writeCommand(child: ChildProcessWithoutNullStreams, command: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      child.stdin.write(`${command}\n`, (error: Error | null | undefined) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private sanitizeCommand(command: string): string {
    const normalized = command.replace(/[\r\n]+/g, " ").trim();
    if (!normalized) {
      throw new Error("Command is required");
    }

    return normalized;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
