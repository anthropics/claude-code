# Automatización · Inventario de Insumos ↔ Rutas Completadas

Grupo Portátil · Operaciones (MTY / QRO)

Descuento automático de insumos (desinfectantes, papel, gel/jabón, equipo de
limpieza) al cierre de cada jornada, sincronizado con el registro de rutas
completadas. Stack: **Supabase** (datos + lógica) · **n8n** (orquestación) ·
**AppSheet** (captura del operador) · **Gmail** (alertas de reorden).

> **Estado:** DESPLEGADO en Supabase `gp-inventario` (ref `dflfvqiwvwvpzspspjfd`) y
> workflow CREADO en n8n (`ukdlxyeB035LbS7q`, inactivo hasta vincular credenciales).
> Este paquete refleja lo que está en producción, no un diseño teórico.

---

## OBJETIVO OPERATIVO
Que el inventario refleje el consumo real de cada jornada sin captura manual, para
eliminar faltantes en campo y compras reactivas. Indicador: **% de rutas con
inventario actualizado el mismo día** (meta 100%) y **cero compras de emergencia**.

## PROCESO / FLUJO
```
Operador cierra ruta en AppSheet ─► Webhook n8n ─► procesar_cierre_ruta(ruta_id) en Supabase
        │                                                   ├─ descuenta insumos (salida en ledger)
        │                                                   ├─ marca servicios/ruta como procesados
        │                                                   └─ registra costo_insumos de la ruta
        ▼                                                   ▼
  (respaldo 20:30 procesa lo no cerrado)      alerta de reorden (tabla alertas + email a Eduardo)
```
- **Consumo real declarado** por el operador manda sobre el **estimado por BOM**.
- Si no declara nada, se usa el estimado (cero fricción).

## MODELO DE DATOS (real en `gp-inventario`)
- Una **ruta** (`rutas`) = la jornada de un operador (sucursal, fecha, estado).
- Cada parada es un **servicio** (`servicios`, uno por unidad; `completado`, `tipo`).
- `movimientos_insumo` — **ledger** (fuente de verdad); el saldo por sucursal
  (`insumo_existencias`) lo mantiene un trigger.
- `consumo_estandar` — receta (BOM) por `tipo` de servicio (LIMPIEZA/ENTREGA/RETIRO/EXTRA).
- `consumo_declarado` — override del operador, por ruta.

## IMPLEMENTACIÓN
| Componente | Herramienta | Archivo |
|---|---|---|
| Esquema, RLS y trigger | Supabase | `sql/01_schema.sql` |
| Funciones (`procesar_cierre_ruta`, `_dia`, `registrar_entrada`, `revisar_stock_minimo`) | Supabase | `sql/02_funciones_triggers.sql` |
| Vistas y KPIs | Supabase | `sql/03_vistas_kpi.sql` |
| Catálogo + existencias MTY + BOM | Supabase | `sql/04_datos_semilla.sql` |
| Endurecimiento de seguridad | Supabase | `sql/05_hardening.sql` |
| Orquestación (webhook + respaldo 20:30 + alerta) | n8n | `n8n/workflow-cierre-ruta.md` |
| Cierre de ruta y consumo real | AppSheet | `appsheet/cierre-ruta.md` |
| Procedimiento operativo | — | `docs/SOP-cierre-jornada-insumos.md` |

### Orden de despliegue en Supabase
```
01_schema → 02_funciones_triggers → 03_vistas_kpi → 04_datos_semilla → 05_hardening
```
Requisitos previos: tablas `sucursales`, `operadores`, `rutas`, `servicios` (ya existen en GP).

## VERIFICACIÓN (hecha)
Probado end-to-end contra el Supabase real (transacción auto-revertida, sin residuo):
- Descuento por BOM: papel 600→593 (2 LIMPIEZA + 1 ENTREGA), 8 insumos, costo ruta $166.95.
- Override por consumo declarado: usó lo declarado, no el estimado.
- Idempotencia: 2ª corrida = 0 líneas, stock sin cambio.
- `v_rutas_sin_procesar` vacía; alerta de reorden al caer bajo mínimo.
- Advisor de Supabase limpio para todos los objetos de este módulo.

## RIESGOS OPERATIVOS
- **Doble descuento** → función idempotente + índice único ruta/insumo + banderas.
- **Operador no cierra la ruta** → respaldo 20:30.
- **BOM desviado** → override declarado + inventario físico mensual (`ajuste`).
- **Stock negativo** → semáforo `AGOTADO` en `v_inventario_actual` + alerta.

## MÉTRICAS DE ÉXITO
- `v_rutas_sin_procesar` vacía al cierre de cada día.
- Reducción de faltantes en campo y de compras de emergencia.
- Costo de insumos por ruta visible en `rutas.costo_insumos`.

## SIGUIENTE ACCIÓN (Eduardo)
1. En n8n: vincular la credencial **Supabase account** en los 3 nodos HTTP y **Gmail
   account** en el nodo de correo; conectar el webhook en AppSheet; activar.
2. Ajustar recetas de consumo (BOM), costos y stock inicial de MTY a la realidad.
3. Al dar de alta **QRO**, sembrar sus existencias y agregar su `procesar_cierre_dia`.
4. Cuando haya WhatsApp/Troncalnet en n8n, cambiar el canal de alerta (hoy es email).
