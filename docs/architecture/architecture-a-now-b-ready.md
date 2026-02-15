# Arquitectura técnica — A ahora, B preparado

## 1. Definiciones clave
- **Nodo**: máquina donde se ejecuta Minecraft (VPS/PC).
- **Agent**: servicio liviano instalado en un nodo para recibir órdenes y reportar estado al panel central.

## 2. Decisión adoptada
Implementar **Opción A (monolito local)** en MVP y diseñar interfaces internas para evolucionar a **Opción B (multi-nodo con agents)** sin ruptura.

## 3. Opción A (MVP)
### Componentes
1. **Web UI**: interfaz de administración.
2. **API Backend**: lógica de negocio y seguridad.
3. **Runtime Manager**: arranque/parada/supervisión de procesos Java.
4. **Scheduler**: tareas programadas (backup/restart/comandos).
5. **Storage**:
   - DB (SQLite inicial, opción Postgres).
   - FS local para mundos, logs y backups.

### Flujo operativo
UI -> API -> Runtime Manager -> Proceso Minecraft

## 4. Cómo dejar base para Opción B
Aunque el MVP corre en una sola máquina, se define desde el inicio una capa de abstracción:

### 4.1 Contratos internos
- `NodeProvider`: ejecutar acciones sobre un nodo (`start`, `stop`, `exec`, `backup`).
- `NodeTelemetry`: reportar estado (`cpu`, `ram`, `disk`, `players`, `uptime`).
- `ArtifactService`: gestionar jars/mods/plugins/backups.

En MVP, `LocalNodeProvider` implementa estos contratos en la misma máquina.

### 4.2 Modelo de datos node-aware
- Toda instancia de servidor guarda `node_id`.
- En MVP existe `node_id = local` por defecto.
- En fase B se agregan nodos remotos sin migrar el dominio principal.

### 4.3 Transporte listo para futuro
- Definir capa de mensajería interna (`CommandBus`) detrás de interfaz.
- En MVP puede ser in-process.
- En B puede mapearse a cola/event bus (NATS/Redis Streams/RabbitMQ).

## 5. Opción B (futuro)
### Componentes adicionales
1. **Control Plane** (panel/API central).
2. **Agent por nodo** (ejecución local en cada host).
3. **Canal seguro** control-plane <-> agent (mTLS/token rotatorio).

### Beneficios
- Gestión de múltiples hosts desde una UI.
- Mejor aislamiento de fallos por máquina.
- Escalado horizontal operativo.

## 6. Seguridad base
1. Auth local y sesiones seguras.
2. RBAC progresivo.
3. Restricción de rutas en file manager (sandbox).
4. Auditoría de acciones críticas.
5. Secretos fuera de logs.

## 7. Decisiones técnicas iniciales
1. Runtime por procesos Java (no exigir Docker al usuario final).
2. Empaquetado recomendado: Docker Compose para panel.
3. Persistencia simple primero, migrable a Postgres.

## 8. Criterio de evolución A -> B
Migrar cuando haya necesidad de operar >1 host estable o límites de capacidad en una sola máquina.
