# Dashboard de desempeño de operadores de limpieza · Grupo Portátil

Dashboard **automatizado** para el seguimiento del desempeño de los operadores de campo
de Grupo Portátil. Lee en vivo desde Supabase (proyecto `gp-inventario`) y muestra los
servicios completados por operador y periodo, con ranking, tendencia semanal y filtros.

![dashboard](docs/preview.png)

> **Estado:** la vista `vista_desempeno_operadores` ya está **desplegada** en Supabase y el
> dashboard está **conectado**. La tabla `servicios` aún no tiene registros: en cuanto los
> operadores empiecen a capturar en AppSheet, el dashboard se puebla solo.

---

## OBJETIVO OPERATIVO

Dar a Eduardo una vista objetiva y sin captura manual del desempeño de los operadores
(Alberto, Emmanuel, Meñito, Juan Pablo), para decisiones de asignación de carga y evaluación.

## Alcance de los KPIs

El dashboard se construye sobre la tabla **real** `servicios` de `gp-inventario`. Con los
campos que esa tabla captura hoy, el KPI disponible es:

| KPI | Estado | Cálculo |
|---|---|---|
| **Servicios completados** | ✅ Activo | `count(*) where completado` por operador/semana |
| **Puntualidad** | 🔜 Fase 2 | Requiere capturar hora programada + hora de llegada en AppSheet |
| **Calidad de ejecución** | 🔜 Fase 2 | Requiere capturar checklist, calificación de cliente y retrabajo |

Puntualidad y calidad **no se pueden calcular con los datos actuales** (la tabla `servicios`
no tiene hora programada, checklist ni calificación). El script `sql/fase2-puntualidad-calidad.sql`
agrega esos campos de forma no destructiva cuando la captura esté lista; el dashboard ya
muestra ambos KPIs como "Próximamente".

## Arquitectura

```
Operador (AppSheet / SimpliRoute, campo)
   └─ registra servicio (completado, foto, checkout)
        ▼
Supabase · tabla servicios            ← fuente de verdad (ya existente)
        │  vista_desempeno_operadores (agregado por operador/semana)
        ├──────────────► Dashboard index.html  (lectura en vivo con anon key)
        └──────────────► Reporte semanal WhatsApp  [n8n]  (misma vista)
```

## Contenido

```
dashboard-desempeno-operadores/
├── index.html                          # Dashboard (conectado a gp-inventario)
├── sql/
│   ├── vista_desempeno_operadores.sql  # Vista desplegada (alcance: completados)
│   └── fase2-puntualidad-calidad.sql   # Ampliación futura (puntualidad + calidad)
├── automatizacion/
│   └── n8n-flujo.md                    # Reporte semanal + alertas
└── docs/preview.png
```

## Puesta en marcha

La vista ya está creada y el dashboard ya trae URL + anon key del proyecto. Para verlo:

1. Abrir `index.html` en el navegador (o publicarlo en Supabase Storage / Vercel / Netlify).
2. Con la tabla `servicios` vacía, muestra datos de **ejemplo** con un aviso; cuando haya
   servicios reales, cambia automáticamente a **"Supabase · en vivo"**.

### Nota de seguridad

La vista se expone con la `anon key` (pública, embebida en el HTML) y solo devuelve
**conteos agregados** por operador y semana — sin datos de cliente. Si el dashboard se
publica en una URL abierta y se prefiere no exponer ni esos conteos, hospedarlo detrás de
autenticación (Supabase Auth o el hosting) y revocar el `grant ... to anon`.

## Fase 2 — habilitar puntualidad y calidad

1. Definir en AppSheet la captura de: hora programada, check-in (hora de llegada),
   checklist (ok/total), calificación del cliente y bandera de retrabajo.
2. Aplicar `sql/fase2-puntualidad-calidad.sql` (agrega columnas nullable + amplía la vista).
3. El dashboard ya está preparado para mostrar ambos KPIs en cuanto la vista los entregue.

## SIGUIENTE ACCIÓN

Publicar `index.html` donde el equipo lo consulte y confirmar que los operadores registran
sus servicios en AppSheet para que el KPI de completados empiece a poblarse.
