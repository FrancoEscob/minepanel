# MinePanel — Visión y Alcance

## Visión
Construir un gestor **self-hosted** de servidores Minecraft para que cualquier persona pueda crear, operar y mantener servidores desde una UI web, sin depender de scripts manuales o configuración compleja en terminal.

## Problema
Montar un servidor Minecraft hoy requiere conocimientos técnicos (versiones, Java, RAM, puertos, mods/plugins, backups, seguridad). Esto frena a admins pequeños y comunidades.

## Propuesta de valor
- Creación guiada en minutos (wizard).
- Operación diaria desde panel web (consola, config, backups, jugadores).
- Gestión multi-servidor en un solo lugar.
- Evolución a multi-host sin reescribir la base.

## Objetivos de producto
1. Reducir tiempo de creación de servidor a <10 minutos.
2. Hacer operaciones comunes sin CLI (reinicio, backup, mods, permisos).
3. Minimizar riesgo operativo con backup + rollback.
4. Mantener modelo local-first y open source.

## No objetivos iniciales
- Marketplace público de pago.
- Integraciones empresariales complejas.
- Autoescalado distribuido desde el día 1.

## Usuarios objetivo
- Admin de comunidad pequeña/mediana.
- Dueño de VPS que quiere simplicidad.
- Equipos que administran múltiples servidores Minecraft.

## Criterios de éxito MVP
- Usuario crea servidor Vanilla o Paper y lo pone online desde UI.
- Puede editar configuración base y gestionar whitelist/ops/bans.
- Puede ver consola en tiempo real y ejecutar comandos.
- Puede hacer backup y restaurar exitosamente.
