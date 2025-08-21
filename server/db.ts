import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure the connection pool with proper settings for serverless
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of connections in pool
  connectionTimeoutMillis: 10000, // 10 seconds connection timeout
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
  allowExitOnIdle: true
});

export const db = drizzle({ client: pool, schema });