-- =====================================================================
-- Grupo Portátil · Módulo de Inventario de Insumos
-- 03_vistas_kpi.sql — Vistas de consulta, alertas y KPIs
-- =====================================================================

-- ------------------------------------------------------------------
-- Alerta: insumos en o por debajo del mínimo (dispara reorden)
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW v_insumos_bajo_minimo AS
SELECT e.plaza,
       i.sku,
       i.nombre,
       i.categoria,
       e.stock_actual,
       e.stock_minimo,
       COALESCE(e.stock_reorden, e.stock_minimo * 2) AS sugerido_pedir,
       i.unidad_medida,
       ROUND(COALESCE(e.stock_reorden, e.stock_minimo * 2) * i.costo_unitario, 2) AS costo_reorden_estimado
FROM insumo_existencias e
JOIN insumos i ON i.id = e.insumo_id
WHERE i.activo
  AND e.stock_actual <= e.stock_minimo
ORDER BY e.plaza, i.categoria, i.nombre;

COMMENT ON VIEW v_insumos_bajo_minimo IS 'Insumos que alcanzaron el punto de reorden. Fuente de la alerta n8n->WhatsApp a Eduardo.';

-- ------------------------------------------------------------------
-- Saldo actual de inventario por plaza (dashboard)
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inventario_actual AS
SELECT e.plaza,
       i.categoria,
       i.sku,
       i.nombre,
       i.unidad_medida,
       e.stock_actual,
       e.stock_minimo,
       ROUND(e.stock_actual * i.costo_unitario, 2) AS valor_inventario,
       CASE
         WHEN e.stock_actual <= 0                    THEN 'AGOTADO'
         WHEN e.stock_actual <= e.stock_minimo       THEN 'BAJO'
         WHEN e.stock_actual <= e.stock_minimo * 1.5 THEN 'MEDIO'
         ELSE 'OK'
       END AS semaforo,
       e.actualizado_en
FROM insumo_existencias e
JOIN insumos i ON i.id = e.insumo_id
WHERE i.activo
ORDER BY e.plaza, i.categoria, i.nombre;

-- ------------------------------------------------------------------
-- Consumo diario por jornada (auditoría rutas <-> inventario)
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW v_consumo_por_jornada AS
SELECT j.fecha,
       j.plaza,
       j.operador,
       j.estado,
       j.ordenes_completadas,
       j.unidades_servidas,
       j.costo_insumos,
       j.procesada_en
FROM jornadas j
ORDER BY j.fecha DESC, j.plaza, j.operador;

-- ------------------------------------------------------------------
-- Consumo semanal por insumo y plaza (planeación de compras)
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW v_consumo_semanal_insumo AS
SELECT date_trunc('week', m.creado_en)::date AS semana,
       m.plaza,
       i.sku,
       i.nombre,
       i.categoria,
       SUM(m.cantidad)          AS cantidad_consumida,
       i.unidad_medida,
       SUM(m.costo_total)       AS costo_consumido
FROM movimientos_insumo m
JOIN insumos i ON i.id = m.insumo_id
WHERE m.tipo = 'salida'
  AND m.origen = 'cierre_jornada'
GROUP BY 1, 2, i.sku, i.nombre, i.categoria, i.unidad_medida
ORDER BY 1 DESC, 2, i.categoria;

-- ------------------------------------------------------------------
-- Órdenes completadas SIN insumos descontados (control de fugas)
-- Rutas cerradas cuya jornada no se procesó -> revisar.
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW v_ordenes_sin_descontar AS
SELECT ot.id AS orden_trabajo_id,
       ot.jornada_id,
       ot.tipo_servicio,
       ot.unidades,
       ot.estado
FROM ordenes_trabajo ot
WHERE ot.estado = 'completado'
  AND ot.insumos_descontados = FALSE
ORDER BY ot.jornada_id;

COMMENT ON VIEW v_ordenes_sin_descontar IS 'Rutas completadas cuyo consumo aún no se aplicó al inventario. Debe estar vacía tras el cierre diario.';
