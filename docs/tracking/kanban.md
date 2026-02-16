# MinePanel Kanban

## To Do
- E4-H2: Gestión whitelist/ops/bans.
- E5-H1: Backups manuales y programados.
- E5-H2: Restore con validaciones.
- E6-H1: `node_id` en todos los flujos restantes.
- E6-H2: Completar contratos y telemetría base.
- UX-H1: Rediseño visual base (layout, jerarquía, tipografía, espaciado).
- UX-H2: Rework de consola (comandos/historial/logs/properties con mejor estructura visual).
- UX-H3: Responsivo + accesibilidad (contraste, foco visible, navegación teclado).
- UX-H4: Estados UX consistentes (loading/empty/error/success) y microcopy.

## Doing
- UX-H0: Definir concepto visual objetivo de UI con Stitch (para implementación siguiente sesión).

## Done
- Documentación base de visión, PRD, arquitectura, backlog y modelo de datos.
- Decisiones de stack: NestJS/Fastify + PostgreSQL.
- Definición de Sprint 1: scaffold + crear + start/stop.
- E1-H1: Scaffold monorepo (`apps/*`, `packages/*`, `infra/docker`) y workspace pnpm.
- E1-H2: Auth local (login/logout/me) con sesión en cookie.
- E2-H1: Creación de servidor (vanilla/paper) con validaciones MVP.
- E2-H2: Start/Stop integrado con runtime local real.
- Runtime: creación de carpetas, `eula.txt`, `server.properties`, logs por servidor.
- Runtime: descarga automática de JAR Vanilla desde Mojang cuando falta `server.jar`.
- Runtime/UI: inspección de `serverDir`, `jarPath`, `logFile`, `pid` y últimas líneas de log.
- E3-H1: Consola/logs realtime en UI (auto-refresh cada 2s con estados loading/error).
- E3-H2: Historial de comandos por servidor (persistido vía auditoría) + re-ejecución 1-click.
- E4-H1 (avance): Edición básica de `server.properties` (MOTD, dificultad, gamemode, whitelist, max-players) con validaciones y aviso de restart requerido.
