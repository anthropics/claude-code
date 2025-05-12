/**
 * GradientCard
 * ============
 *
 * Eine moderne Kartenkomponente mit animierten Farbverläufen und
 * interaktiven Elementen. Wird verwendet für Recent Issues und
 * Optimization Suggestions.
 */

import { unifiedAdapter } from "../adapters";

// Klasse für die GradientCard-Komponente
export class GradientCard {
  /**
   * Konstruktor für die GradientCard-Komponente
   *
   * @param {Object} options - Konfigurationsoptionen
   * @param {string} options.elementId - ID des DOM-Elements, in das die Karte gerendert werden soll
   * @param {Array} options.items - Daten-Items, die angezeigt werden sollen
   * @param {Object} options.gradient - Gradient-Konfiguration
   * @param {Function} options.onItemClick - Callback für Klicks auf Items (optional)
   * @param {Object} options.layout - Layout-Konfiguration (optional)
   * @param {Object} options.itemTemplate - Template-Konfiguration (optional)
   */
  constructor(options) {
    this.options = {
      elementId: null,
      items: [],
      gradient: {
        type: "default", // 'default', 'issue', 'suggestion', 'info', 'warning', 'success', 'error'
        animated: true,
        intensity: 0.7, // 0.0 bis 1.0
        blur: 20, // Blur-Intensität in Pixel
      },
      onItemClick: null,
      layout: {
        maxItems: 5, // Maximale Anzahl von Items pro Karte
        itemGap: 16, // Abstand zwischen Items in Pixel
      },
      itemTemplate: {
        showIcon: true,
        showDescription: true,
        showTimestamp: true,
        showStatus: true,
        showActions: true,
      },
      ...options,
    };

    this.element = document.getElementById(this.options.elementId);
    if (!this.element) {
      console.error(`Element mit ID ${this.options.elementId} nicht gefunden`);
      return;
    }

    this.initializeCard();
  }

  /**
   * Initialisiert die Karte
   */
  initializeCard() {
    // Element mit Basisklasse versehen
    this.element.classList.add("gradient-card");

    // Gradient-Typ festlegen
    this.element.setAttribute("data-gradient-type", this.options.gradient.type);

    // Animation ein- oder ausschalten
    if (this.options.gradient.animated) {
      this.element.classList.add("gradient-animated");
    } else {
      this.element.classList.remove("gradient-animated");
    }

    // Intensität festlegen
    this.element.style.setProperty(
      "--gradient-intensity",
      this.options.gradient.intensity
    );

    // Blur festlegen
    this.element.style.setProperty(
      "--gradient-blur",
      `${this.options.gradient.blur}px`
    );

    // Karte rendern
    this.renderCard();
  }

  /**
   * Rendert die Karte mit allen Items
   */
  renderCard() {
    // Alles in der Karte löschen
    this.element.innerHTML = "";

    // Gradient-Hintergrund-Element erstellen
    const gradientBg = document.createElement("div");
    gradientBg.classList.add("gradient-card-bg");
    this.element.appendChild(gradientBg);

    // Inhalt-Container erstellen
    const contentContainer = document.createElement("div");
    contentContainer.classList.add("gradient-card-content");
    this.element.appendChild(contentContainer);

    // Header erstellen
    const header = document.createElement("div");
    header.classList.add("gradient-card-header");

    // Titel basierend auf Gradient-Typ setzen
    const title = document.createElement("h3");
    title.classList.add("gradient-card-title");
    switch (this.options.gradient.type) {
      case "issue":
        title.textContent = "Recent Issues";
        break;
      case "suggestion":
        title.textContent = "Optimization Suggestions";
        break;
      default:
        title.textContent = this.options.title || "Informationen";
    }
    header.appendChild(title);

    // Header dem Inhalt hinzufügen
    contentContainer.appendChild(header);

    // Items-Liste erstellen
    const itemsList = document.createElement("ul");
    itemsList.classList.add("gradient-card-items");

    // Nur maxItems anzeigen
    const displayItems = this.options.items.slice(
      0,
      this.options.layout.maxItems
    );

    // Items rendern
    for (const item of displayItems) {
      const itemElement = this.createItemElement(item);
      itemsList.appendChild(itemElement);
    }

    // Items-Liste dem Inhalt hinzufügen
    contentContainer.appendChild(itemsList);

    // "Mehr anzeigen"-Link hinzufügen, wenn es mehr Items gibt
    if (this.options.items.length > this.options.layout.maxItems) {
      const moreLink = document.createElement("a");
      moreLink.classList.add("gradient-card-more");
      moreLink.href = "#";
      moreLink.textContent = `Alle ${this.options.items.length} anzeigen`;
      moreLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof this.options.onShowMore === "function") {
          this.options.onShowMore(this.options.items);
        }
      });
      contentContainer.appendChild(moreLink);
    }
  }

  /**
   * Erstellt ein DOM-Element für ein Item
   *
   * @param {Object} item - Das Item-Objekt
   * @returns {HTMLElement} Das DOM-Element für das Item
   */
  createItemElement(item) {
    const li = document.createElement("li");
    li.classList.add("gradient-card-item");

    // Status-Klasse hinzufügen
    if (item.status) {
      li.classList.add(`status-${item.status.toLowerCase()}`);
    }

    // Item-Container erstellen
    const itemContainer = document.createElement("div");
    itemContainer.classList.add("gradient-card-item-content");

    // Icon hinzufügen, wenn es aktiviert ist und das Item ein Icon hat
    if (this.options.itemTemplate.showIcon && item.icon) {
      const iconElement = document.createElement("div");
      iconElement.classList.add("gradient-card-item-icon");
      iconElement.innerHTML = `<i class="${item.icon}"></i>`;
      itemContainer.appendChild(iconElement);
    }

    // Textinhalte erstellen
    const textContent = document.createElement("div");
    textContent.classList.add("gradient-card-item-text");

    // Titel hinzufügen
    const itemTitle = document.createElement("div");
    itemTitle.classList.add("gradient-card-item-title");
    itemTitle.textContent = item.title;
    textContent.appendChild(itemTitle);

    // Beschreibung hinzufügen, wenn sie aktiviert ist und das Item eine Beschreibung hat
    if (this.options.itemTemplate.showDescription && item.description) {
      const description = document.createElement("div");
      description.classList.add("gradient-card-item-description");
      description.textContent = item.description;
      textContent.appendChild(description);
    }

    // Meta-Informationen hinzufügen (Timestamp & Status)
    const meta = document.createElement("div");
    meta.classList.add("gradient-card-item-meta");

    // Timestamp hinzufügen, wenn er aktiviert ist und das Item einen Timestamp hat
    if (this.options.itemTemplate.showTimestamp && item.timestamp) {
      const timestamp = document.createElement("span");
      timestamp.classList.add("gradient-card-item-timestamp");

      // Datum formatieren
      let formattedTime;
      try {
        const date = new Date(item.timestamp);
        formattedTime = date.toLocaleString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        formattedTime = item.timestamp;
      }

      timestamp.textContent = formattedTime;
      meta.appendChild(timestamp);
    }

    // Status hinzufügen, wenn er aktiviert ist und das Item einen Status hat
    if (this.options.itemTemplate.showStatus && item.status) {
      const status = document.createElement("span");
      status.classList.add("gradient-card-item-status");
      status.classList.add(`status-${item.status.toLowerCase()}`);
      status.textContent = item.status;
      meta.appendChild(status);
    }

    textContent.appendChild(meta);
    itemContainer.appendChild(textContent);

    // Aktionen hinzufügen, wenn sie aktiviert sind
    if (
      this.options.itemTemplate.showActions &&
      (item.actions || this.options.onItemClick)
    ) {
      const actions = document.createElement("div");
      actions.classList.add("gradient-card-item-actions");

      // Standardaktion hinzufügen, wenn onItemClick definiert ist
      if (this.options.onItemClick) {
        const viewButton = document.createElement("button");
        viewButton.classList.add("gradient-card-item-action");
        viewButton.innerHTML = '<i class="bi bi-eye"></i>';
        viewButton.title = "Details anzeigen";
        viewButton.addEventListener("click", () => {
          this.options.onItemClick(item);
        });
        actions.appendChild(viewButton);
      }

      // Spezifische Aktionen aus dem Item hinzufügen
      if (item.actions && Array.isArray(item.actions)) {
        item.actions.forEach((action) => {
          const actionButton = document.createElement("button");
          actionButton.classList.add("gradient-card-item-action");
          actionButton.innerHTML = `<i class="${action.icon}"></i>`;
          actionButton.title = action.title || "";
          actionButton.addEventListener("click", () => {
            if (typeof action.handler === "function") {
              action.handler(item);
            }
          });
          actions.appendChild(actionButton);
        });
      }

      itemContainer.appendChild(actions);
    }

    li.appendChild(itemContainer);

    // Event-Listener für Hover-Effekte
    li.addEventListener("mouseenter", () => {
      li.classList.add("hover");
    });

    li.addEventListener("mouseleave", () => {
      li.classList.remove("hover");
    });

    // Event-Listener für Klick auf Item, wenn onItemClick definiert ist
    if (this.options.onItemClick) {
      li.addEventListener("click", (e) => {
        // Nur auslösen, wenn nicht auf eine Aktion geklickt wurde
        if (!e.target.closest(".gradient-card-item-action")) {
          this.options.onItemClick(item);
        }
      });

      // Cursor-Stil anpassen
      li.style.cursor = "pointer";
    }

    return li;
  }

  /**
   * Aktualisiert die Items in der Karte
   *
   * @param {Array} items - Neue Items
   */
  updateItems(items) {
    this.options.items = items;
    this.renderCard();
  }

  /**
   * Aktualisiert die Gradient-Konfiguration
   *
   * @param {Object} gradientConfig - Neue Gradient-Konfiguration
   */
  updateGradient(gradientConfig) {
    this.options.gradient = {
      ...this.options.gradient,
      ...gradientConfig,
    };
    this.initializeCard();
  }
}
