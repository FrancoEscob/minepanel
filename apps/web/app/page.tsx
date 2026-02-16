"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ServerStatus = "stopped" | "starting" | "running" | "stopping" | "error";

interface SessionUser {
  id: string;
  email: string;
  role: "owner" | "admin" | "viewer";
}

interface ServerItem {
  id: string;
  name: string;
  kind: "vanilla" | "paper";
  mcVersion: string;
  status: ServerStatus;
  port: number;
}

interface RuntimeInfo {
  serverDir: string;
  logFile: string;
  jarPath: string;
  jarExists: boolean;
  running: boolean;
  pid: number | null;
}

interface CommandHistoryItem {
  id: string;
  command: string;
  createdAt: string;
}

type ServerDifficulty = "peaceful" | "easy" | "normal" | "hard";
type ServerGamemode = "survival" | "creative" | "adventure" | "spectator";

interface ServerPropertiesInput {
  motd: string;
  difficulty: ServerDifficulty;
  gamemode: ServerGamemode;
  whiteList: boolean;
  maxPlayers: number;
}

interface ServerPropertiesUpdateResult {
  properties: ServerPropertiesInput;
  changedKeys: string[];
  restartRequired: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const DEFAULT_SERVER_PROPERTIES: ServerPropertiesInput = {
  motd: "MinePanel Managed Server",
  difficulty: "normal",
  gamemode: "survival",
  whiteList: false,
  maxPlayers: 20
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null;

  const response = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    credentials: "include",
    headers: hasBody
      ? {
          "Content-Type": "application/json",
          ...(init?.headers ?? {})
        }
      : init?.headers
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function formatHistoryTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "sin hora";
  }

  return parsed.toLocaleTimeString();
}

export default function HomePage() {
  const [email, setEmail] = useState("owner@minepanel.local");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [runtimeByServer, setRuntimeByServer] = useState<Record<string, RuntimeInfo>>({});
  const [logsByServer, setLogsByServer] = useState<Record<string, string[]>>({});
  const [commandHistoryByServer, setCommandHistoryByServer] = useState<Record<string, CommandHistoryItem[]>>({});
  const [consoleOpenByServer, setConsoleOpenByServer] = useState<Record<string, boolean>>({});
  const [loadingConsoleByServer, setLoadingConsoleByServer] = useState<Record<string, boolean>>({});
  const [consoleErrorByServer, setConsoleErrorByServer] = useState<Record<string, string | null>>({});
  const [commandInputByServer, setCommandInputByServer] = useState<Record<string, string>>({});
  const [sendingCommandByServer, setSendingCommandByServer] = useState<Record<string, boolean>>({});
  const [serverPropertiesByServer, setServerPropertiesByServer] = useState<
    Record<string, ServerPropertiesInput>
  >({});
  const [loadingPropertiesByServer, setLoadingPropertiesByServer] = useState<Record<string, boolean>>({});
  const [savingPropertiesByServer, setSavingPropertiesByServer] = useState<Record<string, boolean>>({});
  const [propertiesErrorByServer, setPropertiesErrorByServer] = useState<Record<string, string | null>>({});
  const [propertiesNoticeByServer, setPropertiesNoticeByServer] = useState<Record<string, string | null>>({});
  const [message, setMessage] = useState<string>("");

  const [name, setName] = useState("Survival");
  const [kind, setKind] = useState<"vanilla" | "paper">("paper");
  const [mcVersion, setMcVersion] = useState("1.21.1");
  const [memoryMinMb, setMemoryMinMb] = useState(1024);
  const [memoryMaxMb, setMemoryMaxMb] = useState(2048);
  const [port, setPort] = useState(25565);
  const [eulaAccepted, setEulaAccepted] = useState(true);

  const isLoggedIn = useMemo(() => Boolean(user), [user]);

  const loadServers = useCallback(async () => {
    const data = await apiRequest<ServerItem[]>("/servers", { method: "GET" });
    setServers(data);
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const currentUser = await apiRequest<SessionUser>("/auth/me", { method: "GET" });
      setUser(currentUser);
      await loadServers();
    } catch {
      setUser(null);
    }
  }, [loadServers]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const loadConsole = useCallback(async (serverId: string, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoadingConsoleByServer((prev) => ({ ...prev, [serverId]: true }));
    }

    setConsoleErrorByServer((prev) => ({ ...prev, [serverId]: null }));

    try {
      const [runtime, logs, commandHistory] = await Promise.all([
        apiRequest<RuntimeInfo>(`/servers/${serverId}/runtime`, { method: "GET" }),
        apiRequest<string[]>(`/servers/${serverId}/logs?lines=120`, { method: "GET" }),
        apiRequest<CommandHistoryItem[]>(`/servers/${serverId}/commands/history?limit=12`, {
          method: "GET"
        })
      ]);

      setRuntimeByServer((prev) => ({ ...prev, [serverId]: runtime }));
      setLogsByServer((prev) => ({ ...prev, [serverId]: logs }));
      setCommandHistoryByServer((prev) => ({ ...prev, [serverId]: commandHistory }));
    } catch (error: unknown) {
      setConsoleErrorByServer((prev) => ({
        ...prev,
        [serverId]: error instanceof Error ? error.message : "No se pudo cargar la consola"
      }));
    } finally {
      if (!silent) {
        setLoadingConsoleByServer((prev) => ({ ...prev, [serverId]: false }));
      }
    }
  }, []);

  const loadServerProperties = useCallback(async (serverId: string) => {
    setLoadingPropertiesByServer((prev) => ({ ...prev, [serverId]: true }));
    setPropertiesErrorByServer((prev) => ({ ...prev, [serverId]: null }));

    try {
      const properties = await apiRequest<ServerPropertiesInput>(`/servers/${serverId}/properties`, {
        method: "GET"
      });

      setServerPropertiesByServer((prev) => ({ ...prev, [serverId]: properties }));
      setPropertiesNoticeByServer((prev) => ({ ...prev, [serverId]: null }));
    } catch (error: unknown) {
      setPropertiesErrorByServer((prev) => ({
        ...prev,
        [serverId]: error instanceof Error ? error.message : "No se pudo cargar server.properties"
      }));
    } finally {
      setLoadingPropertiesByServer((prev) => ({ ...prev, [serverId]: false }));
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadServers();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLoggedIn, loadServers]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const openServerIds = Object.entries(consoleOpenByServer)
      .filter(([, isOpen]) => isOpen)
      .map(([serverId]) => serverId);

    if (openServerIds.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      for (const serverId of openServerIds) {
        void loadConsole(serverId, { silent: true });
      }
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [consoleOpenByServer, isLoggedIn, loadConsole]);

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      await apiRequest<{ ok: boolean }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setPassword("");
      await loadSession();
      setMessage("Sesión iniciada");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesión");
    }
  }

  async function onLogout() {
    await apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
    setUser(null);
    setServers([]);
    setRuntimeByServer({});
    setLogsByServer({});
    setCommandHistoryByServer({});
    setConsoleOpenByServer({});
    setLoadingConsoleByServer({});
    setConsoleErrorByServer({});
    setCommandInputByServer({});
    setSendingCommandByServer({});
    setServerPropertiesByServer({});
    setLoadingPropertiesByServer({});
    setSavingPropertiesByServer({});
    setPropertiesErrorByServer({});
    setPropertiesNoticeByServer({});
    setMessage("Sesión cerrada");
  }

  async function onCreateServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      await apiRequest<ServerItem>("/servers", {
        method: "POST",
        body: JSON.stringify({
          name,
          kind,
          mcVersion,
          memoryMinMb,
          memoryMaxMb,
          port,
          eulaAccepted
        })
      });

      await loadServers();
      setMessage("Servidor creado");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el servidor");
    }
  }

  async function onAction(serverId: string, action: "start" | "stop") {
    setMessage("");

    try {
      await apiRequest<ServerItem>(`/servers/${serverId}/${action}`, { method: "POST" });
      await loadServers();
      if (consoleOpenByServer[serverId]) {
        await loadConsole(serverId, { silent: true });
      }
      setMessage(`Servidor ${action === "start" ? "iniciado" : "detenido"}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo ejecutar la acción");
    }
  }

  async function onToggleConsole(serverId: string) {
    const isOpen = Boolean(consoleOpenByServer[serverId]);
    if (isOpen) {
      setConsoleOpenByServer((prev) => ({ ...prev, [serverId]: false }));
      return;
    }

    setConsoleOpenByServer((prev) => ({ ...prev, [serverId]: true }));
    await Promise.all([loadConsole(serverId), loadServerProperties(serverId)]);
  }

  async function onSendCommand(serverId: string, commandOverride?: string) {
    const command = (commandOverride ?? commandInputByServer[serverId] ?? "").trim();
    if (!command) {
      setMessage("Escribe un comando para enviar");
      return;
    }

    setMessage("");
    setSendingCommandByServer((prev) => ({ ...prev, [serverId]: true }));

    try {
      await apiRequest<ServerItem>(`/servers/${serverId}/commands`, {
        method: "POST",
        body: JSON.stringify({ command })
      });

      if (!commandOverride) {
        setCommandInputByServer((prev) => ({ ...prev, [serverId]: "" }));
      }

      await Promise.all([loadServers(), loadConsole(serverId, { silent: true })]);
      setMessage(`Comando enviado: ${command}`);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "No se pudo enviar el comando";
      setMessage(text);
      setConsoleErrorByServer((prev) => ({ ...prev, [serverId]: text }));
    } finally {
      setSendingCommandByServer((prev) => ({ ...prev, [serverId]: false }));
    }
  }

  function onServerPropertiesChange(serverId: string, partial: Partial<ServerPropertiesInput>) {
    setServerPropertiesByServer((prev) => ({
      ...prev,
      [serverId]: { ...(prev[serverId] ?? DEFAULT_SERVER_PROPERTIES), ...partial }
    }));
  }

  async function onSaveServerProperties(serverId: string) {
    const payload = serverPropertiesByServer[serverId] ?? DEFAULT_SERVER_PROPERTIES;

    setSavingPropertiesByServer((prev) => ({ ...prev, [serverId]: true }));
    setPropertiesErrorByServer((prev) => ({ ...prev, [serverId]: null }));
    setPropertiesNoticeByServer((prev) => ({ ...prev, [serverId]: null }));

    try {
      const result = await apiRequest<ServerPropertiesUpdateResult>(`/servers/${serverId}/properties`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      setServerPropertiesByServer((prev) => ({ ...prev, [serverId]: result.properties }));

      const notice =
        result.changedKeys.length === 0
          ? "Sin cambios en server.properties"
          : result.restartRequired
            ? "Propiedades guardadas. Reinicia el servidor para aplicar cambios"
            : "Propiedades guardadas";

      setPropertiesNoticeByServer((prev) => ({ ...prev, [serverId]: notice }));
      setMessage(notice);

      if (consoleOpenByServer[serverId]) {
        await loadConsole(serverId, { silent: true });
      }
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "No se pudo guardar server.properties";
      setPropertiesErrorByServer((prev) => ({ ...prev, [serverId]: text }));
      setMessage(text);
    } finally {
      setSavingPropertiesByServer((prev) => ({ ...prev, [serverId]: false }));
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1>MinePanel MVP</h1>
      <p>Stack: Next.js + NestJS/Fastify + Prisma/PostgreSQL</p>

      {message ? (
        <p style={{ padding: 10, background: "#e7f4ff", border: "1px solid #b5dbff" }}>{message}</p>
      ) : null}

      {!isLoggedIn ? (
        <section style={{ background: "#fff", padding: 16, borderRadius: 8 }}>
          <h2>Iniciar sesión</h2>
          <form onSubmit={onLogin} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
            />
            <button type="submit">Entrar</button>
          </form>
        </section>
      ) : (
        <>
          <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p>
              Sesión: <strong>{user?.email}</strong> ({user?.role})
            </p>
            <button onClick={onLogout}>Cerrar sesión</button>
          </section>

          <section style={{ background: "#fff", padding: 16, borderRadius: 8, marginTop: 16 }}>
            <h2>Crear servidor</h2>
            <form onSubmit={onCreateServer} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" />
              <select value={kind} onChange={(event) => setKind(event.target.value as "vanilla" | "paper") }>
                <option value="vanilla">Vanilla</option>
                <option value="paper">Paper</option>
              </select>

              <input
                value={mcVersion}
                onChange={(event) => setMcVersion(event.target.value)}
                placeholder="Versión MC"
              />
              <input
                type="number"
                value={port}
                onChange={(event) => setPort(Number(event.target.value))}
                placeholder="Puerto"
              />

              <input
                type="number"
                value={memoryMinMb}
                onChange={(event) => setMemoryMinMb(Number(event.target.value))}
                placeholder="RAM Min MB"
              />
              <input
                type="number"
                value={memoryMaxMb}
                onChange={(event) => setMemoryMaxMb(Number(event.target.value))}
                placeholder="RAM Max MB"
              />

              <label style={{ gridColumn: "1 / -1" }}>
                <input
                  type="checkbox"
                  checked={eulaAccepted}
                  onChange={(event) => setEulaAccepted(event.target.checked)}
                />{" "}
                Acepto EULA
              </label>

              <button type="submit" style={{ gridColumn: "1 / -1" }}>
                Crear servidor
              </button>
            </form>
          </section>

          <section style={{ background: "#fff", padding: 16, borderRadius: 8, marginTop: 16 }}>
            <h2>Servidores</h2>
            {servers.length === 0 ? <p>No hay servidores todavía.</p> : null}
            <div style={{ display: "grid", gap: 8 }}>
              {servers.map((server) => (
                <article
                  key={server.id}
                  style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, display: "grid", gap: 6 }}
                >
                  <strong>{server.name}</strong>
                  <span>
                    {server.kind} {server.mcVersion} · puerto {server.port}
                  </span>
                  <span>estado: {server.status}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => onAction(server.id, "start")}>Start</button>
                    <button onClick={() => onAction(server.id, "stop")}>Stop</button>
                    <button onClick={() => onToggleConsole(server.id)}>
                      {consoleOpenByServer[server.id] ? "Ocultar consola" : "Abrir consola realtime"}
                    </button>
                  </div>

                  {consoleOpenByServer[server.id] ? (
                    <div style={{ background: "#fafafa", border: "1px solid #e5e5e5", padding: 8, display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>Consola en tiempo real</strong>
                        <span style={{ fontSize: 12, color: "#555" }}>Auto-refresh: cada 2s</span>
                      </div>

                      {loadingConsoleByServer[server.id] && !runtimeByServer[server.id] ? <p>Cargando consola...</p> : null}

                      {consoleErrorByServer[server.id] ? (
                        <p style={{ margin: 0, color: "#b42318" }}>Error: {consoleErrorByServer[server.id]}</p>
                      ) : null}

                      {runtimeByServer[server.id] ? (
                        <div style={{ background: "#fff", border: "1px solid #e5e5e5", padding: 8 }}>
                          <div>carpeta: {runtimeByServer[server.id].serverDir}</div>
                          <div>jar: {runtimeByServer[server.id].jarPath}</div>
                          <div>jar disponible: {runtimeByServer[server.id].jarExists ? "sí" : "no"}</div>
                          <div>log: {runtimeByServer[server.id].logFile}</div>
                          <div>pid: {runtimeByServer[server.id].pid ?? "-"}</div>
                          <div>runtime activo: {runtimeByServer[server.id].running ? "sí" : "no"}</div>
                        </div>
                      ) : null}

                      {loadingPropertiesByServer[server.id] && !serverPropertiesByServer[server.id] ? (
                        <p style={{ margin: 0 }}>Cargando server.properties...</p>
                      ) : null}

                      {propertiesErrorByServer[server.id] ? (
                        <p style={{ margin: 0, color: "#b42318" }}>
                          Error properties: {propertiesErrorByServer[server.id]}
                        </p>
                      ) : null}

                      {serverPropertiesByServer[server.id] ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void onSaveServerProperties(server.id);
                          }}
                          style={{
                            background: "#fff",
                            border: "1px solid #e5e5e5",
                            padding: 8,
                            display: "grid",
                            gap: 8,
                            gridTemplateColumns: "1fr 1fr"
                          }}
                        >
                          <strong style={{ gridColumn: "1 / -1" }}>server.properties (básico)</strong>
                          <input
                            value={serverPropertiesByServer[server.id]?.motd ?? ""}
                            onChange={(event) => {
                              onServerPropertiesChange(server.id, { motd: event.target.value });
                            }}
                            placeholder="MOTD"
                            style={{ gridColumn: "1 / -1" }}
                          />

                          <select
                            value={serverPropertiesByServer[server.id]?.difficulty ?? "normal"}
                            onChange={(event) => {
                              onServerPropertiesChange(server.id, {
                                difficulty: event.target.value as ServerDifficulty
                              });
                            }}
                          >
                            <option value="peaceful">peaceful</option>
                            <option value="easy">easy</option>
                            <option value="normal">normal</option>
                            <option value="hard">hard</option>
                          </select>

                          <select
                            value={serverPropertiesByServer[server.id]?.gamemode ?? "survival"}
                            onChange={(event) => {
                              onServerPropertiesChange(server.id, {
                                gamemode: event.target.value as ServerGamemode
                              });
                            }}
                          >
                            <option value="survival">survival</option>
                            <option value="creative">creative</option>
                            <option value="adventure">adventure</option>
                            <option value="spectator">spectator</option>
                          </select>

                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={serverPropertiesByServer[server.id]?.maxPlayers ?? 20}
                            onChange={(event) => {
                              onServerPropertiesChange(server.id, {
                                maxPlayers: Number(event.target.value)
                              });
                            }}
                            placeholder="max-players"
                          />

                          <label>
                            <input
                              type="checkbox"
                              checked={serverPropertiesByServer[server.id]?.whiteList ?? false}
                              onChange={(event) => {
                                onServerPropertiesChange(server.id, {
                                  whiteList: event.target.checked
                                });
                              }}
                            />{" "}
                            white-list
                          </label>

                          <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
                            <button type="submit" disabled={savingPropertiesByServer[server.id]}>
                              {savingPropertiesByServer[server.id]
                                ? "Guardando..."
                                : "Guardar server.properties"}
                            </button>
                            <button
                              type="button"
                              disabled={loadingPropertiesByServer[server.id] || savingPropertiesByServer[server.id]}
                              onClick={() => {
                                void loadServerProperties(server.id);
                              }}
                            >
                              Recargar properties
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {propertiesNoticeByServer[server.id] ? (
                        <p style={{ margin: 0, color: "#016630" }}>{propertiesNoticeByServer[server.id]}</p>
                      ) : null}

                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void onSendCommand(server.id);
                        }}
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <input
                          value={commandInputByServer[server.id] ?? ""}
                          onChange={(event) =>
                            setCommandInputByServer((prev) => ({ ...prev, [server.id]: event.target.value }))
                          }
                          placeholder="Ej: say Hola a todos"
                          style={{ flex: 1, minWidth: 220 }}
                        />
                        <button type="submit" disabled={sendingCommandByServer[server.id]}>
                          {sendingCommandByServer[server.id] ? "Enviando..." : "Enviar comando"}
                        </button>
                        <button
                          type="button"
                          disabled={sendingCommandByServer[server.id]}
                          onClick={() => {
                            void onSendCommand(server.id, "say Hola desde MinePanel");
                          }}
                        >
                          say
                        </button>
                        <button
                          type="button"
                          disabled={sendingCommandByServer[server.id]}
                          onClick={() => {
                            void onSendCommand(server.id, "stop");
                          }}
                        >
                          stop
                        </button>
                        <button
                          type="button"
                          disabled={loadingConsoleByServer[server.id]}
                          onClick={() => {
                            void loadConsole(server.id);
                          }}
                        >
                          Refrescar ahora
                        </button>
                      </form>

                      {commandHistoryByServer[server.id]?.length ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          <strong style={{ fontSize: 13 }}>Historial reciente</strong>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {commandHistoryByServer[server.id].map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                disabled={sendingCommandByServer[server.id]}
                                onClick={() => {
                                  void onSendCommand(server.id, entry.command);
                                }}
                                style={{
                                  display: "grid",
                                  gap: 2,
                                  textAlign: "left",
                                  border: "1px solid #ddd",
                                  background: "#fff",
                                  borderRadius: 6,
                                  padding: "6px 8px"
                                }}
                                title={`Re-ejecutar: ${entry.command}`}
                              >
                                <span style={{ fontFamily: "monospace", fontSize: 12 }}>{entry.command}</span>
                                <span style={{ fontSize: 11, color: "#666" }}>
                                  {formatHistoryTime(entry.createdAt)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
                          Sin historial de comandos todavía.
                        </p>
                      )}

                      {logsByServer[server.id]?.length ? (
                        <pre
                          style={{
                            margin: 0,
                            maxHeight: 260,
                            overflow: "auto",
                            background: "#111",
                            color: "#c7f7c7",
                            padding: 8
                          }}
                        >
                          {logsByServer[server.id].join("\n")}
                        </pre>
                      ) : (
                        <p style={{ margin: 0 }}>Sin logs aún.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
