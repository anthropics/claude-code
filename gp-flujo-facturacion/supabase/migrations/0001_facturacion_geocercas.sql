-- =====================================================================
-- Grupo Portátil · Recargo por geocerca + tarifa por servicio
-- Migración 0001 — ADITIVA sobre el schema real de gp-inventario
-- =====================================================================
-- Esta migración NO recrea tus tablas. Se apoya en las existentes:
--   contratos(id int, precio_sin_iva, precio_lavamanos, tiene_lavamanos,
--             total_con_iva, tipo_servicio, latitud, longitud,
--             datos_fiscales, activo, sucursal_id)
--   servicios(id int, contrato_id, tipo, completado, checkout_lat,
--             checkout_lng, checkout_time)
--   facturas(id int, contrato_id, cobro_id, facturama_id, folio_fiscal,
--            subtotal, iva, total, estado, pdf_url, xml_url, ...)
--   cobros(id, contrato_id, estado, periodo_inicio, ...)
--   sucursales(id, clave, ciudad, estado)
--
-- Solo AGREGA: extensión PostGIS, tabla geocercas, tabla
-- tipos_servicio_modificador, columnas nulas en facturas, funciones y una
-- vista. Reversible y sin migrar datos.
--
-- Reglas de negocio detectadas en los datos reales:
--   * datos_fiscales = 'FACTURA'  -> lleva IVA 16% y se timbra CFDI.
--   * datos_fiscales = 'REMISION' -> comprobante no fiscal, sin IVA.
--   * Tarifa base del servicio = precio_sin_iva (+ precio_lavamanos si aplica).
--   * Coordenada del servicio = servicios.checkout_lat/lng, si falta usa
--     contratos.latitud/longitud.
-- =====================================================================

create extension if not exists postgis;

-- ---------------------------------------------------------------------
-- 1. Geocercas (zonas por polígono con recargo)
-- ---------------------------------------------------------------------
-- Polígono en coordenadas Google Maps (SRID 4326, lng lat). El recargo se
-- aplica sobre el subtotal del servicio:
--   recargo_tipo = 'fijo'       -> suma recargo_valor MXN
--   recargo_tipo = 'porcentaje' -> suma subtotal * recargo_valor/100
--   recargo_tipo = 'ninguno'    -> zona base
create table if not exists geocercas (
  id            bigint generated always as identity primary key,
  nombre        text not null,
  sucursal_id   integer references sucursales(id),   -- nullable: si NULL aplica a cualquier plaza
  poligono      geometry(Polygon, 4326) not null,
  recargo_tipo  text not null default 'ninguno'
                  check (recargo_tipo in ('ninguno','fijo','porcentaje')),
  recargo_valor numeric(10,2) not null default 0,
  prioridad     int not null default 100,            -- menor gana en traslapes
  activa        boolean not null default true,
  notas         text,
  created_at    timestamptz not null default now()
);

comment on table geocercas is 'Zonas geográficas (polígonos) con recargo de tarifa por ubicación.';
create index if not exists idx_geocercas_poligono on geocercas using gist (poligono);
create index if not exists idx_geocercas_activa on geocercas (activa) where activa;

-- ---------------------------------------------------------------------
-- 2. Modificador por tipo de servicio (multiplicador de tarifa)
-- ---------------------------------------------------------------------
-- servicios.tipo es texto libre (LIMPIEZA, ENTREGA, ...). Esta tabla mapea
-- cada tipo a un multiplicador. Si un tipo no está aquí, se asume 1.00.
create table if not exists tipos_servicio_modificador (
  clave        text primary key,        -- coincide con servicios.tipo (mayúsculas)
  descripcion  text,
  modificador  numeric(5,2) not null default 1.00,
  facturable   boolean not null default true
);

comment on table tipos_servicio_modificador is 'Multiplicador de tarifa por tipo de servicio (servicios.tipo).';

insert into tipos_servicio_modificador (clave, descripcion, modificador, facturable) values
  ('LIMPIEZA',   'Limpieza / bombeo periódico', 1.00, true),
  ('ENTREGA',    'Entrega de unidad',           1.00, true),
  ('RETIRO',     'Retiro de unidad',            1.00, true),
  ('EXTRA',      'Servicio extra / urgente',    1.50, true),
  ('INSPECCION', 'Inspección de cortesía',      0.00, false)
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 3. Columnas aditivas en facturas (ligar factura ↔ servicio y desglose)
-- ---------------------------------------------------------------------
alter table facturas add column if not exists servicio_id  integer references servicios(id);
alter table facturas add column if not exists geocerca_id  bigint  references geocercas(id);
alter table facturas add column if not exists recargo_zona numeric(12,2) default 0;
alter table facturas add column if not exists desglose     jsonb;

-- Evita facturar dos veces el mismo servicio (cuando servicio_id está seteado).
create unique index if not exists uq_facturas_servicio
  on facturas (servicio_id) where servicio_id is not null;

-- ---------------------------------------------------------------------
-- 4. Función: resolver geocerca de una coordenada
-- ---------------------------------------------------------------------
-- Geocerca activa de mayor prioridad (menor `prioridad`) que contiene el
-- punto. Si p_sucursal_id no es NULL, filtra geocercas de esa sucursal o
-- de sucursal NULL (comodín). NULL si ninguna aplica.
create or replace function resolver_geocerca(
  p_lat        double precision,
  p_lng        double precision,
  p_sucursal_id integer default null
)
returns geocercas
language sql
stable
as $$
  select g.*
  from geocercas g
  where g.activa
    and (p_sucursal_id is null or g.sucursal_id is null or g.sucursal_id = p_sucursal_id)
    and st_contains(g.poligono, st_setsrid(st_makepoint(p_lng, p_lat), 4326))
  order by g.prioridad asc
  limit 1;
$$;

comment on function resolver_geocerca is 'Geocerca activa que contiene el punto (lat,lng), opcionalmente filtrada por sucursal.';

-- ---------------------------------------------------------------------
-- 5. Función núcleo: calcular tarifa de un servicio
-- ---------------------------------------------------------------------
-- Fuente única de verdad del precio. Lee el servicio y su contrato reales.
--   base       = contratos.precio_sin_iva (+ precio_lavamanos si tiene_lavamanos)
--   modificador= tipos_servicio_modificador[servicios.tipo]  (default 1.00)
--   recargo    = geocerca sobre la coordenada del servicio (o del contrato)
--   IVA        = 16% SOLO si el contrato es 'FACTURA' (los 'REMISION' no)
-- Devuelve el desglose completo en JSONB, incluido `es_fiscal` para que el
-- flujo decida timbrar CFDI (FACTURA) o generar remisión (REMISION).
create or replace function calcular_tarifa_servicio(p_servicio_id integer)
returns jsonb
language plpgsql
stable
as $$
declare
  v_serv     servicios%rowtype;
  v_contr    contratos%rowtype;
  v_mod      tipos_servicio_modificador%rowtype;
  v_geo      geocercas%rowtype;
  v_lat      double precision;
  v_lng      double precision;
  v_base     numeric(12,2);
  v_modif    numeric(5,2) := 1.00;
  v_subtotal_base numeric(12,2);
  v_recargo  numeric(12,2) := 0;
  v_subtotal numeric(12,2);
  v_es_fiscal boolean;
  v_iva_tasa numeric(4,3) := 0.16;
  v_iva      numeric(12,2);
  v_total    numeric(12,2);
begin
  select * into v_serv from servicios where id = p_servicio_id;
  if not found then
    raise exception 'Servicio % no existe', p_servicio_id;
  end if;

  select * into v_contr from contratos where id = v_serv.contrato_id;
  if not found then
    raise exception 'Contrato del servicio % no existe', p_servicio_id;
  end if;

  -- Modificador por tipo de servicio (default 1.00 si no está catalogado).
  select * into v_mod from tipos_servicio_modificador
   where clave = upper(coalesce(v_serv.tipo, 'LIMPIEZA'));
  if found then
    v_modif := v_mod.modificador;
    if not v_mod.facturable then
      return jsonb_build_object(
        'facturable', false,
        'motivo', 'tipo de servicio no facturable',
        'servicio_id', v_serv.id,
        'total', 0
      );
    end if;
  end if;

  -- Tarifa base desde el contrato.
  v_base := coalesce(v_contr.precio_sin_iva, 0)
          + case when coalesce(v_contr.tiene_lavamanos, false)
                 then coalesce(v_contr.precio_lavamanos, 0) else 0 end;

  v_subtotal_base := round(v_base * v_modif, 2);

  -- Coordenada: la del checkout del servicio; si falta, la del contrato.
  v_lat := coalesce(v_serv.checkout_lat, v_contr.latitud);
  v_lng := coalesce(v_serv.checkout_lng, v_contr.longitud);

  if v_lat is not null and v_lng is not null then
    select * into v_geo from resolver_geocerca(v_lat, v_lng, v_contr.sucursal_id);
    if found and v_geo.recargo_tipo = 'fijo' then
      v_recargo := v_geo.recargo_valor;
    elsif found and v_geo.recargo_tipo = 'porcentaje' then
      v_recargo := round(v_subtotal_base * v_geo.recargo_valor / 100.0, 2);
    end if;
  end if;

  v_subtotal := v_subtotal_base + v_recargo;

  -- ¿Es fiscal? datos_fiscales = 'FACTURA' -> IVA + CFDI. 'REMISION' -> sin IVA.
  v_es_fiscal := upper(coalesce(v_contr.datos_fiscales, '')) like '%FACTURA%';

  if v_es_fiscal then
    v_iva := round(v_subtotal * v_iva_tasa, 2);
  else
    v_iva := 0;
  end if;
  v_total := v_subtotal + v_iva;

  return jsonb_build_object(
    'facturable', true,
    'es_fiscal', v_es_fiscal,
    'documento', case when v_es_fiscal then 'CFDI' else 'REMISION' end,
    'servicio_id', v_serv.id,
    'contrato_id', v_contr.id,
    'cliente', v_contr.cliente,
    'sucursal_id', v_contr.sucursal_id,
    'tipo_servicio', upper(coalesce(v_serv.tipo, 'LIMPIEZA')),
    'precio_base_contrato', v_contr.precio_sin_iva,
    'precio_lavamanos', case when coalesce(v_contr.tiene_lavamanos,false) then v_contr.precio_lavamanos else 0 end,
    'base', v_base,
    'modificador_servicio', v_modif,
    'subtotal_base', v_subtotal_base,
    'geocerca_id', case when v_geo.id is not null then v_geo.id else null end,
    'geocerca_nombre', v_geo.nombre,
    'recargo_zona', v_recargo,
    'subtotal', v_subtotal,
    'iva_tasa', case when v_es_fiscal then v_iva_tasa else 0 end,
    'iva', v_iva,
    'total', v_total,
    'lat', v_lat,
    'lng', v_lng,
    'moneda', 'MXN'
  );
end;
$$;

comment on function calcular_tarifa_servicio is 'Fuente única del precio de un servicio (base del contrato + geocerca, IVA solo si FACTURA). Devuelve desglose JSONB.';

-- ---------------------------------------------------------------------
-- 6. Vista: servicios listos para facturar
-- ---------------------------------------------------------------------
-- Servicios completados, de contrato activo, aún no ligados a una factura,
-- y con cobro anticipado confirmado (existe un cobro 'pagado' del contrato).
create or replace view servicios_por_facturar as
select
  s.id            as servicio_id,
  s.contrato_id,
  c.contrato_num,
  c.cliente,
  c.sucursal_id,
  s.tipo          as tipo_servicio,
  s.checkout_lat,
  s.checkout_lng,
  s.checkout_time,
  s.operador,
  upper(coalesce(c.datos_fiscales,'')) like '%FACTURA%' as es_fiscal
from servicios s
join contratos c on c.id = s.contrato_id
where s.completado = true
  and coalesce(c.activo, true) = true
  and not exists (select 1 from facturas f where f.servicio_id = s.id)
  and exists (
        select 1 from cobros cb
        where cb.contrato_id = c.id and cb.estado = 'pagado'
      );

comment on view servicios_por_facturar is 'Servicios completados, con cobro confirmado, sin factura. Fuente del flujo n8n.';
