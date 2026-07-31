# AppSheet · Cierre de jornada y captura de consumo real

Cómo debe verse la experiencia del operador (Alberto, Emmanuel, Meñito, Juan Pablo)
para que el inventario se actualice al terminar la ruta.

## Flujo del operador
1. Durante la ruta, cada parada se marca **completado** (ya existe: foto + firma).
2. Al terminar, el operador abre **"Cerrar mi jornada"**.
3. AppSheet muestra el **consumo estimado** de la jornada (calculado por BOM sobre
   sus órdenes completadas) — es el valor por defecto.
4. Opcional: el operador **ajusta a consumo real** si gastó más/menos (ej. derramó
   desinfectante, repuso papel extra). Esto llena `consumo_declarado`.
5. Toca **Confirmar cierre** → se dispara el webhook a n8n con el `jornada_id`.

## Tablas/vistas que consume AppSheet
- **Vista resumen de jornada** (solo lectura), consulta sugerida:
  ```sql
  SELECT ce.tipo_servicio, i.nombre, i.unidad_medida,
         SUM(ce.cantidad_por_unidad * ot.unidades) AS estimado
  FROM ordenes_trabajo ot
  JOIN consumo_estandar ce ON ce.tipo_servicio = ot.tipo_servicio
  JOIN insumos i ON i.id = ce.insumo_id
  WHERE ot.jornada_id = :jornada_id AND ot.estado='completado'
  GROUP BY ce.tipo_servicio, i.nombre, i.unidad_medida;
  ```
- **Formulario de ajuste** → escribe en `consumo_declarado (jornada_id, insumo_id, cantidad)`.

## Acción "Confirmar cierre" (AppSheet Action → Webhook)
- Marca `jornadas.estado = 'cerrada'`, `cerrada_en = NOW()`.
- Llama al webhook n8n `POST /gp/cierre-jornada` con body `{ "jornada_id": "<id>" }`.

## Regla de negocio
- Si el operador **no** ajusta nada, el sistema usa el estimado por BOM (sin fricción).
- Si ajusta aunque sea un insumo, se usa **todo** lo declarado (el operador tomó control
  de esa jornada). Documentar esto para que el equipo lo entienda.
