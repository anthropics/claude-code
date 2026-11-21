-- ============================================================
-- Grupo Portátil · Inventario de insumos
-- 03_vistas_kpi.sql — Vistas de consulta y KPIs
-- ============================================================
-- DESPLEGADO. Migración aplicada: insumos_inventario_vistas
-- (security_invoker se activa en 05_hardening.sql)
-- ============================================================

CREATE OR REPLACE VIEW v_inventario_actual AS
SELECT su.clave AS sucursal, i.categoria, i.sku, i.nombre, i.unidad_medida,
       e.stock_actual, e.stock_minimo,
       ROUND(e.stock_actual * i.costo_unitario, 2) AS valor_inventario,
       CASE WHEN e.stock_actual <= 0                    THEN 'AGOTADO'
            WHEN e.stock_actual <= e.stock_minimo       THEN 'BAJO'
            WHEN e.stock_actual <= e.stock_minimo * 1.5 THEN 'MEDIO'
            ELSE 'OK' END AS semaforo,
       e.updated_at
FROM insumo_existencias e
JOIN insumos i     ON i.id = e.insumo_id
JOIN sucursales su ON su.id = e.sucursal_id
WHERE i.activo
ORDER BY su.clave, i.categoria, i.nombre;

-- Fuente de la alerta n8n -> email de reorden a Eduardo
CREATE OR REPLACE VIEW v_insumos_bajo_minimo AS
SELECT su.clave AS sucursal, i.sku, i.nombre, i.categoria,
       e.stock_actual, e.stock_minimo,
       COALESCE(e.stock_reorden, e.stock_minimo * 2) AS sugerido_pedir,
       i.unidad_medida,
       ROUND(COALESCE(e.stock_reorden, e.stock_minimo * 2) * i.costo_unitario, 2) AS costo_reorden_estimado
FROM insumo_existencias e
JOIN insumos i     ON i.id = e.insumo_id
JOIN sucursales su ON su.id = e.sucursal_id
WHERE i.activo AND e.stock_actual <= e.stock_minimo
ORDER BY su.clave, i.categoria, i.nombre;

CREATE OR REPLACE VIEW v_consumo_semanal_insumo AS
SELECT date_trunc('week', m.created_at)::date AS semana, su.clave AS sucursal,
       i.sku, i.nombre, i.categoria,
       SUM(m.cantidad) AS cantidad_consumida, i.unidad_medida,
       SUM(m.costo_total) AS costo_consumido
FROM movimientos_insumo m
JOIN insumos i     ON i.id = m.insumo_id
JOIN sucursales su ON su.id = m.sucursal_id
WHERE m.tipo = 'salida' AND m.origen IN ('cierre_ruta','cierre_jornada')
GROUP BY 1, su.clave, i.sku, i.nombre, i.categoria, i.unidad_medida
ORDER BY 1 DESC, su.clave, i.categoria;

-- Control de fugas: rutas completadas cuyo consumo aún no se aplicó.
-- Debe estar vacía tras el cierre diario.
CREATE OR REPLACE VIEW v_rutas_sin_procesar AS
SELECT r.id AS ruta_id, su.clave AS sucursal, r.operador_id, r.fecha,
       r.total_paradas, r.paradas_completadas
FROM rutas r
JOIN sucursales su ON su.id = r.sucursal_id
WHERE r.estado = 'completada' AND r.insumos_procesados = FALSE
ORDER BY r.fecha, r.id;
