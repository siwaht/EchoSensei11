import { storage } from "./storage";
import { db } from "./db";
import { agencies, agencyPlans, clients } from "@shared/schema";

export async function seedMultiTenantData() {
  try {
    console.log("Starting multi-tenant seed data...");
    
    // Check if agency plans exist
    const existingPlans = await db.select().from(agencyPlans);
    
    if (existingPlans.length === 0) {
      console.log("Creating agency plans...");
      
      // Create agency plans
      const plans = await db.insert(agencyPlans).values([
        {
          name: "Starter",
          basePrice: 299,
          maxClients: 10,
          masterCharacterQuota: 1000000,
          whitelabelEnabled: false,
          customDomainEnabled: false,
          stripeConnectEnabled: false,
          supportLevel: "email",
        },
        {
          name: "Professional",
          basePrice: 799,
          maxClients: 50,
          masterCharacterQuota: 5000000,
          whitelabelEnabled: true,
          customDomainEnabled: false,
          stripeConnectEnabled: true,
          supportLevel: "priority",
        },
        {
          name: "Enterprise",
          basePrice: 1999,
          maxClients: null, // Unlimited
          masterCharacterQuota: 20000000,
          whitelabelEnabled: true,
          customDomainEnabled: true,
          stripeConnectEnabled: true,
          supportLevel: "dedicated",
        },
      ]).returning();
      
      console.log(`Created ${plans.length} agency plans`);
    }
    
    // Check if demo agency exists
    const existingAgencies = await db.select().from(agencies);
    
    if (existingAgencies.length === 0) {
      console.log("Creating demo agency...");
      
      // Get professional plan
      const professionalPlan = await db.select()
        .from(agencyPlans)
        .where((plan: any) => plan.name === "Professional")
        .limit(1);
      
      if (professionalPlan.length > 0) {
        // Create demo agency
        const [demoAgency] = await db.insert(agencies).values({
          name: "Demo Agency",
          email: "agency@demo.com",
          planId: professionalPlan[0].id,
          status: "active",
          masterCharacterQuota: professionalPlan[0].masterCharacterQuota,
        }).returning();
        
        console.log(`Created demo agency: ${demoAgency.name}`);
        
        // Create demo clients for the agency
        const demoClients = await db.insert(clients).values([
          {
            agencyId: demoAgency.id,
            businessName: "Tech Startup Inc",
            email: "client1@demo.com",
            phone: "+1234567890",
            status: "active",
            characterQuota: 100000,
          },
          {
            agencyId: demoAgency.id,
            businessName: "Digital Marketing Co",
            email: "client2@demo.com",
            phone: "+1234567891",
            status: "active",
            characterQuota: 200000,
          },
        ]).returning();
        
        console.log(`Created ${demoClients.length} demo clients`);
        
        // Note: clientSubscription table doesn't exist in schema, skipping subscription creation
        console.log("Skipping client subscription creation (table not defined in schema)");
      }
    }
    
    console.log("Multi-tenant seed data completed successfully!");
  } catch (error) {
    console.error("Error seeding multi-tenant data:", error);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMultiTenantData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}