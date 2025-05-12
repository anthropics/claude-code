#!/bin/bash
# Script zum Wiederherstellen des DevContainers

# Prüfen, ob wir in einem VS Code-Fenster sind
if [ -z "$VSCODE_IPC_HOOK_CLI" ]; then
  echo "Dieses Skript sollte in VS Code ausgeführt werden."
  exit 1
fi

# Aktuelles Verzeichnis prüfen
if [ ! -d ".devcontainer" ]; then
  echo "Dieses Skript muss im Hauptverzeichnis des Workspace ausgeführt werden."
  exit 1
fi

# Wenn der Container läuft, beenden
echo "Stoppe einen eventuell laufenden DevContainer..."
code --remote "dev-container+${PWD}" --kill-server 2>/dev/null

# Rebuild des Containers
echo "Erstelle den DevContainer neu..."
code --remote "dev-container+${PWD}" --folder-uri "vscode-remote://dev-container+${PWD}" .

echo "DevContainer wird neu erstellt. VS Code wird sich in Kürze verbinden."
echo "Bitte warten Sie, bis der Prozess abgeschlossen ist."
