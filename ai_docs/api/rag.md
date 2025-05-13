# RAG API Documentation

The Retrieval Augmented Generation (RAG) API provides functionality for context-aware AI responses by integrating vector databases with LLM models.

## RAG Framework

The RAG Framework provides the core functionality for RAG operations.

```javascript
const RAGFramework = require('../core/rag/rag_framework');
```

### Methods

#### `constructor(options)`

Creates a new instance of the RAG Framework.

```javascript
const rag = new RAGFramework({
  databaseType: 'chroma',
  embeddingModel: 'voyage',
  apiKey: process.env.VOYAGE_API_KEY
});
```

Parameters:
- `options` (Object, optional):
  - `databaseType` (string): Vector database type (default from config)
  - `embeddingModel` (string): Embedding model to use (default from config)
  - `apiKey` (string): API key for the embedding model (default from environment)

#### `async connect()`

Connects to the vector database.

```javascript
await rag.connect();
```

Returns:
- (Promise<boolean>): Success

#### `async disconnect()`

Disconnects from the vector database.

```javascript
await rag.disconnect();
```

Returns:
- (Promise<boolean>): Success

#### `async addDocument(document)`

Adds a document to the vector database.

```javascript
await rag.addDocument({
  id: 'doc1',
  text: 'This is a sample document about AI.',
  metadata: {
    source: 'sample',
    category: 'AI'
  }
});
```

Parameters:
- `document` (Object):
  - `id` (string): Document ID
  - `text` (string): Document text
  - `metadata` (Object, optional): Document metadata

Returns:
- (Promise<Object>): Added document information

#### `async addDocuments(documents)`

Adds multiple documents to the vector database.

```javascript
await rag.addDocuments([
  {
    id: 'doc1',
    text: 'This is a sample document about AI.',
    metadata: { category: 'AI' }
  },
  {
    id: 'doc2',
    text: 'This is a sample document about ML.',
    metadata: { category: 'ML' }
  }
]);
```

Parameters:
- `documents` (Array): Array of document objects

Returns:
- (Promise<Array>): Added documents information

#### `async search(query, options)`

Searches for documents similar to the query.

```javascript
const results = await rag.search('What is AI?', {
  limit: 5,
  filters: { category: 'AI' }
});
```

Parameters:
- `query` (string): Search query
- `options` (Object, optional):
  - `limit` (number): Maximum number of results (default: 10)
  - `filters` (Object): Metadata filters
  - `minScore` (number): Minimum similarity score (0-1)

Returns:
- (Promise<Array>): Search results, each with:
  - `id` (string): Document ID
  - `text` (string): Document text
  - `metadata` (Object): Document metadata
  - `score` (number): Similarity score (0-1)

#### `async generateEmbedding(text)`

Generates an embedding vector for the given text.

```javascript
const embedding = await rag.generateEmbedding('What is AI?');
```

Parameters:
- `text` (string): Text to generate embedding for

Returns:
- (Promise<Array>): Embedding vector

#### `async generateResponse(query, options)`

Generates a response using RAG.

```javascript
const response = await rag.generateResponse('What is AI?', {
  limit: 5,
  filters: { category: 'AI' },
  model: 'claude-3-opus-20240229'
});
```

Parameters:
- `query` (string): User query
- `options` (Object, optional):
  - `limit` (number): Maximum number of results (default: 10)
  - `filters` (Object): Metadata filters
  - `minScore` (number): Minimum similarity score (0-1)
  - `model` (string): Claude model to use
  - `systemPrompt` (string): System prompt override

Returns:
- (Promise<Object>): Generated response with:
  - `text` (string): Response text
  - `sources` (Array): Reference sources used
  - `model` (string): Model used
  - `usage` (Object): Token usage

## Vector Database

The framework supports multiple vector database backends.

### ChromaDB

```javascript
const ChromaDBAdapter = require('../core/rag/adapters/chroma');
```

#### `constructor(options)`

Creates a new ChromaDB adapter.

```javascript
const chroma = new ChromaDBAdapter({
  host: 'localhost',
  port: 8000,
  collection: 'my-collection'
});
```

Parameters:
- `options` (Object):
  - `host` (string): ChromaDB host
  - `port` (number): ChromaDB port
  - `collection` (string): Collection name

### LanceDB

```javascript
const LanceDBAdapter = require('../core/rag/adapters/lance');
```

#### `constructor(options)`

Creates a new LanceDB adapter.

```javascript
const lance = new LanceDBAdapter({
  path: './data/vector_store',
  table: 'my-table'
});
```

Parameters:
- `options` (Object):
  - `path` (string): LanceDB path
  - `table` (string): Table name

## Embedding Models

The framework supports multiple embedding model providers.

### Voyage AI

```javascript
const VoyageEmbedding = require('../core/rag/embeddings/voyage');
```

#### `constructor(options)`

Creates a new Voyage Embedding instance.

```javascript
const voyage = new VoyageEmbedding({
  apiKey: process.env.VOYAGE_API_KEY,
  model: 'voyage-2'
});
```

Parameters:
- `options` (Object):
  - `apiKey` (string): Voyage API key
  - `model` (string): Model name

#### `async generateEmbedding(text)`

Generates an embedding for the given text.

```javascript
const embedding = await voyage.generateEmbedding('What is AI?');
```

Parameters:
- `text` (string): Text to generate embedding for

Returns:
- (Promise<Array>): Embedding vector

## Document Processors

Document processors help prepare documents for the RAG system.

### TextSplitter

```javascript
const { TextSplitter } = require('../core/rag/processors/text_splitter');
```

#### `constructor(options)`

Creates a new text splitter.

```javascript
const splitter = new TextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200
});
```

Parameters:
- `options` (Object):
  - `chunkSize` (number): Maximum chunk size in characters
  - `chunkOverlap` (number): Overlap between chunks
  - `separator` (string): Separator for splitting (default: '\n\n')

#### `splitText(text)`

Splits text into chunks.

```javascript
const chunks = splitter.splitText(longText);
```

Parameters:
- `text` (string): Text to split

Returns:
- (Array<string>): Text chunks

### MetadataExtractor

```javascript
const { MetadataExtractor } = require('../core/rag/processors/metadata_extractor');
```

#### `constructor(options)`

Creates a new metadata extractor.

```javascript
const extractor = new MetadataExtractor({
  extractTitle: true,
  extractSummary: true
});
```

Parameters:
- `options` (Object):
  - `extractTitle` (boolean): Whether to extract title
  - `extractSummary` (boolean): Whether to extract summary
  - `extractEntities` (boolean): Whether to extract entities

#### `extractMetadata(text)`

Extracts metadata from text.

```javascript
const metadata = extractor.extractMetadata(text);
```

Parameters:
- `text` (string): Text to extract metadata from

Returns:
- (Object): Extracted metadata with:
  - `title` (string): Document title
  - `summary` (string): Document summary
  - `entities` (Array): Extracted entities

## RAG Utilities

Utilities for working with the RAG system.

### DocumentLoader

```javascript
const { DocumentLoader } = require('../core/rag/utils/document_loader');
```

#### `async loadFromFile(filePath, options)`

Loads a document from a file.

```javascript
const document = await DocumentLoader.loadFromFile('./document.pdf');
```

Parameters:
- `filePath` (string): Path to the file
- `options` (Object, optional):
  - `encoding` (string): File encoding (default: 'utf8')
  - `mimeType` (string): Override MIME type

Returns:
- (Promise<Object>): Loaded document

#### `async loadFromDirectory(dirPath, options)`

Loads documents from a directory.

```javascript
const documents = await DocumentLoader.loadFromDirectory('./documents', {
  recursive: true,
  extensions: ['.pdf', '.txt']
});
```

Parameters:
- `dirPath` (string): Path to the directory
- `options` (Object, optional):
  - `recursive` (boolean): Whether to search recursively
  - `extensions` (Array): File extensions to include

Returns:
- (Promise<Array>): Loaded documents

### QueryConstructor

```javascript
const { QueryConstructor } = require('../core/rag/utils/query_constructor');
```

#### `constructQuery(userQuery, context)`

Constructs an enhanced query for better retrieval.

```javascript
const enhancedQuery = QueryConstructor.constructQuery(
  'Tell me about Claude',
  { recentTopics: ['AI', 'LLMs'] }
);
```

Parameters:
- `userQuery` (string): Original user query
- `context` (Object): Additional context

Returns:
- (string): Enhanced query