-- =====================================================================
-- Grupo Portátil · Seed de EJEMPLO — geocercas
-- =====================================================================
-- Polígonos ilustrativos para la sucursal MTY (id = 1). Ajustar con las
-- coordenadas reales de cada zona. Formato PostGIS: 'POLYGON((lng lat, ...))'
-- SRID 4326. El anillo debe cerrar (primer punto == último).
--
-- La tarifa base NO se define aquí: sale del contrato (contratos.precio_sin_iva
-- + precio_lavamanos). Estas geocercas solo agregan el RECARGO por ubicación.
-- Los modificadores por tipo de servicio se cargan en la migración 0001
-- (tabla tipos_servicio_modificador).
-- =====================================================================

insert into geocercas (nombre, sucursal_id, poligono, recargo_tipo, recargo_valor, prioridad, notas)
values
  ('MTY Base — Área Metropolitana', 1,
   st_geomfromtext('POLYGON((-100.45 25.55, -100.20 25.55, -100.20 25.80, -100.45 25.80, -100.45 25.55))', 4326),
   'ninguno', 0, 100, 'Zona base sin recargo (ejemplo, ajustar polígono).'),

  ('MTY Foránea Poniente — Santa Catarina/García', 1,
   st_geomfromtext('POLYGON((-100.75 25.55, -100.45 25.55, -100.45 25.85, -100.75 25.85, -100.75 25.55))', 4326),
   'fijo', 250.00, 50, 'Recargo fijo por traslado foráneo poniente (ejemplo).')
on conflict do nothing;

-- Verificación rápida con coordenadas reales de contratos existentes:
--   select nombre, recargo_tipo, recargo_valor from resolver_geocerca(25.639814, -100.384712, 1);  -- base
--   select nombre, recargo_tipo, recargo_valor from resolver_geocerca(25.705905, -100.525547, 1);  -- foránea
