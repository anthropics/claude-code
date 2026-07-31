-- ============================================================================
-- Grupo Portátil · Módulo de desempeño de operadores
-- 01_schema.sql — Tabla de servicios de limpieza/campo
--
-- La fuente de verdad es AppSheet (el operador registra check-in, checklist y
-- fotos en campo) → n8n sincroniza cada evento a esta tabla en Supabase.
-- El dashboard NO lee AppSheet directo: lee la vista de KPIs (02_vista_kpis.sql)
-- que se construye sobre esta tabla.
--
-- Ejecutar en el SQL Editor de Supabase (o vía migración) una sola vez.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists servicios_limpieza (
  id                 uuid primary key default gen_random_uuid(),

  -- Enlaces al resto del modelo operativo (ver references/flota.md y contratos.md)
  unidad_id          uuid references unidades(id),
  contrato_id        uuid references contratos(id),

  -- Quién y dónde
  operador           text not null,        -- Alberto / Emmanuel / Meñito / Juan Pablo
  plaza              text not null,        -- MTY / QRO
  tipo_servicio      text not null,        -- limpieza / bombeo / entrega / retiro

  -- Puntualidad: programado vs. real (check-in de AppSheet)
  fecha_programada   timestamptz not null,
  fecha_llegada      timestamptz,          -- hora real de llegada al sitio
  fecha_completado   timestamptz,
  minutos_en_sitio   int,

  -- Estado del servicio
  estado             text not null default 'programado',
                     -- programado / en_ruta / completado / no_realizado
                     -- (un servicio de contrato sin pago confirmado no debe generarse:
                     --  esa validación vive aguas arriba, en la orden de trabajo)

  -- Calidad de ejecución (checklist AppSheet + cliente + retrabajo)
  checklist_items_ok    int,               -- ítems del checklist aprobados
  checklist_items_total int,               -- ítems totales del checklist
  calificacion_cliente  numeric(2,1),      -- 1.0 - 5.0 (opcional, encuesta post-servicio)
  retrabajo             boolean default false,  -- hubo que volver / queja formal
  incidencia            boolean default false,  -- daño o anomalía reportada en el servicio

  foto_evidencia     text,                 -- URL en Supabase Storage
  notas              text,

  creado_en          timestamptz default now(),
  actualizado_en     timestamptz default now(),

  constraint plaza_valida    check (plaza in ('MTY', 'QRO')),
  constraint estado_valido   check (estado in ('programado','en_ruta','completado','no_realizado')),
  constraint checklist_valido check (
    checklist_items_ok is null
    or (checklist_items_ok >= 0 and checklist_items_ok <= checklist_items_total)
  ),
  constraint calif_valida    check (
    calificacion_cliente is null
    or (calificacion_cliente >= 1 and calificacion_cliente <= 5)
  )
);

-- Índices para las consultas del dashboard (filtran por operador, plaza y periodo)
create index if not exists idx_serv_operador  on servicios_limpieza (operador);
create index if not exists idx_serv_plaza      on servicios_limpieza (plaza);
create index if not exists idx_serv_programada on servicios_limpieza (fecha_programada);
create index if not exists idx_serv_estado     on servicios_limpieza (estado);

comment on table servicios_limpieza is
  'Registro de cada servicio de campo (limpieza/bombeo/entrega/retiro) ejecutado por un operador. Alimenta la vista de desempeño.';
