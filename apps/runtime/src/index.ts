import type {
  CommandBus,
  NodeProvider,
  NodeTelemetry,
  ServerStatus
} from "@minepanel/contracts";

export class LocalNodeProvider implements NodeProvider, NodeTelemetry {
  private readonly statuses = new Map<string, ServerStatus>();

  async start(serverId: string): Promise<void> {
    this.statuses.set(serverId, "running");
  }

  async stop(serverId: string): Promise<void> {
    this.statuses.set(serverId, "stopped");
  }

  async getServerStatus(serverId: string): Promise<ServerStatus> {
    return this.statuses.get(serverId) ?? "stopped";
  }
}

export class InProcessCommandBus implements CommandBus {
  async dispatch<TPayload>(_command: string, _payload: TPayload): Promise<void> {
    return;
  }
}
