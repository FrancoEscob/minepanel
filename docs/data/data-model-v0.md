# Esquema de datos v0 (MVP con base B-ready)

## Principios
1. Modelo preparado para `node_id` desde el inicio.
2. Auditoría mínima en acciones críticas.
3. Backups y jobs como entidades de primer nivel.

## Entidades principales

## 1) users
- `id` (uuid)
- `email` (string, único)
- `password_hash` (string)
- `role` (enum: owner|admin|viewer)
- `created_at`, `updated_at`

## 2) nodes
- `id` (string/uuid)
- `name` (string)
- `type` (enum: local|remote)
- `status` (enum: healthy|degraded|offline)
- `host` (string, nullable)
- `created_at`, `updated_at`

> En MVP se crea un nodo inicial: `id=local`, `type=local`.

## 3) servers
- `id` (uuid)
- `node_id` (fk -> nodes.id)
- `name` (string)
- `kind` (enum: vanilla|paper|purpur|fabric|forge|neoforge|quilt)
- `mc_version` (string)
- `build` (string, nullable)
- `java_version` (string)
- `memory_min_mb` (int)
- `memory_max_mb` (int)
- `port` (int)
- `status` (enum: stopped|starting|running|stopping|error)
- `world_name` (string)
- `created_at`, `updated_at`

## 4) server_configs
- `id` (uuid)
- `server_id` (fk -> servers.id)
- `key` (string)
- `value` (string)
- `source` (enum: server_properties|system)
- `updated_by` (fk -> users.id, nullable)
- `updated_at`

## 5) player_lists
- `id` (uuid)
- `server_id` (fk -> servers.id)
- `list_type` (enum: whitelist|ops|bans)
- `player_name` (string)
- `player_uuid` (string, nullable)
- `reason` (string, nullable)
- `expires_at` (datetime, nullable)
- `created_at`

## 6) backups
- `id` (uuid)
- `server_id` (fk -> servers.id)
- `node_id` (fk -> nodes.id)
- `storage_type` (enum: local|s3)
- `path` (string)
- `size_bytes` (bigint)
- `status` (enum: creating|ready|failed|restoring)
- `created_by` (fk -> users.id, nullable)
- `created_at`

## 7) scheduled_jobs
- `id` (uuid)
- `server_id` (fk -> servers.id, nullable)
- `job_type` (enum: restart|backup|command)
- `cron_expr` (string)
- `payload_json` (json)
- `enabled` (bool)
- `last_run_at` (datetime, nullable)
- `next_run_at` (datetime, nullable)

## 8) audits
- `id` (uuid)
- `user_id` (fk -> users.id, nullable)
- `server_id` (fk -> servers.id, nullable)
- `action` (string)
- `target` (string)
- `metadata_json` (json)
- `created_at`

## 9) artifacts (base para mods/plugins futuro)
- `id` (uuid)
- `server_id` (fk -> servers.id)
- `artifact_type` (enum: mod|plugin|datapack|jar)
- `source` (enum: modrinth|curseforge|manual)
- `name` (string)
- `version` (string)
- `file_path` (string)
- `installed_at`

## Relaciones clave
- `nodes 1..n servers`
- `servers 1..n backups`
- `servers 1..n player_lists`
- `users 1..n audits`

## Notas de evolución
- En fase B, `nodes.type=remote` y secrets por nodo.
- `artifacts` permite incorporar gestor de dependencias en V1/V2.
