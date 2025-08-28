// Setup SQLite Database Tables
import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';

console.log('🔧 Setting up SQLite database...');

const dbPath = join(process.cwd(), 'data', 'echosensei11.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create UUID function for SQLite
db.function('gen_random_uuid', () => randomUUID());

// Drop existing tables to recreate with correct schema
console.log('🗑️  Dropping existing tables...');
db.exec('DROP TABLE IF EXISTS clients');
db.exec('DROP TABLE IF EXISTS agencies');
db.exec('DROP TABLE IF EXISTS agency_plans');
db.exec('DROP TABLE IF EXISTS users');
db.exec('DROP TABLE IF EXISTS organizations');

// Create basic tables with snake_case names that match schema expectations
console.log('📋 Creating database tables...');

// Users table - using snake_case to match schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    first_name TEXT,
    last_name TEXT,
    profile_image_url TEXT,
    organization_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client',
    agency_id TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Organizations table
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    billing_package TEXT DEFAULT 'starter',
    per_call_rate DECIMAL(10,4) DEFAULT 0.30,
    per_minute_rate DECIMAL(10,4) DEFAULT 0.30,
    monthly_credits INTEGER DEFAULT 0,
    used_credits INTEGER DEFAULT 0,
    credit_reset_date DATETIME,
    custom_rate_enabled BOOLEAN DEFAULT FALSE,
    max_agents INTEGER DEFAULT 5,
    max_users INTEGER DEFAULT 10,
    stripe_customer_id TEXT,
    subscription_id TEXT,
    billing_status TEXT DEFAULT 'inactive',
    last_payment_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Agencies table
db.exec(`
  CREATE TABLE IF NOT EXISTS agencies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    plan_id TEXT,
    status TEXT DEFAULT 'active',
    master_character_quota INTEGER DEFAULT 1000000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Agency Plans table
db.exec(`
  CREATE TABLE IF NOT EXISTS agency_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    max_clients INTEGER,
    master_character_quota INTEGER NOT NULL,
    whitelabel_enabled BOOLEAN DEFAULT FALSE,
    custom_domain_enabled BOOLEAN DEFAULT FALSE,
    stripe_connect_enabled BOOLEAN DEFAULT FALSE,
    support_level TEXT DEFAULT 'email',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Clients table
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    agency_id TEXT NOT NULL,
    business_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'active',
    character_quota INTEGER DEFAULT 100000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agency_id) REFERENCES agencies(id)
  )
`);

console.log('✅ Database tables created successfully!');
console.log(`📁 Database location: ${dbPath}`);

// Close the database
db.close();

console.log('🎉 SQLite database setup complete!');
console.log('🚀 You can now run: npm run dev');
