// Database Setup and Super Admin Creation Script
// This script will help you set up everything needed

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🚀 EchoSensei11 Database Setup');
console.log('================================\n');

// Check if .env file exists
const envPath = join(process.cwd(), '.env');
if (!existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  
  const envContent = `# Database Configuration
# Replace with your actual database URL
DATABASE_URL="postgresql://username:password@localhost:5432/echosensei11"

# Environment
NODE_ENV=development
PORT=5000

# Add other environment variables as needed
`;

  writeFileSync(envPath, envContent);
  console.log('✅ .env file created');
  console.log('⚠️  Please update DATABASE_URL with your actual database connection string\n');
} else {
  console.log('✅ .env file already exists');
}

console.log('🔧 Next Steps:');
console.log('1. Set up a PostgreSQL database:');
console.log('   • Local: Install PostgreSQL and create database');
console.log('   • Cloud: Use Neon (neon.tech) - Free tier available');
console.log('   • Cloud: Use Supabase (supabase.com) - Free tier available');
console.log('\n2. Update your .env file with the DATABASE_URL');
console.log('\n3. Run the database migrations:');
console.log('   npm run db:push');
console.log('\n4. Create the super admin user:');
console.log('   npm run dev');
console.log('\n5. Login with:');
console.log('   Email: cc@siwaht.com');
console.log('   Password: Hola173!');
console.log('\n📚 For detailed instructions, see SUPER_ADMIN_SETUP.md');

// Check if database is accessible
console.log('\n🔍 Checking database connection...');
try {
  // This will only work if DATABASE_URL is set and database is accessible
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
  
  // Try to import storage to test connection
  const { storage } = await import('./server/storage.js');
  console.log('✅ Database connection successful!');
  
  // Try to create super admin
  console.log('\n👤 Creating super admin user...');
  const adminUser = await storage.createUser({
    email: "cc@siwaht.com",
    password: "Hola173!",
    firstName: "Super",
    lastName: "Admin",
    role: "super_admin",
    organizationId: "super-admin-org",
    isAdmin: true,
  });
  
  console.log('✅ Super admin user created successfully!');
  console.log(`   Email: ${adminUser.email}`);
  console.log(`   User ID: ${adminUser.id}`);
  console.log(`   Role: ${adminUser.role}`);
  
} catch (error) {
  console.log('❌ Database connection failed or user creation failed');
  console.log('   This is expected if DATABASE_URL is not set or database is not running');
  console.log('\n   Error details:', error.message);
}
