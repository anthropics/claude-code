'use strict';

/**
 * Cálculo de tarifa por servicio · Grupo Portátil
 * -----------------------------------------------------------------------------
 * Implementación de referencia (espejo de la función SQL
 * `calcular_tarifa_servicio`) adaptada al schema REAL de gp-inventario.
 *
 * Fuente de datos (tablas reales):
 *   contratos: precio_sin_iva, precio_lavamanos, tiene_lavamanos,
 *              datos_fiscales ('FACTURA' | 'REMISION'), sucursal_id,
 *              latitud, longitud, cliente
 *   servicios: tipo, checkout_lat, checkout_lng
 *
 * Fórmula:
 *   base          = precio_sin_iva + (tiene_lavamanos ? precio_lavamanos : 0)
 *   subtotal_base = base * modificador_servicio
 *   recargo_zona  = geocerca fijo ($) | subtotal_base * pct/100 | 0
 *   subtotal      = subtotal_base + recargo_zona
 *   es_fiscal     = datos_fiscales contiene 'FACTURA'
 *   iva           = es_fiscal ? subtotal * 0.16 : 0     (REMISION no lleva IVA)
 *   total         = subtotal + iva
 *
 * Coordenada usada: la del checkout del servicio; si falta, la del contrato.
 */

const { resolverGeocerca } = require('./geocerca');

const IVA_TASA = 0.16;

/** Redondeo a 2 decimales estable. */
function r2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** ¿El contrato se factura (CFDI) o es remisión (sin IVA)? */
function esFiscal(datosFiscales) {
  return String(datosFiscales || '').toUpperCase().includes('FACTURA');
}

/**
 * @param {Object} args
 * @param {Object} args.servicio  {id, contrato_id, tipo, checkout_lat, checkout_lng}
 * @param {Object} args.contrato  {id, cliente, sucursal_id, precio_sin_iva,
 *                                  precio_lavamanos, tiene_lavamanos,
 *                                  datos_fiscales, latitud, longitud}
 * @param {Object} [args.modificadores]  mapa { TIPO: {modificador, facturable} }
 * @param {Array}  [args.geocercas]      catálogo de geocercas
 * @returns {Object} desglose (misma forma que el JSONB de la función SQL)
 */
function calcularTarifaServicio({ servicio, contrato, modificadores = {}, geocercas = [] }) {
  const tipo = String(servicio.tipo || 'LIMPIEZA').toUpperCase();
  const mod = modificadores[tipo];

  if (mod && mod.facturable === false) {
    return {
      facturable: false,
      motivo: 'tipo de servicio no facturable',
      servicio_id: servicio.id,
      total: 0,
    };
  }

  const modificador = mod ? mod.modificador : 1.0;

  // Base desde el contrato.
  const lavamanos = contrato.tiene_lavamanos ? Number(contrato.precio_lavamanos || 0) : 0;
  const base = r2(Number(contrato.precio_sin_iva || 0) + lavamanos);
  const subtotalBase = r2(base * modificador);

  // Recargo por geocerca (coordenada del checkout, o del contrato).
  const lat = servicio.checkout_lat != null ? servicio.checkout_lat : contrato.latitud;
  const lng = servicio.checkout_lng != null ? servicio.checkout_lng : contrato.longitud;

  let recargoZona = 0;
  let geo = null;
  if (lat != null && lng != null) {
    geo = resolverGeocerca(Number(lat), Number(lng), contrato.sucursal_id, geocercas);
    if (geo) {
      if (geo.recargo_tipo === 'fijo') {
        recargoZona = r2(geo.recargo_valor);
      } else if (geo.recargo_tipo === 'porcentaje') {
        recargoZona = r2((subtotalBase * geo.recargo_valor) / 100);
      }
    }
  }

  const subtotal = r2(subtotalBase + recargoZona);
  const fiscal = esFiscal(contrato.datos_fiscales);
  const iva = fiscal ? r2(subtotal * IVA_TASA) : 0;
  const total = r2(subtotal + iva);

  return {
    facturable: true,
    es_fiscal: fiscal,
    documento: fiscal ? 'CFDI' : 'REMISION',
    servicio_id: servicio.id,
    contrato_id: contrato.id,
    cliente: contrato.cliente,
    sucursal_id: contrato.sucursal_id ?? null,
    tipo_servicio: tipo,
    precio_base_contrato: contrato.precio_sin_iva,
    precio_lavamanos: lavamanos,
    base,
    modificador_servicio: modificador,
    subtotal_base: subtotalBase,
    geocerca_id: geo ? geo.id : null,
    geocerca_nombre: geo ? geo.nombre : null,
    recargo_zona: recargoZona,
    subtotal,
    iva_tasa: fiscal ? IVA_TASA : 0,
    iva,
    total,
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    moneda: 'MXN',
  };
}

module.exports = { calcularTarifaServicio, esFiscal, r2, IVA_TASA };
