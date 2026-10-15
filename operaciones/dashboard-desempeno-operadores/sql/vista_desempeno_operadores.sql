-- ============================================================================
-- Grupo Portátil · Desempeño de operadores
-- vista_desempeno_operadores.sql  (DESPLEGADA en el proyecto gp-inventario)
--
-- Vista de SOLO LECTURA construida sobre la tabla real `servicios`.
-- NO crea tablas nuevas ni modifica datos. Reversible:  drop view vista_desempeno_operadores;
--
-- Alcance actual: KPI "servicios completados" por operador y semana.
-- (Puntualidad y calidad de ejecución: ver fase2-puntualidad-calidad.sql)
--
-- La plaza se deriva del contrato → sucursal; si no hay contrato ligado, MTY.
-- ============================================================================

create or replace view vista_desempeno_operadores as
with s as (
  select
    coalesce(nullif(sv.operador, ''), op.alias, 'Sin asignar') as operador,
    coalesce(suc.clave, 'MTY')                                 as plaza,
    to_char(sv.fecha_servicio, 'IYYY') || '-W'
      || to_char(sv.fecha_servicio, 'IW')                      as semana,
    date_trunc('week', sv.fecha_servicio)::date                as semana_inicio,
    sv.completado,
    sv.tipo
  from servicios sv
  left join operadores  op  on op.id  = sv.operador_id
  left join contratos   c   on c.id   = sv.contrato_id
  left join sucursales  suc on suc.id = c.sucursal_id
)
select
  operador,
  plaza,
  semana,
  semana_inicio,
  count(*) filter (where completado) as servicios_completados,
  count(*)                           as servicios_registrados
from s
group by operador, plaza, semana, semana_inicio
order by semana desc, servicios_completados desc;

comment on view vista_desempeno_operadores is
  'KPIs de desempeño por operador (alcance: servicios completados por semana). Fuente del dashboard.';

-- El dashboard consulta esta vista con la anon key. Solo expone conteos
-- agregados por operador/semana (sin datos sensibles de cliente).
grant select on vista_desempeno_operadores to anon;
