# MinePanel

## Identity
- **Type**: Single project (scaffolded MVP in progress)
- **Stack (approved)**: Next.js + TypeScript backend (Fastify/Nest over Fastify) + Prisma + PostgreSQL
- **Architecture**: A now (single host), B-ready (future nodes + agents)

## Current Status
- Monorepo scaffold created (`apps/web`, `apps/api`, `apps/runtime`, `packages/*`, `infra/docker`).
- Auth base (`/api/auth/login|logout|me`) and server CRUD básico (`create`, `start`, `stop`) implemented.
- Runtime local is real (carpetas, logs, proceso Java).
- Auto-download enabled for **Vanilla** jar via Mojang manifest when `server.jar` is missing.
- UI includes runtime/log inspection per server.

## Commands (daily)
```bash
git status
git diff
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
```

## Runtime bootstrap
```bash
docker compose -f infra/docker/docker-compose.yml up -d
pnpm db:push
pnpm db:seed
```

## Universal Rules
- Respect the selected architecture: local-first runtime with `node_id=local` in MVP.
- Keep backend contracts ready for future agents (`NodeProvider`, `NodeTelemetry`, `CommandBus`).
- Do not mix runtime execution details directly into UI layer.
- Never commit secrets/tokens/keys.

## Security
- Keep secrets in local env files, never in tracked files.
- Redact player/admin sensitive values from logs.
- For file operations, enforce server directory sandbox boundaries.

## Runtime Notes
- `runtime-data/servers/<server_id>/` is the local runtime root.
- `server.jar` path can be overridden with `MINEPANEL_SERVER_JAR`.
- Java compatibility is enforced before start (e.g. MC `1.21.x` requires Java 21+).

## Directory Map
- `docs/START-HERE.md` → reading order
- `docs/prd/prd-mvp.md` → MVP scope and requirements
- `docs/architecture/architecture-a-now-b-ready.md` → technical architecture + stack
- `docs/backlog/epics-and-stories.md` → epics and stories
- `docs/data/data-model-v0.md` → initial data model
- `docs/repo/folder-architecture.md` → target repo structure

## Quick Find
```bash
rg -n "Stack aprobado|Next\.js|Fastify|NestJS" docs
rg -n "NodeProvider|NodeTelemetry|CommandBus" docs
rg -n "Épica|Historia|Criterios de aceptación" docs/backlog
rg -n "node_id|servers|backups|audits" docs/data
```

## Pre-PR Checklist
```bash
pnpm typecheck && pnpm lint && pnpm test
```
