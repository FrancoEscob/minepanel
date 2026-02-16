import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { CurrentUser } from "./current-user.decorator";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { SessionUser } from "./session-user.interface";

interface LoginBody {
  email: string;
  password: string;
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: LoginBody, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = await this.authService.login(body.email, body.password);

    reply.setCookie("mp_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });

    return { ok: true };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie("mp_session", { path: "/" });
    return { ok: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: SessionUser) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.authService.me(user.id);
  }
}
