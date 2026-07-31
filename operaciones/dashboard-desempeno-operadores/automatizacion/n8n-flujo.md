# Automatización del dashboard · n8n

El dashboard es **automatizado**: nadie captura datos a mano. Los tres flujos de n8n
mantienen la vista `vista_desempeno_operadores` siempre al día y disparan el reporte
semanal. Todo se ancla al stack real de GP (AppSheet · Supabase · n8n · Troncalnet/WhatsApp).

---

## Flujo 1 · Ingesta de servicios (AppSheet → Supabase)

**Objetivo:** cada servicio que un operador cierra en campo entra a `servicios_limpieza`
sin captura manual. Es la base de todos los KPIs.

```
TRIGGER: Webhook (AppSheet Bot "Servicio completado")
  Se dispara cuando el operador marca un servicio como cerrado en AppSheet,
  con checklist, hora de llegada y foto de evidencia.

  1. [Set] Normalizar payload de AppSheet → columnas de servicios_limpieza
           (operador, plaza, tipo_servicio, fecha_programada, fecha_llegada,
            checklist_items_ok/total, calificacion_cliente, retrabajo, incidencia…)
  2. [Supabase · Insert/Upsert] tabla servicios_limpieza (upsert por id de AppSheet)
  3. [IF] incidencia = true OR retrabajo = true
        → [Troncalnet/WhatsApp] avisar a Eduardo:
          "⚠️ {operador} · {unidad} reportó {incidencia|retrabajo} en {plaza}"
```

**Responsable de configurarlo:** Eduardo (una vez). **En operación:** automático.

---

## Flujo 2 · Servicios no realizados (cron diario)

**Objetivo:** que un servicio programado que no se ejecutó cuente en contra de
puntualidad y del % de servicios realizados, aunque nadie lo cierre en AppSheet.

```
TRIGGER: Schedule (diario 21:00 CST)
  1. [Supabase · Select] servicios con fecha_programada = hoy y estado = 'programado'
  2. [Supabase · Update] marcar estado = 'no_realizado'
  3. [IF] hay ≥ 1 no realizado
        → [WhatsApp] resumen a Eduardo por plaza
```

---

## Flujo 3 · Reporte semanal de desempeño (cron lunes)

**Objetivo:** cerrar la semana con el ranking de operadores y mandar acciones cortas.
Usa la RPC `ranking_operadores()` definida en `sql/02_vista_kpis.sql`.

```
TRIGGER: Schedule (lunes 08:00 CST)
  1. [Supabase · RPC] ranking_operadores(desde = lunes-7, hasta = domingo)
  2. [Code] armar mensaje por plaza:
        🏆 Semana {W}: {top} lideró con {n} servicios y {punt}% puntualidad.
        🔻 A reforzar: {operador} quedó bajo meta de puntualidad ({punt}%).
  3. [WhatsApp/Troncalnet] enviar a Eduardo (resumen) y al grupo de operadores (su dato)
  4. [Google Sheets · Append] guardar snapshot semanal (respaldo histórico)
```

> El dashboard (`index.html`) lee la misma vista en vivo, así que el reporte de WhatsApp
> y el dashboard **nunca se contradicen**: son la misma fuente.

---

## Notas de implementación

- **RLS en Supabase:** la vista se expone por PostgREST con una policy de solo lectura
  para la `anon key` (el dashboard solo consulta, nunca escribe). Las escrituras van con
  `service_role` desde n8n, nunca desde el navegador.
- **Zona horaria:** los `timestamptz` se guardan en UTC; el corte semanal ISO
  (`to_char(..., 'IW')`) es consistente para MTY y QRO.
- **Tolerancia de puntualidad:** 15 min, definida en la vista. Cambiarla ahí y el
  dashboard la refleja sin tocar código.
- **Refresco del dashboard:** la vista es en vivo (no materializada); si el volumen crece,
  convertir a `MATERIALIZED VIEW` + `REFRESH` en el Flujo 2.

## Siguiente acción

1. Eduardo corre `sql/01_schema.sql` y `sql/02_vista_kpis.sql` en Supabase.
2. Crear el Bot de AppSheet "Servicio completado" apuntando al webhook del Flujo 1.
3. Importar los tres flujos a n8n y conectar credenciales (Supabase, WhatsApp).
4. Pegar `SUPABASE_URL` + `anon key` en `index.html` y publicar (Storage o Vercel).
