# RAG-System Handbuch

Dieses Handbuch beschreibt das Retrieval Augmented Generation (RAG) System des Claude Neural Framework. Es erklärt die Architektur, Konfiguration und Verwendung des Systems.

## Einführung

Retrieval Augmented Generation (RAG) verbessert die Antworten von Claude, indem relevante Informationen aus einer Wissensdatenbank abgerufen und in den Kontext der Anfrage eingebettet werden. Dies ermöglicht präzisere und informativere Antworten, insbesondere bei domänenspezifischen oder projektspezifischen Fragen.

Das RAG-System des Claude Neural Framework besteht aus folgenden Komponenten:
- **Embedding Engine**: Generiert Vektorrepräsentationen für Dokumente und Anfragen
- **Vector Store**: Speichert und indiziert Dokumente für effiziente Ähnlichkeitssuche
- **Document Processor**: Verarbeitet und segmentiert Dokumente in sinnvolle Chunks
- **Retrieval Engine**: Findet relevante Informationen basierend auf einer Anfrage
- **Claude Integration**: Generiert präzise Antworten mit Hilfe des abgerufenen Kontexts

## Architektur

Die RAG-Systemarchitektur ist modular aufgebaut und unterstützt verschiedene Embedding-Provider und Vektordatenbanken:

```
                       ┌─────────────────┐
                       │                 │
  ┌──────────┐         │  Embedding      │         ┌──────────┐
  │          │         │  Provider       │         │          │
  │ Document ├────────►│  - Voyage AI    ├────────►│  Vector  │
  │ Processor│         │  - Hugging Face │         │  Store   │
  │          │         │                 │         │          │
  └──────────┘         └─────────────────┘         └────┬─────┘
                                                        │
                                                        │
                                                        ▼
  ┌──────────┐         ┌─────────────────┐         ┌────┴─────┐
  │          │         │                 │         │          │
  │  Query   ├────────►│  Retrieval      │◄────────┤ Context  │
  │ Analyzer │         │  Engine         │         │ Builder  │
  │          │         │                 │         │          │
  └───────┬──┘         └────────┬────────┘         └──────────┘
          │                     │
          │                     │
          ▼                     ▼
  ┌───────┴───────────┐  ┌─────┴───────┐
  │                   │  │             │
  │  Claude API       │  │  Answer     │
  │  Integration      │  │  Generator  │
  │                   │  │             │
  └───────────────────┘  └─────────────┘
```

### Unterstützte Vektordatenbanken

Das System unterstützt zwei Vektordatenbanken:

1. **LanceDB** (Standard): Schnelle Vektordatenbank, die lokal ohne externe Dienste läuft
   - Vorteile: Leichtgewichtig, einfache Installation, keine Abhängigkeiten
   - Nachteile: Weniger skalierbar für sehr große Dokumentensammlungen

2. **ChromaDB**: Flexiblere Vektordatenbank mit erweiterten Funktionen
   - Vorteile: Erweiterte Filtermöglichkeiten, höhere Robustheit
   - Nachteile: Komplexere Einrichtung, mehr Abhängigkeiten

### Embedding-Provider

Das System unterstützt zwei Embedding-Provider:

1. **Voyage AI** (Standard): Hochwertige Embeddings über API
   - Vorteile: Hervorragende Qualität, ständige Verbesserungen
   - Nachteile: Erfordert API-Schlüssel, externe Abhängigkeit

2. **Hugging Face**: Lokale Embedding-Modelle
   - Vorteile: Keine externe API erforderlich, vollständige Kontrolle
   - Nachteile: Höhere Systemanforderungen, potenziell geringere Qualität

## Installation und Einrichtung

### Voraussetzungen

- Python 3.8+ (empfohlen: 3.10+)
- Pip-Pakete:
  - anthropic
  - lancedb oder chromadb
  - langchain
  - voyage (für Voyage AI Embeddings)
  - sentence-transformers (für Hugging Face Embeddings)

### Installation

Die RAG-Komponenten werden automatisch mit dem Hauptinstallationsskript installiert. Für eine manuelle Installation:

```bash
pip install anthropic lancedb chromadb langchain sentence-transformers
pip install voyage  # Nur für Voyage AI Embeddings
```

### Datenbank einrichten

Verwenden Sie das Setup-Skript, um die Vektordatenbank einzurichten:

```bash
python core/rag/setup_database.py
```

Für eine spezifische Datenbank:

```bash
python core/rag/setup_database.py --db-type lancedb
# oder
python core/rag/setup_database.py --db-type chromadb
```

## Konfiguration

Die RAG-Konfiguration befindet sich in `core/config/rag_config.json`:

```json
{
  "database": {
    "type": "lancedb",
    "connection": {
      "path": "data/lancedb"
    },
    "dimensions": 1024
  },
  "embedding": {
    "provider": "voyage",
    "model": "voyage-2",
    "dimensions": 1024,
    "api_key_env": "VOYAGE_API_KEY"
  },
  "retrieval": {
    "top_k": 5,
    "similarity_threshold": 0.7
  },
  "chunking": {
    "size": 1000,
    "overlap": 200,
    "strategy": "semantic"
  }
}
```

### Konfigurationsoptionen

#### Database

- `type`: Datenbanktyp (`lancedb` oder `chromadb`)
- `connection`: Verbindungsdetails (pfadbasiert oder host-basiert)
- `dimensions`: Dimensionalität der Embeddings (muss mit dem Embedding-Modell übereinstimmen)

#### Embedding

- `provider`: Embedding-Provider (`voyage` oder `huggingface`)
- `model`: Zu verwendendes Modell
- `dimensions`: Dimensionalität der Embeddings
- `api_key_env`: Umgebungsvariable für den API-Schlüssel (nur für Voyage AI)

#### Retrieval

- `top_k`: Anzahl der abzurufenden Dokumente
- `similarity_threshold`: Minimale Ähnlichkeit für relevante Dokumente (0-1)
- `reranking`: Aktiviert/deaktiviert das Reranking der Ergebnisse

#### Chunking

- `size`: Größe der Dokumentenchunks in Zeichen
- `overlap`: Überlappung zwischen benachbarten Chunks in Zeichen
- `strategy`: Chunking-Strategie (`semantic`, `sentence`, oder `fixed`)

## Verwendung

### Über die Python-API

```python
from core.rag.claude_rag import ClaudeRagAPI

# API initialisieren
rag_api = ClaudeRagAPI()

# Dokument hinzufügen (Datei)
doc_ids = rag_api.add_document("/pfad/zu/dokument.md", namespace="projekt")

# Dokument hinzufügen (Text)
text = "Dies ist ein Beispieltext, der in die Vektordatenbank eingefügt werden soll."
metadata = {"source": "Beispiel", "author": "Claude Team"}
doc_ids = rag_api.add_document(text, namespace="projekt", metadata=metadata)

# Verzeichnis hinzufügen
results = rag_api.add_documents_from_directory(
    "/pfad/zu/dokumenten",
    namespace="projekt",
    extensions=[".md", ".txt", ".pdf"]
)

# Dokumente suchen
results = rag_api.search(
    "Wie funktioniert das RAG-System?", 
    namespace="projekt", 
    top_k=3
)

# Für jedes Ergebnis
for result in results:
    print(f"Dokument: {result.document.id}")
    print(f"Score: {result.score}")
    print(f"Inhalt: {result.document.content[:100]}...")
    print(f"Metadaten: {result.document.metadata}")
    print("---")

# Frage stellen (mit RAG)
answer, sources = rag_api.ask(
    "Erkläre mir das RAG-System",
    namespace="projekt",
    top_k=5,
    max_tokens=1000,
    temperature=0.7
)

print("Antwort:", answer)
print("\nQuellen:")
for source in sources:
    print(f"- {source.document.id} (Score: {source.score:.4f})")
```

### Über die Kommandozeile

Das RAG-System bietet auch ein Kommandozeilentool:

```bash
# Dokument hinzufügen
python -m core.rag.claude_rag add /pfad/zu/dokument.md --namespace projekt

# Verzeichnis hinzufügen
python -m core.rag.claude_rag add /pfad/zu/dokumenten/ --recursive --namespace projekt

# Dokumente suchen
python -m core.rag.claude_rag search "Wie funktioniert das RAG-System?" --namespace projekt

# Frage stellen
python -m core.rag.claude_rag ask "Erkläre mir das RAG-System" --namespace projekt
```

## Fortgeschrittene Funktionen

### Namespaces

Namespaces ermöglichen die Organisation von Dokumenten in separate Gruppen. Dies ist nützlich für:
- Projekte mit unterschiedlichen Dokumentensammlungen
- Mandantenfähige Anwendungen
- Isolierung von Testdaten

```python
# Dokumente in verschiedenen Namespaces speichern
rag_api.add_document("dokument1.md", namespace="projekt1")
rag_api.add_document("dokument2.md", namespace="projekt2")

# Nur in bestimmten Namespaces suchen
rag_api.search("Abfrage", namespace="projekt1")
```

### Metadatenfilter

Sie können Metadaten zu Dokumenten hinzufügen und später danach filtern:

```python
# Dokument mit Metadaten hinzufügen
rag_api.add_document(
    "dokument.md", 
    namespace="projekt", 
    metadata={
        "author": "Max Mustermann",
        "category": "Dokumentation",
        "version": "1.0"
    }
)

# Nach Metadaten filtern (abhängig vom Vektorspeicher)
# Implementierung für fortgeschrittene Benutzer
```

### Alternativen zu Voyage AI

Für Hugging Face Embeddings, ändern Sie die Konfiguration:

```json
"embedding": {
  "provider": "huggingface",
  "model": "sentence-transformers/all-mpnet-base-v2",
  "dimensions": 768,
  "device": "cpu"
}
```

## Leistungsoptimierung

### Embedding-Caching

Das System unterstützt das Caching von Embeddings, um wiederholte Berechnungen zu vermeiden:

```json
"cache": {
  "enabled": true,
  "ttl": 3600,
  "strategy": "lru",
  "max_size": 1000
}
```

### Chunk-Größe optimieren

Die optimale Chunk-Größe hängt von Ihren Dokumenten ab:
- Kleinere Chunks (500-800 Zeichen): Präzisere Antworten, aber potenziell fragmentierter Kontext
- Größere Chunks (1500-2000 Zeichen): Mehr Kontext, aber eventuell weniger präzise Treffer

Experimentieren Sie mit verschiedenen Werten für optimale Ergebnisse.

## Fehlerbehebung

### Häufige Probleme

**Problem**: Vektordatenbank kann nicht erstellt werden  
**Lösung**: Prüfen Sie Schreibrechte im Datenbankpfad

**Problem**: Embedding-Fehler mit Voyage AI  
**Lösung**: Prüfen Sie den API-Schlüssel und Netzwerkverbindung

**Problem**: Hugging Face Modell zu langsam  
**Lösung**: Verwenden Sie ein kleineres Modell oder GPU-Beschleunigung (`"device": "cuda"`)

**Problem**: Keine relevanten Ergebnisse  
**Lösung**: Senken Sie den Ähnlichkeitsschwellenwert oder überprüfen Sie die Dokumentqualität

## Erweiterung des Systems

Das RAG-System ist modular aufgebaut und kann erweitert werden:

1. **Neue Embedding-Provider**: Erstellen Sie eine neue Klasse, die von `EmbeddingProvider` erbt
2. **Alternative Vektordatenbanken**: Implementieren Sie die `VectorStore`-Schnittstelle
3. **Benutzerdefinierte Chunking-Strategien**: Erweitern Sie die `TextSplitter`-Klasse

Beispiel für einen benutzerdefinierten Embedding-Provider:

```python
class CustomEmbeddingProvider(EmbeddingProvider):
    def __init__(self, config):
        super().__init__(config)
        # Initialisierung
        
    def embed_text(self, text):
        # Implementierung
        
    def embed_batch(self, texts):
        # Implementierung
```

## Fazit

Das RAG-System des Claude Neural Framework bietet eine leistungsstarke Möglichkeit, Claude mit domänenspezifischem Wissen anzureichern. Durch die modulare Architektur und flexible Konfiguration kann es an verschiedene Anwendungsfälle und Anforderungen angepasst werden.

Für weiterführende Informationen:
- [Framework Architektur](../architecture/framework_architecture.md)
- [API Referenz](../api/api_reference.md)
- [RAG Best Practices](rag_best_practices.md)
