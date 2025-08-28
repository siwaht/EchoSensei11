// Create Super Admin User Script
// Run this script after setting up your database and DATABASE_URL environment variable

import { storage } from "./server/storage.js";

async function createSuperAdmin() {
  try {
    console.log("Creating super admin user...");
    
    // Check if admin user already exists
    const existingUser = await storage.getUserByEmail("cc@siwaht.com");
    
    if (existingUser) {
      console.log("✅ Super admin user already exists:", existingUser.email);
      console.log("User ID:", existingUser.id);
      console.log("Role:", existingUser.role);
      return;
    }
    
    // Create super admin user
    const adminUser = await storage.createUser({
      email: "cc@siwaht.com",
      password: "Hola173!",
      firstName: "Super",
      lastName: "Admin",
      role: "super_admin",
      organizationId: "super-admin-org", // You may need to create this organization first
      isAdmin: true,
    });
    
    console.log("✅ Super admin user created successfully!");
    console.log("Email:", adminUser.email);
    console.log("User ID:", adminUser.id);
    console.log("Role:", adminUser.role);
    
  } catch (error) {
    console.error("❌ Error creating super admin user:", error);
    console.log("\nMake sure you have:");
    console.log("1. Set DATABASE_URL environment variable");
    console.log("2. Database is running and accessible");
    console.log("3. Run 'npm install' to install dependencies");
  }
}

// Run the function
createSuperAdmin();
