#!/bin/bash
# Skript zum Aktualisieren der devcontainer.json mit allen installierten Erweiterungen

# Prüfen, ob die Liste der Erweiterungen existiert
if [ ! -f ".devcontainer/extensions/installed_extensions.txt" ]; then
  echo "Bitte führen Sie zuerst save_extensions.sh aus, um die Liste der installierten Erweiterungen zu speichern."
  exit 1
fi

# Temporäre Datei erstellen
temp_file=$(mktemp)

# Erweiterungen im JSON-Format formatieren
extensions_json="      \"extensions\": ["
while read extension; do
  extensions_json+="\n        \"$extension\","
done < .devcontainer/extensions/installed_extensions.txt
# Letztes Komma entfernen
extensions_json=${extensions_json%,}
extensions_json+="\n      ],"

# Vorherige Konfiguration speichern
cp .devcontainer/devcontainer.json .devcontainer/devcontainer.json.bak

# Die devcontainer.json Datei aktualisieren
sed -n '1,/\"extensions\":/p' .devcontainer/devcontainer.json > "$temp_file"
echo -e "$extensions_json" >> "$temp_file"
sed -n '/],/,$p' .devcontainer/devcontainer.json | tail -n +2 >> "$temp_file"

# Überprüfen, ob die Datei gültig ist
if jq empty "$temp_file" 2>/dev/null; then
  mv "$temp_file" .devcontainer/devcontainer.json
  echo "devcontainer.json wurde erfolgreich aktualisiert."
  echo "Eine Sicherungskopie wurde als devcontainer.json.bak gespeichert."
else
  echo "FEHLER: Die generierte JSON-Datei ist ungültig."
  echo "Die ursprüngliche devcontainer.json bleibt unverändert."
  echo "Die problematische Datei wurde in $temp_file gespeichert zur Überprüfung."
  exit 1
fi
