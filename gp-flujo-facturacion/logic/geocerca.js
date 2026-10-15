'use strict';

/**
 * Geocercas · Grupo Portátil
 * -----------------------------------------------------------------------------
 * Resolución point-in-polygon en JS puro (sin dependencias). Es la
 * implementación de referencia / validación de la función SQL
 * `resolver_geocerca` (que usa PostGIS ST_Contains en producción).
 *
 * Un polígono se representa como un arreglo de vértices [lng, lat] (orden
 * GeoJSON/PostGIS). El anillo puede o no venir cerrado; el algoritmo lo trata
 * como cerrado.
 */

/**
 * Ray casting: ¿el punto (lng,lat) está dentro del polígono?
 * @param {[number,number]} punto  [lng, lat]
 * @param {Array<[number,number]>} poligono  vértices [lng, lat]
 * @returns {boolean}
 */
function puntoEnPoligono(punto, poligono) {
  const [x, y] = punto;
  let dentro = false;
  const n = poligono.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    const cruza = (yi > y) !== (yj > y);
    if (cruza) {
      const xInterseccion = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (x < xInterseccion) dentro = !dentro;
    }
  }
  return dentro;
}

/**
 * Resuelve la geocerca activa de mayor prioridad (menor `prioridad`) que
 * contiene el punto. Si `sucursalId` viene dado, solo considera geocercas de
 * esa sucursal o de sucursal `null` (comodín) — igual que la función SQL.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number|null} sucursalId
 * @param {Array<Object>} geocercas  cada una: {id, nombre, sucursal_id,
 *        poligono:[[lng,lat],...], recargo_tipo, recargo_valor, prioridad, activa}
 * @returns {Object|null}
 */
function resolverGeocerca(lat, lng, sucursalId, geocercas) {
  if (lat == null || lng == null) return null;
  const candidatas = geocercas
    .filter((g) => g.activa !== false)
    .filter((g) => sucursalId == null || g.sucursal_id == null || g.sucursal_id === sucursalId)
    .filter((g) => puntoEnPoligono([lng, lat], g.poligono))
    .sort((a, b) => (a.prioridad ?? 100) - (b.prioridad ?? 100));
  return candidatas[0] || null;
}

module.exports = { puntoEnPoligono, resolverGeocerca };
