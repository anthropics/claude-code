#!/bin/bash

# Neural Recursive Debugging Dashboard Starter
# ===========================================
#
# Startet das Dashboard für rekursives Debugging und öffnet es im Browser

# Aktuellen Pfad bestimmen
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Prüfen, ob Node.js installiert ist
if ! command -v node &> /dev/null; then
    echo "Node.js ist nicht installiert. Bitte installieren Sie Node.js, um das Dashboard zu verwenden."
    exit 1
fi

# Prüfen, ob express installiert ist
if ! node -e "try { require.resolve('express'); } catch(e) { process.exit(1); }" &> /dev/null; then
    echo "Express ist nicht installiert. Installation wird gestartet..."
    npm install --no-fund --no-audit --silent express sqlite3
fi

# Git-Repository-Root als Projektverzeichnis verwenden
if command -v git &> /dev/null && git rev-parse --is-inside-work-tree &> /dev/null; then
    PROJECT_ROOT=$(git rev-parse --show-toplevel)
    echo "Git-Repository gefunden: $PROJECT_ROOT"
else
    PROJECT_ROOT=$(dirname $(dirname "$SCRIPT_DIR"))
    echo "Kein Git-Repository gefunden, verwende: $PROJECT_ROOT"
fi

# Umgebungsvariable für Projektpfad setzen
export PROJECT_ROOT="$PROJECT_ROOT"

# Dashboard-Server starten
echo "Starte Neural Recursive Debugging Dashboard..."
cd "$SCRIPT_DIR"

# Port bestimmen (Standard: 3000)
PORT=3000

# Prüfen, ob der Port bereits verwendet wird
while netstat -tuln | grep -q ":$PORT "; do
    PORT=$((PORT+1))
    echo "Port $PORT wird bereits verwendet, versuche Port $((PORT+1))..."
done

# Server-Prozess im Hintergrund starten
PORT=$PORT node server.js &
SERVER_PID=$!

echo "Dashboard-Server läuft auf Port $PORT (PID: $SERVER_PID)"
echo "Dashboard wird im Browser geöffnet..."

# Einige Sekunden warten, damit der Server starten kann
sleep 2

# Browser öffnen (plattformunabhängig)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:$PORT" 2>/dev/null || sensible-browser "http://localhost:$PORT" 2>/dev/null || (echo "Browser konnte nicht automatisch geöffnet werden. Bitte öffnen Sie http://localhost:$PORT manuell.")
elif [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:$PORT"
elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    start "http://localhost:$PORT"
else
    echo "Unbekanntes Betriebssystem. Bitte öffnen Sie http://localhost:$PORT manuell."
fi

# PID in temporärer Datei speichern, damit der Server später beendet werden kann
echo $SERVER_PID > "$SCRIPT_DIR/.dashboard_pid"

echo "Zum Beenden des Dashboards drücken Sie Ctrl+C"

# Auf Tastendruck warten
function cleanup {
    echo "Beende Dashboard-Server..."
    if [ -f "$SCRIPT_DIR/.dashboard_pid" ]; then
        PID=$(cat "$SCRIPT_DIR/.dashboard_pid")
        kill $PID 2>/dev/null
        rm "$SCRIPT_DIR/.dashboard_pid"
    fi
    exit 0
}

# Signal-Handler registrieren
trap cleanup SIGINT SIGTERM

# Warten, bis der Prozess beendet wird
wait $SERVER_PID
