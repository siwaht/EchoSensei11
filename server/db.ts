import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

function getDatabaseConnection() {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }

    // Configure the connection pool with proper settings for serverless
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      max: 10, // Maximum number of connections in pool
      connectionTimeoutMillis: 10000, // 10 seconds connection timeout
      idleTimeoutMillis: 30000, // 30 seconds idle timeout
      allowExitOnIdle: true
    });

    db = drizzle({ client: pool, schema });
  }
  
  return db;
}

// Export a proxy that lazy-loads the database connection
export { getDatabaseConnection as db };