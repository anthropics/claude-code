#!/usr/bin/env python3
"""
Claude Code Leichtgewichtiges RAG-System
=======================================

Dieses Modul implementiert ein leichtgewichtiges RAG-System für Claude Code,
das mit verschiedenen Vektordatenbanken und Embedding-Modellen arbeiten kann.
"""

import os
import json
import logging
import hashlib
from typing import Dict, List, Optional, Union, Any, Tuple
from pathlib import Path
from dataclasses import dataclass, field, asdict

# Dependency Imports
import anthropic
try:
    import lancedb
    LANCEDB_AVAILABLE = True
except ImportError:
    LANCEDB_AVAILABLE = False

try:
    import chromadb
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False

try:
    from voyage import Client as VoyageClient
    VOYAGE_AVAILABLE = True
except ImportError:
    VOYAGE_AVAILABLE = False

# Langchain for text splitting
try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('claude_rag')

@dataclass
class RagConfig:
    """Configuration for the RAG system"""
    database: Dict[str, Any]
    embedding: Dict[str, Any]
    retrieval: Dict[str, Any]
    cache: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_file(cls, path: Union[str, Path]) -> 'RagConfig':
        """Load config from a JSON file"""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Config file not found: {path}")
        
        with open(path, 'r') as f:
            config_data = json.load(f)
        
        return cls(**config_data)
    
    @classmethod
    def default(cls) -> 'RagConfig':
        """Create a default configuration"""
        return cls(
            database={
                "type": "lancedb",
                "connection": {"path": "data/lancedb"}
            },
            embedding={
                "provider": "voyage",
                "model": "voyage-2",
                "dimensions": 1024,
                "api_key_env": "VOYAGE_API_KEY"
            },
            retrieval={
                "top_k": 5,
                "similarity_threshold": 0.7,
                "reranking": False
            },
            cache={
                "enabled": True,
                "ttl": 3600,
                "strategy": "lru"
            }
        )

@dataclass
class Document:
    """A document with content and metadata"""
    id: str
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None
    
    @classmethod
    def from_file(cls, file_path: Union[str, Path], metadata: Optional[Dict[str, Any]] = None) -> 'Document':
        """Create a document from a file"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Generate ID from file path and content hash
        content_hash = hashlib.md5(content.encode()).hexdigest()
        doc_id = f"{path.stem}-{content_hash[:8]}"
        
        # Create metadata
        meta = metadata or {}
        meta.update({
            "source": str(path),
            "filename": path.name,
            "extension": path.suffix.lstrip('.'),
            "created_at": os.path.getctime(path),
            "modified_at": os.path.getmtime(path)
        })
        
        return cls(id=doc_id, content=content, metadata=meta)

@dataclass
class QueryResult:
    """A result from a RAG query"""
    document: Document
    score: float
    
    def __repr__(self) -> str:
        return f"QueryResult(score={self.score:.4f}, id={self.document.id})"

class EmbeddingProvider:
    """Base class for embedding providers"""
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.dimensions = config.get('dimensions', 1024)
    
    def embed_text(self, text: str) -> List[float]:
        """Embed a single text"""
        raise NotImplementedError
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts"""
        raise NotImplementedError

class VoyageEmbeddingProvider(EmbeddingProvider):
    """Embedding provider using Voyage AI"""
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        if not VOYAGE_AVAILABLE:
            raise ImportError("Voyage AI Python package not installed. Install with: pip install voyage")
        
        api_key_env = config.get('api_key_env', 'VOYAGE_API_KEY')
        api_key = os.environ.get(api_key_env)
        if not api_key:
            raise ValueError(f"Voyage API key not found in environment variable: {api_key_env}")
        
        self.model = config.get('model', 'voyage-2')
        self.client = VoyageClient(api_key=api_key)
        self.batch_size = config.get('batch_size', 32)
    
    def embed_text(self, text: str) -> List[float]:
        """Embed a single text using Voyage AI"""
        response = self.client.embed(model=self.model, input=[text])
        return response.embeddings[0]
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts using Voyage AI"""
        # Process in batches to avoid API limits
        all_embeddings = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i+self.batch_size]
            response = self.client.embed(model=self.model, input=batch)
            all_embeddings.extend(response.embeddings)
        return all_embeddings

class HuggingFaceEmbeddingProvider(EmbeddingProvider):
    """Embedding provider using Hugging Face models"""
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise ImportError("Sentence Transformers package not installed. Install with: pip install sentence-transformers")
        
        self.model_name = config.get('model', 'sentence-transformers/all-mpnet-base-v2')
        self.device = config.get('device', 'cpu')
        self.model = SentenceTransformer(self.model_name, device=self.device)
        self.batch_size = config.get('batch_size', 16)
    
    def embed_text(self, text: str) -> List[float]:
        """Embed a single text using Hugging Face"""
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts using Hugging Face"""
        embeddings = self.model.encode(texts, batch_size=self.batch_size, normalize_embeddings=True)
        return embeddings.tolist()

class VectorStore:
    """Base class for vector stores"""
    def __init__(self, config: Dict[str, Any]):
        self.config = config
    
    def initialize(self):
        """Initialize the vector store"""
        raise NotImplementedError
    
    def add_document(self, document: Document, namespace: str = 'default') -> str:
        """Add a document to the vector store"""
        raise NotImplementedError
    
    def search(self, query_vector: List[float], top_k: int = 5, namespace: str = 'default', 
               threshold: float = 0.7) -> List[QueryResult]:
        """Search for similar documents"""
        raise NotImplementedError
    
    def delete_document(self, doc_id: str) -> None:
        """Delete a document from the vector store"""
        raise NotImplementedError
    
    def delete_namespace(self, namespace: str) -> None:
        """Delete all documents in a namespace"""
        raise NotImplementedError

class LanceDBStore(VectorStore):
    """Vector store using LanceDB"""
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        if not LANCEDB_AVAILABLE:
            raise ImportError("LanceDB package not installed. Install with: pip install lancedb")
        
        self.path = config.get('connection', {}).get('path', 'data/lancedb')
        self.dimensions = config.get('dimensions', 1024)
        self.db = None
        self.tables = {}
    
    def initialize(self):
        """Initialize the LanceDB database"""
        # Create directory if it doesn't exist
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        
        self.db = lancedb.connect(self.path)
        logger.info(f"Connected to LanceDB at {self.path}")
    
    def _get_table(self, namespace: str):
        """Get or create a table for the namespace"""
        if namespace in self.tables:
            return self.tables[namespace]
        
        if self.db is None:
            self.initialize()
        
        # Check if table exists
        existing_tables = self.db.table_names()
        if namespace in existing_tables:
            table = self.db.open_table(namespace)
        else:
            # Create schema
            schema = {
                "id": "string",
                "vector": f"float32({self.dimensions})",
                "content": "string",
                "metadata": "json"
            }
            
            # Create empty table
            table = self.db.create_table(
                namespace,
                schema=schema,
                mode="overwrite"
            )
        
        self.tables[namespace] = table
        return table
    
    def add_document(self, document: Document, namespace: str = 'default') -> str:
        """Add a document to LanceDB"""
        if document.embedding is None:
            raise ValueError("Document must have an embedding")
        
        table = self._get_table(namespace)
        
        # Prepare data
        data = {
            "id": document.id,
            "vector": document.embedding,
            "content": document.content,
            "metadata": json.dumps(document.metadata)
        }
        
        # Add to table
        table.add([data])
        
        return document.id
    
    def search(self, query_vector: List[float], top_k: int = 5, namespace: str = 'default', 
               threshold: float = 0.7) -> List[QueryResult]:
        """Search for similar documents in LanceDB"""
        table = self._get_table(namespace)
        
        # Search
        results = table.search(query_vector).limit(top_k).to_pandas()
        
        # Convert to QueryResult objects
        query_results = []
        for _, row in results.iterrows():
            score = float(row['_distance'])
            # Convert distance to similarity score (assuming cosine distance)
            similarity = 1.0 - score
            
            if similarity < threshold:
                continue
            
            metadata = json.loads(row['metadata'])
            doc = Document(
                id=row['id'],
                content=row['content'],
                metadata=metadata
            )
            query_results.append(QueryResult(document=doc, score=similarity))
        
        return query_results
    
    def delete_document(self, doc_id: str, namespace: str = 'default') -> None:
        """Delete a document from LanceDB"""
        table = self._get_table(namespace)
        table.delete(f"id = '{doc_id}'")
    
    def delete_namespace(self, namespace: str) -> None:
        """Delete a namespace (table) from LanceDB"""
        if self.db is None:
            self.initialize()
        
        if namespace in self.tables:
            del self.tables[namespace]
        
        # Drop table if it exists
        if namespace in self.db.table_names():
            self.db.drop_table(namespace)

class ChromaDBStore(VectorStore):
    """Vector store using ChromaDB"""
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        if not CHROMADB_AVAILABLE:
            raise ImportError("ChromaDB package not installed. Install with: pip install chromadb")
        
        self.path = config.get('connection', {}).get('path', 'data/chromadb')
        self.client = None
        self.collections = {}
    
    def initialize(self):
        """Initialize the ChromaDB client"""
        # Create directory if it doesn't exist
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        
        self.client = chromadb.PersistentClient(path=self.path)
        logger.info(f"Connected to ChromaDB at {self.path}")
    
    def _get_collection(self, namespace: str):
        """Get or create a collection for the namespace"""
        if namespace in self.collections:
            return self.collections[namespace]
        
        if self.client is None:
            self.initialize()
        
        # Get or create collection
        collection = self.client.get_or_create_collection(namespace)
        self.collections[namespace] = collection
        
        return collection
    
    def add_document(self, document: Document, namespace: str = 'default') -> str:
        """Add a document to ChromaDB"""
        if document.embedding is None:
            raise ValueError("Document must have an embedding")
        
        collection = self._get_collection(namespace)
        
        # Add to collection
        collection.upsert(
            ids=[document.id],
            embeddings=[document.embedding],
            documents=[document.content],
            metadatas=[document.metadata]
        )
        
        return document.id
    
    def search(self, query_vector: List[float], top_k: int = 5, namespace: str = 'default', 
               threshold: float = 0.7) -> List[QueryResult]:
        """Search for similar documents in ChromaDB"""
        collection = self._get_collection(namespace)
        
        # Search
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        
        # Convert to QueryResult objects
        query_results = []
        for i, doc_id in enumerate(results['ids'][0]):
            # ChromaDB returns distance, convert to similarity
            distance = results['distances'][0][i]
            similarity = 1.0 - distance
            
            if similarity < threshold:
                continue
            
            doc = Document(
                id=doc_id,
                content=results['documents'][0][i],
                metadata=results['metadatas'][0][i]
            )
            query_results.append(QueryResult(document=doc, score=similarity))
        
        return query_results
    
    def delete_document(self, doc_id: str, namespace: str = 'default') -> None:
        """Delete a document from ChromaDB"""
        collection = self._get_collection(namespace)
        collection.delete(ids=[doc_id])
    
    def delete_namespace(self, namespace: str) -> None:
        """Delete a namespace (collection) from ChromaDB"""
        if self.client is None:
            self.initialize()
        
        if namespace in self.collections:
            del self.collections[namespace]
        
        # Delete collection
        self.client.delete_collection(namespace)

class ClaudeIntegration:
    """Integration with Claude API"""
    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-7-sonnet"):
        self.api_key = api_key or os.environ.get("CLAUDE_API_KEY")
        if not self.api_key:
            raise ValueError("Claude API key not provided and not found in environment variable CLAUDE_API_KEY")
        
        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.model = model
    
    def complete(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
        """Generate a completion using Claude"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        return response.content[0].text
    
    def complete_with_rag(self, query: str, contexts: List[Document], 
                          max_tokens: int = 1000, temperature: float = 0.7) -> str:
        """Generate a completion using Claude with RAG contexts"""
        # Format context for Claude
        context_text = "\n\n".join([
            f"Document: {doc.id}\nSource: {doc.metadata.get('source', 'Unknown')}\n\n{doc.content}"
            for doc in contexts
        ])
        
        # Create prompt with context
        prompt = f"""
You are an assistant that answers questions based on the provided context.

Context:
{context_text}

Question: {query}

Please answer the question based on the provided context. If the context doesn't contain relevant information, say so.
"""
        
        return self.complete(prompt, max_tokens, temperature)

class TextSplitter:
    """Split text into chunks for embedding"""
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200, strategy: str = "semantic"):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.strategy = strategy
        
        if not LANGCHAIN_AVAILABLE:
            raise ImportError("Langchain package not installed. Install with: pip install langchain")
    
    def split_text(self, text: str) -> List[str]:
        """Split text into chunks"""
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", ".", "?", "!", " ", ""],
            keep_separator=True
        )
        
        return splitter.split_text(text)
    
    def split_document(self, document: Document) -> List[Document]:
        """Split a document into chunks"""
        chunks = self.split_text(document.content)
        
        chunked_docs = []
        for i, chunk in enumerate(chunks):
            # Create ID for chunk
            chunk_id = f"{document.id}-chunk-{i}"
            
            # Create metadata for chunk
            metadata = document.metadata.copy()
            metadata.update({
                "parent_id": document.id,
                "chunk_index": i,
                "chunk_count": len(chunks)
            })
            
            # Create document for chunk
            doc = Document(id=chunk_id, content=chunk, metadata=metadata)
            chunked_docs.append(doc)
        
        return chunked_docs

class ClaudeRagClient:
    """Main client for Claude RAG system"""
    def __init__(self, config_path: Optional[str] = None):
        # Load configuration
        if config_path:
            self.config = RagConfig.from_file(config_path)
        else:
            # Look for config in default locations
            default_paths = [
                ".claude/config/rag.json",
                "~/.claude/config/rag.json"
            ]
            
            for path in default_paths:
                expanded_path = os.path.expanduser(path)
                if os.path.exists(expanded_path):
                    self.config = RagConfig.from_file(expanded_path)
                    break
            else:
                # Use default config
                self.config = RagConfig.default()
        
        # Initialize components
        self._init_components()
    
    def _init_components(self):
        """Initialize RAG components"""
        # Initialize embedding provider
        provider = self.config.embedding.get("provider", "voyage")
        if provider == "voyage":
            self.embedder = VoyageEmbeddingProvider(self.config.embedding)
        elif provider == "huggingface":
            self.embedder = HuggingFaceEmbeddingProvider(self.config.embedding)
        else:
            raise ValueError(f"Unsupported embedding provider: {provider}")
        
        # Initialize vector store
        db_type = self.config.database.get("type", "lancedb")
        if db_type == "lancedb":
            self.vector_store = LanceDBStore(self.config.database)
        elif db_type == "chromadb":
            self.vector_store = ChromaDBStore(self.config.database)
        else:
            raise ValueError(f"Unsupported vector store type: {db_type}")
        
        # Initialize vector store
        self.vector_store.initialize()
        
        # Initialize text splitter
        chunk_size = self.config.get("chunking", {}).get("size", 1000)
        chunk_overlap = self.config.get("chunking", {}).get("overlap", 200)
        chunking_strategy = self.config.get("chunking", {}).get("strategy", "semantic")
        self.text_splitter = TextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            strategy=chunking_strategy
        )
        
        # Initialize Claude
        self.claude = ClaudeIntegration(
            model=self.config.get("claude", {}).get("model", "claude-3-7-sonnet")
        )
    
    def embed_document(self, document: Union[Document, str, Path], 
                      namespace: str = "default", chunk: bool = True) -> List[str]:
        """Embed a document and add it to the vector store"""
        # Convert to Document if needed
        if isinstance(document, (str, Path)) and os.path.exists(document):
            document = Document.from_file(document)
        elif isinstance(document, str):
            # Create document from text
            doc_id = hashlib.md5(document.encode()).hexdigest()[:16]
            document = Document(id=doc_id, content=document)
        
        # Split document if needed
        docs_to_embed = []
        if chunk:
            docs_to_embed = self.text_splitter.split_document(document)
        else:
            docs_to_embed = [document]
        
        # Embed documents
        doc_ids = []
        for doc in docs_to_embed:
            # Generate embedding
            doc.embedding = self.embedder.embed_text(doc.content)
            
            # Add to vector store
            doc_id = self.vector_store.add_document(doc, namespace=namespace)
            doc_ids.append(doc_id)
        
        return doc_ids
    
    def query(self, query: str, namespace: str = "default", top_k: Optional[int] = None) -> List[QueryResult]:
        """Query the RAG system"""
        # Use config values if not specified
        if top_k is None:
            top_k = self.config.retrieval.get("top_k", 5)
        
        threshold = self.config.retrieval.get("similarity_threshold", 0.7)
        
        # Generate embedding for query
        query_embedding = self.embedder.embed_text(query)
        
        # Search vector store
        results = self.vector_store.search(
            query_vector=query_embedding,
            top_k=top_k,
            namespace=namespace,
            threshold=threshold
        )
        
        return results
    
    def ask(self, query: str, namespace: str = "default", top_k: Optional[int] = None,
            max_tokens: int = 1000, temperature: float = 0.7) -> Tuple[str, List[QueryResult]]:
        """Ask a question using the RAG system"""
        # Query for relevant documents
        results = self.query(query, namespace=namespace, top_k=top_k)
        
        if not results:
            # No relevant documents found
            return "I couldn't find any relevant information to answer your question.", []
        
        # Get documents
        documents = [result.document for result in results]
        
        # Generate response
        response = self.claude.complete_with_rag(
            query=query,
            contexts=documents,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        return response, results

# Command line interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Claude Code RAG System")
    subparsers = parser.add_subparsers(dest="command", help="Command")
    
    # Embed command
    embed_parser = subparsers.add_parser("embed", help="Embed a document")
    embed_parser.add_argument("path", help="Path to document or directory")
    embed_parser.add_argument("--namespace", "-n", default="default", help="Namespace for embeddings")
    embed_parser.add_argument("--config", "-c", help="Path to config file")
    embed_parser.add_argument("--no-chunk", action="store_true", help="Don't split document into chunks")
    
    # Query command
    query_parser = subparsers.add_parser("query", help="Query the RAG system")
    query_parser.add_argument("query", help="Query text")
    query_parser.add_argument("--namespace", "-n", default="default", help="Namespace for query")
    query_parser.add_argument("--top-k", "-k", type=int, help="Number of results to return")
    query_parser.add_argument("--config", "-c", help="Path to config file")
    
    # Ask command
    ask_parser = subparsers.add_parser("ask", help="Ask a question using the RAG system")
    ask_parser.add_argument("query", help="Question to ask")
    ask_parser.add_argument("--namespace", "-n", default="default", help="Namespace for query")
    ask_parser.add_argument("--top-k", "-k", type=int, help="Number of results to return")
    ask_parser.add_argument("--max-tokens", "-m", type=int, default=1000, help="Maximum tokens for response")
    ask_parser.add_argument("--temperature", "-t", type=float, default=0.7, help="Temperature for response")
    ask_parser.add_argument("--config", "-c", help="Path to config file")
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        exit(1)
    
    # Initialize client
    client = ClaudeRagClient(config_path=args.config if hasattr(args, "config") else None)
    
    if args.command == "embed":
        path = Path(args.path)
        if path.is_dir():
            # Embed all files in directory
            for file_path in path.glob("**/*"):
                if file_path.is_file():
                    try:
                        doc_ids = client.embed_document(
                            file_path,
                            namespace=args.namespace,
                            chunk=not args.no_chunk
                        )
                        print(f"Embedded {file_path}: {len(doc_ids)} chunks")
                    except Exception as e:
                        print(f"Error embedding {file_path}: {e}")
        else:
            # Embed single file
            try:
                doc_ids = client.embed_document(
                    path,
                    namespace=args.namespace,
                    chunk=not args.no_chunk
                )
                print(f"Embedded {path}: {len(doc_ids)} chunks")
            except Exception as e:
                print(f"Error embedding {path}: {e}")
    
    elif args.command == "query":
        results = client.query(
            args.query,
            namespace=args.namespace,
            top_k=args.top_k
        )
        
        if not results:
            print("No results found.")
        else:
            print(f"Found {len(results)} results:")
            for i, result in enumerate(results):
                print(f"{i+1}. {result.document.id} (score: {result.score:.4f})")
                print(f"   Source: {result.document.metadata.get('source', 'Unknown')}")
                print(f"   {result.document.content[:200]}...")
                print()
    
    elif args.command == "ask":
        response, results = client.ask(
            args.query,
            namespace=args.namespace,
            top_k=args.top_k,
            max_tokens=args.max_tokens,
            temperature=args.temperature
        )
        
        print("Answer:")
        print(response)
        print()
        print(f"Based on {len(results)} documents:")
        for i, result in enumerate(results):
            print(f"{i+1}. {result.document.id} (score: {result.score:.4f})")
            print(f"   Source: {result.document.metadata.get('source', 'Unknown')}")
