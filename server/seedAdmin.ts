import { storage } from "./storage";
import { randomUUID } from "crypto";

export async function seedAdminUser() {
  try {
    console.log("Checking for admin user...");
    
    // Check if admin user already exists
    const existingAdmin = await storage.getUserByEmail("cc@siwaht.com");
    
    if (existingAdmin) {
      console.log("Admin user already exists:", existingAdmin.email);
      return existingAdmin;
    }
    
    console.log("Creating super admin user...");
    
    // Create admin user with minimal required fields and manual UUID
    const adminUser = await storage.createUser({
      id: randomUUID().toString(), // Ensure it's a string
      email: "cc@siwaht.com",
      password: "Hola173!",
      firstName: "Super",
      lastName: "Admin",
      isAdmin: true,
    });
    
    console.log("✅ Super admin user created:", adminUser.email);
    return adminUser;
    
  } catch (error) {
    console.log("Admin user seeding skipped:", (error as Error).message);
    return null;
  }
}