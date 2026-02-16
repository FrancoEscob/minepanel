import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RuntimeModule } from "./runtime/runtime.module";
import { ServersModule } from "./servers/servers.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RuntimeModule,
    AuthModule,
    ServersModule
  ]
})
export class AppModule {}
