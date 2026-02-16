import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { FastifyRequest } from "fastify";
import type { SessionUser } from "./session-user.interface";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      FastifyRequest & {
        cookies?: Record<string, string>;
        user?: SessionUser;
      }
    >();

    const token = request.cookies?.mp_session;
    if (!token) {
      throw new UnauthorizedException("Missing session");
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string; role: SessionUser["role"] }>(
        token,
        {
          secret: this.configService.get<string>("JWT_SECRET") ?? "change-me"
        }
      );

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role
      };

      return true;
    } catch {
      throw new UnauthorizedException("Invalid session");
    }
  }
}
