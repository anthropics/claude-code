# AppSheet · Cierre de ruta y captura de consumo real

Experiencia del operador (Alberto, Emmanuel, Meñito, Juan Pablo) para que el
inventario se actualice al terminar la ruta. Se integra con las tablas reales de
`gp-inventario` (`rutas`, `servicios`).

## Flujo del operador
1. Durante la ruta, cada `servicio` (parada) se marca **completado** (ya existe).
2. Al terminar, el operador abre **"Cerrar ruta"**.
3. AppSheet muestra el **consumo estimado** de la ruta (calculado por BOM sobre sus
   servicios completados) — es el valor por defecto.
4. Opcional: el operador **ajusta a consumo real** si gastó más/menos. Esto llena
   `consumo_declarado (ruta_id, insumo_id, cantidad)`.
5. Toca **Confirmar cierre** → marca `rutas.estado = 'completada'` y dispara el
   webhook a n8n con `{ "ruta_id": <id> }`.

## Consulta para el resumen de consumo estimado (solo lectura)
```sql
SELECT ce.tipo_servicio, i.nombre, i.unidad_medida,
       SUM(ce.cantidad_por_servicio) AS estimado
FROM servicios s
JOIN consumo_estandar ce ON ce.tipo_servicio = upper(s.tipo)
JOIN insumos i ON i.id = ce.insumo_id
WHERE s.ruta_id = :ruta_id AND s.completado
GROUP BY ce.tipo_servicio, i.nombre, i.unidad_medida;
```

## Acción "Confirmar cierre"
- `UPDATE rutas SET estado='completada' WHERE id=:ruta_id`
- Webhook: `POST https://grupoportatil.app.n8n.cloud/webhook/gp/cierre-ruta`
  con body `{ "ruta_id": <id> }`.

## Regla de negocio
- Si el operador **no** ajusta nada → se usa el estimado por BOM (sin fricción).
- Si captura aunque sea un insumo en `consumo_declarado` → se usa **todo** lo
  declarado para esa ruta (el operador tomó control de esa jornada).
- El descuento es idempotente: reenviar el webhook no vuelve a descontar.
