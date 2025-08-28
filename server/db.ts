import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let database: ReturnType<typeof drizzle> | null = null;

function getDatabaseConnection() {
  if (!database) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }

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
  
  return database!;
}

// Create a callable db that is also an object with query methods
type DrizzleDb = any;
type CallableDb = DrizzleDb & (() => DrizzleDb);

const concreteDb: any = getDatabaseConnection();
export const db = Object.assign(() => concreteDb, concreteDb) as CallableDb;