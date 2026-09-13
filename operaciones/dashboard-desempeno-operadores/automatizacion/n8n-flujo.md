# Automatización · n8n

El dashboard es automatizado: lee la vista `vista_desempeno_operadores` (sobre la tabla
real `servicios`), que se puebla desde AppSheet/SimpliRoute sin captura manual. Estos flujos
de n8n cierran el ciclo con alertas y el reporte semanal. Todo se ancla al stack de GP.

---

## Flujo 1 · Reporte semanal de desempeño (cron lunes)

**Objetivo:** cerrar la semana con el ranking de servicios completados por operador y
enviar acciones cortas por WhatsApp.

```
TRIGGER: Schedule (lunes 08:00 CST)
  1. [Supabase · Select] vista_desempeno_operadores
        where semana_inicio >= lunes-7  (agrupar por operador)
  2. [Code] armar mensaje:
        🏆 Semana {W}: {top} lideró con {n} servicios completados.
        📊 Total flota: {suma} servicios en {operadores} operadores.
  3. [WhatsApp/Troncalnet] enviar a Eduardo (resumen) y al grupo de operadores (su dato)
  4. [Google Sheets · Append] snapshot semanal (respaldo histórico)
```

El dashboard y el reporte leen la **misma vista**, así que nunca se contradicen.

---

## Flujo 2 · Alerta de baja actividad (cron diario)

**Objetivo:** detectar operadores sin servicios registrados en el día.

```
TRIGGER: Schedule (diario 20:00 CST)
  1. [Supabase · Select] servicios de hoy agrupados por operador
  2. [IF] algún operador activo sin servicios hoy
        → [WhatsApp] aviso a Eduardo
```

---

## Fase 2 · Puntualidad y calidad

Cuando se apliquen los campos de `sql/fase2-puntualidad-calidad.sql` y AppSheet capture
hora programada, check-in, checklist y calificación, la misma vista devolverá
`puntualidad_pct` y `calidad_score`. El Flujo 1 puede entonces incluir:

```
🔻 A reforzar: {operador} bajo meta de puntualidad ({pct}%) / calidad ({score}).
```

sin cambios en el dashboard (ya está preparado para ambos KPIs).

---

## Notas de implementación

- **RLS:** el dashboard consulta la vista con la `anon key` (solo lectura, conteos
  agregados). Las escrituras a `servicios` siguen su flujo actual (AppSheet/SimpliRoute).
- **Zona horaria:** los `timestamptz` se guardan en UTC; el corte semanal ISO es consistente.
- **Refresco:** la vista es en vivo (no materializada); si el volumen crece, evaluar
  `MATERIALIZED VIEW` + `REFRESH` en un cron de n8n.

## Siguiente acción

Configurar el Flujo 1 en n8n apuntando a la vista y conectar la credencial de WhatsApp.
