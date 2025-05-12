#!/usr/bin/env python3
"""
Claude Neural Framework RAG System
==================================

A lightweight RAG (Retrieval Augmented Generation) system for Claude Neural Framework
that works with various vector databases and embedding models.
"""

import os
import json
import logging
import hashlib
from typing import Dict, List, Optional, Union, Any, Tuple, Set
from pathlib import Path
from dataclasses import dataclass, field, asdict
from functools import lru_cache
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('claude_rag')

# Optional dependency imports with graceful fallbacks
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("Anthropic package not installed. Install with: pip install anthropic")

try:
    import lancedb
    LANCEDB_AVAILABLE = True
except ImportError:
    LANCEDB_AVAILABLE = False
    logger.info("LanceDB package not installed. Install with: pip install lancedb")

try:
    import chromadb
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    logger.info("ChromaDB package not installed. Install with: pip install chromadb")

try:
    from voyage import Client as VoyageClient
    VOYAGE_AVAILABLE = True
except ImportError:
    VOYAGE_AVAILABLE = False
    logger.info("Voyage AI package not installed. Install with: pip install voyage")

try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    logger.info("Langchain package not installed. Install with: pip install langchain")


@dataclass
class RagConfig:
    """Configuration for the RAG system"""
    database: Dict[str, Any]
    embedding: Dict[str, Any]
    retrieval: Dict[str, Any]
    cache: Dict[str, Any] = field(default_factory=dict)
    chunking: Dict[str, Any] = field(default_factory=lambda: {
        "size": 1000, 
        "overlap": 200,
        "strategy": "semantic"
    })

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
                "strategy": "lru",
                "max_size": 1000
            }
        )
    
    def validate(self) -> Tuple[bool, List[str]]:
        """Validate the configuration"""
        errors = []
        
        # Validate database config
        if "type" not in self.database:
            errors.append("Database type is required")
        elif self.database["type"] not in ["lancedb", "chromadb"]:
            errors.append(f"Unsupported database type: {self.database['type']}")
        
        if "connection" not in self.database:
            errors.append("Database connection configuration is required")
        
        # Validate embedding config
        if "provider" not in self.embedding:
            errors.append("Embedding provider is required")
        elif self.embedding["provider"] not in ["voyage", "huggingface"]:
            errors.append(f"Unsupported embedding provider: {self.embedding['provider']}")
        
        if "model" not in self.embedding:
            errors.append("Embedding model is required")
        
        if "dimensions" not in self.embedding:
            errors.append("Embedding dimensions are required")
        
        # Validate retrieval config
        if "top_k" not in self.retrieval:
            errors.append("Retrieval top_k is required")
        
        if "similarity_threshold" not in self.retrieval:
            errors.append("Retrieval similarity_threshold is required")
        
        return len(errors) == 0, errors


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
            "modified_at": os.path.getmtime(path),
            "size_bytes": os.path.getsize(path)
        })
        
        return cls(id=doc_id, content=content, metadata=meta)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation"""
        result = {
            "id": self.id,
            "content": self.content,
            "metadata": self.metadata
        }
        if self.embedding is not None:
            result["embedding"] = self.embedding
        return result


@dataclass
class QueryResult:
    """A result from a RAG query"""
    document: Document
    score: float
    
    def __repr__(self) -> str:
        return f"QueryResult(score={self.score:.4f}, id={self.document.id})"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation"""
        return {
            "document": self.document.to_dict(),
            "score": self.score
        }


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
        if not text.strip():
            # Return zero vector for empty text
            return [0.0] * self.dimensions
            
        response = self.client.embed(model=self.model, input=[text])
        return response.embeddings[0]
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts using Voyage AI, processing in batches"""
        if not texts:
            return []
            
        # Process in batches to avoid API limits
        all_embeddings = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i+self.batch_size]
            # Handle empty strings
            batch = [text if text.strip() else " " for text in batch]
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
        if not text.strip():
            return [0.0] * self.dimensions
            
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts using Hugging Face"""
        if not texts:
            return []
            
        # Replace empty strings with a space to avoid errors
        texts = [text if text.strip() else " " for text in texts]
        embeddings = self.model.encode(
            texts, 
            batch_size=self.batch_size, 
            normalize_embeddings=True,
            show_progress_bar=len(texts) > 100
        )
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
    
    def add_documents(self, documents: List[Document], namespace: str = 'default') -> List[str]:
        """Add multiple documents to the vector store"""
        doc_ids = []
        for doc in documents:
            doc_id = self.add_document(doc, namespace)
            doc_ids.append(doc_id)
        return doc_ids
    
    def search(self, query_vector: List[float], top_k: int = 5, namespace: str = 'default', 
               threshold: float = 0.7) -> List[QueryResult]:
        """Search for similar documents"""
        raise NotImplementedError
    
    def delete_document(self, doc_id: str, namespace: str = 'default') -> None:
        """Delete a document from the vector store"""
        raise NotImplementedError
    
    def delete_namespace(self, namespace: str) -> None:
        """Delete all documents in a namespace"""
        raise NotImplementedError
    
    def get_namespaces(self) -> List[str]:
        """Get list of all namespaces"""
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
    
    def add_documents(self, documents: List[Document], namespace: str = 'default') -> List[str]:
        """Add multiple documents to LanceDB in a single batch"""
        if not documents:
            return []
            
        # Check that all documents have embeddings
        for doc in documents:
            if doc.embedding is None:
                raise ValueError(f"Document {doc.id} missing embedding")
        
        table = self._get_table(namespace)
        
        # Prepare batch data
        data = [
            {
                "id": doc.id,
                "vector": doc.embedding,
                "content": doc.content,
                "metadata": json.dumps(doc.metadata)
            }
            for doc in documents
        ]
        
        # Add to table in a single operation
        table.add(data)
        
        return [doc.id for doc in documents]
    
    def search(self, query_vector: List[float], top_k: int = 5, namespace: str = 'default', 
               threshold: float = 0.7) -> List[QueryResult]:
        """Search for similar documents in LanceDB"""
        table = self._get_table(namespace)
        
        # Search
        results = table.search(query_vector).limit(top_k).to_pandas()
        
        # Convert to QueryResult objects
        query_results = []
        for _, row in results.iterrows():
            # Convert distance to similarity score (assuming cosine distance)
            # LanceDB returns L2 distance by default
            distance = float(row['_distance'])
            similarity = 1.0 / (1.0 + distance)  # Convert to similarity score
            
            if similarity < threshold:
                continue
            
            try:
                metadata = json.loads(row['metadata'])
            except (json.JSONDecodeError, TypeError):
                metadata = {}
                
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
        # Escape single quotes in doc_id
        escaped_id = doc_id.replace("'", "''")
        table.delete(f"id = '{escaped_id}'")
    
    def delete_namespace(self, namespace: str) -> None:
        """Delete a namespace (table) from LanceDB"""
        if self.db is None:
            self.initialize()
        
        if namespace in self.tables:
            del self.tables[namespace]
        
        # Drop table if it exists
        if namespace in self.db.table_names():
            self.db.drop_table(namespace)
    
    def get_namespaces(self) -> List[str]:
        """Get all namespaces (tables) in LanceDB"""
        if self.db is None:
            self.initialize()
        
        return self.db.table_names()


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
    
    def add_documents(self, documents: List[Document], namespace: str = 'default') -> List[str]:
        """Add multiple documents to ChromaDB in a single batch"""
        if not documents:
            return []
            
        # Check that all documents have embeddings
        for doc in documents:
            if doc.embedding is None:
                raise ValueError(f"Document {doc.id} missing embedding")
        
        collection = self._get_collection(namespace)
        
        # Add to collection in a single operation
        collection.upsert(
            ids=[doc.id for doc in documents],
            embeddings=[doc.embedding for doc in documents],
            documents=[doc.content for doc in documents],
            metadatas=[doc.metadata for doc in documents]
        )
        
        return [doc.id for doc in documents]
    
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
            similarity = 1.0 - distance  # ChromaDB uses cosine distance
            
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
    
    def get_namespaces(self) -> List[str]:
        """Get all namespaces (collections) in ChromaDB"""
        if self.client is None:
            self.initialize()
        
        return [collection.name for collection in self.client.list_collections()]


class QueryCache:
    """Cache for query results to improve response time for repeated queries"""
    def __init__(self, config: Dict[str, Any]):
        self.enabled = config.get('enabled', True)
        self.ttl = config.get('ttl', 3600)  # Time-to-live in seconds
        self.max_size = config.get('max_size', 1000)
        self.strategy = config.get('strategy', 'lru')
        
        self._cache = {}
        self._timestamps = {}
        self._access_count = {}
    
    def get(self, query: str, namespace: str) -> Optional[List[QueryResult]]:
        """Get results from cache if available and not expired"""
        if not self.enabled:
            return None
            
        key = self._make_key(query, namespace)
        
        if key not in self._cache:
            return None
            
        # Check if expired
        timestamp = self._timestamps.get(key, 0)
        if time.time() - timestamp > self.ttl:
            # Expired, remove from cache
            self._remove_key(key)
            return None
            
        # Update access count for LRU/LFU
        self._access_count[key] = self._access_count.get(key, 0) + 1
        return self._cache[key]
    
    def set(self, query: str, namespace: str, results: List[QueryResult]) -> None:
        """Store results in cache"""
        if not self.enabled:
            return
            
        key = self._make_key(query, namespace)
        
        # Check if cache is full
        if len(self._cache) >= self.max_size:
            self._evict_entry()
            
        self._cache[key] = results
        self._timestamps[key] = time.time()
        self._access_count[key] = 1
    
    def _make_key(self, query: str, namespace: str) -> str:
        """Create a cache key from query and namespace"""
        return f"{namespace}:{hashlib.md5(query.encode()).hexdigest()}"
    
    def _remove_key(self, key: str) -> None:
        """Remove an entry from all cache dictionaries"""
        self._cache.pop(key, None)
        self._timestamps.pop(key, None)
        self._access_count.pop(key, None)
    
    def _evict_entry(self) -> None:
        """Evict an entry based on the cache strategy"""
        if not self._cache:
            return
            
        if self.strategy == 'lru':  # Least Recently Used
            # Find oldest key
            oldest_key = min(self._timestamps.items(), key=lambda x: x[1])[0]
            self._remove_key(oldest_key)
        elif self.strategy == 'lfu':  # Least Frequently Used
            # Find least accessed key
            least_used_key = min(self._access_count.items(), key=lambda x: x[1])[0]
            self._remove_key(least_used_key)
        else:  # Random eviction
            import random
            key = random.choice(list(self._cache.keys()))
            self._remove_key(key)
    
    def clear(self) -> None:
        """Clear the entire cache"""
        self._cache.clear()
        self._timestamps.clear()
        self._access_count.clear()


class ClaudeIntegration:
    """Integration with Claude API"""
    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-7-sonnet"):
        if not ANTHROPIC_AVAILABLE:
            raise ImportError("Anthropic package not installed. Install with: pip install anthropic")
            
        self.api_key = api_key or os.environ.get("CLAUDE_API_KEY")
        if not self.api_key:
            raise ValueError("Claude API key not provided and not found in environment variable CLAUDE_API_KEY")
        
        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.model = model
    
    def complete(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7, 
                 system_prompt: Optional[str] = None) -> str:
        """Generate a completion using Claude"""
        messages = [{"role": "user", "content": prompt}]
        
        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=messages
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
        
        # System prompt for RAG
        system_prompt = """
        You are an assistant that answers questions based on the provided context.
        If the context contains relevant information, use it to inform your answer.
        If the context doesn't contain the information needed to answer the question fully,
        say so clearly, and provide the best answer you can with the available information.
        Always maintain a helpful, informative tone, and strive for accuracy.
        """
        
        # Create prompt with context
        prompt = f"""
        Here is the context information:
        
        {context_text}
        
        Question: {query}
        
        Please answer based on the provided context.
        """
        
        return self.complete(prompt, max_tokens, temperature, system_prompt=system_prompt)


class TextSplitter:
    """Split text into chunks for embedding"""
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200, strategy: str = "semantic"):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.strategy = strategy
        
        if not LANGCHAIN_AVAILABLE:
            raise ImportError("Langchain package not installed. Install with: pip install langchain")
        
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", ".", "?", "!", " ", ""],
            keep_separator=True
        )
    
    def split_text(self, text: str) -> List[str]:
        """Split text into chunks"""
        if not text:
            return []
            
        return self.splitter.split_text(text)
    
    def split_document(self, document: Document) -> List[Document]:
        """Split a document into chunks"""
        chunks = self.split_text(document.content)
        
        if not chunks:
            return []
            
        chunked_docs = []
        for i, chunk in enumerate(chunks):
            # Create ID for chunk
            chunk_id = f"{document.id}-chunk-{i}"
            
            # Create metadata for chunk
            metadata = document.metadata.copy()
            metadata.update({
                "parent_id": document.id,
                "chunk_index": i,
                "chunk_count": len(chunks),
                "is_chunk": True,
                "chunk_text_length": len(chunk)
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
        self.database_type = db_type
        
        if db_type == "lancedb":
            self.vector_store = LanceDBStore({
                **self.config.database,
                "dimensions": self.config.embedding.get("dimensions", 1024)
            })
        elif db_type == "chromadb":
            self.vector_store = ChromaDBStore(self.config.database)
        else:
            raise ValueError(f"Unsupported vector store type: {db_type}")
        
        # Initialize vector store
        self.vector_store.initialize()
        
        # Initialize text splitter
        chunk_size = self.config.chunking.get("size", 1000)
        chunk_overlap = self.config.chunking.get("overlap", 200)
        chunking_strategy = self.config.chunking.get("strategy", "semantic")
        self.text_splitter = TextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            strategy=chunking_strategy
        )
        
        # Initialize Claude
        self.claude = ClaudeIntegration(
            model=self.config.get("claude", {}).get("model", "claude-3-7-sonnet")
        )
        
        # Initialize query cache
        self.cache = QueryCache(self.config.cache)
    
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
        if chunk and len(document.content) > self.text_splitter.chunk_size / 2:
            docs_to_embed = self.text_splitter.split_document(document)
        else:
            docs_to_embed = [document]
        
        # Return early if no documents to embed
        if not docs_to_embed:
            return []
            
        # Embed documents in batch
        contents = [doc.content for doc in docs_to_embed]
        embeddings = self.embedder.embed_batch(contents)
        
        # Assign embeddings to documents
        for i, doc in enumerate(docs_to_embed):
            doc.embedding = embeddings[i]
        
        # Add to vector store in batch
        return self.vector_store.add_documents(docs_to_embed, namespace=namespace)
    
    def query(self, query: str, namespace: str = "default", 
              top_k: Optional[int] = None, use_cache: bool = True) -> List[QueryResult]:
        """Query the RAG system"""
        # Use cache if enabled
        if use_cache:
            cached_results = self.cache.get(query, namespace)
            if cached_results:
                logger.debug(f"Using cached results for query: {query[:30]}...")
                return cached_results
        
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
        
        # Cache results if enabled
        if use_cache:
            self.cache.set(query, namespace, results)
        
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
    
    def get_namespaces(self) -> List[str]:
        """Get all namespaces in the vector store"""
        return self.vector_store.get_namespaces()
    
    def clear_cache(self) -> None:
        """Clear the query cache"""
        self.cache.clear()


# Command line interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Claude Neural Framework RAG System")
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
    query_parser.add_argument("--no-cache", action="store_true", help="Disable query cache")
    
    # Ask command
    ask_parser = subparsers.add_parser("ask", help="Ask a question using the RAG system")
    ask_parser.add_argument("query", help="Question to ask")
    ask_parser.add_argument("--namespace", "-n", default="default", help="Namespace for query")
    ask_parser.add_argument("--top-k", "-k", type=int, help="Number of results to return")
    ask_parser.add_argument("--max-tokens", "-m", type=int, default=1000, help="Maximum tokens for response")
    ask_parser.add_argument("--temperature", "-t", type=float, default=0.7, help="Temperature for response")
    ask_parser.add_argument("--config", "-c", help="Path to config file")
    
    # List namespaces command
    list_parser = subparsers.add_parser("list", help="List all namespaces")
    list_parser.add_argument("--config", "-c", help="Path to config file")
    
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
            top_k=args.top_k,
            use_cache=not args.no_cache
        )
        
        if not results:
            print("No results found.")
        else:
            print(f"Found {len(results)} results:")
            for i, result in enumerate(results):
                print(f"{i+1}. {result.document.id} (score: {result.score:.4f})")
                print(f"   Source: {result.document.metadata.get('source', 'Unknown')}")
                content_preview = result.document.content[:200]
                if len(result.document.content) > 200:
                    content_preview += "..."
                print(f"   {content_preview}")
                print()
    
    elif args.command == "ask":
        try:
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
                
        except Exception as e:
            print(f"Error generating answer: {e}")
    
    elif args.command == "list":
        namespaces = client.get_namespaces()
        print("Available namespaces:")
        for ns in namespaces:
            print(f"- {ns}")