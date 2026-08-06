# SOP · Cierre de jornada y actualización de inventario de insumos

**Área:** Operaciones · **Plazas:** MTY / QRO · **Responsables:** operadores + Eduardo
**Frecuencia:** diaria, al finalizar cada jornada de servicio.

## Objetivo
Que el inventario de insumos (desinfectantes, papel, gel/jabón, equipo de limpieza)
refleje el consumo real de cada jornada de forma automática, ligado a las rutas
completadas, para evitar faltantes en campo y compras reactivas.

## Procedimiento diario

### Operador (Alberto / Emmanuel / Meñito / Juan Pablo)
1. Marca cada parada como **completado** en AppSheet (foto + firma) — sin cambios.
2. Al terminar la ruta, entra a **"Cerrar mi jornada"**.
3. Revisa el consumo estimado; ajústalo solo si gastaste algo distinto.
4. Toca **Confirmar cierre**. Listo — el inventario se descuenta solo.

### Sistema (n8n + Supabase) — automático
5. Recibe el cierre, calcula consumo (real declarado o estimado por BOM).
6. Descuenta insumos de la plaza correspondiente (movimiento de salida).
7. Marca las órdenes de esa jornada como `insumos_descontados`.
8. Si algún insumo quedó en o bajo el mínimo, avisa a Eduardo por WhatsApp con la
   sugerencia de reorden.
9. Envía al operador un resumen: órdenes, unidades y costo de insumos del día.

### Respaldo (automático, 20:30)
10. n8n barre jornadas no cerradas manualmente y las procesa igual. Nada se queda
    sin descontar.

## Verificación (Eduardo, semanal)
- La vista `v_ordenes_sin_descontar` debe estar **vacía**. Si tiene filas, hubo
  rutas completadas sin cerrar jornada → revisar con el operador.
- Revisar `v_consumo_semanal_insumo` para planear compras.
- Hacer **inventario físico** mensual y capturar diferencias como `ajuste`
  (`origen='inventario_fisico'`) para recalibrar el BOM si el estimado se desvía.

## Riesgos y controles
| Riesgo | Control |
|---|---|
| Doble descuento por reintento | Función idempotente + índice único por jornada/insumo |
| Operador olvida cerrar jornada | Respaldo programado 20:30 |
| BOM desviado de la realidad | Ajuste declarado por operador + inventario físico mensual |
| Stock en negativo (desfase) | Semáforo AGOTADO en `v_inventario_actual` + alerta |

## Métricas de éxito
- 100% de jornadas con inventario descontado el mismo día.
- Reducción de faltantes en campo (unidades servidas sin insumo).
- Cero compras de emergencia por sorpresa de stock.
