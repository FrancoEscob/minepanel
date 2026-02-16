export type ServerKind = "vanilla" | "paper";

export type ServerStatus =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "error";

export interface CreateServerInput {
  name: string;
  kind: ServerKind;
  mcVersion: string;
  memoryMinMb: number;
  memoryMaxMb: number;
  port: number;
  eulaAccepted: boolean;
}

export interface SendServerCommandInput {
  command: string;
}

export type ServerDifficulty = "peaceful" | "easy" | "normal" | "hard";

export type ServerGamemode = "survival" | "creative" | "adventure" | "spectator";

export interface ServerPropertiesInput {
  motd: string;
  difficulty: ServerDifficulty;
  gamemode: ServerGamemode;
  whiteList: boolean;
  maxPlayers: number;
}

export interface ServerPropertiesUpdateResult {
  properties: ServerPropertiesInput;
  changedKeys: string[];
  restartRequired: boolean;
}

export interface NodeProvider {
  start(serverId: string): Promise<void>;
  stop(serverId: string): Promise<void>;
}

export interface NodeTelemetry {
  getServerStatus(serverId: string): Promise<ServerStatus>;
}

export interface CommandBus {
  dispatch<TPayload>(command: string, payload: TPayload): Promise<void>;
}
