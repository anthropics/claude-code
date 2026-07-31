-- ============================================================================
-- Grupo Portátil · Módulo de desempeño de operadores
-- 02_vista_kpis.sql — Vista semanal de KPIs por operador
--
-- Una fila por (operador, plaza, semana ISO). El dashboard consume esta vista
-- vía la API REST de Supabase (PostgREST) y agrega en el navegador según los
-- filtros de plaza y periodo. La misma vista alimenta el reporte semanal por
-- WhatsApp (n8n).
--
-- KPIs clave:
--   • Puntualidad      = % de servicios completados que llegaron dentro de la
--                        tolerancia (15 min sobre la hora programada).
--   • Servicios compl. = # de servicios en estado 'completado'.
--   • Calidad de ejec. = score 0-100 ponderado:
--                        50% cumplimiento de checklist
--                        30% calificación del cliente (normalizada a 100)
--                        20% ausencia de retrabajo
-- ============================================================================

create or replace view vista_desempeno_operadores as
with base as (
  select
    operador,
    plaza,
    -- Semana ISO como etiqueta ordenable, ej. '2026-W31'
    to_char(fecha_programada, 'IYYY') || '-W' || to_char(fecha_programada, 'IW') as semana,
    date_trunc('week', fecha_programada)::date as semana_inicio,

    -- Volumen
    count(*) filter (where estado = 'completado')                       as servicios_completados,
    count(*)                                                             as servicios_programados,
    count(*) filter (where estado = 'no_realizado')                     as servicios_no_realizados,

    -- Puntualidad (solo sobre completados con check-in registrado)
    count(*) filter (
      where estado = 'completado'
        and fecha_llegada is not null
        and fecha_llegada <= fecha_programada + interval '15 minutes'
    )                                                                    as servicios_a_tiempo,
    count(*) filter (
      where estado = 'completado' and fecha_llegada is not null
    )                                                                    as servicios_con_checkin,

    -- Calidad — insumos crudos (se ponderan abajo)
    sum(checklist_items_ok)                                              as checklist_ok,
    sum(checklist_items_total)                                           as checklist_total,
    avg(calificacion_cliente)                                            as calif_cliente_prom,
    count(*) filter (where retrabajo)                                    as retrabajos,
    count(*) filter (where incidencia)                                   as incidencias,
    avg(minutos_en_sitio)                                                as minutos_prom
  from servicios_limpieza
  group by 1, 2, 3, 4
)
select
  operador,
  plaza,
  semana,
  semana_inicio,
  servicios_completados,
  servicios_programados,
  servicios_no_realizados,
  servicios_a_tiempo,
  servicios_con_checkin,
  retrabajos,
  incidencias,
  round(minutos_prom)::int as minutos_prom,

  -- Insumos crudos de calidad (permiten reagregar por periodo sin promediar %)
  checklist_ok,
  checklist_total,

  -- KPI 1 · Puntualidad (%)
  case when servicios_con_checkin > 0
       then round(100.0 * servicios_a_tiempo / servicios_con_checkin, 1)
       else null end                                                    as puntualidad_pct,

  -- KPI 3 · insumos normalizados
  case when checklist_total > 0
       then round(100.0 * checklist_ok / checklist_total, 1)
       else null end                                                    as checklist_pct,
  round(calif_cliente_prom, 2)                                          as calif_cliente_prom,

  -- KPI 3 · Calidad de ejecución (score 0-100 ponderado)
  round(
      0.50 * coalesce(100.0 * checklist_ok / nullif(checklist_total, 0), 0)
    + 0.30 * coalesce(100.0 * calif_cliente_prom / 5.0, 0)
    + 0.20 * (100.0 - coalesce(100.0 * retrabajos / nullif(servicios_completados, 0), 0))
  , 1)                                                                   as calidad_score
from base
order by semana desc, plaza, operador;

comment on view vista_desempeno_operadores is
  'KPIs semanales de desempeño por operador: puntualidad, servicios completados y calidad de ejecución. Fuente del dashboard y del reporte semanal.';

-- ----------------------------------------------------------------------------
-- (Opcional) RPC para el reporte semanal por WhatsApp: ranking del periodo.
-- ----------------------------------------------------------------------------
create or replace function ranking_operadores(
  desde date default (current_date - interval '7 days')::date,
  hasta date default current_date,
  plaza_filtro text default null
)
returns table (
  operador text,
  plaza text,
  servicios_completados bigint,
  puntualidad_pct numeric,
  calidad_score numeric
)
language sql stable as $$
  select
    v.operador,
    v.plaza,
    sum(v.servicios_completados)                                         as servicios_completados,
    round(
      100.0 * sum(v.servicios_a_tiempo)
            / nullif(sum(v.servicios_con_checkin), 0), 1)                as puntualidad_pct,
    round(avg(v.calidad_score), 1)                                       as calidad_score
  from vista_desempeno_operadores v
  where v.semana_inicio >= desde
    and v.semana_inicio <= hasta
    and (plaza_filtro is null or v.plaza = plaza_filtro)
  group by v.operador, v.plaza
  order by servicios_completados desc, puntualidad_pct desc;
$$;
