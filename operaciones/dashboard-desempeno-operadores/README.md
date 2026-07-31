# Dashboard de desempeño de operadores de limpieza · Grupo Portátil

Dashboard **automatizado** para el seguimiento del desempeño de los operadores de campo
(limpieza, bombeo, entrega y retiro) en Monterrey y Querétaro. Muestra los tres KPIs
clave por operador y periodo: **puntualidad**, **servicios completados** y **calidad de
ejecución**, con ranking, comparativa contra metas y tendencia semanal.

![dashboard](docs/preview.png)

---

## OBJETIVO OPERATIVO

Dar a Eduardo una vista objetiva y sin captura manual del desempeño de Alberto, Emmanuel,
Meñito y Juan Pablo, para tomar decisiones de asignación de carga, coaching y evaluación.
Indicadores que mejora: **puntualidad de servicio** y **calidad percibida por el cliente**.

## KPIs y cómo se calculan

| KPI | Definición | Meta GP |
|---|---|---|
| **Servicios completados** | # de servicios en estado `completado` en el periodo | — (volumen) |
| **Puntualidad** | % de servicios que llegaron dentro de 15 min de la hora programada (check-in de AppSheet) | ≥ 90% |
| **Calidad de ejecución** | Score 0-100 = 50% cumplimiento de checklist + 30% calificación del cliente + 20% ausencia de retrabajo | ≥ 85 |
| **Servicios realizados** | % de servicios programados que sí se ejecutaron (completados / programados) | ≥ 95% |

> Los porcentajes se **reagregan desde sumas crudas** al cambiar el periodo (no se promedian
> porcentajes de semanas), tanto en la vista SQL como en el dashboard.

## PROCESO / FLUJO

```
Operador (AppSheet, campo)
   └─ cierra servicio: check-in, checklist, foto, calif. cliente
        │  [n8n · Flujo 1]
        ▼
Supabase · tabla servicios_limpieza      ← fuente de verdad
        │  vista_desempeno_operadores (KPIs semanales por operador)
        ├──────────────► Dashboard index.html (lectura en vivo, esta carpeta)
        └──────────────► Reporte semanal WhatsApp  [n8n · Flujo 3]
```

## IMPLEMENTACIÓN EN EL STACK DE GP

| Componente | Herramienta | Archivo |
|---|---|---|
| Captura en campo | **AppSheet** | (Bot "Servicio completado") |
| Base de datos | **Supabase** | `sql/01_schema.sql`, `sql/02_vista_kpis.sql` |
| Automatización / ingesta / reporte | **n8n** | `automatizacion/n8n-flujo.md` |
| Dashboard | HTML autocontenido | `index.html` |
| Alertas y reporte | **Troncalnet / WhatsApp** | Flujo 3 |

### Puesta en marcha

1. **Supabase** — en el SQL Editor, ejecutar en orden:
   ```
   sql/01_schema.sql        # tabla servicios_limpieza (+ índices y checks)
   sql/02_vista_kpis.sql    # vista de KPIs + RPC ranking_operadores()
   ```
   Exponer la vista con una policy RLS de solo lectura para la `anon key`.

2. **Dashboard** — abrir `index.html` y pegar credenciales:
   ```js
   const SUPABASE_URL      = "https://TU-PROYECTO.supabase.co";
   const SUPABASE_ANON_KEY = "TU_ANON_KEY";
   ```
   Sin credenciales, el dashboard funciona con **datos demo** (8 semanas, los 4 operadores)
   para evaluar el diseño. Publicar en Supabase Storage, Vercel o Netlify (es un solo archivo).

3. **n8n** — importar y conectar los tres flujos de `automatizacion/n8n-flujo.md`.

### Sin backend

El dashboard es **un solo archivo HTML** sin dependencias externas (sin CDNs): gráficas en
SVG puro, tema claro/oscuro automático, tooltips al pasar el cursor, tabla de ranking
accesible y filtros por plaza y periodo. Se puede abrir directo en el navegador.

## RIESGOS OPERATIVOS

- **Check-in no registrado** → un servicio sin `fecha_llegada` no cuenta para puntualidad
  (se excluye, no se penaliza). Reforzar el uso del check-in en AppSheet.
- **Servicio no cerrado en campo** → el Flujo 2 lo marca `no_realizado` en el corte diario.
- **Calificación de cliente opcional** → si falta, la calidad pondera checklist + retrabajo;
  la encuesta post-servicio mejora la señal.

## MÉTRICAS DE ÉXITO

- Puntualidad promedio de flota ≥ 90% sostenida 4 semanas.
- 100% de servicios con check-in y checklist registrados en AppSheet.
- Reporte semanal enviado sin intervención manual.

## SIGUIENTE ACCIÓN

Eduardo ejecuta los dos scripts SQL en Supabase y pega la `anon key` en `index.html` para
ver el dashboard con datos reales; en paralelo se arma el Bot de AppSheet del Flujo 1.

---

## Estructura

```
dashboard-desempeno-operadores/
├── index.html                    # Dashboard (autocontenido, Supabase + demo)
├── sql/
│   ├── 01_schema.sql             # Tabla servicios_limpieza
│   └── 02_vista_kpis.sql         # Vista de KPIs + RPC de ranking
├── automatizacion/
│   └── n8n-flujo.md              # 3 flujos: ingesta, cierre diario, reporte semanal
└── README.md
```
