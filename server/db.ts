import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from "ws";
import * as schema from "@shared/schema";
import { join } from 'path';

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let database: any = null;

function getDatabaseConnection() {
  if (!database) {
    if (!process.env.DATABASE_URL) {
      console.log("⚠️  No DATABASE_URL set, using local SQLite database");
      
      // Create SQLite database file in the data directory
      const dbPath = join(process.cwd(), 'data', 'echosensei11.db');
      const sqlite = new Database(dbPath);
      
      // Enable foreign keys
      sqlite.pragma('foreign_keys = ON');
      
      // Create the Drizzle database instance
      database = drizzleSQLite(sqlite, { schema });
      console.log(`✅ SQLite database initialized at: ${dbPath}`);
    } else {
      console.log("✅ Using PostgreSQL database from DATABASE_URL");
      
      // Configure the connection pool with proper settings for serverless
      pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        allowExitOnIdle: true
      });

      database = drizzle({ client: pool, schema });
    }
  }
  
  return database!;
}

// Export the database instance directly
export const db = getDatabaseConnection();