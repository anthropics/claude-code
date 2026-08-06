# Automatización · Inventario de Insumos ↔ Rutas Completadas

Grupo Portátil · Operaciones (MTY / QRO)

Descuento automático de insumos (desinfectantes, papel, gel/jabón, equipo de
limpieza) al cierre de cada jornada, sincronizado con el registro de rutas
completadas. Stack: **Supabase** (datos + lógica) · **n8n** (orquestación) ·
**AppSheet** (captura del operador) · **WhatsApp/Troncalnet** (alertas).

---

## OBJETIVO OPERATIVO
Que el inventario refleje el consumo real de cada jornada sin captura manual, para
eliminar faltantes en campo y compras reactivas. Indicador que mejora: **% de
jornadas con inventario actualizado el mismo día** (meta 100%) y **cero compras de
emergencia**.

## PROCESO / FLUJO
```
Operador cierra ruta en AppSheet ─► Webhook n8n ─► procesar_cierre_jornada() en Supabase
        │                                                   │
        │                                                   ├─ descuenta insumos (salida en ledger)
        │                                                   ├─ marca órdenes como descontadas
        │                                                   └─ cierra la jornada con totales
        ▼                                                   ▼
  (respaldo 20:30 si no cerró)              alerta de reorden a Eduardo + resumen al operador
```
- **Consumo real declarado** por el operador manda sobre el **estimado por BOM**.
- Si no declara nada, se usa el estimado (cero fricción).

## IMPLEMENTACIÓN EN EL STACK GP
| Componente | Herramienta | Archivo |
|---|---|---|
| Esquema de datos | Supabase | `sql/01_schema.sql` |
| Lógica de descuento (idempotente) | Supabase (PL/pgSQL) | `sql/02_funciones_triggers.sql` |
| Vistas, alertas y KPIs | Supabase | `sql/03_vistas_kpi.sql` |
| Catálogo + recetas de consumo (BOM) | Supabase | `sql/04_datos_semilla.sql` |
| Orquestación de cierre | n8n | `n8n/workflow-cierre-jornada.md` |
| Captura del operador | AppSheet | `appsheet/cierre-jornada.md` |
| Procedimiento del equipo | — | `docs/SOP-cierre-jornada-insumos.md` |

### Modelo de datos (resumen)
- `movimientos_insumo` — **libro mayor** (fuente de verdad). Nada edita el saldo directo.
- `insumo_existencias` — saldo vivo por plaza, lo mantiene un trigger.
- `consumo_estandar` — receta (BOM): insumo por unidad servida y tipo de servicio.
- `jornadas` — bisagra rutas↔inventario: `abierta → cerrada → procesada`.
- `consumo_declarado` — cantidades reales del operador (override del BOM).

### Orden de despliegue en Supabase
```
01_schema.sql → 02_funciones_triggers.sql → 03_vistas_kpi.sql → 04_datos_semilla.sql
```

## RIESGOS OPERATIVOS
- **Doble descuento** → blindado con función idempotente + índice único por
  jornada/insumo + bandera `insumos_descontados` en las órdenes.
- **Operador no cierra jornada** → respaldo programado 20:30 en n8n.
- **BOM desviado de la realidad** → override declarado + inventario físico mensual
  (`ajuste`, `origen='inventario_fisico'`) para recalibrar.
- **Stock negativo** → semáforo `AGOTADO` y alerta; señala desfase a corregir.

## MÉTRICAS DE ÉXITO
- `v_ordenes_sin_descontar` vacía al cierre de cada día.
- 100% de jornadas procesadas el mismo día.
- Reducción de faltantes en campo y de compras de emergencia.
- Costo de insumos por servicio visible en `jornadas.costo_insumos`.

## SIGUIENTE ACCIÓN (Eduardo)
1. Revisar `sql/04_datos_semilla.sql`: ajustar **recetas de consumo (BOM)**, costos
   y stock inicial a la realidad de GP (los valores son de arranque).
2. Confirmar el **nombre real** de la tabla de rutas completadas (aquí `ordenes_trabajo`
   con columnas `tipo_servicio`, `unidades`, `estado`, `operador`, `plaza`).
3. Dar OK para **desplegar en vivo**: aplicar las migraciones en Supabase y crear el
   workflow en n8n (inactivo para tu revisión) usando los tools MCP ya conectados.
