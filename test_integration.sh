#!/bin/bash
# Integration test für UI-Komponenten

echo "Teste UI-Komponenten Integration..."
echo "=================================="

# Verzeichnisse prüfen
if [ -d "./src/ui_components" ]; then
  echo "✅ ui_components Verzeichnis existiert"
else
  echo "❌ ui_components Verzeichnis wurde nicht gefunden"
fi

if [ -d "./src/schema_ui" ]; then
  echo "✅ schema_ui Verzeichnis existiert"
else
  echo "❌ schema_ui Verzeichnis wurde nicht gefunden"
fi

# Komponenten-Dateien prüfen
echo -e "\nDashboard Komponenten:"
if [ -f "./src/ui_components/dashboard/BentoGrid.js" ]; then
  echo "✅ BentoGrid Komponente existiert"
else
  echo "❌ BentoGrid Komponente wurde nicht gefunden"
fi

if [ -f "./src/ui_components/dashboard/AdvancedFilter.js" ]; then
  echo "✅ AdvancedFilter Komponente existiert"
else
  echo "❌ AdvancedFilter Komponente wurde nicht gefunden"
fi

if [ -f "./src/ui_components/dashboard/DynamicMetricTile.js" ]; then
  echo "✅ DynamicMetricTile Komponente existiert"
else
  echo "❌ DynamicMetricTile Komponente wurde nicht gefunden"
fi

if [ -f "./src/ui_components/dashboard/GradientCard.js" ]; then
  echo "✅ GradientCard Komponente existiert"
else
  echo "❌ GradientCard Komponente wurde nicht gefunden"
fi

# Adapter
echo -e "\nAdapter:"
if [ -f "./src/ui_components/adapters.js" ]; then
  echo "✅ Adapter existiert"
else
  echo "❌ Adapter wurde nicht gefunden"
fi

# Index-Datei
if [ -f "./src/ui_components/index.js" ]; then
  echo "✅ UI Components Index existiert"
else
  echo "❌ UI Components Index wurde nicht gefunden"
fi

if [ -f "./src/schema_ui/index.js" ]; then
  echo "✅ Schema UI Index existiert"
else
  echo "❌ Schema UI Index wurde nicht gefunden"
fi

# Design System
echo -e "\nDesign System:"
if [ -f "./src/ui_components/design-system/colors.css" ]; then
  echo "✅ Design System Colors existiert"
else
  echo "❌ Design System Colors wurde nicht gefunden"
fi

if [ -f "./src/ui_components/design-system/responsive.css" ]; then
  echo "✅ Design System Responsive existiert"
else
  echo "❌ Design System Responsive wurde nicht gefunden"
fi

# Dokumentation
echo -e "\nDokumentation:"
if [ -f "./docs/INTEGRATED_UI_COMPONENTS.md" ]; then
  echo "✅ Komponenten-Dokumentation existiert"
else
  echo "❌ Komponenten-Dokumentation wurde nicht gefunden"
fi

if [ -f "./docs/MIGRATION_GUIDE.md" ]; then
  echo "✅ Migrations-Leitfaden existiert"
else
  echo "❌ Migrations-Leitfaden wurde nicht gefunden"
fi

# Beispiel
echo -e "\nBeispielimplementierung:"
if [ -f "./src/integrated_example.js" ]; then
  echo "✅ Integriertes Beispiel existiert"
else
  echo "❌ Integriertes Beispiel wurde nicht gefunden"
fi

echo -e "\nTest abgeschlossen!"
