import { Body, Controller, Get, Inject, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { SessionUser } from "../auth/session-user.interface";
import { ServersService } from "./servers.service";
import type {
  CreateServerBody,
  SendServerCommandBody,
  UpdateServerPropertiesBody
} from "./servers.types";

@UseGuards(JwtAuthGuard)
@Controller("servers")
export class ServersController {
  constructor(@Inject(ServersService) private readonly serversService: ServersService) {}

  @Get()
  async list() {
    return this.serversService.list();
  }

  @Post()
  async create(@Body() body: CreateServerBody, @CurrentUser() user: SessionUser) {
    return this.serversService.create(body, user.id);
  }

  @Post(":id/start")
  async start(@Param("id") id: string, @CurrentUser() user: SessionUser) {
    return this.serversService.start(id, user.id);
  }

  @Post(":id/stop")
  async stop(@Param("id") id: string, @CurrentUser() user: SessionUser) {
    return this.serversService.stop(id, user.id);
  }

  @Post(":id/commands")
  async sendCommand(
    @Param("id") id: string,
    @Body() body: SendServerCommandBody,
    @CurrentUser() user: SessionUser
  ) {
    return this.serversService.sendCommand(id, body.command, user.id);
  }

  @Get(":id/commands/history")
  async commandHistory(
    @Param("id") id: string,
    @Query("limit") limit?: string
  ): Promise<Array<{ id: string; command: string; createdAt: string }>> {
    const parsedLimit = Number(limit ?? "12");
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 12;
    return this.serversService.getCommandHistory(id, safeLimit);
  }

  @Get(":id/properties")
  async properties(@Param("id") id: string) {
    return this.serversService.getServerProperties(id);
  }

  @Put(":id/properties")
  async updateProperties(
    @Param("id") id: string,
    @Body() body: UpdateServerPropertiesBody,
    @CurrentUser() user: SessionUser
  ) {
    return this.serversService.updateServerProperties(id, body, user.id);
  }

  @Get(":id/runtime")
  async runtime(@Param("id") id: string) {
    return this.serversService.getRuntimeInfo(id);
  }

  @Get(":id/logs")
  async logs(@Param("id") id: string, @Query("lines") lines?: string) {
    const parsedLines = Number(lines ?? "100");
    const safeLines = Number.isFinite(parsedLines) ? parsedLines : 100;
    return this.serversService.getLogs(id, safeLines);
  }
}
