import { storage } from "./storage";
import type { QuickActionButton } from "@shared/schema";

const defaultSystemButtons = [
  {
    name: "Customer Support",
    prompt: "You are a helpful and empathetic customer support representative. Listen carefully to the customer's issue, provide clear solutions, and maintain a professional yet friendly tone throughout the conversation.",
    icon: "User",
    color: "bg-blue-500 hover:bg-blue-600",
    category: "Support",
    order: 1,
    isSystem: true,
    isActive: true,
  },
  {
    name: "Sales Assistant",
    prompt: "You are a knowledgeable sales assistant. Help customers understand our products, answer their questions, and guide them toward the best solution for their needs. Be persuasive but not pushy.",
    icon: "DollarSign",
    color: "bg-green-500 hover:bg-green-600",
    category: "Sales",
    order: 2,
    isSystem: true,
    isActive: true,
  },
  {
    name: "Appointment Scheduler",
    prompt: "You are an appointment scheduling assistant. Help callers book, reschedule, or cancel appointments. Verify availability, collect necessary information, and confirm all appointment details clearly.",
    icon: "Calendar",
    color: "bg-purple-500 hover:bg-purple-600",
    category: "Scheduling",
    order: 3,
    isSystem: true,
    isActive: true,
  },
  {
    name: "Technical Support",
    prompt: "You are a technical support specialist. Help users troubleshoot issues, provide step-by-step guidance, and escalate complex problems when necessary. Explain technical concepts in simple terms.",
    icon: "Wrench",
    color: "bg-red-500 hover:bg-red-600",
    category: "Support",
    order: 4,
    isSystem: true,
    isActive: true,
  },
  {
    name: "Survey Collector",
    prompt: "You are conducting a brief customer satisfaction survey. Ask the prepared questions clearly, record responses accurately, and thank the participant for their time and feedback.",
    icon: "Sheet",
    color: "bg-yellow-500 hover:bg-yellow-600",
    category: "Feedback",
    order: 5,
    isSystem: true,
    isActive: true,
  },
  {
    name: "Order Status",
    prompt: "You are an order status assistant. Help customers track their orders, provide shipping updates, and handle any concerns about deliveries. Access order information and provide accurate status updates.",
    icon: "Package",
    color: "bg-indigo-500 hover:bg-indigo-600",
    category: "Support",
    order: 6,
    isSystem: true,
    isActive: true,
  },
  {
    name: "Lead Qualifier",
    prompt: "You are a lead qualification specialist. Gather information about potential customers, assess their needs and budget, and determine if they're a good fit for our services. Be professional and respectful.",
    icon: "Target",
    color: "bg-pink-500 hover:bg-pink-600",
    category: "Sales",
    order: 7,
    isSystem: true,
    isActive: true,
  },
  {
    name: "FAQ Assistant",
    prompt: "You are an FAQ assistant. Answer common questions about our products and services based on the knowledge base. If you don't know an answer, offer to connect the caller with a specialist.",
    icon: "HelpCircle",
    color: "bg-gray-500 hover:bg-gray-600",
    category: "Support",
    order: 8,
    isSystem: true,
    isActive: true,
  },
];

export async function seedQuickActionButtons() {
  
  try {
    console.log("Seeding quick action buttons...");
    
    // Check if any system buttons already exist
    const existingButtons = await storage.getQuickActionButtons();
    const systemButtons = existingButtons.filter((b: QuickActionButton) => b.isSystem);
    
    if (systemButtons.length > 0) {
      console.log(`System buttons already exist (${systemButtons.length} found). Skipping seed.`);
      return;
    }
    
    // Create default system buttons
    for (const button of defaultSystemButtons) {
      await storage.createQuickActionButton({
        ...button,
        createdBy: "system", // System-created buttons
      });
      console.log(`Created system button: ${button.name}`);
    }
    
    console.log(`Successfully seeded ${defaultSystemButtons.length} system quick action buttons.`);
  } catch (error) {
    console.error("Error seeding quick action buttons:", error);
    throw error;
  }
}

// Run if called directly
seedQuickActionButtons()
  .then(() => {
    console.log("Seed completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });