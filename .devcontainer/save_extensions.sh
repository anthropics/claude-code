#!/bin/bash
# Skript zum Speichern aller aktuell installierten VS Code-Erweiterungen

# Verzeichnis für die Ausgabe erstellen, falls es nicht existiert
mkdir -p .devcontainer/extensions

# Liste der installierten Erweiterungen speichern
NODE_OPTIONS="" code --list-extensions > .devcontainer/extensions/installed_extensions.txt

# Ausgabe
echo "Alle installierten Erweiterungen wurden in .devcontainer/extensions/installed_extensions.txt gespeichert."
echo "Um die devcontainer.json zu aktualisieren, führen Sie das Skript update_devcontainer.sh aus."
