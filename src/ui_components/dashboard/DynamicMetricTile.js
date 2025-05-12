/**
 * DynamicMetricTile
 * ================
 *
 * Eine moderne, dynamische Komponente zur Anzeige von Metriken mit
 * Trend-Indikatoren, Farbkodierung und animierten Übergängen.
 *
 * Diese Komponente ersetzt die statische RecursionMetricCard.
 */

import { unifiedAdapter } from "../adapters";

// Klasse für die DynamicMetricTile-Komponente
export class DynamicMetricTile {
  /**
   * Konstruktor für die DynamicMetricTile-Komponente
   *
   * @param {Object} options - Konfigurationsoptionen
   * @param {string} options.elementId - ID des DOM-Elements, in das die Karte gerendert werden soll
   * @param {string} options.title - Titel der Metrik
   * @param {number} options.value - Aktueller Wert der Metrik
   * @param {number} options.previousValue - Vorheriger Wert für Trend-Berechnung (optional)
   * @param {string} options.format - Formatierung für den Wert (z.B. 'number', 'percentage', 'currency')
   * @param {string} options.icon - Icon-Klasse (FontAwesome oder Bootstrap Icons)
   * @param {Object} options.thresholds - Schwellenwerte für Farbkodierung (optional)
   * @param {Object} options.trends - Konfiguration für Trend-Anzeige (optional)
   */
  constructor(options) {
    this.options = {
      elementId: null,
      title: "",
      value: 0,
      previousValue: null,
      format: "number",
      icon: null,
      thresholds: {
        success: null, // Wert >= success ist grün
        warning: null, // Wert >= warning ist gelb
        danger: null, // Wert >= danger ist rot
      },
      trends: {
        showIcon: true, // Trend-Icon anzeigen
        showPercentage: true, // Prozentuale Änderung anzeigen
        inverseColors: false, // Inverse Farbgebung (z.B. für Fehlerraten)
      },
      ...options,
    };

    this.element = document.getElementById(this.options.elementId);
    if (!this.element) {
      console.error(`Element mit ID ${this.options.elementId} nicht gefunden`);
      return;
    }

    this.oldValue = this.options.value; // Für Animation
    this.render();
  }

  /**
   * Berechnet den Trend zwischen aktuellem und vorherigem Wert
   *
   * @returns {Object} Trendinformationen mit Prozentsatz und Richtung
   */
  calculateTrend() {
    const { value, previousValue } = this.options;

    if (previousValue === null || previousValue === value) {
      return { percentage: 0, direction: "neutral" };
    }

    const difference = value - previousValue;
    const percentage =
      previousValue !== 0
        ? Math.round((difference / Math.abs(previousValue)) * 100)
        : 0;

    return {
      percentage: Math.abs(percentage),
      direction: difference > 0 ? "up" : "down",
    };
  }

  /**
   * Bestimmt die Statusfarbe basierend auf dem aktuellen Wert und den Schwellenwerten
   *
   * @returns {string} CSS-Klassenname für die Statusfarbe
   */
  getStatusColor() {
    const { value, thresholds, trends } = this.options;
    const trend = this.calculateTrend();

    // Wenn keine Schwellenwerte definiert sind, basiert die Farbe auf dem Trend
    if (
      thresholds.success === null &&
      thresholds.warning === null &&
      thresholds.danger === null
    ) {
      if (trend.percentage === 0) return "neutral";

      const isPositiveTrend = trend.direction === "up";
      const isPositiveIndicator = !trends.inverseColors;

      // Positive Indikatoren: Aufwärts ist gut (z.B. Umsatz)
      // Negative Indikatoren: Abwärts ist gut (z.B. Fehlerrate)
      const isGood = isPositiveTrend === isPositiveIndicator;

      return isGood ? "success" : "danger";
    }

    // Schwellenwertbasierte Farbgebung
    if (thresholds.danger !== null && value >= thresholds.danger) {
      return "danger";
    }

    if (thresholds.warning !== null && value >= thresholds.warning) {
      return "warning";
    }

    if (thresholds.success !== null && value >= thresholds.success) {
      return "success";
    }

    return "neutral";
  }

  /**
   * Formatiert den Wert entsprechend der angegebenen Formatierungsoption
   *
   * @param {number} value - Zu formatierender Wert
   * @returns {string} Formatierter Wert
   */
  formatValue(value) {
    const { format } = this.options;

    switch (format) {
      case "percentage":
        return `${value}%`;
      case "currency":
        return `$${value.toLocaleString()}`;
      case "decimal":
        return value.toFixed(2);
      case "number":
      default:
        return value.toLocaleString();
    }
  }

  /**
   * Rendert die Metrik-Karte im DOM
   */
  render() {
    if (!this.element) return;

    const trend = this.calculateTrend();
    const statusColor = this.getStatusColor();

    // CSS-Klassen für die Trend-Richtung
    const trendDirectionClass =
      trend.direction === "up"
        ? "trend-up"
        : trend.direction === "down"
        ? "trend-down"
        : "trend-neutral";

    // Trend-Icon basierend auf der Richtung
    const trendIcon =
      trend.direction === "up"
        ? '<i class="bi bi-arrow-up-right"></i>'
        : trend.direction === "down"
        ? '<i class="bi bi-arrow-down-right"></i>'
        : '<i class="bi bi-dash"></i>';

    // Haupt-Icon, wenn definiert
    const mainIcon = this.options.icon
      ? `<div class="metric-icon"><i class="${this.options.icon}"></i></div>`
      : "";

    // Trend-Anzeige, wenn aktiviert
    const trendDisplay =
      this.options.trends.showIcon || this.options.trends.showPercentage
        ? `<div class="metric-trend ${trendDirectionClass} text-${statusColor}">
            ${this.options.trends.showIcon ? trendIcon : ""}
            ${
              this.options.trends.showPercentage && trend.percentage !== 0
                ? `<span class="trend-percentage">${trend.percentage}%</span>`
                : ""
            }
          </div>`
        : "";

    // HTML für die Metrik-Karte
    const html = `
        <div class="dynamic-metric-tile card ${statusColor}-border">
          <div class="card-body">
            ${mainIcon}
            <div class="metric-content">
              <p class="metric-title">${this.options.title}</p>
              <h3 class="metric-value text-${statusColor}" data-value="${
      this.options.value
    }">
                ${this.formatValue(this.oldValue)}
              </h3>
              ${trendDisplay}
            </div>
          </div>
        </div>
      `;

    this.element.innerHTML = html;

    // Animation des Werts, wenn sich dieser geändert hat
    if (this.oldValue !== this.options.value) {
      this.animateValue(this.oldValue, this.options.value);
    }
  }

  /**
   * Animiert die Änderung eines Werts
   *
   * @param {number} start - Startwert
   * @param {number} end - Endwert
   * @param {number} duration - Animationsdauer in Millisekunden
   */
  animateValue(start, end, duration = 1000) {
    const valueDisplay = this.element.querySelector(".metric-value");
    if (!valueDisplay) return;

    const range = end - start;
    const minTimer = 50; // minimaler Schritt zwischen Updates
    const stepTime = Math.abs(Math.floor(duration / range));
    const timer = Math.max(stepTime, minTimer);
    const steps = Math.ceil(duration / timer);
    const increment = range / steps;

    let current = start;
    let step = 0;

    const updateTimer = setInterval(() => {
      step++;
      current += increment;
      const shouldStop =
        (increment > 0 && current >= end) ||
        (increment < 0 && current <= end) ||
        step >= steps;

      current = shouldStop ? end : current;
      valueDisplay.textContent = this.formatValue(Math.round(current));

      if (shouldStop) {
        clearInterval(updateTimer);
        this.oldValue = end;
      }
    }, timer);
  }

  /**
   * Aktualisiert die Metrik mit einem neuen Wert
   *
   * @param {number} newValue - Neuer Wert für die Metrik
   * @param {number} previousValue - Vorheriger Vergleichswert (optional)
   */
  update(newValue, previousValue = null) {
    this.options.previousValue =
      previousValue !== null ? previousValue : this.options.value;
    this.options.value = newValue;
    this.render();
  }
}
