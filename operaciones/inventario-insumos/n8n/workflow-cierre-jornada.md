# n8n · Workflow "Cierre de Jornada → Inventario de Insumos"

Automatiza el descuento de insumos al finalizar cada jornada y sincroniza el
resultado con el registro de rutas completadas. Idempotente por diseño: apoyarse
en `procesar_cierre_jornada()` (ver `sql/02_funciones_triggers.sql`) evita doble
descuento aunque el flujo se dispare dos veces.

---

## Arquitectura del disparo (dos entradas, misma lógica)

```
(1) AppSheet "Cerrar jornada"  ──► Webhook n8n ─┐
                                                 ├─► [Procesar cierre] ─► [Alertas] ─► [Notificar]
(2) Respaldo programado 20:30  ──► Schedule ────┘
```

- **Entrada 1 — Webhook (principal):** cuando el operador toca *Cerrar jornada*
  en AppSheet, se envía `jornada_id`. Descuento inmediato al terminar la ruta.
- **Entrada 2 — Schedule (red de seguridad):** a las 20:30 (MTY y QRO) barre
  jornadas con `estado='cerrada'` o con órdenes completadas sin procesar, por si
  un operador olvidó cerrar. Como la función es idempotente, no hay riesgo de
  doble descuento si ambas entradas coinciden.

---

## Nodos

### A) Rama Webhook

1. **Webhook** (`POST /gp/cierre-jornada`)
   - Body esperado: `{ "jornada_id": "<uuid>" }`
   - Autenticación: Header Auth (token compartido con AppSheet).

2. **Supabase → RPC `procesar_cierre_jornada`** (nodo Postgres o Supabase, "Execute Query")
   ```sql
   SELECT * FROM procesar_cierre_jornada('{{ $json.jornada_id }}'::uuid);
   ```
   Devuelve una fila por insumo descontado (`sku`, `cantidad`, `costo`). Cero
   filas = jornada ya procesada o sin consumo (no es error).

### B) Rama Schedule (respaldo)

1. **Schedule Trigger** — Cron `30 20 * * *`.
2. **Postgres — jornadas pendientes**
   ```sql
   -- Cierra automáticamente jornadas con órdenes completadas sin procesar
   INSERT INTO jornadas (operador, plaza, fecha, estado, cerrada_en)
   SELECT ot.operador, ot.plaza, CURRENT_DATE, 'cerrada', NOW()
   FROM ordenes_trabajo ot
   WHERE ot.estado='completado' AND ot.jornada_id IS NULL
   GROUP BY ot.operador, ot.plaza
   ON CONFLICT (operador, plaza, fecha) DO NOTHING;

   SELECT id AS jornada_id FROM jornadas
   WHERE fecha = CURRENT_DATE AND estado IN ('abierta','cerrada');
   ```
   > Nota: si tus órdenes aún no traen `jornada_id`, asigna la jornada del día
   > antes de procesar. Ajusta este bloque a cómo tu app agrupa las rutas.
3. **Loop / Split In Batches** → por cada `jornada_id`, llamar la misma RPC del paso A2.

### C) Rama común — Alertas de stock bajo

4. **Postgres — revisar mínimos**
   ```sql
   SELECT plaza, sku, nombre, stock_actual, stock_minimo, sugerido_pedir,
          unidad_medida, costo_reorden_estimado
   FROM v_insumos_bajo_minimo;
   ```
5. **IF** — ¿hay filas?
   - **True** → **WhatsApp / Troncalnet (HTTP Request)** a Eduardo:
     ```
     🧴 Insumos en punto de reorden ({{plaza}}):
     {{#each}}• {{nombre}}: {{stock_actual}} {{unidad_medida}} (mín {{stock_minimo}}) → pedir {{sugerido_pedir}}
     {{/each}}
     ```

### D) Rama común — Confirmación al operador

6. **WhatsApp / Troncalnet** al operador con el resumen de su jornada:
   ```
   ✅ Jornada cerrada — {{operador}} {{fecha}}
   Órdenes: {{ordenes_completadas}} · Unidades: {{unidades_servidas}}
   Insumos descontados: {{n_insumos}} · Costo insumos: ${{costo_insumos}}
   ```
   Consultar totales con:
   ```sql
   SELECT ordenes_completadas, unidades_servidas, costo_insumos, operador, fecha
   FROM jornadas WHERE id = '{{ $json.jornada_id }}'::uuid;
   ```

### E) Manejo de errores
- Conectar un **Error Trigger** que notifique a Eduardo por WhatsApp si la RPC
  falla, incluyendo `jornada_id`. Nunca se pierde una jornada en silencio.

---

## Reglas de idempotencia (crítico)
1. `procesar_cierre_jornada()` sale sin efectos si `jornada.estado='procesada'`.
2. Índice único `uniq_salida_jornada_insumo` impide doble salida por jornada/insumo.
3. `ordenes_trabajo.insumos_descontados=TRUE` evita reprocesar la misma ruta.

Por eso Webhook + Schedule pueden coexistir sin duplicar descuentos.

---

## Construcción vía MCP de n8n (cuando se apruebe el despliegue)
El asistente puede crear este workflow con el SDK de n8n:
1. `get_sdk_reference` + `get_workflow_best_practices` (techniques: `scheduling`, `webhook`).
2. `search_nodes` → `webhook`, `schedule trigger`, `postgres`, `if`, `http request`, `split in batches`.
3. `get_node_types` de todos los nodos.
4. `create_workflow_from_code` con la lógica de arriba.
5. `validate_workflow` y dejar **inactivo** para revisión de Eduardo antes de publicar.
