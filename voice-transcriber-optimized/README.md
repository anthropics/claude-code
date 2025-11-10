# 🎤 Voice Transcriber Pro

Eine moderne, professionelle Sprachtranskriptions-Anwendung mit KI-gestützter Optimierung und Multi-Provider-Unterstützung.

## ✨ Features

### 🚀 Kernfunktionen
- **Mehrere Whisper-Modelle**: Alle OpenAI Whisper-Modelle verfügbar (tiny, base, small, medium, large, large-v2, large-v3)
- **Multi-Provider-Support**: OpenAI, Groq, Local Whisper
- **GPT-4 Post-Processing**: Automatische Verbesserung der Transkriptionen
- **Optimale Prompts**: 5 vorgefertigte GPT-4 Prompts für verschiedene Anwendungsfälle
- **12+ Sprachen**: Unterstützung für Deutsch, Englisch, Spanisch, Französisch, und mehr

### 🎨 Moderne Benutzeroberfläche
- **Stylisches Design**: Modernes, farbenfrohes UI mit Farbkennzeichnungen
- **Responsive**: Perfekt optimiert für Desktop, Tablet und Smartphone
- **Drag & Drop**: Einfaches Hochladen von Audio-Dateien
- **Dark Mode Ready**: Vorbereitet für Dark Mode (in Entwicklung)

### 📱 Samsung Galaxy Tab S24 FE Unterstützung
- **Progressive Web App (PWA)**: Installierbar wie eine native App
- **Offline-Fähig**: Service Worker für Offline-Nutzung
- **Touch-Optimiert**: Perfekt für Tablet-Bedienung
- **Responsive Layout**: Automatische Anpassung an Tablet-Größe

### 🔧 Erweiterte Funktionen
- **API-Konfiguration**: Einfache Verwaltung von API-Keys
- **Ergebnis-Export**: Download als TXT-Datei
- **Zwischenablage**: Ein-Klick-Kopieren der Ergebnisse
- **Echtzeitfortschritt**: Live-Updates während der Transkription

## 📋 Voraussetzungen

- Python 3.8 oder höher
- pip (Python Package Manager)
- (Optional) FFmpeg für lokale Whisper-Modelle

## 🔧 Installation

### 1. Repository klonen oder herunterladen

```bash
cd voice-transcriber-optimized
```

### 2. Virtuelle Umgebung erstellen (empfohlen)

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3. Abhängigkeiten installieren

```bash
pip install -r requirements.txt
```

### 4. Umgebungsvariablen konfigurieren

```bash
# .env.example kopieren
cp .env.example .env

# .env bearbeiten und API-Keys eintragen
```

### 5. Anwendung starten

```bash
python app.py
```

Die Anwendung ist nun unter `http://localhost:5000` erreichbar.

## 📱 Samsung Galaxy Tab S24 FE Nutzung

### Variante 1: Im Browser nutzen

1. **Netzwerk-IP ermitteln**:
   ```bash
   # Windows
   ipconfig

   # macOS/Linux
   ifconfig
   ```

2. **Auf dem Tablet öffnen**:
   - Samsung Internet Browser oder Chrome öffnen
   - `http://[IHRE-IP]:5000` eingeben
   - Beispiel: `http://192.168.1.100:5000`

### Variante 2: Als PWA installieren

1. Webseite im Browser öffnen
2. Im Chrome-Menü (⋮) **"Zum Startbildschirm hinzufügen"** wählen
3. App-Icon wird auf dem Home Screen erstellt
4. App wie eine native Anwendung nutzen

### Vorteile der PWA auf dem Tablet:
- ✅ Vollbild-Modus ohne Browser-UI
- ✅ Schneller Zugriff vom Home Screen
- ✅ Offline-Caching für bessere Performance
- ✅ Native App-ähnliches Erlebnis

## 🎯 API-Provider einrichten

### OpenAI Whisper & GPT-4

1. Account erstellen auf [platform.openai.com](https://platform.openai.com)
2. API-Key generieren unter "API Keys"
3. In den Einstellungen eintragen

**Kosten** (Stand 2024):
- Whisper: $0.006 pro Minute
- GPT-4 Turbo: $0.01 pro 1K Tokens

### Groq (Schneller & Günstiger)

1. Account erstellen auf [console.groq.com](https://console.groq.com)
2. API-Key generieren
3. In den Einstellungen eintragen

**Vorteile**:
- ⚡ Bis zu 10x schneller als OpenAI
- 💰 Günstigere Preise
- 🎯 Gleiche Qualität

### Local Whisper (Kostenlos)

1. FFmpeg installieren:
   ```bash
   # Windows (mit Chocolatey)
   choco install ffmpeg

   # macOS
   brew install ffmpeg

   # Linux
   sudo apt install ffmpeg
   ```

2. In der App "Local" Provider auswählen

**Vorteile**:
- 🆓 Komplett kostenlos
- 🔒 Maximale Privatsphäre (keine Cloud)
- ⚠️ Langsamer & benötigt gute Hardware

## 🎨 GPT-4 Post-Processing Modi

### 1. Grammatik & Rechtschreibung korrigieren
Verbessert automatisch Fehler in der Transkription.

**Anwendungsfall**: Alltägliche Aufnahmen, Voice Memos

### 2. Satzzeichen & Formatierung hinzufügen
Fügt professionelle Formatierung mit Absätzen hinzu.

**Anwendungsfall**: Längere Diktate, Artikel

### 3. Professionell formulieren
Macht die Sprache formeller und geschäftsmäßiger.

**Anwendungsfall**: Business-Dokumente, offizielle Korrespondenz

### 4. Zusammenfassung erstellen
Erstellt eine prägnante Zusammenfassung des Inhalts.

**Anwendungsfall**: Meetings, Vorträge, Interviews

### 5. Hauptpunkte extrahieren
Erstellt eine Bullet-Point-Liste der wichtigsten Punkte.

**Anwendungsfall**: Meeting-Protokolle, Notizen

## 🔐 Sicherheit & Datenschutz

- ✅ API-Keys werden lokal gespeichert
- ✅ Keine Daten werden auf eigenen Servern gespeichert
- ✅ Direkte Kommunikation mit API-Providern
- ⚠️ Bei Cloud-Providern (OpenAI, Groq) durchlaufen Audio-Dateien deren Server
- 🔒 Für maximale Privatsphäre: Local Whisper nutzen

## 📁 Projektstruktur

```
voice-transcriber-optimized/
├── app.py                      # Flask Backend
├── requirements.txt            # Python Dependencies
├── .env.example               # Environment Template
├── config/
│   └── settings.json          # App-Konfiguration
├── templates/
│   └── index.html            # Haupt-HTML
├── static/
│   ├── css/
│   │   └── style.css         # Moderne Styles
│   ├── js/
│   │   ├── app.js           # Main JavaScript
│   │   └── sw.js            # Service Worker
│   ├── manifest.json         # PWA Manifest
│   ├── icon-192.png         # PWA Icon (192x192)
│   └── icon-512.png         # PWA Icon (512x512)
└── README.md                 # Diese Datei
```

## 🎨 Farbschema

Die Anwendung verwendet ein modernes, farbenfrohes Design:

- **Primary (Indigo)**: Hauptaktionen, Links
- **Success (Grün)**: Erfolgreiche Operationen
- **Warning (Orange)**: Warnungen
- **Error (Rot)**: Fehlermeldungen
- **Gray (Neutral)**: UI-Elemente, Text

## 🚀 Deployment

### Lokal mit Gunicorn (Linux/macOS)

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Lokal mit Waitress (Windows)

```bash
waitress-serve --host=0.0.0.0 --port=5000 app:app
```

### Cloud Deployment

Die Anwendung kann auf folgenden Plattformen deployed werden:
- Heroku
- Railway
- Render
- DigitalOcean
- AWS Elastic Beanstalk
- Google Cloud Run

## 🐛 Troubleshooting

### Problem: "Module not found" Fehler
**Lösung**: Stellen Sie sicher, dass alle Dependencies installiert sind:
```bash
pip install -r requirements.txt
```

### Problem: Local Whisper funktioniert nicht
**Lösung**: FFmpeg installieren (siehe Installation)

### Problem: App im Tablet nicht erreichbar
**Lösung**:
1. Prüfen Sie, dass PC und Tablet im gleichen WLAN sind
2. Firewall-Einstellungen prüfen
3. Korrekte IP-Adresse verwenden

### Problem: API-Fehler "Invalid API Key"
**Lösung**: API-Keys in den Einstellungen überprüfen und neu eingeben

## 🔄 Updates & Erweiterungen

### Geplante Features
- [ ] Dark Mode
- [ ] Multi-File Upload
- [ ] Audio-Aufnahme direkt in der App
- [ ] Transkriptions-Historie
- [ ] Cloud-Speicher-Integration (Google Drive, Dropbox)
- [ ] Weitere Sprachen
- [ ] Custom GPT-4 Prompts
- [ ] Speaker Diarization (Sprecher-Erkennung)

## 📝 Lizenz

Dieses Projekt ist für private und kommerzielle Nutzung frei verfügbar.

## 🤝 Support

Bei Fragen oder Problemen:
1. README durchlesen
2. Troubleshooting-Sektion prüfen
3. Issue im Repository erstellen

## 🎉 Credits

Entwickelt mit:
- Flask (Python Web Framework)
- OpenAI Whisper API
- Groq API
- Modern CSS3 & JavaScript

---

**Viel Erfolg mit Ihrem Voice Transcriber Pro! 🎤✨**
