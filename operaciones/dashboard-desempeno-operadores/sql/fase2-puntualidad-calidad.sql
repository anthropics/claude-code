-- ============================================================================
-- Grupo Portátil · Desempeño de operadores — FASE 2 (NO desplegada aún)
-- fase2-puntualidad-calidad.sql
--
-- Habilita los KPIs de PUNTUALIDAD y CALIDAD DE EJECUCIÓN.
-- La tabla `servicios` actual no tiene con qué calcularlos (no hay hora
-- programada, checklist ni calificación). Este script agrega esos campos
-- de forma NO destructiva (columnas nullable) para que AppSheet los capture.
--
-- Requiere decisión de negocio antes de aplicar:
--   1. AppSheet debe capturar hora programada y hora de llegada (check-in).
--   2. AppSheet debe capturar checklist (ok/total), calificación y retrabajo.
-- Aplicar con apply_migration solo cuando la captura esté lista.
-- ============================================================================

-- 1) Campos de captura (nullable = no rompe filas existentes) --------------
alter table servicios add column if not exists hora_programada     timestamptz;
alter table servicios add column if not exists hora_llegada        timestamptz;  -- check-in real
alter table servicios add column if not exists checklist_ok        int;
alter table servicios add column if not exists checklist_total     int;
alter table servicios add column if not exists calificacion_cliente numeric(2,1); -- 1.0 - 5.0
alter table servicios add column if not exists retrabajo           boolean default false;

-- 2) Vista ampliada con los tres KPIs --------------------------------------
create or replace view vista_desempeno_operadores as
with s as (
  select
    coalesce(nullif(sv.operador, ''), op.alias, 'Sin asignar') as operador,
    coalesce(suc.clave, 'MTY')                                 as plaza,
    to_char(sv.fecha_servicio, 'IYYY') || '-W'
      || to_char(sv.fecha_servicio, 'IW')                      as semana,
    date_trunc('week', sv.fecha_servicio)::date                as semana_inicio,
    sv.completado,
    -- puntualidad: llegada dentro de 15 min de la hora programada
    (sv.hora_llegada is not null and sv.hora_programada is not null
      and sv.hora_llegada <= sv.hora_programada + interval '15 minutes') as a_tiempo,
    (sv.hora_llegada is not null and sv.hora_programada is not null)      as con_checkin,
    sv.checklist_ok, sv.checklist_total, sv.calificacion_cliente, sv.retrabajo
  from servicios sv
  left join operadores  op  on op.id  = sv.operador_id
  left join contratos   c   on c.id   = sv.contrato_id
  left join sucursales  suc on suc.id = c.sucursal_id
)
select
  operador, plaza, semana, semana_inicio,
  count(*) filter (where completado)  as servicios_completados,
  count(*)                            as servicios_registrados,
  count(*) filter (where a_tiempo)    as servicios_a_tiempo,
  count(*) filter (where con_checkin) as servicios_con_checkin,
  sum(checklist_ok)                   as checklist_ok,
  sum(checklist_total)                as checklist_total,
  avg(calificacion_cliente)           as calif_cliente_prom,
  count(*) filter (where retrabajo)   as retrabajos,
  -- KPI puntualidad (%)
  case when count(*) filter (where con_checkin) > 0
       then round(100.0 * count(*) filter (where a_tiempo)
                        / count(*) filter (where con_checkin), 1) end as puntualidad_pct,
  -- KPI calidad (0-100): 50% checklist + 30% calif cliente + 20% sin retrabajo
  round(
      0.50 * coalesce(100.0 * sum(checklist_ok) / nullif(sum(checklist_total),0), 0)
    + 0.30 * coalesce(100.0 * avg(calificacion_cliente) / 5.0, 0)
    + 0.20 * (100.0 - coalesce(100.0 * count(*) filter (where retrabajo)
                    / nullif(count(*) filter (where completado),0), 0))
  , 1)                                as calidad_score
from s
group by operador, plaza, semana, semana_inicio
order by semana desc, servicios_completados desc;

grant select on vista_desempeno_operadores to anon;
