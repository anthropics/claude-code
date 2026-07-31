-- =====================================================================
-- Grupo Portátil · Módulo de Inventario de Insumos
-- 01_schema.sql — Estructura de datos (Supabase / PostgreSQL)
-- =====================================================================
-- Objetivo: registrar y descontar automáticamente el consumo de insumos
-- (desinfectantes, papel, gel/jabón, equipo de limpieza) al cierre de
-- cada jornada de servicio, sincronizado con las rutas/órdenes completadas.
--
-- Diseño de fuente de verdad:
--   movimientos_insumo  = libro mayor (ledger) inmutable de entradas/salidas
--   insumo_existencias  = saldo vivo por plaza (lo mantiene un trigger)
--   El saldo NUNCA se edita a mano: siempre vía un movimiento.
--
-- Se asume que ya existen las tablas `unidades`, `contratos`, `clientes`
-- y `ordenes_trabajo` (registro de rutas completadas). Al final del archivo
-- se extiende `ordenes_trabajo` con banderas de control de idempotencia; si
-- tu tabla tiene otro nombre, ajusta esa sección.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1) Catálogo de insumos
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insumos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             TEXT UNIQUE NOT NULL,              -- ej: 'DES-CLORO-20L'
  nombre          TEXT NOT NULL,                     -- 'Desinfectante clorado'
  categoria       TEXT NOT NULL
                    CHECK (categoria IN ('desinfectante','papel','gel_jabon',
                                         'equipo_limpieza','otro')),
  unidad_medida   TEXT NOT NULL,                     -- 'litro','ml','rollo','pieza','kg'
  costo_unitario  NUMERIC(10,2) NOT NULL DEFAULT 0,  -- costo por unidad_medida
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE insumos IS 'Catálogo maestro de insumos de servicio y limpieza.';

-- ------------------------------------------------------------------
-- 2) Existencias por plaza (saldo vivo — lo mantiene el trigger)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insumo_existencias (
  insumo_id       UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  plaza           TEXT NOT NULL CHECK (plaza IN ('MTY','QRO')),
  stock_actual    NUMERIC(12,3) NOT NULL DEFAULT 0,  -- puede quedar negativo => alerta de desfase
  stock_minimo    NUMERIC(12,3) NOT NULL DEFAULT 0,  -- umbral de reorden
  stock_reorden   NUMERIC(12,3),                     -- cantidad sugerida a pedir (NULL => stock_minimo*2)
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (insumo_id, plaza)
);

COMMENT ON TABLE insumo_existencias IS 'Saldo de inventario por plaza. No editar stock_actual a mano: usar movimientos_insumo.';

-- ------------------------------------------------------------------
-- 3) Consumo estándar por tipo de servicio (Bill of Materials)
--    Cuánto insumo consume, en promedio, servir UNA unidad sanitaria.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consumo_estandar (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_servicio      TEXT NOT NULL
                       CHECK (tipo_servicio IN ('limpieza','entrega','retiro',
                                                'inspeccion','servicio_especial')),
  insumo_id          UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  cantidad_por_unidad NUMERIC(12,3) NOT NULL CHECK (cantidad_por_unidad >= 0),
  UNIQUE (tipo_servicio, insumo_id)
);

COMMENT ON TABLE consumo_estandar IS 'Receta de consumo (BOM): insumo por unidad servida según tipo de servicio.';

-- ------------------------------------------------------------------
-- 4) Jornada de servicio (cierre por operador / plaza / día)
--    Es la bisagra entre "rutas completadas" e "inventario".
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jornadas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operador            TEXT NOT NULL,                 -- Alberto / Emmanuel / Meñito / Juan Pablo
  plaza               TEXT NOT NULL CHECK (plaza IN ('MTY','QRO')),
  fecha               DATE NOT NULL,
  estado              TEXT NOT NULL DEFAULT 'abierta'
                        CHECK (estado IN ('abierta','cerrada','procesada')),
  ordenes_completadas INT NOT NULL DEFAULT 0,
  unidades_servidas   INT NOT NULL DEFAULT 0,
  costo_insumos       NUMERIC(12,2) NOT NULL DEFAULT 0,
  cerrada_en          TIMESTAMPTZ,                   -- cuando el operador cierra en AppSheet
  procesada_en        TIMESTAMPTZ,                   -- cuando n8n aplicó los descuentos
  UNIQUE (operador, plaza, fecha)
);

COMMENT ON TABLE jornadas IS 'Cierre diario por operador. estado: abierta->cerrada(operador)->procesada(n8n).';

-- ------------------------------------------------------------------
-- 5) Consumo declarado por el operador (opcional, override del estimado)
--    Si el operador captura cantidades REALES al cerrar, mandan sobre el BOM.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consumo_declarado (
  jornada_id  UUID NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
  insumo_id   UUID NOT NULL REFERENCES insumos(id),
  cantidad    NUMERIC(12,3) NOT NULL CHECK (cantidad >= 0),
  PRIMARY KEY (jornada_id, insumo_id)
);

COMMENT ON TABLE consumo_declarado IS 'Cantidades reales capturadas por el operador; si existen para una jornada, sustituyen al estimado por BOM.';

-- ------------------------------------------------------------------
-- 6) Movimientos de inventario (LEDGER — fuente de verdad)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_insumo (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id         UUID NOT NULL REFERENCES insumos(id),
  plaza             TEXT NOT NULL CHECK (plaza IN ('MTY','QRO')),
  tipo              TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste')),
  cantidad          NUMERIC(12,3) NOT NULL,          -- >0 en entrada/salida; con signo en ajuste
  origen            TEXT NOT NULL
                      CHECK (origen IN ('cierre_jornada','compra','ajuste_manual','merma','inventario_fisico')),
  jornada_id        UUID REFERENCES jornadas(id),
  orden_trabajo_id  UUID,                            -- REFERENCES ordenes_trabajo(id)
  operador          TEXT,
  costo_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  nota              TEXT,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- entrada/salida deben ser positivas; ajuste puede ser negativo pero nunca cero
  CONSTRAINT mov_cantidad_valida CHECK (
    (tipo = 'ajuste'  AND cantidad <> 0) OR
    (tipo IN ('entrada','salida') AND cantidad > 0)
  )
);

COMMENT ON TABLE movimientos_insumo IS 'Libro mayor inmutable de inventario. Cada movimiento ajusta insumo_existencias vía trigger.';

CREATE INDEX IF NOT EXISTS idx_mov_insumo_plaza  ON movimientos_insumo (insumo_id, plaza);
CREATE INDEX IF NOT EXISTS idx_mov_jornada       ON movimientos_insumo (jornada_id);
CREATE INDEX IF NOT EXISTS idx_mov_fecha         ON movimientos_insumo (creado_en);

-- Idempotencia: una jornada no puede descontar el mismo insumo dos veces.
-- Blinda contra reintentos de n8n o doble clic de "cerrar jornada".
CREATE UNIQUE INDEX IF NOT EXISTS uniq_salida_jornada_insumo
  ON movimientos_insumo (jornada_id, insumo_id)
  WHERE origen = 'cierre_jornada';

-- ------------------------------------------------------------------
-- 7) Extensión a ordenes_trabajo (registro de rutas completadas)
--    Banderas de control para sincronizar rutas <-> inventario.
--    Ajusta el nombre de la tabla si en tu Supabase difiere.
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.ordenes_trabajo') IS NOT NULL THEN
    ALTER TABLE ordenes_trabajo
      ADD COLUMN IF NOT EXISTS jornada_id UUID REFERENCES jornadas(id),
      ADD COLUMN IF NOT EXISTS insumos_descontados BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS idx_ot_jornada ON ordenes_trabajo (jornada_id);
  ELSE
    RAISE NOTICE 'Tabla ordenes_trabajo no encontrada: crea las banderas jornada_id e insumos_descontados en tu tabla de rutas completadas.';
  END IF;
END $$;
