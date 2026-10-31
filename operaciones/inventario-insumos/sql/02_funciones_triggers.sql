-- ============================================================
-- Grupo Portátil · Inventario de insumos
-- 02_funciones_triggers.sql — Funciones de negocio
-- ============================================================
-- DESPLEGADO. Migración aplicada: insumos_inventario_funciones
-- ============================================================

-- Alertas de stock bajo -> tabla `alertas` existente (sin duplicar abiertas)
CREATE OR REPLACE FUNCTION revisar_stock_minimo(p_sucursal INT)
RETURNS void AS $$
BEGIN
  INSERT INTO alertas (tipo, descripcion, entidad_id)
  SELECT 'INSUMO_BAJO',
         format('%s en %s: %s %s en existencia (min %s) — pedir %s',
                i.nombre, su.clave, e.stock_actual, i.unidad_medida, e.stock_minimo,
                COALESCE(e.stock_reorden, e.stock_minimo * 2)),
         'insumo:' || i.id || ':suc:' || p_sucursal
  FROM insumo_existencias e
  JOIN insumos i    ON i.id = e.insumo_id
  JOIN sucursales su ON su.id = e.sucursal_id
  WHERE e.sucursal_id = p_sucursal
    AND i.activo
    AND e.stock_actual <= e.stock_minimo
    AND NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.tipo = 'INSUMO_BAJO'
        AND a.entidad_id = 'insumo:' || i.id || ':suc:' || p_sucursal
        AND a.resuelta = false
    );
END;
$$ LANGUAGE plpgsql;

-- Núcleo: procesar el cierre de una RUTA (= jornada de servicio del operador).
-- Descuenta insumos (real declarado, o estimado por BOM sobre servicios completados).
-- Idempotente: si la ruta ya está procesada, no hace nada.
-- La llama n8n vía RPC: SELECT * FROM procesar_cierre_ruta(<ruta_id>);
CREATE OR REPLACE FUNCTION procesar_cierre_ruta(p_ruta_id INT)
RETURNS TABLE (r_insumo_id INT, r_sku TEXT, r_cantidad NUMERIC, r_costo NUMERIC) AS $$
DECLARE
  v_sucursal  INT;
  v_operador  INT;
  v_fecha     DATE;
  v_procesado BOOLEAN;
  v_declarado BOOLEAN;
  v_nserv     INT;
BEGIN
  SELECT sucursal_id, operador_id, fecha, insumos_procesados
    INTO v_sucursal, v_operador, v_fecha, v_procesado
    FROM rutas WHERE id = p_ruta_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Ruta % no existe', p_ruta_id; END IF;
  IF v_procesado THEN RETURN; END IF;   -- idempotencia dura
  IF v_sucursal IS NULL THEN RAISE EXCEPTION 'Ruta % sin sucursal_id', p_ruta_id; END IF;

  v_declarado := EXISTS (SELECT 1 FROM consumo_declarado WHERE ruta_id = p_ruta_id);
  SELECT count(*) INTO v_nserv
    FROM servicios s
   WHERE s.ruta_id = p_ruta_id AND s.completado AND s.insumos_descontados = FALSE;

  RETURN QUERY
  WITH consumo AS (
    -- Real declarado por el operador
    SELECT cd.insumo_id, cd.cantidad::numeric(12,3) AS cantidad
      FROM consumo_declarado cd
     WHERE v_declarado AND cd.ruta_id = p_ruta_id
    UNION ALL
    -- Estimado por BOM sobre servicios completados de la ruta (1 servicio = 1 unidad)
    SELECT ce.insumo_id, SUM(ce.cantidad_por_servicio)::numeric(12,3)
      FROM servicios s
      JOIN consumo_estandar ce ON ce.tipo_servicio = upper(s.tipo)
     WHERE NOT v_declarado
       AND s.ruta_id = p_ruta_id
       AND s.completado
       AND s.insumos_descontados = FALSE
     GROUP BY ce.insumo_id
  ),
  agregado AS (
    SELECT c.insumo_id, SUM(c.cantidad) AS cantidad
      FROM consumo c GROUP BY c.insumo_id HAVING SUM(c.cantidad) > 0
  ),
  aplicado AS (
    INSERT INTO movimientos_insumo
      (insumo_id, sucursal_id, tipo, cantidad, origen, ruta_id, operador_id, fecha_jornada, servicios_contados, costo_total, nota)
    SELECT a.insumo_id, v_sucursal, 'salida', a.cantidad, 'cierre_ruta',
           p_ruta_id, v_operador, v_fecha, v_nserv,
           ROUND(a.cantidad * i.costo_unitario, 2),
           CASE WHEN v_declarado THEN 'Consumo declarado por operador'
                ELSE 'Consumo estimado por BOM de servicios completados' END
      FROM agregado a JOIN insumos i ON i.id = a.insumo_id
    ON CONFLICT (ruta_id, insumo_id) WHERE origen = 'cierre_ruta' DO NOTHING
    RETURNING movimientos_insumo.insumo_id, movimientos_insumo.cantidad, movimientos_insumo.costo_total
  )
  SELECT ap.insumo_id, i.sku, ap.cantidad, ap.costo_total
    FROM aplicado ap JOIN insumos i ON i.id = ap.insumo_id;

  -- Sincronizar rutas <-> inventario
  UPDATE servicios SET insumos_descontados = TRUE
   WHERE ruta_id = p_ruta_id AND completado;

  UPDATE rutas
     SET insumos_procesados = TRUE,
         procesado_en = now(),
         costo_insumos = (SELECT COALESCE(SUM(costo_total),0)
                            FROM movimientos_insumo
                           WHERE ruta_id = p_ruta_id AND origen = 'cierre_ruta')
   WHERE id = p_ruta_id;

  PERFORM revisar_stock_minimo(v_sucursal);
END;
$$ LANGUAGE plpgsql;

-- Respaldo diario: procesa todas las rutas completadas del día no procesadas.
-- La llama n8n a las 20:30: SELECT procesar_cierre_dia(1, CURRENT_DATE);
CREATE OR REPLACE FUNCTION procesar_cierre_dia(p_sucursal INT, p_fecha DATE)
RETURNS INT AS $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN
    SELECT id FROM rutas
     WHERE sucursal_id = p_sucursal AND fecha = p_fecha
       AND estado = 'completada' AND insumos_procesados = FALSE
  LOOP
    PERFORM procesar_cierre_ruta(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- Alta de stock por compra/reposición
CREATE OR REPLACE FUNCTION registrar_entrada(p_insumo_id INT, p_sucursal INT, p_cantidad NUMERIC, p_nota TEXT DEFAULT NULL)
RETURNS INT AS $$
DECLARE v_id INT; v_costo NUMERIC(10,2);
BEGIN
  SELECT costo_unitario INTO v_costo FROM insumos WHERE id = p_insumo_id;
  INSERT INTO movimientos_insumo (insumo_id, sucursal_id, tipo, cantidad, origen, costo_total, nota)
  VALUES (p_insumo_id, p_sucursal, 'entrada', p_cantidad, 'compra', ROUND(p_cantidad * COALESCE(v_costo,0),2), p_nota)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
