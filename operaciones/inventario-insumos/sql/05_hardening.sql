-- ============================================================
-- Grupo Portátil · Inventario de insumos
-- 05_hardening.sql — Endurecimiento de seguridad
-- ============================================================
-- DESPLEGADO. Migración aplicada: insumos_inventario_hardening
-- Limpia los advisories de Supabase para los objetos de este módulo:
--   - security_definer_view (ERROR)  -> vistas respetan RLS del que consulta
--   - function_search_path_mutable (WARN) -> search_path fijo
-- ============================================================

-- Vistas: respetar RLS del usuario que consulta
ALTER VIEW v_inventario_actual       SET (security_invoker = true);
ALTER VIEW v_insumos_bajo_minimo     SET (security_invoker = true);
ALTER VIEW v_consumo_semanal_insumo  SET (security_invoker = true);
ALTER VIEW v_rutas_sin_procesar      SET (security_invoker = true);

-- Funciones: search_path fijo
ALTER FUNCTION aplicar_movimiento_insumo()                SET search_path = public, pg_temp;
ALTER FUNCTION procesar_cierre_ruta(INT)                  SET search_path = public, pg_temp;
ALTER FUNCTION procesar_cierre_dia(INT, DATE)             SET search_path = public, pg_temp;
ALTER FUNCTION registrar_entrada(INT, INT, NUMERIC, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION revisar_stock_minimo(INT)                  SET search_path = public, pg_temp;
