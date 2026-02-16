import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import type { ServerPropertiesInput, ServerPropertiesUpdateResult } from "@minepanel/contracts";
import { NODE_LOCAL_ID } from "@minepanel/domain";
import { Prisma, type Server, ServerKind, ServerStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RuntimeService, type RuntimeServerDefinition } from "../runtime/runtime.service";
import type { CreateServerBody, UpdateServerPropertiesBody } from "./servers.types";

interface ServerCommandHistoryItem {
  id: string;
  command: string;
  createdAt: string;
}

type ServerPropertiesMap = Record<string, string>;

const DIFFICULTY_VALUES = ["peaceful", "easy", "normal", "hard"] as const;
const GAMEMODE_VALUES = ["survival", "creative", "adventure", "spectator"] as const;

@Injectable()
export class ServersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RuntimeService) private readonly runtimeService: RuntimeService
  ) {}

  async list() {
    return this.prisma.server.findMany({
      orderBy: { createdAt: "desc" }
    });
  }

  async create(payload: CreateServerBody, userId: string) {
    this.validateCreatePayload(payload);

    await this.prisma.node.upsert({
      where: { id: NODE_LOCAL_ID },
      update: { status: "healthy" },
      create: {
        id: NODE_LOCAL_ID,
        name: "Local Node",
        type: "local",
        status: "healthy"
      }
    });

    try {
      const server = await this.prisma.server.create({
        data: {
          nodeId: NODE_LOCAL_ID,
          name: payload.name,
          kind: payload.kind as ServerKind,
          mcVersion: payload.mcVersion,
          memoryMinMb: payload.memoryMinMb,
          memoryMaxMb: payload.memoryMaxMb,
          port: payload.port,
          eulaAccepted: payload.eulaAccepted,
          status: ServerStatus.stopped
        }
      });

      await this.runtimeService.provision(this.toRuntimeDefinition(server));

      await this.writeAudit(userId, server.id, "server.create", server.name, {
        kind: server.kind,
        version: server.mcVersion,
        port: server.port
      });

      return server;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Server name or port already exists on local node");
      }

      throw new InternalServerErrorException("Could not create server");
    }
  }

  async start(serverId: string, userId: string) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new NotFoundException("Server not found");
    }

    await this.prisma.server.update({
      where: { id: serverId },
      data: { status: ServerStatus.starting }
    });

    try {
      await this.runtimeService.start(this.toRuntimeDefinition(server));
    } catch (error: unknown) {
      await this.prisma.server.update({
        where: { id: serverId },
        data: { status: ServerStatus.error }
      });

      throw new BadRequestException(
        error instanceof Error ? error.message : "Could not start server runtime"
      );
    }

    const updated = await this.prisma.server.update({
      where: { id: serverId },
      data: { status: ServerStatus.running }
    });

    await this.writeAudit(userId, serverId, "server.start", server.name, null);
    return updated;
  }

  async stop(serverId: string, userId: string) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new NotFoundException("Server not found");
    }

    await this.prisma.server.update({
      where: { id: serverId },
      data: { status: ServerStatus.stopping }
    });

    await this.runtimeService.stop(serverId);

    const updated = await this.prisma.server.update({
      where: { id: serverId },
      data: { status: ServerStatus.stopped }
    });

    await this.writeAudit(userId, serverId, "server.stop", server.name, null);
    return updated;
  }

  async sendCommand(serverId: string, command: string, userId: string) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new NotFoundException("Server not found");
    }

    const normalizedCommand = command.replace(/[\r\n]+/g, " ").trim();
    if (!normalizedCommand) {
      throw new BadRequestException("command is required");
    }

    if (normalizedCommand.toLowerCase() === "stop") {
      return this.stop(serverId, userId);
    }

    try {
      await this.runtimeService.sendCommand(serverId, normalizedCommand);
    } catch (error: unknown) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Could not send command to server process"
      );
    }

    await this.writeAudit(userId, serverId, "server.command", server.name, {
      command: normalizedCommand
    });

    return this.prisma.server.findUniqueOrThrow({ where: { id: serverId } });
  }

  async getCommandHistory(serverId: string, limit = 12): Promise<ServerCommandHistoryItem[]> {
    await this.requireServer(serverId);

    const safeLimit = Math.max(1, Math.min(limit, 50));
    const audits = await this.prisma.audit.findMany({
      where: {
        serverId,
        action: { in: ["server.command", "server.stop"] }
      },
      orderBy: { createdAt: "desc" },
      take: safeLimit
    });

    return audits
      .map((audit) => {
        const command = this.getCommandFromAudit(audit.action, audit.metadata);
        if (!command) {
          return null;
        }

        return {
          id: audit.id,
          command,
          createdAt: audit.createdAt.toISOString()
        };
      })
      .filter((item): item is ServerCommandHistoryItem => item !== null);
  }

  async getServerProperties(serverId: string): Promise<ServerPropertiesInput> {
    await this.requireServer(serverId);
    const rawProperties = await this.runtimeService.getServerProperties(serverId);
    return this.normalizeServerProperties(rawProperties);
  }

  async updateServerProperties(
    serverId: string,
    payload: UpdateServerPropertiesBody,
    userId: string
  ): Promise<ServerPropertiesUpdateResult> {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new NotFoundException("Server not found");
    }

    const normalized = this.validateAndNormalizeServerProperties(payload);

    const { properties, changedKeys } = await this.runtimeService.updateServerProperties(serverId, {
      motd: normalized.motd,
      difficulty: normalized.difficulty,
      gamemode: normalized.gamemode,
      "white-list": normalized.whiteList ? "true" : "false",
      "max-players": String(normalized.maxPlayers)
    });

    if (changedKeys.length > 0) {
      await this.writeAudit(userId, serverId, "server.properties.update", server.name, {
        changedKeys
      });
    }

    const runtime = await this.runtimeService.getRuntimeInfo(serverId);

    return {
      properties: this.normalizeServerProperties(properties),
      changedKeys,
      restartRequired: runtime.running && changedKeys.length > 0
    };
  }

  async getRuntimeInfo(serverId: string) {
    await this.requireServer(serverId);
    return this.runtimeService.getRuntimeInfo(serverId);
  }

  async getLogs(serverId: string, lines = 100) {
    await this.requireServer(serverId);
    return this.runtimeService.getLogs(serverId, lines);
  }

  private getCommandFromAudit(action: string, metadata: Prisma.JsonValue | null): string | null {
    if (action === "server.stop") {
      return "stop";
    }

    if (action !== "server.command" || !metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return null;
    }

    const command = (metadata as Prisma.JsonObject).command;
    return typeof command === "string" && command.trim().length > 0 ? command : null;
  }

  private normalizeServerProperties(properties: ServerPropertiesMap): ServerPropertiesInput {
    return {
      motd: this.normalizeMotd(properties.motd),
      difficulty: this.parseDifficulty(properties.difficulty),
      gamemode: this.parseGamemode(properties.gamemode),
      whiteList: this.parseBoolean(properties["white-list"], false),
      maxPlayers: this.parseBoundedInteger(properties["max-players"], 20)
    };
  }

  private validateAndNormalizeServerProperties(
    payload: UpdateServerPropertiesBody
  ): ServerPropertiesInput {
    if (typeof payload.motd !== "string" || !payload.motd.trim()) {
      throw new BadRequestException("motd is required");
    }

    const motd = payload.motd.trim();

    if (motd.length > 120) {
      throw new BadRequestException("motd must be at most 120 characters");
    }

    if (typeof payload.whiteList !== "boolean") {
      throw new BadRequestException("whiteList must be a boolean");
    }

    const maxPlayers = Number(payload.maxPlayers);
    if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 200) {
      throw new BadRequestException("maxPlayers must be an integer between 1 and 200");
    }

    return {
      motd,
      difficulty: this.parseDifficulty(payload.difficulty, true),
      gamemode: this.parseGamemode(payload.gamemode, true),
      whiteList: payload.whiteList,
      maxPlayers
    };
  }

  private normalizeMotd(value: unknown): string {
    if (typeof value !== "string") {
      return "MinePanel Managed Server";
    }

    const normalized = value.trim();
    return normalized || "MinePanel Managed Server";
  }

  private parseDifficulty(
    value: unknown,
    strict = false
  ): ServerPropertiesInput["difficulty"] {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if ((DIFFICULTY_VALUES as readonly string[]).includes(normalized)) {
        return normalized as ServerPropertiesInput["difficulty"];
      }
    }

    if (strict) {
      throw new BadRequestException("difficulty must be peaceful, easy, normal or hard");
    }

    return "normal";
  }

  private parseGamemode(value: unknown, strict = false): ServerPropertiesInput["gamemode"] {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if ((GAMEMODE_VALUES as readonly string[]).includes(normalized)) {
        return normalized as ServerPropertiesInput["gamemode"];
      }
    }

    if (strict) {
      throw new BadRequestException(
        "gamemode must be survival, creative, adventure or spectator"
      );
    }

    return "survival";
  }

  private parseBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }

      if (normalized === "false") {
        return false;
      }
    }

    return fallback;
  }

  private parseBoundedInteger(value: unknown, fallback: number): number {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
      return fallback;
    }

    return parsed;
  }

  private validateCreatePayload(payload: CreateServerBody) {
    if (!payload.name?.trim()) {
      throw new BadRequestException("name is required");
    }

    if (!["vanilla", "paper"].includes(payload.kind)) {
      throw new BadRequestException("kind must be vanilla or paper");
    }

    if (!payload.mcVersion?.trim()) {
      throw new BadRequestException("mcVersion is required");
    }

    if (!Number.isInteger(payload.memoryMinMb) || payload.memoryMinMb < 512) {
      throw new BadRequestException("memoryMinMb must be an integer >= 512");
    }

    if (!Number.isInteger(payload.memoryMaxMb) || payload.memoryMaxMb < payload.memoryMinMb) {
      throw new BadRequestException("memoryMaxMb must be an integer >= memoryMinMb");
    }

    if (!Number.isInteger(payload.port) || payload.port < 1024 || payload.port > 65535) {
      throw new BadRequestException("port must be between 1024 and 65535");
    }

    if (payload.eulaAccepted !== true) {
      throw new BadRequestException("EULA must be accepted");
    }
  }

  private async writeAudit(
    userId: string,
    serverId: string,
    action: string,
    target: string,
    metadata: Prisma.JsonValue | null
  ) {
    await this.prisma.audit.create({
      data: {
        userId,
        serverId,
        action,
        target,
        metadata: metadata ?? undefined
      }
    });
  }

  private toRuntimeDefinition(server: Server): RuntimeServerDefinition {
    return {
      id: server.id,
      name: server.name,
      kind: server.kind,
      mcVersion: server.mcVersion,
      port: server.port,
      memoryMinMb: server.memoryMinMb,
      memoryMaxMb: server.memoryMaxMb,
      eulaAccepted: server.eulaAccepted
    };
  }

  private async requireServer(serverId: string): Promise<void> {
    const server = await this.prisma.server.findUnique({ where: { id: serverId }, select: { id: true } });
    if (!server) {
      throw new NotFoundException("Server not found");
    }
  }
}
