import { storage } from "./storage";

export async function seedAdminUser() {
  try {
    // Check if admin user already exists
    const existingUser = await storage.getUserByEmail("cc@siwaht.com");
    
    if (existingUser) {
      console.log("Admin user already exists");
      return;
    }
    
    // Create admin user with plain password (will be handled specially in auth.ts)
    const adminUser = await storage.createUser({
      email: "cc@siwaht.com",
      password: "Hola173!", // This will be checked directly in auth.ts
      firstName: "Admin",
      lastName: "User",
      isAdmin: true,
    });
    
    console.log("Admin user created successfully:", adminUser.email);
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}