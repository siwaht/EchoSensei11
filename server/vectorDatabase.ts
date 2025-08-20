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
      if (!tableNames.includes('documents')) {
        // Create table with schema
        this.table = await this.connection.createTable('documents', [
          {
            id: 'doc_1',
            content: 'Initial document',
            embedding: new Array(1536).fill(0), // OpenAI embedding dimension
            metadata: {
              source: 'init',
              fileType: 'text',
              timestamp: new Date()
            }
          }
        ]);
        // Clear the initial document
        await this.table.delete('id = "doc_1"');
      } else {
        this.table = await this.connection.openTable('documents');
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

    const document: DocumentChunk = {
      id,
      content,
      embedding,
      metadata: {
        ...metadata,
        timestamp: new Date()
      }
    };

    await this.table.add([document as any]);
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

    const documentChunks: DocumentChunk[] = [];
    const ids: string[] = [];

    for (const doc of documents) {
      const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const embedding = await this.generateEmbedding(doc.content);
      
      documentChunks.push({
        id,
        content: doc.content,
        embedding,
        metadata: {
          ...doc.metadata,
          timestamp: new Date()
        }
      });
      ids.push(id);
    }

    await this.table.add(documentChunks as any);
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

    const queryEmbedding = await this.generateEmbedding(query);
    
    let searchQuery = this.table
      .vectorSearch(queryEmbedding)
      .limit(limit);

    // Filter by agentId if provided
    if (agentId) {
      searchQuery = searchQuery.where(`metadata.agentId = '${agentId}'`);
    }

    const results = await (searchQuery as any).execute();
    
    const resultArray: any[] = [];
    for await (const batch of results) {
      const records = batch.toArray();
      records.forEach((record: any) => {
        resultArray.push({
          content: record.content,
          metadata: record.metadata,
          score: record._distance || 0
        });
      });
    }
    return resultArray;
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