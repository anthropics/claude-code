#!/bin/bash
# Skript zum Bereinigen und Neustarten des Qdrant-Servers

# Definiere die Pfade
QDRANT_BASE_DIR="/workspace/.qdrant"
QDRANT_DB_DIR="$QDRANT_BASE_DIR/qdrant-db-unique-$(date +%Y%m%d%H%M%S)"

# Erzeuge einen neuen, eindeutigen Datenbank-Pfad
mkdir -p "$QDRANT_DB_DIR"
echo "Neuer Qdrant-Datenbank-Pfad erstellt: $QDRANT_DB_DIR"

# Setze die Umgebungsvariablen für den Qdrant-Server
export QDRANT_LOCAL_PATH="$QDRANT_DB_DIR"
export COLLECTION_NAME="agent-land-saarland-unique"
export EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"

echo "Umgebungsvariablen gesetzt:"
echo "QDRANT_LOCAL_PATH=$QDRANT_LOCAL_PATH"
echo "COLLECTION_NAME=$COLLECTION_NAME"
echo "EMBEDDING_MODEL=$EMBEDDING_MODEL"

# Starte den Qdrant-Server mit den neuen Einstellungen
echo "Starte Qdrant-Server..."
npx mcp-server-qdrant

# Hinweis: Der Befehl wird erst beendet, wenn der Server beendet wird
