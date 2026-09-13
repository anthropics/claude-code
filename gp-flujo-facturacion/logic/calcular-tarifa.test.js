'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { puntoEnPoligono, resolverGeocerca } = require('./geocerca');
const { calcularTarifaServicio, esFiscal, r2 } = require('./calcular-tarifa');

// ---- Geocercas de ejemplo (sucursal 1 = MTY), en [lng,lat] -----------------
const GEOCERCAS = [
  {
    id: 1,
    nombre: 'MTY Base — Área Metropolitana',
    sucursal_id: 1,
    poligono: [
      [-100.45, 25.55],
      [-100.20, 25.55],
      [-100.20, 25.80],
      [-100.45, 25.80],
      [-100.45, 25.55],
    ],
    recargo_tipo: 'ninguno',
    recargo_valor: 0,
    prioridad: 100,
    activa: true,
  },
  {
    id: 2,
    nombre: 'MTY Foránea Poniente — Santa Catarina/García',
    sucursal_id: 1,
    poligono: [
      [-100.75, 25.55],
      [-100.45, 25.55],
      [-100.45, 25.85],
      [-100.75, 25.85],
      [-100.75, 25.55],
    ],
    recargo_tipo: 'fijo',
    recargo_valor: 250,
    prioridad: 50,
    activa: true,
  },
  {
    id: 3,
    nombre: 'MTY Foránea % (ejemplo)',
    sucursal_id: 1,
    poligono: [
      [-100.20, 25.80],
      [-100.05, 25.80],
      [-100.05, 25.95],
      [-100.20, 25.95],
      [-100.20, 25.80],
    ],
    recargo_tipo: 'porcentaje',
    recargo_valor: 15,
    prioridad: 50,
    activa: true,
  },
];

const MODIFICADORES = {
  LIMPIEZA: { modificador: 1.0, facturable: true },
  EXTRA: { modificador: 1.5, facturable: true },
  INSPECCION: { modificador: 0.0, facturable: false },
};

// =============================================================================
// Point-in-polygon / resolución de geocerca
// =============================================================================
test('puntoEnPoligono: dentro y fuera', () => {
  const cuadro = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(puntoEnPoligono([5, 5], cuadro), true);
  assert.equal(puntoEnPoligono([15, 5], cuadro), false);
});

test('resolverGeocerca: coordenada real contrato 1 -> zona base', () => {
  const g = resolverGeocerca(25.639814, -100.384712, 1, GEOCERCAS);
  assert.equal(g.id, 1);
});

test('resolverGeocerca: coordenada real contrato 8 -> foránea poniente', () => {
  const g = resolverGeocerca(25.705905, -100.525547, 1, GEOCERCAS);
  assert.equal(g.id, 2);
});

test('resolverGeocerca: sin coordenada -> null', () => {
  assert.equal(resolverGeocerca(null, null, 1, GEOCERCAS), null);
});

test('resolverGeocerca: geocerca de otra sucursal no aplica', () => {
  const soloSuc2 = [{ ...GEOCERCAS[0], sucursal_id: 2 }];
  assert.equal(resolverGeocerca(25.64, -100.38, 1, soloSuc2), null);
});

// =============================================================================
// esFiscal (FACTURA vs REMISION)
// =============================================================================
test('esFiscal distingue FACTURA de REMISION', () => {
  assert.equal(esFiscal('FACTURA'), true);
  assert.equal(esFiscal('REMISION'), false);
  assert.equal(esFiscal(null), false);
});

// =============================================================================
// Cálculo de tarifa — replica los casos validados contra la DB real
// =============================================================================
test('contrato FACTURA en zona foránea (replica DB: total 3770)', () => {
  const d = calcularTarifaServicio({
    servicio: { id: 3, contrato_id: 8, tipo: 'LIMPIEZA', checkout_lat: 25.705905, checkout_lng: -100.525547 },
    contrato: {
      id: 8, cliente: 'PROMI-MEX TECNOLOGIAS', sucursal_id: null,
      precio_sin_iva: 3000, precio_lavamanos: null, tiene_lavamanos: true,
      datos_fiscales: 'FACTURA', latitud: 25.705905, longitud: -100.525547,
    },
    modificadores: MODIFICADORES,
    geocercas: GEOCERCAS,
  });
  assert.equal(d.base, 3000);          // lavamanos null -> 0
  assert.equal(d.recargo_zona, 250);   // geocerca foránea fija
  assert.equal(d.subtotal, 3250);
  assert.equal(d.es_fiscal, true);
  assert.equal(d.documento, 'CFDI');
  assert.equal(d.iva, 520);            // 3250 * 0.16
  assert.equal(d.total, 3770);
  assert.equal(d.geocerca_id, 2);
});

test('contrato REMISION en zona base (replica DB: total 2100, sin IVA)', () => {
  const d = calcularTarifaServicio({
    servicio: { id: 1, contrato_id: 1, tipo: 'LIMPIEZA', checkout_lat: 25.639814, checkout_lng: -100.384712 },
    contrato: {
      id: 1, cliente: 'X', sucursal_id: null,
      precio_sin_iva: 2100, precio_lavamanos: 0, tiene_lavamanos: false,
      datos_fiscales: 'REMISION', latitud: 25.639814, longitud: -100.384712,
    },
    modificadores: MODIFICADORES,
    geocercas: GEOCERCAS,
  });
  assert.equal(d.base, 2100);
  assert.equal(d.recargo_zona, 0);
  assert.equal(d.es_fiscal, false);
  assert.equal(d.documento, 'REMISION');
  assert.equal(d.iva, 0);            // remisión no lleva IVA
  assert.equal(d.total, 2100);
});

test('lavamanos se suma a la base cuando tiene_lavamanos', () => {
  const d = calcularTarifaServicio({
    servicio: { id: 9, contrato_id: 9, tipo: 'LIMPIEZA', checkout_lat: 25.64, checkout_lng: -100.38 },
    contrato: {
      id: 9, cliente: 'Y', sucursal_id: 1,
      precio_sin_iva: 3000, precio_lavamanos: 500, tiene_lavamanos: true,
      datos_fiscales: 'FACTURA', latitud: 25.64, longitud: -100.38,
    },
    modificadores: MODIFICADORES,
    geocercas: GEOCERCAS,
  });
  assert.equal(d.base, 3500);        // 3000 + 500
  assert.equal(d.recargo_zona, 0);   // zona base
  assert.equal(d.iva, 560);          // 3500 * 0.16
  assert.equal(d.total, 4060);
});

test('modificador de tipo de servicio (EXTRA x1.5)', () => {
  const d = calcularTarifaServicio({
    servicio: { id: 10, contrato_id: 1, tipo: 'EXTRA', checkout_lat: 25.64, checkout_lng: -100.38 },
    contrato: {
      id: 1, cliente: 'Z', sucursal_id: 1,
      precio_sin_iva: 2000, precio_lavamanos: 0, tiene_lavamanos: false,
      datos_fiscales: 'FACTURA', latitud: 25.64, longitud: -100.38,
    },
    modificadores: MODIFICADORES,
    geocercas: GEOCERCAS,
  });
  assert.equal(d.subtotal_base, 3000); // 2000 * 1.5
  assert.equal(d.total, r2(3000 * 1.16)); // 3480
});

test('recargo por porcentaje', () => {
  const d = calcularTarifaServicio({
    servicio: { id: 11, contrato_id: 1, tipo: 'LIMPIEZA', checkout_lat: 25.88, checkout_lng: -100.12 },
    contrato: {
      id: 1, cliente: 'W', sucursal_id: 1,
      precio_sin_iva: 1000, precio_lavamanos: 0, tiene_lavamanos: false,
      datos_fiscales: 'FACTURA', latitud: 25.88, longitud: -100.12,
    },
    modificadores: MODIFICADORES,
    geocercas: GEOCERCAS,
  });
  assert.equal(d.geocerca_id, 3);
  assert.equal(d.recargo_zona, 150); // 1000 * 15%
  assert.equal(d.subtotal, 1150);
  assert.equal(d.total, 1334);       // 1150 * 1.16
});

test('tipo no facturable -> total 0', () => {
  const d = calcularTarifaServicio({
    servicio: { id: 12, contrato_id: 1, tipo: 'INSPECCION', checkout_lat: 25.64, checkout_lng: -100.38 },
    contrato: {
      id: 1, cliente: 'Q', sucursal_id: 1,
      precio_sin_iva: 2000, tiene_lavamanos: false, datos_fiscales: 'FACTURA',
      latitud: 25.64, longitud: -100.38,
    },
    modificadores: MODIFICADORES,
    geocercas: GEOCERCAS,
  });
  assert.equal(d.facturable, false);
  assert.equal(d.total, 0);
});

test('sin coordenada de checkout usa la del contrato', () => {
  const d = calcularTarifaServicio({
    servicio: { id: 13, contrato_id: 8, tipo: 'LIMPIEZA', checkout_lat: null, checkout_lng: null },
    contrato: {
      id: 8, cliente: 'R', sucursal_id: 1,
      precio_sin_iva: 3000, tiene_lavamanos: false, datos_fiscales: 'FACTURA',
      latitud: 25.705905, longitud: -100.525547, // foránea
    },
    modificadores: MODIFICADORES,
    geocercas: GEOCERCAS,
  });
  assert.equal(d.geocerca_id, 2);    // resolvió con la coord del contrato
  assert.equal(d.recargo_zona, 250);
});
