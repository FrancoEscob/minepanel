# Backlog técnico inicial (épicas e historias)

## Épica E1 — Fundaciones del panel
### Historia E1-H1
Como admin, quiero instalar MinePanel fácilmente para empezar rápido.

**Criterios de aceptación**
- Instalación documentada por pasos.
- Primer arranque crea usuario owner.

### Historia E1-H2
Como admin, quiero iniciar sesión de forma segura para proteger el panel.

**Criterios de aceptación**
- Login funcional y sesión persistente.
- Logout invalida sesión activa.

## Épica E2 — Gestión de servidores
### Historia E2-H1
Como admin, quiero crear un servidor con wizard para evitar configuración manual.

**Criterios de aceptación**
- Permite elegir Vanilla/Paper y versión.
- Permite RAM, puerto y nombre.
- Valida EULA antes de iniciar.

### Historia E2-H2
Como admin, quiero iniciar/parar/reiniciar para operar el servidor.

**Criterios de aceptación**
- Acciones disponibles en lista y detalle.
- Estado se actualiza en UI.

## Épica E3 — Consola y observabilidad
### Historia E3-H1
Como admin, quiero ver logs en tiempo real para diagnosticar problemas.

**Criterios de aceptación**
- Streaming de logs en vivo.
- Indicador de conexión de consola.

### Historia E3-H2
Como admin, quiero enviar comandos desde UI para gestionar juego en caliente.

**Criterios de aceptación**
- Campo de comando con historial básico.
- Confirmación visual de envío.

## Épica E4 — Configuración y jugadores
### Historia E4-H1
Como admin, quiero editar `server.properties` desde UI para evitar errores manuales.

**Criterios de aceptación**
- Vista formulario para propiedades comunes.
- Guardado y detección de restart requerido.

### Historia E4-H2
Como admin, quiero gestionar whitelist/ops/bans para controlar acceso.

**Criterios de aceptación**
- CRUD de entradas en cada lista.
- Cambios reflejados en archivos y runtime.

## Épica E5 — Backups y resiliencia
### Historia E5-H1
Como admin, quiero crear backups manuales y programados para proteger mundos.

**Criterios de aceptación**
- Backup manual 1-click.
- Programación diaria/semanal.

### Historia E5-H2
Como admin, quiero restaurar backups para recuperar estado tras fallos.

**Criterios de aceptación**
- Lista de backups con metadata.
- Flujo de restore con advertencia y confirmación.

## Épica E6 — Base B-ready (nodos/agents)
### Historia E6-H1
Como sistema, quiero que cada servidor tenga `node_id` para soportar multi-host futuro.

**Criterios de aceptación**
- Modelo incluye `node_id` y usa `local` por defecto.
- Casos de uso resuelven acciones vía `NodeProvider`.

### Historia E6-H2
Como equipo técnico, quiero contratos de ejecución/telemetría desacoplados para evitar reescritura.

**Criterios de aceptación**
- Interfaces definidas y usadas por servicios.
- Implementación local funciona sin componentes remotos.

## Prioridad sugerida
1. E1 -> E2 -> E3 -> E4 -> E5 -> E6.
