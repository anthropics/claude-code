# GP · Flujo de facturación automática post-servicio

Automatización que **emite el comprobante correcto después de cada servicio**
(CFDI si el contrato es fiscal, remisión si no), calculando la tarifa según
**geocerca (ubicación)** y **tipo de servicio**, integrando contratos,
coordenadas de Google Maps y Facturama.

Stack: **Supabase (PostGIS)** + **n8n** + **Facturama (CFDI 4.0)** + **AppSheet**
+ **Troncalnet/WhatsApp**.

> **Estado:** la migración `0001` está **aplicada y validada** contra el proyecto
> Supabase `gp-inventario` (schema real), incluidos casos reales de contrato
> FACTURA y REMISION. Diseño completo: [`docs/diseno-flujo.md`](docs/diseno-flujo.md).

---

## Cómo funciona

```
AppSheet (operador cierra servicio + checkout GPS)
        │
        ▼
Supabase  servicios.completado = true
        │   (solo si el contrato tiene un cobro 'pagado')
        ▼
n8n  cada 10 min → vista servicios_por_facturar
        │
        ▼
Supabase  calcular_tarifa_servicio(servicio_id)   ← PostGIS resuelve la geocerca
        │   base(contrato) × modificador + recargo_zona (+ IVA si FACTURA)
        ▼
   ¿es_fiscal?
     ├─ FACTURA  → Facturama timbra CFDI 4.0 → registra factura → WhatsApp
     └─ REMISION → registra comprobante no fiscal → WhatsApp
        │
        └─ (error de timbrado) → alerta a Eduardo
```

---

## Diseñado sobre el schema REAL de `gp-inventario`

No hay tabla `clientes` (el cliente es `contratos.cliente`, texto). Las
coordenadas y el precio ya viven en el contrato. La migración es **aditiva**:

**Agrega:**
- Extensión **PostGIS**.
- **`geocercas`** — zonas por polígono (SRID 4326) con recargo `fijo`/`porcentaje`/`ninguno`, `sucursal_id` y `prioridad`.
- **`tipos_servicio_modificador`** — multiplicador por `servicios.tipo` (LIMPIEZA=1, EXTRA=1.5, …).
- Columnas nulas en **`facturas`**: `servicio_id`, `geocerca_id`, `recargo_zona`, `desglose`.
- **`resolver_geocerca(lat, lng, sucursal_id)`** y **`calcular_tarifa_servicio(servicio_id)`** (fuente única del precio).
- Vista **`servicios_por_facturar`** (aplica la regla de cobro anticipado vía `cobros.estado='pagado'`).

**Reutiliza (no toca):** `contratos` (precio_sin_iva, precio_lavamanos, tiene_lavamanos, datos_fiscales, latitud/longitud), `servicios` (tipo, completado, checkout_lat/lng), `facturas`, `cobros`, `sucursales`.

**Regla fiscal detectada en los datos:** `contratos.datos_fiscales = 'FACTURA'`
lleva IVA y se timbra CFDI; `'REMISION'` es no fiscal, sin IVA.

---

## Estructura del paquete

```
gp-flujo-facturacion/
├── README.md
├── docs/diseno-flujo.md                       ← SOP: proceso, riesgos, métricas, pendientes
├── supabase/
│   ├── migrations/0001_facturacion_geocercas.sql   ← APLICADO en gp-inventario
│   └── seed_ejemplo.sql                        ← geocercas de ejemplo (ajustar a reales)
├── logic/
│   ├── geocerca.js                             ← point-in-polygon (referencia de PostGIS)
│   ├── calcular-tarifa.js                      ← fórmula (espejo de la función SQL)
│   └── calcular-tarifa.test.js                 ← 13 pruebas (incluyen casos de la DB real)
├── n8n/workflow-facturacion-post-servicio.json ← workflow importable (ramas CFDI/Remisión)
└── package.json                                ← `npm test`
```

---

## Pruebas

```bash
npm test          # node --test · 13/13 pass
```

Incluyen los dos casos verificados contra la base real:
- Contrato FACTURA en zona foránea → total **3770** (CFDI).
- Contrato REMISION en zona base → total **2100** (sin IVA).

---

## Pendientes antes de activar

1. **Datos fiscales del receptor** (RFC, régimen, uso CFDI, CP): no existen
   estructurados en la DB. Definir dónde se capturan antes de timbrar CFDI reales.
2. **Modelo de facturación**: confirmar por servicio (este flujo) vs mensual por `cobro`.
3. **Polígonos y recargos reales** por zona (reemplazar el seed).
4. Importar el workflow en n8n, conectar credenciales (Supabase, Facturama,
   Troncalnet) y **probar con 1 servicio real**.

---

## Verificación rápida en Supabase

```sql
-- Geocerca de una coordenada real:
select nombre, recargo_tipo, recargo_valor from resolver_geocerca(25.705905, -100.525547, 1);

-- Tarifa de un servicio (requiere un servicio existente):
select jsonb_pretty(calcular_tarifa_servicio(<servicio_id>));
```
