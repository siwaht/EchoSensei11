import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

export interface ProcessedDocument {
  content: string;
  chunks: string[];
  metadata: {
    fileType: string;
    fileName: string;
    pageCount?: number;
    wordCount: number;
    characterCount: number;
  };
}

export class DocumentProcessor {
  private readonly chunkSize: number = 1000; // Characters per chunk
  private readonly chunkOverlap: number = 200; // Overlap between chunks

  async processFile(filePath: string): Promise<ProcessedDocument> {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    let content: string;
    let pageCount: number | undefined;

    switch (ext) {
      case '.pdf':
        const pdfResult = await this.processPDF(filePath);
        content = pdfResult.content;
        pageCount = pdfResult.pageCount;
        break;
      case '.docx':
      case '.doc':
        content = await this.processWord(filePath);
        break;
      case '.txt':
      case '.md':
      case '.csv':
        content = await this.processText(filePath);
        break;
      case '.json':
        content = await this.processJSON(filePath);
        break;
      default:
        // Try to read as text for unknown file types
        content = await this.processText(filePath);
    }

    const chunks = this.chunkText(content);
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const characterCount = content.length;

    return {
      content,
      chunks,
      metadata: {
        fileType: ext.substring(1), // Remove the dot
        fileName,
        pageCount,
        wordCount,
        characterCount
      }
    };
  }

  private async processPDF(filePath: string): Promise<{ content: string; pageCount: number }> {
    try {
      // Dynamically import pdf-parse to avoid initialization issues in production
      const pdf = (await import('pdf-parse')).default;
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return {
        content: data.text,
        pageCount: data.numpages
      };
    } catch (error: any) {
      console.error('Error processing PDF:', error);
      throw new Error(`Failed to process PDF file: ${error?.message || 'Unknown error'}`);
    }
  }

  private async processWord(filePath: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error: any) {
      console.error('Error processing Word document:', error);
      throw new Error(`Failed to process Word document: ${error?.message || 'Unknown error'}`);
    }
  }

  private async processText(filePath: string): Promise<string> {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error: any) {
      console.error('Error processing text file:', error);
      throw new Error(`Failed to process text file: ${error?.message || 'Unknown error'}`);
    }
  }

  private async processJSON(filePath: string): Promise<string> {
    try {
      const jsonContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(jsonContent);
      // Convert JSON to readable text format
      return JSON.stringify(parsed, null, 2);
    } catch (error: any) {
      console.error('Error processing JSON file:', error);
      throw new Error(`Failed to process JSON file: ${error?.message || 'Unknown error'}`);
    }
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    
    // Clean the text
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    
    if (cleanedText.length <= this.chunkSize) {
      return [cleanedText];
    }

    let start = 0;
    while (start < cleanedText.length) {
      let end = start + this.chunkSize;
      
      // If we're not at the end of the text, try to find a good breaking point
      if (end < cleanedText.length) {
        // Look for sentence endings
        const sentenceEnders = ['. ', '! ', '? ', '\n'];
        let bestBreak = -1;
        
        for (const ender of sentenceEnders) {
          const breakPoint = cleanedText.lastIndexOf(ender, end);
          if (breakPoint > start && breakPoint > bestBreak) {
            bestBreak = breakPoint + ender.length;
          }
        }
        
        // If we found a good breaking point, use it
        if (bestBreak > start) {
          end = bestBreak;
        } else {
          // Otherwise, try to break at a word boundary
          const spaceBreak = cleanedText.lastIndexOf(' ', end);
          if (spaceBreak > start) {
            end = spaceBreak;
          }
        }
      }
      
      chunks.push(cleanedText.substring(start, end).trim());
      
      // Move start position, considering overlap
      start = end - this.chunkOverlap;
      
      // Make sure we're making progress
      if (start <= chunks.length * this.chunkOverlap) {
        start = end;
      }
    }
    
    return chunks;
  }

  async processBuffer(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
    const ext = path.extname(fileName).toLowerCase();
    
    let content: string;
    let pageCount: number | undefined;

    switch (ext) {
      case '.pdf':
        // Dynamically import pdf-parse to avoid initialization issues in production
        const pdf = (await import('pdf-parse')).default;
        const data = await pdf(buffer);
        content = data.text;
        pageCount = data.numpages;
        break;
      case '.docx':
      case '.doc':
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
        break;
      case '.txt':
      case '.md':
      case '.csv':
        content = buffer.toString('utf-8');
        break;
      case '.json':
        try {
          const parsed = JSON.parse(buffer.toString('utf-8'));
          content = JSON.stringify(parsed, null, 2);
        } catch {
          content = buffer.toString('utf-8');
        }
        break;
      default:
        // Try to read as text for unknown file types
        content = buffer.toString('utf-8');
    }

    const chunks = this.chunkText(content);
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const characterCount = content.length;

    return {
      content,
      chunks,
      metadata: {
        fileType: ext.substring(1), // Remove the dot
        fileName,
        pageCount,
        wordCount,
        characterCount
      }
    };
  }

  getSupportedFileTypes(): string[] {
    return [
      '.txt',
      '.pdf',
      '.docx',
      '.doc',
      '.md',
      '.csv',
      '.json'
    ];
  }

  isFileTypeSupported(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return this.getSupportedFileTypes().includes(ext);
  }
}

// Singleton instance
let documentProcessor: DocumentProcessor | null = null;

export function getDocumentProcessor(): DocumentProcessor {
  if (!documentProcessor) {
    documentProcessor = new DocumentProcessor();
  }
  return documentProcessor;
}