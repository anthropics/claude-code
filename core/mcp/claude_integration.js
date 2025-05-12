// Integration von Claude Code mit vibecodingframework
// integration/vibecodingframework/api/claude.js

import { Configuration, AnthropicAPI } from 'anthropic';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { getUserContext } from '@/lib/auth';
import { enterpriseIntegration } from './enterprise_integration';

// Konfigurationen laden
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const DB_TYPE = process.env.DB_TYPE || 'supabase'; // 'supabase' oder 'sqlite'
const ENTERPRISE_ENABLED = process.env.ENTERPRISE_FEATURES_ENABLED === 'true';

// Initialize enterprise features if enabled
if (ENTERPRISE_ENABLED) {
  enterpriseIntegration.initialize()
    .then(initialized => {
      if (initialized) {
        console.log('Enterprise features initialized successfully');
      } else {
        console.warn('Enterprise features could not be initialized');
      }
    })
    .catch(error => {
      console.error('Error initializing enterprise features:', error);
    });
}

// Konfiguriere API-Clients
const anthropic = new AnthropicAPI({
  apiKey: CLAUDE_API_KEY,
});

// Initialisiere Supabase Client
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * RAG-Schnittstelle für Claude
 */
export class ClaudeRagIntegration {
  private dbType: 'supabase' | 'sqlite';
  private embeddingModel: string;
  private embeddingDimensions: number;
  private vectorTable: string;
  private claudeModel: string;
  private namespace: string;

  constructor(options = {}) {
    this.dbType = options.dbType || DB_TYPE;
    this.embeddingModel = options.embeddingModel || 'voyage-2';
    this.embeddingDimensions = options.embeddingDimensions || 1024;
    this.vectorTable = options.vectorTable || 'embeddings';
    this.claudeModel = options.claudeModel || 'claude-3-7-sonnet';
    this.namespace = options.namespace || 'default';
  }

  /**
   * Generiert ein Embedding für einen gegebenen Text
   * @param text Text, für den ein Embedding generiert werden soll
   * @returns Vector Embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!VOYAGE_API_KEY) {
      throw new Error('Voyage API key ist nicht konfiguriert');
    }

    try {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VOYAGE_API_KEY}`
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Voyage API Fehler: ${error.message}`);
      }

      const result = await response.json();
      return result.data[0].embedding;
    } catch (error) {
      console.error('Fehler beim Generieren des Embeddings:', error);
      throw error;
    }
  }

  /**
   * Speichert ein Embedding in der Vektordatenbank
   * @param id Einzigartige ID für das Dokument
   * @param content Textinhalt des Dokuments
   * @param embedding Vektor-Embedding
   * @param metadata Zusätzliche Metadaten zum Dokument
   * @returns Document ID
   */
  async storeEmbedding(
    id: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any> = {}
  ): Promise<string> {
    if (this.dbType === 'supabase') {
      if (!supabase) {
        throw new Error('Supabase Client ist nicht initialisiert');
      }

      try {
        // Überprüfen, ob pgvector-Erweiterung und Tabelle existieren
        const { error: checkError } = await supabase.rpc('ensure_embeddings_table', { 
          table_name: this.vectorTable,
          dimensions: this.embeddingDimensions 
        });

        if (checkError && !checkError.message.includes('already exists')) {
          throw checkError;
        }

        // Embedding in Supabase speichern
        const { error } = await supabase
          .from(this.vectorTable)
          .upsert({
            id,
            content,
            embedding,
            metadata,
            namespace: this.namespace,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        return id;
      } catch (error) {
        console.error('Fehler beim Speichern des Embeddings in Supabase:', error);
        throw error;
      }
    } else if (this.dbType === 'sqlite') {
      // Implementierung für SQLite über API-Endpunkt
      try {
        const response = await fetch('/api/embeddings/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            content,
            embedding,
            metadata,
            namespace: this.namespace
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`SQLite API Fehler: ${error.message}`);
        }

        const result = await response.json();
        return result.id;
      } catch (error) {
        console.error('Fehler beim Speichern des Embeddings in SQLite:', error);
        throw error;
      }
    } else {
      throw new Error(`Nicht unterstützter Datenbanktyp: ${this.dbType}`);
    }
  }

  /**
   * Sucht nach ähnlichen Dokumenten basierend auf einem Abfragetext
   * @param queryText Abfragetext
   * @param topK Anzahl der zurückzugebenden Ergebnisse
   * @returns Ähnliche Dokumente mit Ähnlichkeitswerten
   */
  async search(queryText: string, topK: number = 5): Promise<Array<{
    id: string;
    content: string;
    score: number;
    metadata: Record<string, any>;
  }>> {
    // Embedding für die Abfrage generieren
    const queryEmbedding = await this.generateEmbedding(queryText);

    if (this.dbType === 'supabase') {
      if (!supabase) {
        throw new Error('Supabase Client ist nicht initialisiert');
      }

      try {
        // Ähnlichkeitssuche mit pgvector
        const { data, error } = await supabase.rpc('match_embeddings', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: topK,
          filter_namespace: this.namespace
        });

        if (error) throw error;

        return data.map(item => ({
          id: item.id,
          content: item.content,
          score: item.similarity,
          metadata: item.metadata
        }));
      } catch (error) {
        console.error('Fehler bei der Suche in Supabase:', error);
        throw error;
      }
    } else if (this.dbType === 'sqlite') {
      // Implementierung für SQLite über API-Endpunkt
      try {
        const response = await fetch('/api/embeddings/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embedding: queryEmbedding,
            namespace: this.namespace,
            topK
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`SQLite API Fehler: ${error.message}`);
        }

        return await response.json();
      } catch (error) {
        console.error('Fehler bei der Suche in SQLite:', error);
        throw error;
      }
    } else {
      throw new Error(`Nicht unterstützter Datenbanktyp: ${this.dbType}`);
    }
  }

  /**
   * Generiert eine Antwort von Claude mit RAG-Kontext
   * @param query Anfrage des Benutzers
   * @param topK Anzahl der Kontextdokumente
   * @param userAbout Optional: .about-Profil des Benutzers für Personalisierung
   * @param userContext Optional: Benutzerkontext für Berechtigungen
   * @returns Claude-Antwort
   */
  async answerWithRag(
    query: string,
    topK: number = 5,
    userAbout: Record<string, any> = {},
    userContext: Record<string, any> = {}
  ): Promise<string> {
    try {
      // Log audit event if enterprise features are enabled
      if (ENTERPRISE_ENABLED && enterpriseIntegration.isEnterpriseEnabled()) {
        await enterpriseIntegration.logAuditEvent({
          action: 'rag_query',
          user: userContext?.id || 'anonymous',
          query,
          timestamp: new Date().toISOString()
        });
      }

      // Relevante Dokumente suchen
      const searchResults = await this.search(query, topK);

      if (searchResults.length === 0) {
        // Keine relevanten Dokumente gefunden
        return this.generateClaudeResponse(
          query,
          'Ich konnte in meinen verfügbaren Informationen keine relevanten Dokumente zu deiner Anfrage finden.',
          userAbout,
          userContext
        );
      }

      // Apply enterprise security filters if enabled
      let filteredResults = searchResults;
      if (ENTERPRISE_ENABLED && enterpriseIntegration.isEnterpriseEnabled() && userContext?.id) {
        filteredResults = [];

        for (const doc of searchResults) {
          // Check if user has permission to access this document
          const hasPermission = await enterpriseIntegration.hasPermission(
            { id: userContext.id },
            'read',
            { type: 'document', id: doc.id, metadata: doc.metadata }
          );

          if (hasPermission) {
            filteredResults.push(doc);
          }
        }

        if (filteredResults.length === 0) {
          return this.generateClaudeResponse(
            query,
            'Du hast keine Berechtigung, auf die relevanten Dokumente zuzugreifen.',
            userAbout,
            userContext
          );
        }
      }

      // Kontext für Claude formatieren
      const contextText = filteredResults
        .map(doc => `DOKUMENT: ${doc.id}\nQUELLE: ${doc.metadata?.source || 'Unbekannt'}\nINHALT:\n${doc.content}`)
        .join('\n\n---\n\n');

      // Claude-Prompt mit RAG-Kontext erstellen
      const prompt = `
Du bist ein hilfreicher Assistent, der Fragen auf Basis des bereitgestellten Kontexts beantwortet.

KONTEXT:
${contextText}

${userAbout && Object.keys(userAbout).length > 0 ? `
BENUTZER-PROFIL:
${JSON.stringify(userAbout, null, 2)}
` : ''}

ANFRAGE: ${query}

Beantworte die Anfrage basierend auf dem bereitgestellten Kontext. Falls der Kontext nicht genügend Informationen enthält, gib dies an.
`;

      // Get enterprise compliance frameworks if enabled
      let systemMessage = '';
      if (ENTERPRISE_ENABLED && enterpriseIntegration.isEnterpriseEnabled()) {
        const enterpriseConfig = enterpriseIntegration.getEnterpriseConfig();
        if (enterpriseConfig?.compliance?.frameworks?.length > 0) {
          systemMessage = `Beachte bei deiner Antwort die folgenden Compliance-Frameworks: ${enterpriseConfig.compliance.frameworks.join(', ')}. Stelle sicher, dass deine Antwort alle relevanten Compliance-Anforderungen erfüllt.`;
        }
      }

      // Create Claude request
      let claudeRequest = {
        model: this.claudeModel,
        max_tokens: 1024,
        system: systemMessage,
        messages: [
          { role: 'user', content: prompt }
        ]
      };

      // Apply enterprise security constraints if enabled
      if (ENTERPRISE_ENABLED && enterpriseIntegration.isEnterpriseEnabled()) {
        claudeRequest = enterpriseIntegration.applySecurityConstraints(claudeRequest);
      }

      // Antwort von Claude generieren
      const response = await anthropic.messages.create(claudeRequest);

      // Log completion if enterprise features are enabled
      if (ENTERPRISE_ENABLED && enterpriseIntegration.isEnterpriseEnabled()) {
        await enterpriseIntegration.logAuditEvent({
          action: 'rag_completion',
          user: userContext?.id || 'anonymous',
          query,
          results_count: filteredResults.length,
          model: claudeRequest.model,
          timestamp: new Date().toISOString()
        });
      }

      return response.content[0].text;
    } catch (error) {
      console.error('Fehler beim Generieren der RAG-Antwort:', error);

      // Log error if enterprise features are enabled
      if (ENTERPRISE_ENABLED && enterpriseIntegration.isEnterpriseEnabled()) {
        await enterpriseIntegration.logAuditEvent({
          action: 'rag_error',
          user: userContext?.id || 'anonymous',
          query,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      throw error;
    }
  }

  /**
   * Generiert eine Standard-Antwort von Claude ohne RAG
   * @param query Anfrage des Benutzers
   * @param systemMessage Optionale Systemnachricht
   * @param userAbout Optional: .about-Profil des Benutzers für Personalisierung
   * @returns Claude-Antwort
   */
  async generateClaudeResponse(
    query: string,
    systemMessage: string = '',
    userAbout: Record<string, any> = {}
  ): Promise<string> {
    try {
      // Benutzerkontext in die Anfrage integrieren
      let fullPrompt = query;
      
      if (userAbout && Object.keys(userAbout).length > 0) {
        fullPrompt = `
BENUTZER-PROFIL:
${JSON.stringify(userAbout, null, 2)}

ANFRAGE: ${query}
`;
      }

      // Antwort von Claude generieren
      const response = await anthropic.messages.create({
        model: this.claudeModel,
        max_tokens: 1024,
        system: systemMessage,
        messages: [
          { role: 'user', content: fullPrompt }
        ]
      });

      return response.content[0].text;
    } catch (error) {
      console.error('Fehler beim Generieren der Claude-Antwort:', error);
      throw error;
    }
  }
}

// API-Route-Handler für /api/claude/embed
export async function embedHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Nur POST-Anfragen sind erlaubt' });
  }

  try {
    const { text, metadata = {}, namespace } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text ist erforderlich' });
    }

    // Benutzerkontext prüfen (optional)
    const user = await getUserContext(req);
    if (!user) {
      return res.status(401).json({ message: 'Nicht authentifiziert' });
    }

    // Claude RAG Integration initialisieren
    const claudeRag = new ClaudeRagIntegration({
      namespace: namespace || user.id
    });

    // Embedding generieren
    const embedding = await claudeRag.generateEmbedding(text);

    // Embedding speichern
    const id = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const docId = await claudeRag.storeEmbedding(id, text, embedding, metadata);

    return res.status(200).json({ success: true, id: docId });
  } catch (error) {
    console.error('Fehler beim Embedding:', error);
    return res.status(500).json({ message: error.message });
  }
}

// API-Route-Handler für /api/claude/query
export async function queryHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Nur POST-Anfragen sind erlaubt' });
  }

  try {
    const { query, namespace, topK = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Abfrage ist erforderlich' });
    }

    // Benutzerkontext prüfen (optional)
    const user = await getUserContext(req);
    
    // Claude RAG Integration initialisieren
    const claudeRag = new ClaudeRagIntegration({
      namespace: namespace || (user ? user.id : 'default')
    });

    // Ähnlichkeitssuche durchführen
    const results = await claudeRag.search(query, topK);

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('Fehler bei der Abfrage:', error);
    return res.status(500).json({ message: error.message });
  }
}

// API-Route-Handler für /api/claude/chat
export async function chatHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Nur POST-Anfragen sind erlaubt' });
  }

  try {
    const { query, useRag = true, namespace, topK = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Abfrage ist erforderlich' });
    }

    // Benutzerkontext prüfen und .about-Profil laden
    const user = await getUserContext(req);
    let userAbout = {};
    
    if (user) {
      // .about-Profil aus der Datenbank laden
      if (supabase) {
        const { data } = await supabase
          .from('profiles')
          .select('about')
          .eq('id', user.id)
          .single();
        
        if (data && data.about) {
          userAbout = data.about;
        }
      }
    }

    // Claude RAG Integration initialisieren
    const claudeRag = new ClaudeRagIntegration({
      namespace: namespace || (user ? user.id : 'default')
    });

    let response;
    if (useRag) {
      // RAG-basierte Antwort generieren
      response = await claudeRag.answerWithRag(query, topK, userAbout);
    } else {
      // Standardantwort ohne RAG generieren
      response = await claudeRag.generateClaudeResponse(
        query,
        'Du bist ein hilfreicher Assistent, der Fragen präzise und sachlich beantwortet.',
        userAbout
      );
    }

    return res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('Fehler beim Chat:', error);
    return res.status(500).json({ message: error.message });
  }
}

// React-Hook für die Verwendung von Claude in React-Komponenten
export function useClaudeRag() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Sendet eine Anfrage an Claude mit RAG
   * @param query Anfrage des Benutzers
   * @param options Optionen (useRag, namespace, topK)
   * @returns Claude-Antwort
   */
  const askClaude = async (query, options = {}) => {
    const { useRag = true, namespace, topK = 5 } = options;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/claude/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, useRag, namespace, topK })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      const data = await response.json();
      setLoading(false);
      return data.response;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };
  
  /**
   * Speichert ein Dokument für RAG
   * @param text Textinhalt des Dokuments
   * @param metadata Metadaten zum Dokument
   * @param namespace Namespace für das Dokument
   * @returns Dokument-ID
   */
  const storeDocument = async (text, metadata = {}, namespace) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/claude/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, metadata, namespace })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      const data = await response.json();
      setLoading(false);
      return data.id;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };
  
  /**
   * Führt eine semantische Suche durch
   * @param query Suchtext
   * @param namespace Namespace für die Suche
   * @param topK Anzahl der Ergebnisse
   * @returns Suchergebnisse
   */
  const searchDocuments = async (query, namespace, topK = 5) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/claude/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, namespace, topK })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      const data = await response.json();
      setLoading(false);
      return data.results;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };
  
  return {
    askClaude,
    storeDocument,
    searchDocuments,
    loading,
    error
  };
}

// Next.js API-Routen-Handler exportieren
export default {
  embed: embedHandler,
  query: queryHandler,
  chat: chatHandler
};
