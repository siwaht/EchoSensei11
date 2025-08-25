import * as lancedb from "@lancedb/lancedb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs/promises";
import * as path from "path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

interface KnowledgeDocument {
  id: string;
  name: string;
  content: string;
  agentIds: string[];
  createdAt: Date;
  organizationId: string;
}

interface VectorDocument {
  id: string;
  documentId: string;
  content: string;
  vector: number[];
  metadata: {
    name: string;
    agentIds: string[];
    organizationId: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

class VectorDatabase {
  private db: lancedb.Connection | null = null;
  private embeddings: OpenAIEmbeddings;
  private dbPath = "./vector_db";
  private documentsTableName = "knowledge_documents";

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("OpenAI API key not found. Vector database features will be limited.");
    }
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      modelName: "text-embedding-3-small",
    });
  }

  async initialize() {
    try {
      // Ensure the database directory exists
      await fs.mkdir(this.dbPath, { recursive: true });
      
      // Connect to or create the database
      this.db = await lancedb.connect(this.dbPath);
      
      // Check if table exists
      const tables = await this.db.tableNames();
      if (!tables.includes(this.documentsTableName)) {
        console.log("Knowledge base table does not exist yet. It will be created on first document upload.");
      } else {
        console.log("Vector database initialized with existing table");
      }
      
    } catch (error) {
      console.error("Error initializing vector database:", error);
      // Don't throw error, just log it
      // The table will be created when first document is added
    }
  }

  async addDocument(
    documentId: string,
    name: string,
    content: string,
    agentIds: string[],
    organizationId: string
  ): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      // Split content into chunks with proper sizing
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""],
      });
      
      const chunks = await splitter.splitText(content);
      const totalChunks = chunks.length;
      
      console.log(`Splitting document "${name}" into ${totalChunks} chunks`);
      
      // Check if table exists, create if needed
      const tables = await this.db!.tableNames();
      let table;
      let documentsToAdd: any[] = [];
      
      if (!tables.includes(this.documentsTableName)) {
        // Create table with first chunk
        console.log("Creating new knowledge_documents table...");
        const firstChunk = chunks[0];
        const firstEmbedding = await this.embeddings.embedQuery(firstChunk);
        
        table = await this.db!.createTable(this.documentsTableName, [
          {
            id: `${documentId}_chunk_0`,
            documentId,
            content: firstChunk,
            vector: firstEmbedding,
            metadata: JSON.stringify({
              name,
              agentIds,
              organizationId,
              chunkIndex: 0,
              totalChunks,
            }),
          },
        ]);
        
        // Process remaining chunks (starting from index 1)
        for (let i = 1; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = await this.embeddings.embedQuery(chunk);
          
          documentsToAdd.push({
            id: `${documentId}_chunk_${i}`,
            documentId,
            content: chunk,
            vector: embedding,
            metadata: JSON.stringify({
              name,
              agentIds,
              organizationId,
              chunkIndex: i,
              totalChunks,
            }),
          });
        }
      } else {
        // Table exists, add all chunks
        table = await this.db!.openTable(this.documentsTableName);
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = await this.embeddings.embedQuery(chunk);
          
          documentsToAdd.push({
            id: `${documentId}_chunk_${i}`,
            documentId,
            content: chunk,
            vector: embedding,
            metadata: JSON.stringify({
              name,
              agentIds,
              organizationId,
              chunkIndex: i,
              totalChunks,
            }),
          });
        }
      }
      
      // Add documents to the table if any
      if (documentsToAdd.length > 0) {
        await table.add(documentsToAdd as any);
        console.log(`Added ${documentsToAdd.length} chunks to existing table`);
      }
      
      console.log(`Successfully indexed document "${name}" with ${totalChunks} chunks`);
    } catch (error) {
      console.error("Error adding document to vector database:", error);
      throw error;
    }
  }

  async searchDocuments(
    query: string,
    agentId: string,
    organizationId: string,
    limit: number = 5
  ): Promise<any[]> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      // Check if table exists first
      const tables = await this.db!.tableNames();
      if (!tables.includes(this.documentsTableName)) {
        return [];
      }
      
      const table = await this.db!.openTable(this.documentsTableName);
      
      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.embedQuery(query);
      
      // Perform vector search
      const searchResults = await table
        .search(queryEmbedding)
        .limit(limit * 3) // Get more results to filter
        .toArray();
      
      // Filter and parse results
      const filteredResults = searchResults
        .filter((result: any) => {
          try {
            const metadata = typeof result.metadata === 'string' 
              ? JSON.parse(result.metadata) 
              : result.metadata;
            return (
              metadata.organizationId === organizationId &&
              metadata.agentIds.includes(agentId)
            );
          } catch {
            return false;
          }
        })
        .slice(0, limit);
      
      return filteredResults.map((result: any) => {
        const metadata = typeof result.metadata === 'string' 
          ? JSON.parse(result.metadata) 
          : result.metadata;
        return {
          content: result.content,
          documentName: metadata.name,
          score: result._distance || 0,
          chunkIndex: metadata.chunkIndex,
          totalChunks: metadata.totalChunks,
        };
      });
    } catch (error) {
      console.error("Error searching documents:", error);
      return [];
    }
  }

  async getDocuments(organizationId: string): Promise<any[]> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      // Check if table exists first
      const tables = await this.db!.tableNames();
      if (!tables.includes(this.documentsTableName)) {
        // Table doesn't exist yet, return empty array
        return [];
      }
      
      const table = await this.db!.openTable(this.documentsTableName);
      
      // Get all documents for the organization - scan full table
      const results = await table.query().toArray();
      
      // Group by documentId to get unique documents
      const documentsMap = new Map();
      
      for (const result of results) {
        try {
          const metadata = typeof result.metadata === 'string' 
            ? JSON.parse(result.metadata) 
            : result.metadata;
          
          if (metadata.organizationId === organizationId) {
            const docId = result.documentId;
            if (!documentsMap.has(docId)) {
              documentsMap.set(docId, {
                id: docId,
                name: metadata.name,
                agentIds: metadata.agentIds || [],
                chunks: metadata.totalChunks || 1,
                createdAt: new Date().toISOString(),
              });
            }
          }
        } catch (error) {
          console.error('Error parsing document metadata:', error);
        }
      }
      
      return Array.from(documentsMap.values());
    } catch (error) {
      console.error("Error getting documents:", error);
      return [];
    }
  }

  async deleteDocument(documentId: string, organizationId: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      // Check if table exists first
      const tables = await this.db!.tableNames();
      if (!tables.includes(this.documentsTableName)) {
        return; // Nothing to delete if table doesn't exist
      }
      
      const table = await this.db!.openTable(this.documentsTableName);
      
      // Delete all chunks for this document - need to find and delete manually
      const allDocs = await table.query().toArray();
      const toDelete = allDocs.filter((doc: any) => {
        try {
          const metadata = typeof doc.metadata === 'string' 
            ? JSON.parse(doc.metadata) 
            : doc.metadata;
          return doc.documentId === documentId && metadata.organizationId === organizationId;
        } catch {
          return false;
        }
      });
      
      // Delete each matching document
      for (const doc of toDelete) {
        await table.delete(`id = '${doc.id}'`);
      }
      
      console.log(`Deleted document ${documentId} from vector database`);
    } catch (error) {
      console.error("Error deleting document:", error);
      throw error;
    }
  }

  async getDocumentContent(documentId: string, organizationId: string): Promise<string> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      // Check if table exists first
      const tables = await this.db!.tableNames();
      if (!tables.includes(this.documentsTableName)) {
        return "";
      }
      
      const table = await this.db!.openTable(this.documentsTableName);
      
      // Get all chunks for this document
      const allDocs = await table.query().toArray();
      const chunks = allDocs.filter((doc: any) => {
        try {
          const metadata = typeof doc.metadata === 'string' 
            ? JSON.parse(doc.metadata) 
            : doc.metadata;
          return doc.documentId === documentId && metadata.organizationId === organizationId;
        } catch {
          return false;
        }
      });
      
      // Sort by chunk index and concatenate content
      const sortedChunks = chunks.sort((a: any, b: any) => {
        const aMetadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
        const bMetadata = typeof b.metadata === 'string' ? JSON.parse(b.metadata) : b.metadata;
        return aMetadata.chunkIndex - bMetadata.chunkIndex;
      });
      
      return sortedChunks.map((chunk: any) => chunk.content).join("\n\n");
    } catch (error) {
      console.error("Error getting document content:", error);
      return "";
    }
  }

  async extractTextFromFile(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    try {
      if (mimeType === "application/pdf") {
        const data = await pdfParse(buffer);
        return data.text;
      } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        filename.endsWith(".docx")
      ) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } else if (mimeType === "text/plain" || filename.endsWith(".txt")) {
        return buffer.toString("utf-8");
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      console.error("Error extracting text from file:", error);
      throw error;
    }
  }
}

// Create singleton instance
export const vectorDB = new VectorDatabase();

// Initialize on module load - don't fail if initialization has issues
vectorDB.initialize().catch(error => {
  // Only log if it's not about missing OpenAI API key
  if (!error.message?.includes("OPENAI_API_KEY")) {
    console.warn("Vector database initialization warning:", error.message || error);
  }
  // Vector database will be initialized on first use if needed
});