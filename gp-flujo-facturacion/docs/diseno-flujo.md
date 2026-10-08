# Flujo automatizado de facturación post-servicio · Grupo Portátil

> **Estado:** migración `0001` **aplicada y validada** contra el proyecto Supabase
> `gp-inventario` (schema real), con casos reales de contrato FACTURA y REMISION.
> Pendiente: datos fiscales del receptor y decisión del modelo de facturación
> (ver "Pendientes").

## OBJETIVO OPERATIVO

Emitir automáticamente el comprobante correcto **después de cada servicio
completado**, calculando la tarifa según **ubicación (geocerca)** y **tipo de
servicio**, y respetando si el contrato es fiscal (**CFDI**) o no (**REMISION**).

**Indicadores que mejora:**
- Tiempo de emisión: de horas/días → minutos tras cerrar el servicio.
- Fugas de cobro por recargos de zona no aplicados → 0 (recargo automático).
- Errores de tarifa por captura manual → eliminados (fuente única en SQL).
- Trazabilidad: cada factura queda ligada a su servicio, contrato, geocerca y desglose.

---

## PROCESO / FLUJO

| # | Paso | Responsable | Herramienta |
|---|------|-------------|-------------|
| 1 | Operador cierra el servicio en campo (foto, checkout con GPS) | Alberto / Emmanuel / Meñito / Juan Pablo | AppSheet |
| 2 | AppSheet escribe el servicio con `completado=true` y `checkout_lat/lng` | Sistema | AppSheet → Supabase |
| 3 | Cada 10 min se detectan servicios completados, con cobro confirmado, sin factura | Sistema | n8n (`servicios_por_facturar`) |
| 4 | Se resuelve la geocerca y se calcula la tarifa | Sistema | Supabase `calcular_tarifa_servicio()` (PostGIS) |
| 5a | Si el contrato es **FACTURA** → se timbra CFDI 4.0 | Sistema | n8n → Facturama |
| 5b | Si es **REMISION** → se registra comprobante no fiscal (sin IVA) | Sistema | n8n → Supabase |
| 6 | Se registra la factura, ligada al servicio (`facturas.servicio_id`) | Sistema | Supabase |
| 7 | Se avisa al cliente | Sistema | n8n → Troncalnet/WhatsApp |
| 8 | Si el timbrado falla, se alerta a Eduardo | Sistema | n8n → Troncalnet |

### Regla de cobro anticipado
La vista `servicios_por_facturar` solo incluye servicios cuyo contrato tiene un
`cobro` en estado `pagado`. Sin cobro confirmado, el servicio no se factura
automáticamente.

### Modelo de tarifa (fuente única: `calcular_tarifa_servicio`)

```
base          = contratos.precio_sin_iva + (tiene_lavamanos ? precio_lavamanos : 0)
subtotal_base = base × modificador_servicio        (tipos_servicio_modificador)
recargo_zona  = geocerca fijo ($) | subtotal_base × pct/100 | 0
subtotal      = subtotal_base + recargo_zona
es_fiscal     = contratos.datos_fiscales contiene 'FACTURA'
IVA           = es_fiscal ? subtotal × 16% : 0     (REMISION no lleva IVA)
TOTAL         = subtotal + IVA
```

- **Coordenada:** `servicios.checkout_lat/lng`; si falta, `contratos.latitud/longitud`.
- **Geocerca:** polígono PostGIS (SRID 4326), resuelto con `ST_Contains`; en
  traslape gana la de menor `prioridad`.
- **Casos validados contra la DB real:**
  - Contrato 8 (PROMI-MEX, FACTURA, zona foránea): base 3000 + recargo 250 + IVA 520 = **3770** (CFDI).
  - Contrato 1 (REMISION, zona base): base 2100 + recargo 0 + IVA 0 = **2100** (REMISION).

---

## IMPLEMENTACIÓN EN EL STACK DE GP

| Componente | Dónde | Archivo |
|---|---|---|
| Geocercas, modificadores, funciones, vista, columnas en `facturas` | Supabase `gp-inventario` (PostGIS) — **aplicado** | `supabase/migrations/0001_facturacion_geocercas.sql` |
| Geocercas de ejemplo (MTY) | Supabase | `supabase/seed_ejemplo.sql` |
| Lógica de tarifa (referencia + tests) | Repo / n8n Code node | `logic/calcular-tarifa.js`, `logic/geocerca.js` |
| Orquestación | n8n | `n8n/workflow-facturacion-post-servicio.json` |
| Timbrado CFDI | Facturama | (dentro del workflow) |
| Aviso a cliente | Troncalnet / WhatsApp | (dentro del workflow) |
| Captura en campo | AppSheet | (existente — asegurar checkout con GPS) |

---

## RIESGOS OPERATIVOS

| Riesgo | Mitigación |
|---|---|
| Servicio sin coordenada | Usa la del contrato como fallback; hacer el GPS obligatorio en AppSheet. |
| Geocercas mal trazadas | Seed marcado como ejemplo; validar polígonos reales por plaza antes de activar. |
| Doble facturación | Índice único `uq_facturas_servicio` sobre `facturas.servicio_id`. |
| **Sin datos fiscales del receptor** | `contratos.datos_fiscales` solo trae el flag FACTURA/REMISION; **falta capturar RFC/régimen/uso/CP** para timbrar CFDI reales. Bloqueante para la rama fiscal. |
| Falla de Facturama | Salida de error → alerta a Eduardo; el servicio queda pendiente para reintento. |
| Contrato sin cobro pagado | La vista lo excluye; se factura tras confirmar el cobro. |

---

## MÉTRICAS DE ÉXITO

- **% de servicios facturados automáticamente** (meta > 95%).
- **Tiempo cierre-de-servicio → comprobante** (meta < 15 min).
- **Facturas en error de timbrado** por semana (meta → 0).
- **Recargos de zona aplicados / servicios foráneos** (sin fugas).
- **Diferencia tarifa esperada vs emitida** (meta = 0; protegido por tests).

---

## PENDIENTES (decisión de Eduardo)

1. **Datos fiscales del receptor.** Definir dónde se capturan (RFC, régimen, uso
   CFDI, CP) — hoy no existen estructurados. Sin esto no se pueden timbrar CFDI reales.
2. **Modelo de facturación.** ¿Por servicio (este flujo) o mensual por `cobro`?
   Los 337 cobros mensuales sugieren que hoy se factura por periodo.
3. **Polígonos y recargos reales** por zona (reemplazar el seed de ejemplo).
4. Importar el workflow en n8n, conectar credenciales y **probar con 1 servicio real**.

---

## SIGUIENTE ACCIÓN

- Confirmar el modelo de facturación (por servicio vs mensual) y la fuente de los
  datos fiscales. Con eso, ajustar la rama CFDI del workflow y activar.
