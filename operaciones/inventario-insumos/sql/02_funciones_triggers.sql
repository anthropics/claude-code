-- =====================================================================
-- Grupo Portátil · Módulo de Inventario de Insumos
-- 02_funciones_triggers.sql — Lógica de negocio
-- =====================================================================
-- Contiene:
--   A) trigger que mantiene insumo_existencias al aplicar cada movimiento
--   B) función procesar_cierre_jornada(): el corazón de la automatización
--   C) función registrar_entrada(): alta de stock por compra
-- =====================================================================

-- ------------------------------------------------------------------
-- A) Mantener el saldo vivo (insumo_existencias) desde el ledger
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION aplicar_movimiento_insumo()
RETURNS TRIGGER AS $$
DECLARE
  v_delta NUMERIC(12,3);
BEGIN
  -- Delta con signo: entrada suma, salida resta, ajuste usa el signo capturado.
  v_delta := CASE NEW.tipo
               WHEN 'entrada' THEN  NEW.cantidad
               WHEN 'salida'  THEN -NEW.cantidad
               WHEN 'ajuste'  THEN  NEW.cantidad
             END;

  INSERT INTO insumo_existencias (insumo_id, plaza, stock_actual, actualizado_en)
  VALUES (NEW.insumo_id, NEW.plaza, v_delta, NOW())
  ON CONFLICT (insumo_id, plaza) DO UPDATE
    SET stock_actual   = insumo_existencias.stock_actual + v_delta,
        actualizado_en = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aplicar_movimiento ON movimientos_insumo;
CREATE TRIGGER trg_aplicar_movimiento
  AFTER INSERT ON movimientos_insumo
  FOR EACH ROW EXECUTE FUNCTION aplicar_movimiento_insumo();

-- ------------------------------------------------------------------
-- B) Procesar el cierre de una jornada
--    1. Calcula el consumo (declarado por operador, o estimado por BOM).
--    2. Inserta un movimiento de SALIDA por insumo (idempotente).
--    3. Marca las órdenes como descontadas y la jornada como procesada.
--    Devuelve la cantidad de líneas de insumo aplicadas.
--
--    Es SEGURA ante reintentos: si la jornada ya está 'procesada' no hace nada.
-- ------------------------------------------------------------------
-- OUT params con prefijo r_ para no colisionar con columnas (insumo_id, cantidad...)
-- dentro de la consulta (p. ej. en el conflict_target del ON CONFLICT).
-- DROP explícito: CREATE OR REPLACE no permite cambiar los tipos/nombres de OUT.
DROP FUNCTION IF EXISTS procesar_cierre_jornada(UUID);
CREATE OR REPLACE FUNCTION procesar_cierre_jornada(p_jornada_id UUID)
RETURNS TABLE (r_insumo_id UUID, r_sku TEXT, r_cantidad NUMERIC, r_costo NUMERIC) AS $$
DECLARE
  v_plaza    TEXT;
  v_operador TEXT;
  v_estado   TEXT;
  v_usar_declarado BOOLEAN;
BEGIN
  -- Bloqueo para evitar carreras entre el webhook y el respaldo programado.
  SELECT j.plaza, j.operador, j.estado
    INTO v_plaza, v_operador, v_estado
    FROM jornadas j
   WHERE j.id = p_jornada_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada % no existe', p_jornada_id;
  END IF;

  -- Idempotencia dura: si ya se procesó, salir sin efectos.
  IF v_estado = 'procesada' THEN
    RETURN;
  END IF;

  -- ¿El operador declaró consumo real? Entonces manda sobre el estimado.
  v_usar_declarado := EXISTS (SELECT 1 FROM consumo_declarado cd WHERE cd.jornada_id = p_jornada_id);

  -- Construir el consumo agregado por insumo en una CTE temporal.
  RETURN QUERY
  WITH consumo AS (
    -- Rama 1: consumo REAL declarado por el operador
    SELECT cd.insumo_id, cd.cantidad::NUMERIC(12,3) AS cantidad
      FROM consumo_declarado cd
     WHERE v_usar_declarado AND cd.jornada_id = p_jornada_id

    UNION ALL

    -- Rama 2: consumo ESTIMADO por BOM sobre las órdenes completadas de la jornada
    SELECT ce.insumo_id,
           SUM(ce.cantidad_por_unidad * COALESCE(ot.unidades, 1))::NUMERIC(12,3) AS cantidad
      FROM ordenes_trabajo ot
      JOIN consumo_estandar ce
        ON ce.tipo_servicio = ot.tipo_servicio
     WHERE NOT v_usar_declarado
       AND ot.jornada_id = p_jornada_id
       AND ot.estado = 'completado'
       AND ot.insumos_descontados = FALSE
     GROUP BY ce.insumo_id
  ),
  agregado AS (
    SELECT c.insumo_id, SUM(c.cantidad) AS cantidad
      FROM consumo c
     GROUP BY c.insumo_id
    HAVING SUM(c.cantidad) > 0
  ),
  aplicado AS (
    INSERT INTO movimientos_insumo
      (insumo_id, plaza, tipo, cantidad, origen, jornada_id, operador, costo_total, nota)
    SELECT a.insumo_id, v_plaza, 'salida', a.cantidad, 'cierre_jornada',
           p_jornada_id, v_operador,
           ROUND(a.cantidad * i.costo_unitario, 2),
           CASE WHEN v_usar_declarado THEN 'Consumo declarado por operador'
                ELSE 'Consumo estimado por BOM de rutas completadas' END
      FROM agregado a
      JOIN insumos i ON i.id = a.insumo_id
    -- Si por reintento ya existe (jornada_id, insumo_id), no duplica.
    ON CONFLICT (jornada_id, insumo_id) WHERE origen = 'cierre_jornada'
    DO NOTHING
    RETURNING movimientos_insumo.insumo_id, movimientos_insumo.cantidad, movimientos_insumo.costo_total
  )
  SELECT ap.insumo_id, i.sku, ap.cantidad, ap.costo_total
    FROM aplicado ap
    JOIN insumos i ON i.id = ap.insumo_id;

  -- Marcar órdenes de la jornada como descontadas (sincroniza rutas <-> inventario).
  UPDATE ordenes_trabajo
     SET insumos_descontados = TRUE
   WHERE jornada_id = p_jornada_id
     AND estado = 'completado';

  -- Cerrar la jornada con totales.
  UPDATE jornadas j
     SET estado = 'procesada',
         procesada_en = NOW(),
         cerrada_en = COALESCE(j.cerrada_en, NOW()),
         ordenes_completadas = (SELECT COUNT(*) FROM ordenes_trabajo o
                                 WHERE o.jornada_id = p_jornada_id AND o.estado = 'completado'),
         unidades_servidas   = (SELECT COALESCE(SUM(o.unidades),0) FROM ordenes_trabajo o
                                 WHERE o.jornada_id = p_jornada_id AND o.estado = 'completado'),
         costo_insumos       = (SELECT COALESCE(SUM(m.costo_total),0) FROM movimientos_insumo m
                                 WHERE m.jornada_id = p_jornada_id AND m.origen = 'cierre_jornada')
   WHERE j.id = p_jornada_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION procesar_cierre_jornada IS 'Descuenta insumos de una jornada (real declarado o estimado por BOM). Idempotente. Llamado por n8n vía RPC.';

-- ------------------------------------------------------------------
-- C) Alta de stock por compra / reposición
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_entrada(
  p_insumo_id UUID,
  p_plaza     TEXT,
  p_cantidad  NUMERIC,
  p_nota      TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_costo NUMERIC(10,2);
BEGIN
  SELECT costo_unitario INTO v_costo FROM insumos WHERE id = p_insumo_id;
  INSERT INTO movimientos_insumo
    (insumo_id, plaza, tipo, cantidad, origen, costo_total, nota)
  VALUES
    (p_insumo_id, p_plaza, 'entrada', p_cantidad, 'compra',
     ROUND(p_cantidad * COALESCE(v_costo,0), 2), p_nota)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_entrada IS 'Registra entrada de inventario por compra/reposición y actualiza el saldo.';
