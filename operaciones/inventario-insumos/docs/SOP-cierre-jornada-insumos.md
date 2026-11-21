# SOP · Cierre de jornada y actualización de inventario de insumos

**Área:** Operaciones · **Plazas:** MTY (activa) / QRO (al dar de alta la sucursal)
**Responsables:** operadores + Eduardo · **Frecuencia:** diaria, al cerrar cada ruta.

## Objetivo
Que el inventario de insumos (desinfectantes, papel, gel/jabón, equipo de limpieza)
refleje el consumo real de cada jornada de forma automática, ligado a las rutas
completadas, para evitar faltantes en campo y compras reactivas.

## Modelo de datos (real, en `gp-inventario`)
- Una **ruta** = la jornada de un operador (tabla `rutas`: operador, sucursal, fecha, estado).
- Cada parada es un **servicio** (`servicios`, uno por unidad sanitaria; `completado`, `tipo`).
- El consumo se descuenta por ruta y queda en el ledger `movimientos_insumo`.

## Procedimiento diario

### Operador (Alberto / Emmanuel / Meñito / Juan Pablo)
1. Marca cada parada como **completado** en AppSheet — sin cambios.
2. Al terminar, entra a **"Cerrar ruta"**.
3. Revisa el consumo estimado; ajústalo solo si gastaste algo distinto.
4. Toca **Confirmar cierre**. El inventario se descuenta solo.

### Sistema (n8n + Supabase) — automático
5. Webhook → `procesar_cierre_ruta(ruta_id)`: calcula consumo (real declarado o
   estimado por BOM) y lo descuenta de la sucursal de la ruta.
6. Marca los servicios de la ruta como `insumos_descontados` y la ruta como
   `insumos_procesados` (con su `costo_insumos`).
7. Si algún insumo quedó en o bajo el mínimo → registro en `alertas` + email a Eduardo.

### Respaldo (automático, 20:30)
8. `procesar_cierre_dia(1, hoy)` barre rutas `completada` no procesadas. Idempotente.

## Verificación (Eduardo)
- `v_rutas_sin_procesar` debe estar **vacía** al cierre del día. Si tiene filas,
  hubo rutas completadas sin cerrar → revisar con el operador.
- `v_consumo_semanal_insumo` para planear compras.
- Inventario físico mensual → capturar diferencias como `movimientos_insumo` tipo
  `ajuste` (`origen='inventario_fisico'`) para recalibrar el BOM.

## Riesgos y controles
| Riesgo | Control |
|---|---|
| Doble descuento por reintento | `procesar_cierre_ruta` idempotente + índice único ruta/insumo |
| Operador no cierra la ruta | Respaldo programado 20:30 |
| BOM desviado de la realidad | Consumo declarado por operador + inventario físico mensual |
| Stock en negativo (desfase) | Semáforo AGOTADO en `v_inventario_actual` + alerta |

## Métricas de éxito
- 100% de rutas con inventario descontado el mismo día.
- Reducción de faltantes en campo y de compras de emergencia.
- Costo de insumos por ruta visible en `rutas.costo_insumos`.
