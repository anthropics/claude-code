/**
 * Unit-Test für die BentoGrid-Komponente
 * Beispieltest für die integrierte Komponenten-Bibliothek
 */

import { BentoGrid } from "../../../src/ui_components/dashboard/BentoGrid";
import { lightweightAdapter } from "../../../src/ui_components/adapters";

// Mock des DOM-Elements
const mockElement = {
  innerHTML: "",
  addEventListener: jest.fn(),
  querySelector: jest.fn().mockReturnValue({
    addEventListener: jest.fn(),
  }),
  querySelectorAll: jest.fn().mockReturnValue([]),
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
  },
};

describe("BentoGrid Komponente", () => {
  let bentoGrid;

  beforeEach(() => {
    // DOM-Mocking
    document.getElementById = jest.fn().mockReturnValue(mockElement);

    // Komponente initialisieren
    bentoGrid = new BentoGrid({
      elementId: "test-grid",
      items: [
        { id: 1, name: "Test 1", status: "Aktiv" },
        { id: 2, name: "Test 2", status: "Inaktiv" },
      ],
      columns: {
        name: { label: "Name", sortable: true },
        status: { label: "Status", sortable: true },
      },
      adapter: lightweightAdapter,
    });
  });

  test("sollte korrekt initialisiert werden", () => {
    expect(bentoGrid).toBeDefined();
    expect(bentoGrid.options.items.length).toBe(2);
    expect(bentoGrid.options.columns).toHaveProperty("name");
    expect(bentoGrid.options.columns).toHaveProperty("status");
  });

  test("sollte nach Spalten sortieren können", () => {
    // Simuliere Sortierung nach Name
    bentoGrid.sortBy("name", "asc");

    // Überprüfe den Sortierstatus
    expect(bentoGrid.options.sort.column).toBe("name");
    expect(bentoGrid.options.sort.direction).toBe("asc");
  });

  test("sollte den DOM korrekt initialisieren", () => {
    bentoGrid.render();

    // Überprüfe, ob die render-Methode das DOM manipuliert hat
    expect(document.getElementById).toHaveBeenCalledWith("test-grid");
    expect(mockElement.innerHTML).not.toBe("");
  });

  test("sollte neue Items hinzufügen können", () => {
    const newItem = { id: 3, name: "Test 3", status: "Neu" };

    bentoGrid.addItem(newItem);

    expect(bentoGrid.options.items.length).toBe(3);
    expect(bentoGrid.options.items[2]).toEqual(newItem);
  });

  test("sollte Items entfernen können", () => {
    bentoGrid.removeItem(1);

    expect(bentoGrid.options.items.length).toBe(1);
    expect(bentoGrid.options.items[0].id).toBe(2);
  });
});
