/**
 * Colors Module
 * ============
 *
 * Exportiert CSS-Farben als JavaScript-Module für modulare Verwendung.
 */

// Dynamisch die CSS-Datei laden
export function loadColors() {
  const linkElement = document.createElement("link");
  linkElement.rel = "stylesheet";
  linkElement.href = "/src/ui_components/design-system/colors.css";
  document.head.appendChild(linkElement);
}

// Standard-Export: Führt die Funktion aus, wenn das Modul geladen wird
export default loadColors();
