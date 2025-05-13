#!/usr/bin/env python3
"""
Claude RAG Datenbank-Setup
===========================

Dieses Skript richtet eine Vektordatenbank für das Claude RAG Framework ein.
Es unterstützt LanceDB und ChromaDB als Vektordatenbanken.
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path

# Verzeichnis zum Script hinzufügen
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(script_dir))

# Konfigurationsverzeichnis
CONFIG_DIR = os.path.join(os.path.dirname(script_dir), "config")
CONFIG_FILE = os.path.join(CONFIG_DIR, "rag_config.json")

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('claude_rag_setup')

def load_config():
    """Lade die RAG-Konfiguration"""
    if not os.path.exists(CONFIG_FILE):
        logger.error(f"Konfigurationsdatei nicht gefunden: {CONFIG_FILE}")
        sys.exit(1)
    
    with open(CONFIG_FILE, 'r') as f:
        config = json.load(f)
    
    return config

def setup_lancedb(config):
    """Richte LanceDB ein"""
    try:
        import lancedb
    except ImportError:
        logger.error("LanceDB nicht installiert. Installieren Sie mit: pip install lancedb")
        return False
    
    db_path = config["database"]["connection"]["path"]
    db_path = os.path.abspath(os.path.expanduser(db_path))
    
    # Erstelle Verzeichnis, falls es nicht existiert
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    try:
        # Verbindung zur Datenbank herstellen
        db = lancedb.connect(db_path)
        
        # Table-Schema
        schema = {
            "id": "string",
            "vector": f"float32({config['database']['dimensions']})",
            "content": "string",
            "metadata": "json"
        }
        
        # Erstelle die Standard-Tabelle, wenn sie nicht existiert
        if "default" not in db.table_names():
            logger.info("Erstelle Standard-Tabelle in LanceDB")
            db.create_table("default", schema=schema)
        
        logger.info(f"LanceDB erfolgreich eingerichtet in {db_path}")
        return True
    except Exception as e:
        logger.error(f"Fehler beim Einrichten von LanceDB: {e}")
        return False

def setup_chromadb(config):
    """Richte ChromaDB ein"""
    try:
        import chromadb
    except ImportError:
        logger.error("ChromaDB nicht installiert. Installieren Sie mit: pip install chromadb")
        return False
    
    db_path = config["database"]["alternatives"]["chromadb"]["path"]
    db_path = os.path.abspath(os.path.expanduser(db_path))
    
    # Erstelle Verzeichnis, falls es nicht existiert
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    try:
        # Verbindung zur Datenbank herstellen
        client = chromadb.PersistentClient(path=db_path)
        
        # Erstelle die Standard-Collection, wenn sie nicht existiert
        client.get_or_create_collection("default")
        
        logger.info(f"ChromaDB erfolgreich eingerichtet in {db_path}")
        return True
    except Exception as e:
        logger.error(f"Fehler beim Einrichten von ChromaDB: {e}")
        return False

def check_embedding_model(config):
    """Überprüfe das Embedding-Modell"""
    provider = config["embedding"]["provider"]
    
    if provider == "voyage":
        # Überprüfe API-Key
        api_key_env = config["embedding"]["api_key_env"]
        api_key = os.environ.get(api_key_env)
        
        if not api_key:
            logger.warning(f"Kein API-Key für Voyage gefunden in {api_key_env}")
            return False
        
        try:
            from voyage import Client
            client = Client(api_key=api_key)
            logger.info("Voyage API-Verbindung erfolgreich getestet")
            return True
        except ImportError:
            logger.error("Voyage Python-Paket nicht installiert. Installieren Sie mit: pip install voyage")
            return False
        except Exception as e:
            logger.error(f"Fehler bei der Verbindung zur Voyage API: {e}")
            return False
    
    elif provider == "huggingface":
        try:
            from sentence_transformers import SentenceTransformer
            model_name = config["embedding"]["alternatives"]["huggingface"]["model"]
            logger.info(f"Lade Hugging Face Modell: {model_name}")
            model = SentenceTransformer(model_name)
            logger.info("Hugging Face Modell erfolgreich geladen")
            return True
        except ImportError:
            logger.error("Sentence Transformers nicht installiert. Installieren Sie mit: pip install sentence-transformers")
            return False
        except Exception as e:
            logger.error(f"Fehler beim Laden des Hugging Face Modells: {e}")
            return False
    
    else:
        logger.error(f"Nicht unterstützter Embedding-Provider: {provider}")
        return False

def check_claude_api(config):
    """Überprüfe die Claude API"""
    api_key_env = config["claude"]["api_key_env"]
    api_key = os.environ.get(api_key_env)
    
    if not api_key:
        logger.warning(f"Kein API-Key für Claude gefunden in {api_key_env}")
        return False
    
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        logger.info("Claude API-Verbindung erfolgreich getestet")
        return True
    except ImportError:
        logger.error("Anthropic Python-Paket nicht installiert. Installieren Sie mit: pip install anthropic")
        return False
    except Exception as e:
        logger.error(f"Fehler bei der Verbindung zur Claude API: {e}")
        return False

def main():
    """Hauptfunktion"""
    parser = argparse.ArgumentParser(description='Claude RAG Datenbank-Setup')
    parser.add_argument('--db-type', choices=['lancedb', 'chromadb', 'both'], default='lancedb',
                      help='Zu verwendender Datenbanktyp (Standard: lancedb)')
    parser.add_argument('--check-only', action='store_true',
                      help='Nur Konfiguration überprüfen, keine Datenbank einrichten')
    
    args = parser.parse_args()
    
    logger.info("Lade Konfiguration...")
    config = load_config()
    
    # Überprüfe die Embedding-Provider
    embedding_ok = check_embedding_model(config)
    if embedding_ok:
        logger.info("Embedding-Modell OK")
    else:
        logger.warning("Embedding-Modell nicht verfügbar. RAG-Funktionalität eingeschränkt.")
    
    # Überprüfe die Claude API
    claude_ok = check_claude_api(config)
    if claude_ok:
        logger.info("Claude API OK")
    else:
        logger.warning("Claude API nicht verfügbar. RAG-Funktionalität eingeschränkt.")
    
    if args.check_only:
        logger.info("Überprüfung abgeschlossen. Beende.")
        return
    
    # Setup durchführen
    if args.db_type in ['lancedb', 'both']:
        logger.info("Richte LanceDB ein...")
        lancedb_ok = setup_lancedb(config)
    
    if args.db_type in ['chromadb', 'both']:
        logger.info("Richte ChromaDB ein...")
        chromadb_ok = setup_chromadb(config)
    
    logger.info("Setup abgeschlossen.")

if __name__ == "__main__":
    main()
