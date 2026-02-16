# PRD MVP — MinePanel

## 1. Resumen
MinePanel MVP será un panel web local para crear y gestionar servidores Minecraft **Vanilla** y **Paper** en un único host.

## 1.1 Stack aprobado
1. **UI**: Next.js + TypeScript.
2. **API/servicios**: TypeScript (Fastify o NestJS sobre Fastify).
3. **DB**: PostgreSQL (producción) con Prisma.
4. **Entorno dev**: SQLite opcional para arranque rápido.
5. **Contenedores**: Docker Compose para el panel.
6. **Ejecución servidores MC**: procesos Java en host durante MVP.

## 2. Alcance MVP

### Incluido
1. Autenticación local (admin inicial).
2. Gestión de múltiples instancias en un host.
3. Wizard de creación de servidor.
4. Start/Stop/Restart + consola en tiempo real.
5. Configuración base (`server.properties`) + whitelist/ops/bans.
6. Backups locales y restauración.
7. Monitor básico (CPU, RAM, disco, estado proceso).

### Excluido (post-MVP)
1. Multi-host con agentes.
2. Marketplace de plantillas.
3. Integración completa CurseForge.
4. Métricas avanzadas (TPS profundo, profiling avanzado).

## 3. Pestañas MVP
1. **Dashboard**: estado global y acciones rápidas.
2. **Servidores**: listado, filtros y acceso a detalle.
3. **Crear servidor**: wizard guiado.
4. **Backups**: programación simple y restore.
5. **Jugadores**: whitelist, bans, ops.
6. **Ajustes**: config del panel y seguridad básica.

## 4. Flujos críticos
1. Crear servidor nuevo -> seleccionar tipo/versión -> asignar RAM/puerto -> aceptar EULA -> iniciar.
2. Abrir detalle -> ver consola -> ejecutar comando.
3. Cambiar propiedad -> guardar -> reiniciar si aplica.
4. Crear backup manual/programado -> restaurar backup.

## 5. Requisitos funcionales
### RF-01 Gestión de instancias
- Crear, iniciar, detener, reiniciar, eliminar instancia.

### RF-02 Consola
- Streaming de logs en tiempo real.
- Envío de comandos al proceso.

### RF-03 Configuración
- Edición segura de propiedades soportadas.
- Gestión de listas: whitelist, ops, bans.

### RF-04 Backups
- Backup manual y programado.
- Restauración con validación previa.

### RF-05 Seguridad
- Login local.
- Roles iniciales: `owner`, `admin`, `viewer` (base para RBAC futuro).

## 6. Requisitos no funcionales
1. UI usable en desktop y móvil.
2. Persistencia robusta (tolerancia a reinicio del panel).
3. Trazabilidad de acciones críticas (auditoría básica).
4. Arranque sencillo con Docker Compose.

## 7. Riesgos principales
1. Incompatibilidad de versiones Java/Minecraft.
2. Corrupción por apagado forzado.
3. Actualizaciones que rompen mods/plugins.

## 8. Mitigaciones
1. Validador previo de versión/runtime.
2. Secuencia de parada segura.
3. Backup pre-acción + rollback guiado.

## 9. Dependencias externas
- Descargas de software servidor (Mojang/PaperMC).
- Integraciones futuras: Modrinth y CurseForge.
- Cumplimiento EULA Minecraft.

## 10. Definición de terminado MVP
MVP terminado cuando un usuario puede instalar MinePanel, crear y operar al menos un servidor de forma íntegra desde la UI, incluyendo backup y restauración.
