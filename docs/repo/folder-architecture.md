# Arquitectura de carpetas propuesta

## Estructura objetivo del repositorio
```text
minepanel/
  docs/
    product/
    prd/
    architecture/
    backlog/
    data/
    repo/
  apps/
    web/                # UI
    api/                # backend HTTP + auth
    runtime/            # gestión procesos Minecraft
  packages/
    domain/             # entidades y reglas de negocio
    shared/             # utilidades comunes
    contracts/          # interfaces (NodeProvider, Telemetry, etc.)
  infra/
    docker/
    scripts/
  .github/
    workflows/
```

## Criterios de diseño
1. Separar dominio de infraestructura para facilitar migración A -> B.
2. Mantener contratos estables entre `api` y `runtime`.
3. Preparar `contracts` para futuros agents.
4. Evitar acoplar UI a detalles de ejecución local.

## Convenciones iniciales
1. `docs/` como fuente de verdad de producto y arquitectura.
2. Código nuevo se agrega por aplicación/paquete, no por tipo técnico global.
3. Todo caso de uso que opere servidores debe pasar por contrato `NodeProvider`.

## Decisiones pendientes (para sesión de implementación)
1. Stack exacto frontend/backend.
2. Motor de DB inicial (SQLite vs Postgres).
3. Sistema de colas para fase B.
