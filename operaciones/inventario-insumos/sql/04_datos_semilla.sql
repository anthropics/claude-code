-- ============================================================
-- Grupo Portátil · Inventario de insumos
-- 04_datos_semilla.sql — Catálogo base, existencias y BOM
-- ============================================================
-- DESPLEGADO (via execute_sql, todo idempotente con ON CONFLICT DO NOTHING).
-- Existencias sembradas SOLO para MTY (sucursal_id=1): es la única sucursal
-- que existe hoy en `sucursales`. Al dar de alta QRO, sembrar sus existencias.
-- AJUSTAR cantidades del BOM, costos y stock a la realidad de GP.
-- ============================================================

-- Catálogo de insumos
INSERT INTO insumos (sku, nombre, categoria, unidad_medida, costo_unitario) VALUES
  ('DES-CLORO-L',    'Desinfectante clorado concentrado',  'desinfectante',   'litro', 38.00),
  ('DES-AROMA-L',    'Desodorante aromatizante para tanque','desinfectante',  'litro', 52.00),
  ('PAPEL-HIG-ROLLO','Papel higiénico institucional',      'papel',          'rollo',  6.50),
  ('TOALLA-PAPEL',   'Toalla de papel para manos',         'papel',          'rollo', 18.00),
  ('GEL-ANTIB-L',    'Gel antibacterial',                  'gel_jabon',      'litro', 45.00),
  ('JABON-ESP-L',    'Jabón espuma para dispensador',      'gel_jabon',      'litro', 40.00),
  ('GUANTES-PAR',    'Guantes de nitrilo (par)',           'equipo_limpieza','pieza',  4.00),
  ('BOLSA-RES-PZA',  'Bolsa para residuos reforzada',      'equipo_limpieza','pieza',  3.20),
  ('FIBRA-PZA',      'Fibra / esponja de limpieza',        'equipo_limpieza','pieza',  8.00)
ON CONFLICT (sku) DO NOTHING;

-- Existencias iniciales para MTY (sucursal_id=1). Reemplazar por conteo físico real.
INSERT INTO insumo_existencias (insumo_id, sucursal_id, stock_actual, stock_minimo, stock_reorden)
SELECT i.id, 1, v.ini, v.min, v.reorden
FROM insumos i JOIN (VALUES
  ('DES-CLORO-L',120,40,120),('DES-AROMA-L',80,30,80),
  ('PAPEL-HIG-ROLLO',600,200,600),('TOALLA-PAPEL',200,60,200),
  ('GEL-ANTIB-L',60,20,60),('JABON-ESP-L',50,20,50),
  ('GUANTES-PAR',400,100,400),('BOLSA-RES-PZA',500,150,500),('FIBRA-PZA',120,40,120)
) AS v(sku,ini,min,reorden) ON v.sku=i.sku
ON CONFLICT (insumo_id, sucursal_id) DO NOTHING;

-- BOM: consumo por servicio (= por unidad servida) según tipo de servicio.
-- Tipos reales de servicios.tipo: LIMPIEZA, ENTREGA, RETIRO, INSPECCION, EXTRA.
-- INSPECCION no consume insumos (no aparece aquí).
INSERT INTO consumo_estandar (tipo_servicio, insumo_id, cantidad_por_servicio)
SELECT t.tipo, i.id, t.cant FROM insumos i JOIN (VALUES
  ('LIMPIEZA','DES-CLORO-L',0.30),('LIMPIEZA','DES-AROMA-L',0.20),('LIMPIEZA','PAPEL-HIG-ROLLO',2.00),
  ('LIMPIEZA','GEL-ANTIB-L',0.10),('LIMPIEZA','JABON-ESP-L',0.10),('LIMPIEZA','GUANTES-PAR',1.00),
  ('LIMPIEZA','BOLSA-RES-PZA',1.00),('LIMPIEZA','FIBRA-PZA',0.20),
  ('ENTREGA','DES-CLORO-L',0.20),('ENTREGA','DES-AROMA-L',0.20),('ENTREGA','PAPEL-HIG-ROLLO',3.00),
  ('ENTREGA','GEL-ANTIB-L',0.25),('ENTREGA','JABON-ESP-L',0.25),('ENTREGA','GUANTES-PAR',1.00),
  ('RETIRO','DES-CLORO-L',0.25),('RETIRO','GUANTES-PAR',1.00),('RETIRO','BOLSA-RES-PZA',1.00),('RETIRO','FIBRA-PZA',0.30),
  ('EXTRA','DES-CLORO-L',0.40),('EXTRA','DES-AROMA-L',0.30),('EXTRA','PAPEL-HIG-ROLLO',2.00),
  ('EXTRA','GEL-ANTIB-L',0.15),('EXTRA','JABON-ESP-L',0.15),('EXTRA','GUANTES-PAR',1.00),
  ('EXTRA','BOLSA-RES-PZA',1.00),('EXTRA','FIBRA-PZA',0.30)
) AS t(tipo,sku,cant) ON t.sku=i.sku
ON CONFLICT (tipo_servicio, insumo_id) DO NOTHING;
