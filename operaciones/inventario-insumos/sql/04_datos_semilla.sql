-- =====================================================================
-- Grupo Portátil · Módulo de Inventario de Insumos
-- 04_datos_semilla.sql — Catálogo base y recetas de consumo (BOM)
-- =====================================================================
-- AJUSTA los valores de cantidad_por_unidad, costos y stock a tu realidad.
-- Estos son valores de arranque razonables para renta de sanitarios.
-- =====================================================================

-- ------------------------------------------------------------------
-- Catálogo de insumos
-- ------------------------------------------------------------------
INSERT INTO insumos (sku, nombre, categoria, unidad_medida, costo_unitario) VALUES
  ('DES-CLORO-L',    'Desinfectante clorado concentrado', 'desinfectante',   'litro', 38.00),
  ('DES-AROMA-L',    'Desodorante aromatizante para tanque','desinfectante',  'litro', 52.00),
  ('PAPEL-HIG-ROLLO','Papel higiénico institucional',      'papel',          'rollo',  6.50),
  ('TOALLA-PAPEL',   'Toalla de papel para manos',         'papel',          'rollo', 18.00),
  ('GEL-ANTIB-L',    'Gel antibacterial',                  'gel_jabon',      'litro', 45.00),
  ('JABON-ESP-L',    'Jabón espuma para dispensador',      'gel_jabon',      'litro', 40.00),
  ('GUANTES-PAR',    'Guantes de nitrilo (par)',           'equipo_limpieza','pieza',  4.00),
  ('BOLSA-RES-PZA',  'Bolsa para residuos reforzada',      'equipo_limpieza','pieza',  3.20),
  ('FIBRA-PZA',      'Fibra / esponja de limpieza',        'equipo_limpieza','pieza',  8.00)
ON CONFLICT (sku) DO NOTHING;

-- ------------------------------------------------------------------
-- Existencias iniciales por plaza (ejemplo — reemplazar por conteo real)
-- ------------------------------------------------------------------
INSERT INTO insumo_existencias (insumo_id, plaza, stock_actual, stock_minimo, stock_reorden)
SELECT i.id, p.plaza, p.stock_ini, p.min, p.reorden
FROM insumos i
JOIN (VALUES
  -- sku,              plaza, stock_ini, min,  reorden
  ('DES-CLORO-L',      'MTY', 120,  40,  120),
  ('DES-CLORO-L',      'QRO',  60,  20,   60),
  ('DES-AROMA-L',      'MTY',  80,  30,   80),
  ('DES-AROMA-L',      'QRO',  40,  15,   40),
  ('PAPEL-HIG-ROLLO',  'MTY', 600, 200,  600),
  ('PAPEL-HIG-ROLLO',  'QRO', 300, 100,  300),
  ('TOALLA-PAPEL',     'MTY', 200,  60,  200),
  ('TOALLA-PAPEL',     'QRO', 100,  30,  100),
  ('GEL-ANTIB-L',      'MTY',  60,  20,   60),
  ('GEL-ANTIB-L',      'QRO',  30,  10,   30),
  ('JABON-ESP-L',      'MTY',  50,  20,   50),
  ('JABON-ESP-L',      'QRO',  25,  10,   25),
  ('GUANTES-PAR',      'MTY', 400, 100,  400),
  ('GUANTES-PAR',      'QRO', 200,  50,  200),
  ('BOLSA-RES-PZA',    'MTY', 500, 150,  500),
  ('BOLSA-RES-PZA',    'QRO', 250,  80,  250),
  ('FIBRA-PZA',        'MTY', 120,  40,  120),
  ('FIBRA-PZA',        'QRO',  60,  20,   60)
) AS p(sku, plaza, stock_ini, min, reorden) ON p.sku = i.sku
ON CONFLICT (insumo_id, plaza) DO NOTHING;

-- ------------------------------------------------------------------
-- Recetas de consumo (BOM) por tipo de servicio, por unidad servida
-- ------------------------------------------------------------------
-- LIMPIEZA / BOMBEO (servicio periódico — el más frecuente)
INSERT INTO consumo_estandar (tipo_servicio, insumo_id, cantidad_por_unidad)
SELECT 'limpieza', i.id, v.cant
FROM insumos i
JOIN (VALUES
  ('DES-CLORO-L',     0.30),
  ('DES-AROMA-L',     0.20),
  ('PAPEL-HIG-ROLLO', 2.00),
  ('GEL-ANTIB-L',     0.10),
  ('JABON-ESP-L',     0.10),
  ('GUANTES-PAR',     1.00),
  ('BOLSA-RES-PZA',   1.00),
  ('FIBRA-PZA',       0.20)
) AS v(sku, cant) ON v.sku = i.sku
ON CONFLICT (tipo_servicio, insumo_id) DO NOTHING;

-- ENTREGA (colocación de unidad nueva — se deja dotación inicial)
INSERT INTO consumo_estandar (tipo_servicio, insumo_id, cantidad_por_unidad)
SELECT 'entrega', i.id, v.cant
FROM insumos i
JOIN (VALUES
  ('DES-CLORO-L',     0.20),
  ('DES-AROMA-L',     0.20),
  ('PAPEL-HIG-ROLLO', 3.00),
  ('GEL-ANTIB-L',     0.25),
  ('JABON-ESP-L',     0.25),
  ('GUANTES-PAR',     1.00)
) AS v(sku, cant) ON v.sku = i.sku
ON CONFLICT (tipo_servicio, insumo_id) DO NOTHING;

-- RETIRO (limpieza final antes de volver al patio)
INSERT INTO consumo_estandar (tipo_servicio, insumo_id, cantidad_por_unidad)
SELECT 'retiro', i.id, v.cant
FROM insumos i
JOIN (VALUES
  ('DES-CLORO-L',   0.25),
  ('GUANTES-PAR',   1.00),
  ('BOLSA-RES-PZA', 1.00),
  ('FIBRA-PZA',     0.30)
) AS v(sku, cant) ON v.sku = i.sku
ON CONFLICT (tipo_servicio, insumo_id) DO NOTHING;

-- SERVICIO ESPECIAL (limpieza extra / reposición a demanda)
INSERT INTO consumo_estandar (tipo_servicio, insumo_id, cantidad_por_unidad)
SELECT 'servicio_especial', i.id, v.cant
FROM insumos i
JOIN (VALUES
  ('DES-CLORO-L',     0.40),
  ('DES-AROMA-L',     0.30),
  ('PAPEL-HIG-ROLLO', 2.00),
  ('GEL-ANTIB-L',     0.15),
  ('JABON-ESP-L',     0.15),
  ('GUANTES-PAR',     1.00),
  ('BOLSA-RES-PZA',   1.00),
  ('FIBRA-PZA',       0.30)
) AS v(sku, cant) ON v.sku = i.sku
ON CONFLICT (tipo_servicio, insumo_id) DO NOTHING;

-- INSPECCIÓN: no consume insumos (revisión visual), se omite del BOM.
