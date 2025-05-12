/**
 * Responsive Layout Module
 * ======================
 *
 * Exportiert responsive Layout-Stile als JavaScript-Module für modulare Verwendung.
 */

// Dynamisch die CSS-Datei laden
export function loadResponsiveStyles() {
  const linkElement = document.createElement("link");
  linkElement.rel = "stylesheet";
  linkElement.href = "/src/ui_components/design-system/responsive.css";
  document.head.appendChild(linkElement);
}

// Standard-Export: Führt die Funktion aus, wenn das Modul geladen wird
export default loadResponsiveStyles();
