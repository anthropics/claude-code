#!/usr/bin/env python3
"""
Claude RAG System API
=====================

Eine vereinfachte API-Schnittstelle für das Claude RAG Framework.
Diese Datei stellt benutzerfreundliche Funktionen zum Arbeiten mit dem RAG-System bereit.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Union, Any, Tuple

# Importiere das Framework
from .rag_framework import (
    RagConfig, Document, QueryResult, 
    EmbeddingProvider, VoyageEmbeddingProvider, HuggingFaceEmbeddingProvider,
    VectorStore, LanceDBStore, ChromaDBStore,
    TextSplitter, ClaudeIntegration, ClaudeRagClient
)

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('claude_rag_api')

class ClaudeRagAPI:
    """Benutzerfreundliche API für das Claude RAG System"""
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialisiert die Claude RAG API
        
        Args:
            config_path: Optional. Pfad zur Konfigurationsdatei.
                         Wenn nicht angegeben, wird in Standardorten gesucht.
        """
        # Standard-Konfigurationspfade
        default_paths = [
            os.path.join(os.path.dirname(__file__), '..', 'config', 'rag_config.json'),
            os.path.expanduser("~/.claude/config/rag_config.json")
        ]
        
        # Suche nach Konfigurationsdatei
        if config_path:
            self.config_path = config_path
        else:
            for path in default_paths:
                if os.path.exists(path):
                    self.config_path = path
                    break
            else:
                # Verwende die erste Option als Standard und erstelle sie
                self.config_path = default_paths[0]
                os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
                
                # Erstelle Standardkonfiguration
                config = RagConfig.default()
                with open(self.config_path, 'w') as f:
                    json.dump(asdict(config), f, indent=2)
        
        # Initialisiere den RAG-Client
        self.client = ClaudeRagClient(config_path=self.config_path)
        logger.info(f"Claude RAG API initialisiert mit Konfiguration aus {self.config_path}")
    
    def add_document(self, document: Union[str, Path, Document], 
                     namespace: str = "default", 
                     metadata: Optional[Dict[str, Any]] = None,
                     chunk: bool = True) -> List[str]:
        """
        Fügt ein Dokument zur RAG-Datenbank hinzu
        
        Args:
            document: Das hinzuzufügende Dokument. Kann ein Dateipfad, Textinhalt oder Document-Objekt sein.
            namespace: Der Namespace zum Speichern des Dokuments. Standard ist "default".
            metadata: Optionale Metadaten für das Dokument, wenn document ein Textstring ist.
            chunk: Ob das Dokument in kleinere Teile aufgeteilt werden soll.
        
        Returns:
            Eine Liste von Dokument-IDs, die zur Datenbank hinzugefügt wurden.
        """
        if isinstance(document, str) and os.path.exists(document):
            # Dokument ist ein Dateipfad
            logger.info(f"Füge Dokument aus Datei hinzu: {document}")
            return self.client.embed_document(document, namespace=namespace, chunk=chunk)
        elif isinstance(document, str):
            # Dokument ist ein Textstring
            logger.info("Füge Text-Dokument hinzu")
            doc_id = f"doc-{hash(document)}"
            doc = Document(id=doc_id, content=document, metadata=metadata or {})
            return self.client.embed_document(doc, namespace=namespace, chunk=chunk)
        else:
            # Dokument ist ein Document-Objekt
            logger.info(f"Füge Document-Objekt hinzu: {document.id}")
            return self.client.embed_document(document, namespace=namespace, chunk=chunk)
    
    def add_documents_from_directory(self, directory: Union[str, Path], 
                                     namespace: str = "default",
                                     extensions: List[str] = None,
                                     recursive: bool = True,
                                     chunk: bool = True) -> Dict[str, List[str]]:
        """
        Fügt alle Dokumente aus einem Verzeichnis zur RAG-Datenbank hinzu
        
        Args:
            directory: Das Verzeichnis, aus dem Dokumente geladen werden sollen.
            namespace: Der Namespace zum Speichern der Dokumente. Standard ist "default".
            extensions: Optional. Liste von Dateierweiterungen, die berücksichtigt werden sollen.
                        Standard ist ['.txt', '.md', '.pdf', '.docx'].
            recursive: Ob Unterverzeichnisse durchsucht werden sollen. Standard ist True.
            chunk: Ob die Dokumente in kleinere Teile aufgeteilt werden sollen.
        
        Returns:
            Ein Dictionary mit Dateipfaden als Schlüssel und Listen von Dokument-IDs als Werte.
        """
        directory = Path(directory)
        if not directory.exists() or not directory.is_dir():
            raise ValueError(f"Verzeichnis nicht gefunden: {directory}")
        
        extensions = extensions or ['.txt', '.md', '.pdf', '.docx']
        
        # Glob-Muster erstellen
        pattern = "**/*" if recursive else "*"
        
        # Ergebnisse speichern
        results = {}
        
        # Alle Dateien durchlaufen
        for file_path in directory.glob(pattern):
            if file_path.is_file() and file_path.suffix.lower() in extensions:
                try:
                    doc_ids = self.add_document(str(file_path), namespace=namespace, chunk=chunk)
                    results[str(file_path)] = doc_ids
                    logger.info(f"Dokument {file_path} hinzugefügt: {len(doc_ids)} Chunks")
                except Exception as e:
                    logger.error(f"Fehler beim Hinzufügen von {file_path}: {e}")
        
        return results
    
    def search(self, query: str, namespace: str = "default", 
               top_k: Optional[int] = None) -> List[QueryResult]:
        """
        Sucht nach Dokumenten, die zur Abfrage passen
        
        Args:
            query: Die Suchabfrage.
            namespace: Der zu durchsuchende Namespace. Standard ist "default".
            top_k: Die maximale Anzahl von Ergebnissen. Wenn None, wird der Wert aus der Konfiguration verwendet.
        
        Returns:
            Eine Liste von QueryResult-Objekten mit passenden Dokumenten.
        """
        logger.info(f"Suche nach: {query} in Namespace {namespace}")
        return self.client.query(query=query, namespace=namespace, top_k=top_k)
    
    def ask(self, query: str, namespace: str = "default", 
            top_k: Optional[int] = None, max_tokens: int = 1000, 
            temperature: float = 0.7) -> Tuple[str, List[QueryResult]]:
        """
        Stellt eine Frage an das RAG-System und erhält eine Antwort
        
        Args:
            query: Die Frage an das System.
            namespace: Der zu durchsuchende Namespace. Standard ist "default".
            top_k: Die maximale Anzahl von Ergebnissen. Wenn None, wird der Wert aus der Konfiguration verwendet.
            max_tokens: Die maximale Anzahl von Tokens in der Antwort.
            temperature: Die Temperatur für die Antwortgenerierung (0.0 bis 1.0).
        
        Returns:
            Ein Tupel aus (Antwort, Liste von QueryResult-Objekten).
        """
        logger.info(f"Frage: {query} in Namespace {namespace}")
        return self.client.ask(
            query=query, 
            namespace=namespace, 
            top_k=top_k, 
            max_tokens=max_tokens, 
            temperature=temperature
        )
    
    def list_namespaces(self) -> List[str]:
        """
        Listet alle verfügbaren Namespaces auf
        
        Returns:
            Eine Liste von Namespace-Namen.
        """
        try:
            # Diese Implementierung hängt vom verwendeten Vektorspeicher ab
            vector_store = self.client.vector_store
            
            if isinstance(vector_store, LanceDBStore):
                db = vector_store.db
                if db is None:
                    vector_store.initialize()
                    db = vector_store.db
                return db.table_names()
            elif isinstance(vector_store, ChromaDBStore):
                client = vector_store.client
                if client is None:
                    vector_store.initialize()
                    client = vector_store.client
                return client.list_collections()
            else:
                logger.warning(f"Unbekannter Vektorspeichertyp: {type(vector_store).__name__}")
                return []
        except Exception as e:
            logger.error(f"Fehler beim Auflisten der Namespaces: {e}")
            return []
    
    def delete_document(self, doc_id: str, namespace: str = "default") -> bool:
        """
        Löscht ein Dokument aus der RAG-Datenbank
        
        Args:
            doc_id: Die ID des zu löschenden Dokuments.
            namespace: Der Namespace des Dokuments. Standard ist "default".
        
        Returns:
            True bei Erfolg, False bei Fehler.
        """
        try:
            self.client.vector_store.delete_document(doc_id, namespace=namespace)
            logger.info(f"Dokument {doc_id} aus Namespace {namespace} gelöscht")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Löschen von Dokument {doc_id}: {e}")
            return False
    
    def delete_namespace(self, namespace: str) -> bool:
        """
        Löscht einen gesamten Namespace aus der RAG-Datenbank
        
        Args:
            namespace: Der zu löschende Namespace.
        
        Returns:
            True bei Erfolg, False bei Fehler.
        """
        try:
            self.client.vector_store.delete_namespace(namespace)
            logger.info(f"Namespace {namespace} gelöscht")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Löschen von Namespace {namespace}: {e}")
            return False
    
    def get_config(self) -> RagConfig:
        """
        Gibt die aktuelle Konfiguration zurück
        
        Returns:
            Das RagConfig-Objekt.
        """
        return self.client.config
    
    def update_config(self, config: RagConfig) -> bool:
        """
        Aktualisiert die Konfiguration
        
        Args:
            config: Das neue RagConfig-Objekt.
        
        Returns:
            True bei Erfolg, False bei Fehler.
        """
        try:
            # Konfiguration speichern
            with open(self.config_path, 'w') as f:
                json.dump(asdict(config), f, indent=2)
            
            # Client neu initialisieren
            self.client = ClaudeRagClient(config_path=self.config_path)
            
            logger.info(f"Konfiguration aktualisiert und in {self.config_path} gespeichert")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren der Konfiguration: {e}")
            return False

# Hilfsfunktion, um ein einfaches Kommandozeilentool bereitzustellen
def main():
    """Kommandozeilenschnittstelle für Claude RAG"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Claude RAG System API")
    subparsers = parser.add_subparsers(dest="command", help="Befehl")
    
    # add - Dokument hinzufügen
    add_parser = subparsers.add_parser("add", help="Dokument hinzufügen")
    add_parser.add_argument("path", help="Pfad zum Dokument oder Verzeichnis")
    add_parser.add_argument("--namespace", "-n", default="default", help="Namespace")
    add_parser.add_argument("--no-chunk", action="store_true", help="Dokument nicht aufteilen")
    add_parser.add_argument("--recursive", "-r", action="store_true", help="Verzeichnisse rekursiv durchsuchen")
    
    # search - Dokumente suchen
    search_parser = subparsers.add_parser("search", help="Dokumente suchen")
    search_parser.add_argument("query", help="Suchabfrage")
    search_parser.add_argument("--namespace", "-n", default="default", help="Namespace")
    search_parser.add_argument("--top-k", "-k", type=int, help="Maximale Anzahl von Ergebnissen")
    
    # ask - Frage stellen
    ask_parser = subparsers.add_parser("ask", help="Frage stellen")
    ask_parser.add_argument("query", help="Frage")
    ask_parser.add_argument("--namespace", "-n", default="default", help="Namespace")
    ask_parser.add_argument("--top-k", "-k", type=int, help="Maximale Anzahl von Ergebnissen")
    ask_parser.add_argument("--max-tokens", "-m", type=int, default=1000, help="Maximale Anzahl von Tokens in der Antwort")
    ask_parser.add_argument("--temperature", "-t", type=float, default=0.7, help="Temperatur für die Antwortgenerierung")
    
    # list - Namespaces auflisten
    list_parser = subparsers.add_parser("list", help="Namespaces auflisten")
    
    # delete - Dokument oder Namespace löschen
    delete_parser = subparsers.add_parser("delete", help="Dokument oder Namespace löschen")
    delete_parser.add_argument("--doc-id", "-d", help="Dokument-ID")
    delete_parser.add_argument("--namespace", "-n", help="Namespace")
    delete_parser.add_argument("--confirm", action="store_true", help="Löschen bestätigen")
    
    # Argumente parsen
    args = parser.parse_args()
    
    # API initialisieren
    api = ClaudeRagAPI()
    
    if args.command == "add":
        path = Path(args.path)
        if path.is_file():
            result = api.add_document(str(path), namespace=args.namespace, chunk=not args.no_chunk)
            print(f"Dokument {path} hinzugefügt: {len(result)} Chunks")
        elif path.is_dir():
            results = api.add_documents_from_directory(
                str(path), 
                namespace=args.namespace, 
                recursive=args.recursive, 
                chunk=not args.no_chunk
            )
            print(f"{len(results)} Dokumente hinzugefügt")
            for file_path, doc_ids in results.items():
                print(f"  {file_path}: {len(doc_ids)} Chunks")
        else:
            print(f"Fehler: Datei oder Verzeichnis nicht gefunden: {path}")
    
    elif args.command == "search":
        results = api.search(args.query, namespace=args.namespace, top_k=args.top_k)
        if not results:
            print("Keine Ergebnisse gefunden.")
        else:
            print(f"{len(results)} Ergebnisse gefunden:")
            for i, result in enumerate(results):
                print(f"{i+1}. {result.document.id} (Score: {result.score:.4f})")
                print(f"   Quelle: {result.document.metadata.get('source', 'Unbekannt')}")
                content_preview = result.document.content[:200].replace('\n', ' ')
                print(f"   {content_preview}...")
                print()
    
    elif args.command == "ask":
        response, results = api.ask(
            args.query, 
            namespace=args.namespace, 
            top_k=args.top_k, 
            max_tokens=args.max_tokens, 
            temperature=args.temperature
        )
        
        print("Antwort:")
        print(response)
        print()
        print(f"Basierend auf {len(results)} Dokumenten:")
        for i, result in enumerate(results):
            print(f"{i+1}. {result.document.id} (Score: {result.score:.4f})")
            print(f"   Quelle: {result.document.metadata.get('source', 'Unbekannt')}")
    
    elif args.command == "list":
        namespaces = api.list_namespaces()
        if not namespaces:
            print("Keine Namespaces gefunden.")
        else:
            print(f"{len(namespaces)} Namespaces gefunden:")
            for namespace in namespaces:
                print(f"  {namespace}")
    
    elif args.command == "delete":
        if args.doc_id and args.namespace:
            if not args.confirm:
                confirm = input(f"Dokument {args.doc_id} aus Namespace {args.namespace} löschen? [j/N] ")
                if confirm.lower() != 'j':
                    print("Löschen abgebrochen.")
                    return
            
            success = api.delete_document(args.doc_id, namespace=args.namespace)
            if success:
                print(f"Dokument {args.doc_id} aus Namespace {args.namespace} gelöscht.")
            else:
                print(f"Fehler beim Löschen von Dokument {args.doc_id}.")
        
        elif args.namespace and not args.doc_id:
            if not args.confirm:
                confirm = input(f"Gesamten Namespace {args.namespace} löschen? [j/N] ")
                if confirm.lower() != 'j':
                    print("Löschen abgebrochen.")
                    return
            
            success = api.delete_namespace(args.namespace)
            if success:
                print(f"Namespace {args.namespace} gelöscht.")
            else:
                print(f"Fehler beim Löschen von Namespace {args.namespace}.")
        
        else:
            print("Fehler: Entweder --doc-id und --namespace oder nur --namespace angeben.")
    
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
