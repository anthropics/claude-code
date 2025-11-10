# 🚀 Schnellstart-Anleitung

## In 5 Minuten einsatzbereit!

### Schritt 1: Installation vorbereiten

```bash
# In das Projekt-Verzeichnis wechseln
cd voice-transcriber-optimized

# Virtuelle Umgebung erstellen
python -m venv venv

# Virtuelle Umgebung aktivieren
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

### Schritt 2: Abhängigkeiten installieren

```bash
pip install -r requirements.txt
```

### Schritt 3: Icons erstellen

```bash
# Pillow installieren (falls noch nicht vorhanden)
pip install Pillow

# Icons generieren
python create_icons.py
```

### Schritt 4: API-Keys einrichten

1. **OpenAI API-Key erhalten**:
   - Gehen Sie zu [platform.openai.com](https://platform.openai.com)
   - Registrieren Sie sich oder melden Sie sich an
   - Navigieren Sie zu "API Keys"
   - Erstellen Sie einen neuen Key
   - Kopieren Sie den Key (beginnt mit "sk-...")

2. **Groq API-Key erhalten** (optional, aber empfohlen - schneller!):
   - Gehen Sie zu [console.groq.com](https://console.groq.com)
   - Registrieren Sie sich
   - Erstellen Sie einen API-Key
   - Kopieren Sie den Key (beginnt mit "gsk_...")

### Schritt 5: App starten

```bash
python app.py
```

Sie sollten folgende Ausgabe sehen:
```
============================================================
🎤 Optimized Voice Transcriber gestartet!
============================================================
📱 Öffnen Sie http://localhost:5000 im Browser
📱 Für Samsung Tablet: http://[IHRE-IP]:5000
============================================================
```

### Schritt 6: Im Browser öffnen

1. Öffnen Sie Ihren Browser
2. Gehen Sie zu: `http://localhost:5000`
3. Klicken Sie auf das ⚙️ Einstellungen-Icon (oben rechts)
4. Tragen Sie Ihre API-Keys ein
5. Klicken Sie auf "Speichern"

### Schritt 7: Erste Transkription!

1. Ziehen Sie eine Audio-Datei auf die Upload-Fläche ODER klicken Sie auf "Datei auswählen"
2. Wählen Sie Ihren Provider (OpenAI oder Groq)
3. Wählen Sie das Modell
4. Optional: Aktivieren Sie GPT-4 Post-Processing
5. Klicken Sie auf "Transkription starten"
6. Fertig! 🎉

## 📱 Für Samsung Galaxy Tab S24 FE

### Ihre IP-Adresse finden:

**Windows:**
```bash
ipconfig
# Suchen Sie nach "IPv4-Adresse" (z.B. 192.168.1.100)
```

**macOS/Linux:**
```bash
ifconfig
# Suchen Sie nach "inet" (z.B. 192.168.1.100)
```

### Auf dem Tablet verbinden:

1. Stellen Sie sicher, dass Tablet und PC im **gleichen WLAN** sind
2. Öffnen Sie Samsung Internet oder Chrome auf dem Tablet
3. Geben Sie ein: `http://[IHRE-IP]:5000`
   - Beispiel: `http://192.168.1.100:5000`
4. App wird geladen!

### Als PWA installieren:

1. Klicken Sie im Browser-Menü auf **"⋮"** (drei Punkte)
2. Wählen Sie **"Zum Startbildschirm hinzufügen"**
3. App-Icon erscheint auf Ihrem Home Screen
4. Fertig - nutzen Sie es wie eine normale App! 📱

## 💡 Tipps

### Audio-Formate
Unterstützte Formate: MP3, WAV, M4A, OGG, WebM

### Beste Qualität
- Verwenden Sie hochwertige Aufnahmen
- Minimieren Sie Hintergrundgeräusche
- Sprechen Sie deutlich

### Kosten sparen
- Nutzen Sie **Groq** - bis zu 10x schneller und günstiger als OpenAI
- Für private Daten: Nutzen Sie **Local Whisper** (kostenlos, aber langsamer)

### GPT-4 effektiv nutzen
- Für Meetings: "Hauptpunkte extrahieren"
- Für Diktate: "Satzzeichen & Formatierung hinzufügen"
- Für Business: "Professionell formulieren"

## ❓ Probleme?

### "Module not found" Fehler
```bash
pip install -r requirements.txt
```

### Port 5000 bereits belegt
Ändern Sie in `app.py` die letzte Zeile:
```python
app.run(host='0.0.0.0', port=8000, debug=True)  # Port auf 8000 ändern
```

### Tablet kann nicht verbinden
1. PC und Tablet müssen im selben WLAN sein
2. Firewall prüfen (Port 5000 freigeben)
3. Richtige IP-Adresse verwenden

## 🎉 Fertig!

Viel Spaß mit Ihrem Voice Transcriber Pro!

Weitere Infos in der [vollständigen README](README.md).
