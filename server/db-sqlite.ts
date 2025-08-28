import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";
import { join } from 'path';

// Create SQLite database file in the data directory
const dbPath = join(process.cwd(), 'data', 'echosensei11.db');
const sqlite = new Database(dbPath);

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');

// Create the Drizzle database instance
export const db = drizzle(sqlite, { schema });

console.log(`✅ SQLite database initialized at: ${dbPath}`);
