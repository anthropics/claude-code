# n8n · Workflow "Cierre de jornada → Inventario de insumos"

**Estado:** CREADO en n8n (inactivo, pendiente de vincular credenciales y activar).
**Proyecto:** personal de Eduardo · **Workflow ID:** `ukdlxyeB035LbS7q`
**URL:** https://grupoportatil.app.n8n.cloud/workflow/ukdlxyeB035LbS7q

Descuenta insumos al cierre de cada ruta de servicio y avisa por email cuando un
insumo cae a su punto de reorden. Se apoya en las funciones ya desplegadas en
Supabase (`gp-inventario`), que garantizan idempotencia.

---

## Arquitectura (8 nodos, 2 disparadores)

```
Webhook POST /gp/cierre-ruta ─► Normalizar ruta_id ─► procesar_cierre_ruta(ruta_id) ─┐
                                                                                       ├─► Revisar Stock Bajo ─► Email Alerta Reorden
Schedule 20:30 diario ───────► procesar_cierre_dia(1, hoy) ────────────────────────────┘
```

| Nodo | Tipo | Qué hace |
|---|---|---|
| Webhook Cierre Ruta | webhook (POST `gp/cierre-ruta`) | Recibe `{ "ruta_id": <int> }` desde AppSheet al cerrar la ruta |
| Normalizar ruta_id | set | Extrae `ruta_id` de `body` o raíz del payload |
| Descontar insumos de ruta | httpRequest → Supabase RPC | `POST /rest/v1/rpc/procesar_cierre_ruta` con `{p_ruta_id}` |
| Respaldo diario 20:30 | scheduleTrigger | Red de seguridad para rutas no cerradas manualmente |
| Cerrar jornada del dia MTY | httpRequest → Supabase RPC | `POST /rest/v1/rpc/procesar_cierre_dia` con `{p_sucursal:1, p_fecha: hoy}` |
| Revisar Stock Bajo | httpRequest → Supabase (executeOnce) | `GET /rest/v1/v_insumos_bajo_minimo?select=*` |
| Email Alerta Reorden | gmail (executeOnce) | Un correo a Eduardo listando insumos bajo mínimo. Si 0 filas, no envía |

- **Autenticación Supabase:** los 3 nodos HTTP usan *Predefined Credential Type → Supabase API* (credencial `Supabase account`). Inyecta `apikey` + `Authorization` automáticamente.
- **Idempotencia:** `procesar_cierre_ruta` no descuenta dos veces (bandera `rutas.insumos_procesados` + índice único por ruta/insumo). Por eso el webhook y el respaldo pueden coincidir sin duplicar.
- **Cero fricción en el email:** `Revisar Stock Bajo` devuelve N filas; si son 0, el nodo Gmail simplemente no corre. Con `executeOnce` se manda **un** correo agregando todas las filas.

---

## Puesta en marcha (pasos manuales)

1. **Vincular credenciales** (n8n no las auto-asignó):
   - 3 nodos HTTP Request → credencial **Supabase account**.
   - Email Alerta Reorden → credencial **Gmail account**.
2. **Conectar AppSheet**: en la acción "cerrar ruta", llamar por webhook:
   - URL producción: `https://grupoportatil.app.n8n.cloud/webhook/gp/cierre-ruta`
   - Método: `POST` · Body: `{ "ruta_id": <id de la ruta> }`
3. **Zona horaria**: el schedule dispara 20:30 (hora de la instancia). Ajustar si aplica.
4. **Activar** el workflow.

## Prueba en vivo sugerida
Crear una ruta de prueba con 2-3 `servicios` completados, disparar el webhook con su
`ruta_id`, y verificar en `v_inventario_actual` que el stock bajó y en
`v_rutas_sin_procesar` que quedó vacío. Repetir el disparo confirma idempotencia
(no vuelve a descontar). Limpiar la ruta de prueba al terminar.

## Pendiente / mejoras
- **Canal de alerta:** hoy es email (no hay credencial de WhatsApp/Troncalnet en n8n).
  Al conectarla, sustituir el nodo Gmail por WhatsApp/Troncalnet.
- **Confirmación al operador:** se puede agregar un nodo que le responda su resumen
  de jornada (órdenes, unidades, costo) leyendo `rutas.costo_insumos`.
- **QRO:** cuando exista la sucursal, el respaldo diario necesita una segunda llamada
  `procesar_cierre_dia(<id_qro>, hoy)` (o parametrizar por sucursal activa).
