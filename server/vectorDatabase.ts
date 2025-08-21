import { connect, Connection, Table } from '@lancedb/lancedb';
import { OpenAI } from 'openai';
import * as path from 'path';
import * as fs from 'fs';

interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    source: string;
    fileType: string;
    pageNumber?: number;
    agentId?: string;
    timestamp: Date;
  };
}

export class VectorDatabaseService {
  private connection: Connection | null = null;
  private openai: OpenAI | null = null;
  private table: Table | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'data', 'lancedb');
    // Ensure the data directory exists
    if (!fs.existsSync(path.dirname(this.dbPath))) {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    }
  }

  async initialize(apiKey?: string): Promise<void> {
    try {
      // Initialize LanceDB connection
      this.connection = await connect(this.dbPath);
      
      // Initialize OpenAI if API key is provided
      if (apiKey) {
        this.openai = new OpenAI({ apiKey });
      }

      // Create or open the documents table
      const tableNames = await this.connection.tableNames();
      
      if (tableNames.includes('documents')) {
        // Drop existing table to ensure clean schema
        try {
          await this.connection.dropTable('documents');
          console.log('Dropped existing documents table');
        } catch (e) {
          console.log('Could not drop table:', e);
        }
      }
      
      // Create fresh table with proper schema
      const initialDoc = {
        id: 'doc_init',
        content: 'Initial document for schema',
        embedding: new Array(1536).fill(0), // OpenAI embedding dimension
        metadata: {
          source: 'init',
          fileType: 'text',
          pageNumber: 1,
          agentId: 'init',
          timestamp: new Date().toISOString()
        }
      };
      
      this.table = await this.connection.createTable('documents', [initialDoc]);
      console.log('Created new documents table with proper schema');
      
      // Clear the initial document
      try {
        await this.table.delete('id = "doc_init"');
      } catch (e) {
        // Initial doc might not exist
      }
    } catch (error) {
      console.error('Failed to initialize vector database:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      // Return a mock embedding if no OpenAI API key is provided
      console.warn('No OpenAI API key provided, using mock embeddings');
      return new Array(1536).fill(0).map(() => Math.random());
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Fallback to mock embedding
      return new Array(1536).fill(0).map(() => Math.random());
    }
  }

  async addDocument(
    content: string,
    metadata: {
      source: string;
      fileType: string;
      pageNumber?: number;
      agentId?: string;
    }
  ): Promise<string> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const embedding = await this.generateEmbedding(content);

    const document = {
      id: id,
      content: String(content),
      embedding: embedding,
      metadata: {
        source: String(metadata.source || ''),
        fileType: String(metadata.fileType || ''),
        pageNumber: Number(metadata.pageNumber || 1),
        agentId: String(metadata.agentId || ''),
        timestamp: new Date().toISOString()
      }
    };

    await this.table.add([document]);
    return id;
  }

  async addDocuments(
    documents: Array<{
      content: string;
      metadata: {
        source: string;
        fileType: string;
        pageNumber?: number;
        agentId?: string;
      };
    }>
  ): Promise<string[]> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    const documentChunks: any[] = [];
    const ids: string[] = [];

    for (const doc of documents) {
      const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const embedding = await this.generateEmbedding(doc.content);
      
      // Ensure all metadata fields have consistent types
      documentChunks.push({
        id: id,
        content: String(doc.content),
        embedding: embedding,
        metadata: {
          source: String(doc.metadata.source || ''),
          fileType: String(doc.metadata.fileType || ''),
          pageNumber: Number(doc.metadata.pageNumber || 1),
          agentId: String(doc.metadata.agentId || ''),
          timestamp: new Date().toISOString()
        }
      });
      ids.push(id);
    }

    try {
      await this.table.add(documentChunks);
    } catch (error: any) {
      console.error('Error adding documents to table:', error);
      // If there's a schema error, try to recreate the table
      if ((error.message?.includes('Schema') || error.message?.includes('dictionary')) && this.connection) {
        console.log('Schema conflict detected, recreating table...');
        await this.connection.dropTable('documents');
        this.table = await this.connection.createTable('documents', documentChunks.slice(0, 1));
        if (documentChunks.length > 1 && this.table) {
          await this.table.add(documentChunks.slice(1));
        }
      } else {
        throw error;
      }
    }
    
    return ids;
  }

  async searchDocuments(
    query: string,
    limit: number = 5,
    agentId?: string
  ): Promise<Array<{ content: string; metadata: any; score: number }>> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Perform vector search
      const results = await this.table
        .vectorSearch(queryEmbedding)
        .limit(limit)
        .toArray();

      return results.map((record: any) => ({
        content: record.content,
        metadata: record.metadata,
        score: record._distance || 0
      }));
    } catch (error: any) {
      console.error('Error searching documents:', error);
      
      // If there's no documents or table is empty, return empty array
      if (error.message?.includes('No vector column found') || 
          error.message?.includes('empty table')) {
        return [];
      }
      
      // Try without vector search - just return recent documents
      try {
        const allDocs = await this.table.query().limit(limit).toArray();
        return allDocs.map((record: any) => ({
          content: record.content,
          metadata: record.metadata,
          score: 1.0
        }));
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
        return [];
      }
    }
  }

  async deleteDocumentsBySource(source: string): Promise<void> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    await this.table.delete(`metadata.source = '${source}'`);
  }

  async deleteDocumentsByAgent(agentId: string): Promise<void> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    await this.table.delete(`metadata.agentId = '${agentId}'`);
  }

  async getAllDocuments(agentId?: string): Promise<DocumentChunk[]> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    const query = this.table.query();
    if (agentId) {
      query.where(`metadata.agentId = '${agentId}'`);
    }
    
    const results: DocumentChunk[] = [];
    for await (const batch of await (query as any).execute()) {
      const records = batch.toArray();
      results.push(...records);
    }
    return results;
  }

  async getDocumentStats(agentId?: string): Promise<{
    totalDocuments: number;
    fileTypes: Record<string, number>;
    sources: string[];
  }> {
    const documents = await this.getAllDocuments(agentId);
    
    const fileTypes: Record<string, number> = {};
    const sources = new Set<string>();

    documents.forEach(doc => {
      const fileType = doc.metadata.fileType;
      fileTypes[fileType] = (fileTypes[fileType] || 0) + 1;
      sources.add(doc.metadata.source);
    });

    return {
      totalDocuments: documents.length,
      fileTypes,
      sources: Array.from(sources)
    };
  }
}

// Singleton instance
let vectorDbService: VectorDatabaseService | null = null;

export function getVectorDatabaseService(): VectorDatabaseService {
  if (!vectorDbService) {
    vectorDbService = new VectorDatabaseService();
  }
  return vectorDbService;
}