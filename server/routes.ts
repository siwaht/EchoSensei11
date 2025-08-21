import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertIntegrationSchema, insertAgentSchema, insertCallLogSchema, insertPhoneNumberSchema, insertBatchCallSchema, insertBatchCallRecipientSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import type { RequestHandler } from "express";
import { seedAdminUser } from "./seedAdmin";
import multer from "multer";

// Authentication middleware
const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// ElevenLabs API helper
async function callElevenLabsAPI(apiKey: string, endpoint: string, method = "GET", body?: any) {
  const headers: any = {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
  };

  const url = `https://api.elevenlabs.io${endpoint}`;
  console.log(`Calling ElevenLabs API: ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    console.error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    console.error(`Response body: ${responseText}`);
    
    // Try to parse error message from response
    let errorMessage = `ElevenLabs API error: ${response.status}`;
    try {
      const errorData = JSON.parse(responseText);
      if (errorData.detail?.message) {
        errorMessage = errorData.detail.message;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // If response is not JSON, use the status text
      errorMessage = responseText || response.statusText;
    }
    
    throw new Error(errorMessage);
  }

  // Return parsed JSON if response has content
  if (responseText) {
    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", responseText);
      return {};
    }
  }
  return {};
}

// Encryption helpers
function encryptApiKey(apiKey: string): string {
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  return `${iv.toString("hex")}:${encrypted}`;
}

function decryptApiKey(encryptedApiKey: string): string {
  try {
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
    
    // Handle both old and new encryption formats
    if (!encryptedApiKey.includes(":")) {
      // Old format - try legacy decryption
      const decipher = crypto.createDecipher("aes-256-cbc", process.env.ENCRYPTION_KEY || "default-key");
      let decrypted = decipher.update(encryptedApiKey, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }
    
    // New format
    const [ivHex, encrypted] = encryptedApiKey.split(":");
    const iv = Buffer.from(ivHex, "hex");
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt API key. Please re-enter your API key.");
  }
}

// Cost calculation helper (rough estimate: $0.30 per minute)
function calculateCallCost(durationSeconds: number, costData?: any): number {
  // If ElevenLabs provides actual cost data, use it
  if (costData?.llm_cost) {
    return Number(costData.llm_cost);
  }
  if (costData?.cost) {
    return Number(costData.cost);
  }
  
  // Otherwise, calculate estimated cost based on ElevenLabs pricing
  // ElevenLabs charges approximately $0.30 per minute for conversational AI
  const minutes = durationSeconds / 60;
  return Math.round(minutes * 0.30 * 100) / 100; // Round to 2 decimal places
}

export function registerRoutes(app: Express): Server {
  // Seed admin user on startup
  seedAdminUser().catch(console.error);
  
  // Auth middleware
  setupAuth(app);

  // Auth routes already handled by setupAuth in auth.ts

  // Admin middleware
  const isAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  };

  // Admin routes - User Management
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updatedUser = await storage.updateUser(req.params.userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteUser(req.params.userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin routes - Organization Management
  app.get('/api/admin/organizations', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const organizations = await storage.getAllOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.get('/api/admin/billing', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const billingData = await storage.getAdminBillingData();
      res.json(billingData);
    } catch (error) {
      console.error("Error fetching billing data:", error);
      res.status(500).json({ message: "Failed to fetch billing data" });
    }
  });

  app.patch('/api/admin/organizations/:orgId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updatedOrg = await storage.updateOrganization(req.params.orgId, req.body);
      res.json(updatedOrg);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  // Admin routes - Create new user
  app.post('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { email, firstName, lastName, password, companyName, isAdmin } = req.body;
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // If company name is provided, find or create organization
      let organizationId = undefined;
      if (companyName && companyName.trim()) {
        // Try to find existing organization
        const organizations = await storage.getAllOrganizations();
        const existingOrg = organizations.find(org => 
          org.name.toLowerCase() === companyName.toLowerCase()
        );
        
        if (existingOrg) {
          organizationId = existingOrg.id;
        } else {
          // Create new organization
          const newOrg = await storage.createOrganization({ name: companyName });
          organizationId = newOrg.id;
        }
      }

      // Create new user
      const newUser = await storage.createUser({
        email,
        firstName,
        lastName,
        password,
        organizationId,
        isAdmin: isAdmin || false,
      });

      res.json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Admin routes - Billing Package Management
  app.get('/api/admin/billing-packages', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const packages = await storage.getBillingPackages();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching billing packages:", error);
      res.status(500).json({ message: "Failed to fetch billing packages" });
    }
  });

  app.post('/api/admin/billing-packages', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const newPackage = await storage.createBillingPackage(req.body);
      res.json(newPackage);
    } catch (error) {
      console.error("Error creating billing package:", error);
      res.status(500).json({ message: "Failed to create billing package" });
    }
  });

  app.patch('/api/admin/billing-packages/:pkgId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updatedPackage = await storage.updateBillingPackage(req.params.pkgId, req.body);
      res.json(updatedPackage);
    } catch (error) {
      console.error("Error updating billing package:", error);
      res.status(500).json({ message: "Failed to update billing package" });
    }
  });

  app.delete('/api/admin/billing-packages/:pkgId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteBillingPackage(req.params.pkgId);
      res.json({ message: "Billing package deleted successfully" });
    } catch (error) {
      console.error("Error deleting billing package:", error);
      res.status(500).json({ message: "Failed to delete billing package" });
    }
  });

  // System templates routes (admin only)
  app.get('/api/admin/system-templates', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const templates = await storage.getSystemTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching system templates:", error);
      res.status(500).json({ message: "Failed to fetch system templates" });
    }
  });

  app.post('/api/admin/system-templates', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const newTemplate = await storage.createSystemTemplate(req.body);
      res.json(newTemplate);
    } catch (error) {
      console.error("Error creating system template:", error);
      res.status(500).json({ message: "Failed to create system template" });
    }
  });

  app.patch('/api/admin/system-templates/:templateId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updatedTemplate = await storage.updateSystemTemplate(req.params.templateId, req.body);
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating system template:", error);
      res.status(500).json({ message: "Failed to update system template" });
    }
  });

  app.delete('/api/admin/system-templates/:templateId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteSystemTemplate(req.params.templateId);
      res.json({ message: "System template deleted successfully" });
    } catch (error) {
      console.error("Error deleting system template:", error);
      res.status(500).json({ message: "Failed to delete system template" });
    }
  });

  // Public route to get active system templates (for all users)
  app.get('/api/system-templates', isAuthenticated, async (req: any, res) => {
    try {
      const templates = await storage.getSystemTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching system templates:", error);
      res.status(500).json({ message: "Failed to fetch system templates" });
    }
  });

  // Quick Action Buttons routes - Admin (for system buttons)
  app.get('/api/admin/quick-action-buttons', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const buttons = await storage.getQuickActionButtons();
      res.json(buttons);
    } catch (error) {
      console.error("Error fetching quick action buttons:", error);
      res.status(500).json({ message: "Failed to fetch quick action buttons" });
    }
  });

  app.post('/api/admin/quick-action-buttons', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const buttonData = {
        ...req.body,
        isSystem: true,
        createdBy: req.user.id
      };
      const newButton = await storage.createQuickActionButton(buttonData);
      res.json(newButton);
    } catch (error) {
      console.error("Error creating quick action button:", error);
      res.status(500).json({ message: "Failed to create quick action button" });
    }
  });

  app.patch('/api/admin/quick-action-buttons/:buttonId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const button = await storage.getQuickActionButton(req.params.buttonId);
      if (!button) {
        return res.status(404).json({ message: "Quick action button not found" });
      }
      
      // Only allow admins to update system buttons
      if (!button.isSystem) {
        return res.status(403).json({ message: "Cannot modify user buttons through admin API" });
      }
      
      const updatedButton = await storage.updateQuickActionButton(req.params.buttonId, req.body);
      res.json(updatedButton);
    } catch (error) {
      console.error("Error updating quick action button:", error);
      res.status(500).json({ message: "Failed to update quick action button" });
    }
  });

  app.delete('/api/admin/quick-action-buttons/:buttonId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const button = await storage.getQuickActionButton(req.params.buttonId);
      if (!button) {
        return res.status(404).json({ message: "Quick action button not found" });
      }
      
      // Only allow admins to delete system buttons
      if (!button.isSystem) {
        return res.status(403).json({ message: "Cannot delete user buttons through admin API" });
      }
      
      await storage.deleteQuickActionButton(req.params.buttonId);
      res.json({ message: "Quick action button deleted successfully" });
    } catch (error) {
      console.error("Error deleting quick action button:", error);
      res.status(500).json({ message: "Failed to delete quick action button" });
    }
  });

  // Quick Action Buttons routes - Users (for their own buttons)
  app.get('/api/quick-action-buttons', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get both system buttons and user's organization buttons
      const buttons = await storage.getQuickActionButtons(user.organizationId);
      res.json(buttons);
    } catch (error) {
      console.error("Error fetching quick action buttons:", error);
      res.status(500).json({ message: "Failed to fetch quick action buttons" });
    }
  });

  app.post('/api/quick-action-buttons', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const buttonData = {
        ...req.body,
        isSystem: false,
        createdBy: req.user.id,
        organizationId: user.organizationId
      };
      
      const newButton = await storage.createQuickActionButton(buttonData);
      res.json(newButton);
    } catch (error) {
      console.error("Error creating quick action button:", error);
      res.status(500).json({ message: "Failed to create quick action button" });
    }
  });

  app.patch('/api/quick-action-buttons/:buttonId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const button = await storage.getQuickActionButton(req.params.buttonId);
      if (!button) {
        return res.status(404).json({ message: "Quick action button not found" });
      }
      
      // Users can only update their own organization's buttons (not system buttons)
      if (button.isSystem || button.organizationId !== user.organizationId) {
        return res.status(403).json({ message: "You don't have permission to modify this button" });
      }
      
      const updatedButton = await storage.updateQuickActionButton(req.params.buttonId, req.body);
      res.json(updatedButton);
    } catch (error) {
      console.error("Error updating quick action button:", error);
      res.status(500).json({ message: "Failed to update quick action button" });
    }
  });

  app.delete('/api/quick-action-buttons/:buttonId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const button = await storage.getQuickActionButton(req.params.buttonId);
      if (!button) {
        return res.status(404).json({ message: "Quick action button not found" });
      }
      
      // Users can only delete their own organization's buttons (not system buttons)
      if (button.isSystem || button.organizationId !== user.organizationId) {
        return res.status(403).json({ message: "You don't have permission to delete this button" });
      }
      
      await storage.deleteQuickActionButton(req.params.buttonId);
      res.json({ message: "Quick action button deleted successfully" });
    } catch (error) {
      console.error("Error deleting quick action button:", error);
      res.status(500).json({ message: "Failed to delete quick action button" });
    }
  });

  // Integration routes
  app.post("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ message: "API key is required" });
      }

      const encryptedKey = encryptApiKey(apiKey);
      
      const integration = await storage.upsertIntegration({
        organizationId: user.organizationId,
        provider: "elevenlabs",
        apiKey: encryptedKey,
        status: "INACTIVE",
      });

      res.json({ message: "Integration saved successfully", id: integration.id });
    } catch (error) {
      console.error("Error saving integration:", error);
      res.status(500).json({ message: "Failed to save integration" });
    }
  });

  // Get integration by provider
  app.get("/api/integrations/:provider", isAuthenticated, async (req: any, res) => {
    try {
      let { provider } = req.params;
      
      // Map voiceai to elevenlabs internally
      if (provider === "voiceai") {
        provider = "elevenlabs";
      }
      
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const integration = await storage.getIntegration(user.organizationId, provider);
      
      if (!integration) {
        // Return inactive status if no integration exists
        return res.json({ 
          status: "INACTIVE",
          provider: provider,
          message: "No integration configured"
        });
      }
      
      // Don't send the encrypted API key to the client
      const { apiKey, ...integrationWithoutKey } = integration;
      res.json(integrationWithoutKey);
    } catch (error) {
      console.error("Error fetching integration:", error);
      res.status(500).json({ message: "Failed to fetch integration" });
    }
  });

  app.post("/api/integrations/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration) {
        return res.status(404).json({ message: "No integration found" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      try {
        console.log("Testing ElevenLabs API connection...");
        // Use the /v1/user endpoint to validate the API key
        const userData = await callElevenLabsAPI(apiKey, "/v1/user");
        console.log("ElevenLabs user data retrieved:", userData);
        
        await storage.updateIntegrationStatus(integration.id, "ACTIVE", new Date());
        res.json({ 
          message: "Connection successful", 
          status: "ACTIVE",
          subscription: userData.subscription || null
        });
      } catch (error: any) {
        console.error("ElevenLabs API test failed:", error.message);
        await storage.updateIntegrationStatus(integration.id, "ERROR", new Date());
        
        // Return more specific error message
        let errorMessage = "Connection failed";
        if (error.message.includes("401") || error.message.includes("Unauthorized")) {
          errorMessage = "Invalid API key. Please check your ElevenLabs API key.";
        } else if (error.message.includes("403") || error.message.includes("Forbidden")) {
          errorMessage = "Access forbidden. Your API key may not have the required permissions.";
        } else if (error.message.includes("404")) {
          errorMessage = "ElevenLabs API endpoint not found. Please try again later.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        res.status(400).json({ 
          message: errorMessage, 
          status: "ERROR" 
        });
      }
    } catch (error: any) {
      console.error("Error testing integration:", error);
      res.status(500).json({ 
        message: error.message || "Failed to test integration" 
      });
    }
  });

  app.get("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration) {
        return res.json({ status: "INACTIVE" });
      }

      // Never return the actual API key
      res.json({
        status: integration.status,
        lastTested: integration.lastTested,
        createdAt: integration.createdAt,
      });
    } catch (error) {
      console.error("Error fetching integration:", error);
      res.status(500).json({ message: "Failed to fetch integration" });
    }
  });

  // Agent routes
  app.post("/api/agents/validate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { elevenLabsAgentId } = req.body;
      if (!elevenLabsAgentId) {
        return res.status(400).json({ message: "ElevenLabs Agent ID is required" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
        return res.status(400).json({ message: "Active ElevenLabs integration required" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      try {
        console.log("Validating agent with ID:", elevenLabsAgentId);
        const agentData = await callElevenLabsAPI(apiKey, `/v1/convai/agents/${elevenLabsAgentId}`);
        console.log("Agent validation successful:", agentData);
        res.json({ 
          message: "Agent validated successfully", 
          agentData: {
            id: agentData.id,
            name: agentData.name,
            description: agentData.description,
          }
        });
      } catch (error: any) {
        console.error("Agent validation failed:", error?.message || error);
        res.status(400).json({ message: `Invalid agent ID or API error: ${error?.message || 'Unknown error'}` });
      }
    } catch (error) {
      console.error("Error validating agent:", error);
      res.status(500).json({ message: "Failed to validate agent" });
    }
  });

  // Create a new agent on ElevenLabs
  app.post("/api/agents/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
        return res.status(400).json({ message: "Active ElevenLabs integration required" });
      }

      const { name, firstMessage, systemPrompt, language, voiceId } = req.body;
      
      if (!name || !firstMessage || !systemPrompt) {
        return res.status(400).json({ message: "Name, first message, and system prompt are required" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      // Create agent on ElevenLabs with complete configuration override
      const agentPayload: any = {
        name,
        conversation_config: {
          agent: {
            prompt: {
              prompt: systemPrompt,
              first_message: firstMessage,
              language: language || "en"
            },
            first_message: firstMessage,
            language: language || "en"
          },
          tts: {
            voice_id: voiceId || "21m00Tcm4TlvDq8ikWAM", // Default to Rachel voice if not specified
            agent_output_audio_format: "pcm_16000",
            optimize_streaming_latency: 3,
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true
          },
          turn: {
            mode: "simultaneous",
            threshold: 0.5
          },
          asr: {
            quality: "high",
            provider: "elevenlabs"
          }
        },
        platform_settings: {
          auth: {
            mode: "open" // Allow all calls without authentication
          }
        }
      };

      console.log("Creating agent on ElevenLabs:", agentPayload);
      
      const elevenLabsResponse = await callElevenLabsAPI(
        apiKey,
        "/v1/convai/agents",
        "POST",
        agentPayload
      );

      console.log("ElevenLabs agent created:", elevenLabsResponse);

      // Save agent to our database
      const agentData = insertAgentSchema.parse({
        organizationId: user.organizationId,
        elevenLabsAgentId: elevenLabsResponse.agent_id,
        name: name,
        description: `Created via VoiceAI Dashboard`,
        firstMessage: firstMessage,
        systemPrompt: systemPrompt,
        language: language || "en",
        voiceId: voiceId,
        isActive: true
      });

      const newAgent = await storage.createAgent(agentData);
      
      // Update integration status to active
      await storage.updateIntegrationStatus(integration.id, "ACTIVE", new Date());

      res.json({
        ...newAgent,
        message: "Agent created successfully"
      });
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create agent" 
      });
    }
  });

  app.post("/api/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agentData = insertAgentSchema.parse({
        ...req.body,
        organizationId: user.organizationId,
      });

      // Check if agent already exists
      const existingAgent = await storage.getAgentByElevenLabsId(
        agentData.elevenLabsAgentId,
        user.organizationId
      );
      if (existingAgent) {
        return res.status(400).json({ message: "Agent already registered" });
      }

      // Get integration to sync with ElevenLabs
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (integration && integration.apiKey && agentData.elevenLabsAgentId) {
        const decryptedKey = decryptApiKey(integration.apiKey);
        
        try {
          // Fetch agent details from ElevenLabs to sync initial settings
          const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentData.elevenLabsAgentId}`, {
            headers: {
              "xi-api-key": decryptedKey,
              "Content-Type": "application/json",
            },
          });
          
          if (response.ok) {
            const elevenLabsAgent = await response.json();
            
            // Extract settings from ElevenLabs agent
            const conversationConfig = elevenLabsAgent.conversation_config || {};
            const agentConfig = conversationConfig.agent || {};
            const ttsConfig = conversationConfig.tts || {};
            const llmConfig = conversationConfig.llm || {};
            
            // Update agent data with ElevenLabs settings
            agentData.firstMessage = agentConfig.first_message || agentData.firstMessage;
            agentData.systemPrompt = agentConfig.prompt || agentData.systemPrompt;
            agentData.language = agentConfig.language || agentData.language || 'en';
            agentData.voiceId = ttsConfig.voice_id || agentData.voiceId;
            
            if (ttsConfig.stability !== undefined || ttsConfig.similarity_boost !== undefined) {
              agentData.voiceSettings = {
                stability: ttsConfig.stability || 0.5,
                similarityBoost: ttsConfig.similarity_boost || 0.75,
                style: ttsConfig.style || 0,
                useSpeakerBoost: ttsConfig.use_speaker_boost ?? true,
              };
            }
            
            if (llmConfig.model || llmConfig.temperature !== undefined || llmConfig.max_tokens !== undefined) {
              agentData.llmSettings = {
                model: llmConfig.model || 'gpt-4',
                temperature: llmConfig.temperature || 0.7,
                maxTokens: llmConfig.max_tokens || 150,
              };
            }
            
            
            if (agentConfig.tool_ids) {
              // Map tool_ids to the expected tools structure
              agentData.tools = {
                customTools: agentConfig.tool_ids ? agentConfig.tool_ids.map((id: string) => ({
                  id,
                  name: id,
                  type: 'integration',
                  enabled: true
                })) : []
              };
            }
            
            if (agentConfig.dynamic_variables) {
              agentData.dynamicVariables = agentConfig.dynamic_variables;
            }
          }
        } catch (elevenLabsError) {
          console.error("Error fetching agent from ElevenLabs:", elevenLabsError);
          // Continue with agent creation even if sync fails
        }
      }

      const agent = await storage.createAgent(agentData);
      res.json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.get("/api/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agents = await storage.getAgents(user.organizationId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.delete("/api/agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agentId = req.params.id;
      
      // Check if agent exists and belongs to the organization
      const agent = await storage.getAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Delete from ElevenLabs first if the agent is synced
      if (agent.elevenLabsAgentId) {
        const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
        if (integration && integration.apiKey) {
          try {
            const decryptedKey = decryptApiKey(integration.apiKey);
            
            console.log(`Deleting agent from ElevenLabs: ${agent.elevenLabsAgentId}`);
            
            // Call ElevenLabs API to delete the agent
            const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.elevenLabsAgentId}`, {
              method: "DELETE",
              headers: {
                "xi-api-key": decryptedKey,
              }
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to delete agent from ElevenLabs: ${response.status} - ${errorText}`);
              // Don't fail the entire operation if ElevenLabs deletion fails
              // The user may want to remove it from their dashboard anyway
            } else {
              console.log(`Successfully deleted agent ${agent.elevenLabsAgentId} from ElevenLabs`);
            }
          } catch (elevenLabsError) {
            console.error("Error deleting agent from ElevenLabs:", elevenLabsError);
            // Continue with local deletion even if ElevenLabs deletion fails
          }
        }
      }

      // Delete the agent from local database
      await storage.deleteAgent(user.organizationId, agentId);
      
      res.json({ message: "Agent deleted successfully" });
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });


  // Get available VoiceAI voices (new endpoint)
  app.get("/api/voiceai/voices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "VoiceAI API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      
      // Fetch voices from API
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": decryptedKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data.voices || []);
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ message: "Failed to fetch voices" });
    }
  });
  
  // Legacy endpoint for backwards compatibility
  app.get("/api/elevenlabs/voices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      
      // Fetch voices from ElevenLabs API
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": decryptedKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data.voices || []);
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ message: "Failed to fetch voices" });
    }
  });

  // Phone number routes
  app.get("/api/phone-numbers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const phoneNumbers = await storage.getPhoneNumbers(user.organizationId);
      res.json(phoneNumbers);
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      res.status(500).json({ message: "Failed to fetch phone numbers" });
    }
  });

  app.post("/api/phone-numbers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const validation = insertPhoneNumberSchema.safeParse({
        ...req.body,
        organizationId: user.organizationId,
      });

      if (!validation.success) {
        return res.status(400).json({ message: "Invalid phone number data", errors: validation.error.errors });
      }

      // Encrypt sensitive data if provided
      const phoneNumberData = { ...validation.data };
      if (phoneNumberData.twilioAuthToken) {
        phoneNumberData.twilioAuthToken = encryptApiKey(phoneNumberData.twilioAuthToken);
      }
      if (phoneNumberData.sipPassword) {
        phoneNumberData.sipPassword = encryptApiKey(phoneNumberData.sipPassword);
      }

      // Create phone number first (following Vapi/Synthflow pattern)
      // Set initial status to pending for validation
      phoneNumberData.status = "pending";
      let phoneNumber = await storage.createPhoneNumber(phoneNumberData);
      
      // Then attempt to sync with ElevenLabs if integration exists
      // This is a non-blocking validation step
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (integration && integration.apiKey) {
        try {
          const decryptedKey = decryptApiKey(integration.apiKey);
          
          // Format phone number for ElevenLabs in E.164 format
          // Remove any non-digit characters from the phone number
          const cleanPhoneNumber = phoneNumberData.phoneNumber.replace(/\D/g, '');
          // Get the country code without the + sign
          const rawCountryCode = (phoneNumberData.countryCode || '+1').replace('+', '');
          
          // Check if the phone number already starts with the country code
          // If it does, don't add it again
          let formattedPhoneNumber;
          if (cleanPhoneNumber.startsWith(rawCountryCode)) {
            // Phone number already includes country code
            formattedPhoneNumber = '+' + cleanPhoneNumber;
          } else {
            // Add country code to phone number
            formattedPhoneNumber = '+' + rawCountryCode + cleanPhoneNumber;
          }
          
          // Create phone number in ElevenLabs
          const elevenLabsPayload: any = {
            label: phoneNumberData.label,
            phone_number: formattedPhoneNumber,
            // Don't send country_code as a separate field
          };

          if (phoneNumberData.provider === "twilio" && phoneNumberData.twilioAccountSid) {
            elevenLabsPayload.provider = "twilio";
            elevenLabsPayload.sid = phoneNumberData.twilioAccountSid;
            // Add the auth token if provided (required by ElevenLabs)
            if (phoneNumberData.twilioAuthToken) {
              const decryptedToken = decryptApiKey(phoneNumberData.twilioAuthToken);
              elevenLabsPayload.token = decryptedToken;
            }
          } else if (phoneNumberData.provider === "sip_trunk") {
            elevenLabsPayload.provider = "sip";
            if (phoneNumberData.sipTrunkUri) {
              elevenLabsPayload.sip_uri = phoneNumberData.sipTrunkUri;
            }
          }

          const response = await callElevenLabsAPI(
            decryptedKey,
            "/v1/convai/phone-numbers",
            "POST",
            elevenLabsPayload
          );

          console.log("ElevenLabs phone creation response:", JSON.stringify(response, null, 2));

          // ElevenLabs returns phone_number_id in the response
          // Let's check multiple possible field names to be sure
          const phoneId = response.phone_number_id || response.phone_id || response.id;
          
          if (phoneId) {
            // Update the phone number status to active after successful sync
            const updateResult = await storage.updatePhoneNumber(phoneNumber.id, user.organizationId, {
              elevenLabsPhoneId: phoneId,
              status: "active",
              lastSynced: new Date()
            });
            console.log("Updated phone number with ElevenLabs ID:", {
              localPhoneId: phoneNumber.id,
              elevenLabsPhoneId: phoneId,
              updateSuccess: !!updateResult
            });
            
            // Update the returned phone number object
            phoneNumber.elevenLabsPhoneId = phoneId;
            phoneNumber.status = "active";
            phoneNumber.lastSynced = new Date();
          } else {
            console.warn("ElevenLabs response did not include phone ID. Full response:", JSON.stringify(response, null, 2));
            // Still mark as active since it was created successfully
            await storage.updatePhoneNumber(phoneNumber.id, user.organizationId, {
              status: "active",
              lastSynced: new Date()
            });
            phoneNumber.status = "active";
            phoneNumber.lastSynced = new Date();
          }
        } catch (elevenLabsError: any) {
          console.error("Warning: Could not validate with ElevenLabs:", elevenLabsError.message);
          // Phone number remains in pending status - user can fix credentials later
          // This follows the Vapi/Synthflow pattern of allowing import without immediate validation
        }
      }
      res.json(phoneNumber);
    } catch (error) {
      console.error("Error creating phone number:", error);
      res.status(500).json({ message: "Failed to create phone number" });
    }
  });

  app.patch("/api/phone-numbers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const updates = req.body;

      // Encrypt sensitive data if provided
      if (updates.twilioAuthToken) {
        updates.twilioAuthToken = encryptApiKey(updates.twilioAuthToken);
      }
      if (updates.sipPassword) {
        updates.sipPassword = encryptApiKey(updates.sipPassword);
      }

      const phoneNumber = await storage.updatePhoneNumber(id, user.organizationId, updates);
      res.json(phoneNumber);
    } catch (error) {
      console.error("Error updating phone number:", error);
      res.status(500).json({ message: "Failed to update phone number" });
    }
  });
  
  // Verify phone number with ElevenLabs
  app.post("/api/phone-numbers/:id/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const phoneNumber = await storage.getPhoneNumber(id, user.organizationId);
      
      if (!phoneNumber) {
        return res.status(404).json({ message: "Phone number not found" });
      }
      
      // Try to sync with ElevenLabs
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ 
          message: "ElevenLabs integration not configured. Please add your ElevenLabs API key in the integrations section.",
          status: "pending" 
        });
      }
      
      try {
        const decryptedKey = decryptApiKey(integration.apiKey);
        
        // Format phone number for ElevenLabs in E.164 format
        const cleanPhoneNumber = phoneNumber.phoneNumber.replace(/\D/g, '');
        // Get the country code without the + sign
        const rawCountryCode = (phoneNumber.countryCode || '+1').replace('+', '');
        
        // Check if the phone number already starts with the country code
        // If it does, don't add it again
        let formattedPhoneNumber;
        if (cleanPhoneNumber.startsWith(rawCountryCode)) {
          // Phone number already includes country code
          formattedPhoneNumber = '+' + cleanPhoneNumber;
        } else {
          // Add country code to phone number
          formattedPhoneNumber = '+' + rawCountryCode + cleanPhoneNumber;
        }
        
        // Create phone number in ElevenLabs
        const elevenLabsPayload: any = {
          label: phoneNumber.label,
          phone_number: formattedPhoneNumber,
        };

        if (phoneNumber.provider === "twilio") {
          if (!phoneNumber.twilioAccountSid || !phoneNumber.twilioAuthToken) {
            return res.status(400).json({ 
              message: "Twilio credentials are missing. Please edit the phone number to add your Twilio Account SID and Auth Token.",
              status: "pending" 
            });
          }
          
          elevenLabsPayload.provider = "twilio";
          elevenLabsPayload.sid = phoneNumber.twilioAccountSid;
          const decryptedToken = decryptApiKey(phoneNumber.twilioAuthToken);
          elevenLabsPayload.token = decryptedToken;
        } else if (phoneNumber.provider === "sip_trunk") {
          elevenLabsPayload.provider = "sip";
          if (phoneNumber.sipTrunkUri) {
            elevenLabsPayload.sip_uri = phoneNumber.sipTrunkUri;
          }
        }

        const response = await callElevenLabsAPI(
          decryptedKey,
          "/v1/convai/phone-numbers",
          "POST",
          elevenLabsPayload
        );

        if (response.phone_id) {
          // Update the phone number status to active after successful sync
          await storage.updatePhoneNumber(phoneNumber.id, user.organizationId, {
            elevenLabsPhoneId: response.phone_id,
            status: "active",
            lastSynced: new Date()
          });
          
          res.json({ 
            status: "active",
            message: "Phone number successfully verified and activated",
            elevenLabsPhoneId: response.phone_id 
          });
        } else {
          res.json({ 
            status: "pending",
            message: "Verification completed but phone number not activated. Please check your credentials." 
          });
        }
      } catch (elevenLabsError: any) {
        console.error("ElevenLabs verification error:", elevenLabsError.message);
        
        // Parse error message for specific issues
        let errorMessage = "Unable to verify phone number with ElevenLabs.";
        if (elevenLabsError.message?.includes("Twilio") || elevenLabsError.message?.includes("Authenticate")) {
          errorMessage = "Invalid Twilio credentials. Please verify your Account SID and Auth Token are correct.";
        } else if (elevenLabsError.message?.includes("already exists")) {
          errorMessage = "This phone number is already registered with ElevenLabs.";
        }
        
        res.json({ 
          status: "pending",
          message: errorMessage,
          error: elevenLabsError.message 
        });
      }
    } catch (error: any) {
      console.error("Error verifying phone number:", error);
      res.status(500).json({ 
        message: error.message || "Failed to verify phone number",
        status: "pending" 
      });
    }
  });

  // Assign agent to phone number
  app.patch("/api/phone-numbers/:id/assign-agent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const { agentId } = req.body;

      // Get phone number to check it exists
      const phoneNumber = await storage.getPhoneNumber(id, user.organizationId);
      if (!phoneNumber) {
        return res.status(404).json({ message: "Phone number not found" });
      }

      // If agentId is provided, verify the agent exists
      let elevenLabsAgentId = null;
      if (agentId) {
        const agent = await storage.getAgent(agentId, user.organizationId);
        if (!agent) {
          return res.status(404).json({ message: "Agent not found" });
        }
        elevenLabsAgentId = agent.elevenLabsAgentId;
      }

      // Update phone number with agent assignment
      const updatedPhoneNumber = await storage.updatePhoneNumber(id, user.organizationId, {
        agentId: agentId,
        elevenLabsAgentId: elevenLabsAgentId
      });

      console.log("Phone number details for agent assignment:", {
        phoneNumberId: phoneNumber.id,
        elevenLabsPhoneId: phoneNumber.elevenLabsPhoneId,
        status: phoneNumber.status,
        agentId: agentId,
        elevenLabsAgentId: elevenLabsAgentId
      });

      // If phone number is synced with ElevenLabs (has elevenLabsPhoneId), update the assignment there
      // We check for elevenLabsPhoneId regardless of status to ensure sync happens
      if (phoneNumber.elevenLabsPhoneId) {
        const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
        if (integration && integration.apiKey) {
          try {
            const decryptedKey = decryptApiKey(integration.apiKey);
            
            // Update phone number in ElevenLabs with agent assignment
            // ElevenLabs expects just "agent_id" in the request body
            const payload: any = {};
            
            // Only include agent_id if we have one (to assign), otherwise empty payload (to unassign)
            if (elevenLabsAgentId) {
              payload.agent_id = elevenLabsAgentId;
            }
            
            console.log("Updating ElevenLabs phone number with payload:", payload);
            
            // Try PATCH first, then fall back to PUT if it fails
            let response;
            try {
              response = await callElevenLabsAPI(
                decryptedKey,
                `/v1/convai/phone-numbers/${phoneNumber.elevenLabsPhoneId}`,
                "PATCH",
                payload
              );
              console.log("ElevenLabs PATCH response:", response);
            } catch (patchError: any) {
              console.log("PATCH failed, trying PUT:", patchError.message);
              response = await callElevenLabsAPI(
                decryptedKey,
                `/v1/convai/phone-numbers/${phoneNumber.elevenLabsPhoneId}`,
                "PUT",
                payload
              );
              console.log("ElevenLabs PUT response:", response);
            }
          } catch (elevenLabsError: any) {
            console.error("Error updating agent assignment in ElevenLabs:", elevenLabsError.message || elevenLabsError);
            // Continue even if ElevenLabs update fails - local update is still valid
          }
        } else {
          console.log("No ElevenLabs integration found, skipping sync");
        }
      } else {
        console.log("Phone number has no elevenLabsPhoneId, skipping ElevenLabs sync");
      }

      res.json(updatedPhoneNumber);
    } catch (error) {
      console.error("Error assigning agent to phone number:", error);
      res.status(500).json({ message: "Failed to assign agent to phone number" });
    }
  });

  // Re-sync phone number with ElevenLabs (to fix missing IDs)
  app.post("/api/phone-numbers/:id/resync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const phoneNumber = await storage.getPhoneNumber(id, user.organizationId);
      
      if (!phoneNumber) {
        return res.status(404).json({ message: "Phone number not found" });
      }
      
      // Get ElevenLabs integration
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs integration not configured" });
      }
      
      const decryptedKey = decryptApiKey(integration.apiKey);
      
      // Get all phone numbers from ElevenLabs to find this one
      try {
        const elevenLabsPhones = await callElevenLabsAPI(
          decryptedKey,
          "/v1/convai/phone-numbers",
          "GET"
        );
        
        console.log("ElevenLabs phone numbers:", JSON.stringify(elevenLabsPhones, null, 2));
        
        // Format our phone number for comparison
        const cleanPhoneNumber = phoneNumber.phoneNumber.replace(/\D/g, '');
        const rawCountryCode = (phoneNumber.countryCode || '+1').replace('+', '');
        let formattedPhoneNumber;
        if (cleanPhoneNumber.startsWith(rawCountryCode)) {
          formattedPhoneNumber = '+' + cleanPhoneNumber;
        } else {
          formattedPhoneNumber = '+' + rawCountryCode + cleanPhoneNumber;
        }
        
        // Find matching phone number in ElevenLabs
        const matchingPhone = elevenLabsPhones.find((p: any) => 
          p.phone_number === formattedPhoneNumber || 
          p.label === phoneNumber.label
        );
        
        if (matchingPhone) {
          const phoneId = matchingPhone.phone_number_id || matchingPhone.id;
          
          // Update our database with the ElevenLabs ID
          await storage.updatePhoneNumber(phoneNumber.id, user.organizationId, {
            elevenLabsPhoneId: phoneId,
            status: "active",
            lastSynced: new Date()
          });
          
          res.json({ 
            message: "Phone number re-synced successfully",
            elevenLabsPhoneId: phoneId,
            status: "active"
          });
        } else {
          res.status(404).json({ 
            message: "Phone number not found in ElevenLabs. You may need to delete and re-import it.",
            searchedFor: formattedPhoneNumber
          });
        }
      } catch (error: any) {
        console.error("Error re-syncing phone number:", error);
        res.status(500).json({ message: error.message || "Failed to re-sync phone number" });
      }
    } catch (error) {
      console.error("Error in resync:", error);
      res.status(500).json({ message: "Failed to re-sync phone number" });
    }
  });

  app.delete("/api/phone-numbers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      
      // Get phone number to check if it has ElevenLabs ID
      const phoneNumber = await storage.getPhoneNumber(id, user.organizationId);
      if (!phoneNumber) {
        return res.status(404).json({ message: "Phone number not found" });
      }

      // Delete from ElevenLabs if synced
      if (phoneNumber.elevenLabsPhoneId) {
        const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
        if (integration && integration.apiKey) {
          try {
            const decryptedKey = decryptApiKey(integration.apiKey);
            await callElevenLabsAPI(
              decryptedKey,
              `/v1/convai/phone-numbers/${phoneNumber.elevenLabsPhoneId}`,
              "DELETE"
            );
          } catch (elevenLabsError) {
            console.error("Error deleting phone number from ElevenLabs:", elevenLabsError);
            // Continue with local deletion even if ElevenLabs deletion fails
          }
        }
      }

      await storage.deletePhoneNumber(id, user.organizationId);
      res.json({ message: "Phone number deleted successfully" });
    } catch (error) {
      console.error("Error deleting phone number:", error);
      res.status(500).json({ message: "Failed to delete phone number" });
    }
  });

  // Update agent settings
  app.patch("/api/agents/:agentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { agentId } = req.params;
      const updates = req.body;
      
      console.log("\n=== AGENT UPDATE REQUEST ===");
      console.log("Agent ID:", agentId);
      console.log("Updates received:", JSON.stringify(updates, null, 2));
      console.log("================================\n");

      // First, get the agent to get the ElevenLabs agent ID
      const agent = await storage.getAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // If we have any ElevenLabs-related updates, sync with ElevenLabs API
      const needsElevenLabsUpdate = updates.firstMessage !== undefined || 
                                     updates.systemPrompt !== undefined ||
                                     updates.language !== undefined ||
                                     updates.voiceId !== undefined || 
                                     updates.voiceSettings !== undefined ||
                                     updates.llmSettings !== undefined ||
                                     updates.tools !== undefined ||
                                     updates.dynamicVariables !== undefined ||
                                     updates.evaluationCriteria !== undefined ||
                                     updates.dataCollection !== undefined;

      if (needsElevenLabsUpdate && agent.elevenLabsAgentId) {
        const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
        if (integration && integration.apiKey) {
          const decryptedKey = decryptApiKey(integration.apiKey);
          
          try {
            // First, fetch the current agent configuration from ElevenLabs
            console.log("\n=== FETCHING CURRENT AGENT CONFIG ===");
            const currentAgentResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.elevenLabsAgentId}`, {
              headers: {
                "xi-api-key": decryptedKey,
                "Content-Type": "application/json",
              },
            });
            
            let currentAgentConfig: any = {};
            if (currentAgentResponse.ok) {
              currentAgentConfig = await currentAgentResponse.json();
              console.log("Current agent config fetched successfully");
            } else {
              console.error("Failed to fetch current agent config, using defaults");
            }
            
            // Build the update payload - COMPLETE OVERRIDE, not partial update
            const elevenLabsPayload: any = {
              name: updates.name || agent.name,
              conversation_config: {
                agent: {
                  prompt: {
                    prompt: updates.systemPrompt !== undefined ? updates.systemPrompt : (agent.systemPrompt || "You are a helpful AI assistant"),
                    first_message: updates.firstMessage !== undefined ? updates.firstMessage : (agent.firstMessage || "Hello! How can I help you today?"),
                    language: updates.language !== undefined ? updates.language : (agent.language || "en")
                  },
                  first_message: updates.firstMessage !== undefined ? updates.firstMessage : (agent.firstMessage || "Hello! How can I help you today?"),
                  language: updates.language !== undefined ? updates.language : (agent.language || "en")
                },
                turn: {
                  mode: "simultaneous",
                  threshold: 0.5
                },
                asr: {
                  quality: "high",
                  provider: "elevenlabs"
                }
              },
              platform_settings: {
                auth: {
                  mode: "open" // Allow all calls without authentication
                }
              }
            };

            // Add LLM settings if provided
            if (updates.llmSettings || agent.llmSettings) {
              const llmSettings = updates.llmSettings || agent.llmSettings;
              elevenLabsPayload.conversation_config.llm = {
                model: llmSettings.model || "gpt-4",
                temperature: llmSettings.temperature || 0.7,
                max_tokens: llmSettings.maxTokens || 150,
              };
            }

            // Always include complete TTS settings for full override
            const voiceSettings = updates.voiceSettings || agent.voiceSettings || {};
            elevenLabsPayload.conversation_config.tts = {
              voice_id: updates.voiceId || agent.voiceId || "21m00Tcm4TlvDq8ikWAM", // Default to Rachel voice
              agent_output_audio_format: "pcm_16000",
              optimize_streaming_latency: 3,
              stability: voiceSettings.stability !== undefined ? voiceSettings.stability : 0.5,
              similarity_boost: voiceSettings.similarityBoost !== undefined ? voiceSettings.similarityBoost : 0.75,
              style: voiceSettings.style !== undefined ? voiceSettings.style : 0,
              use_speaker_boost: voiceSettings.useSpeakerBoost !== undefined ? voiceSettings.useSpeakerBoost : true
            };


            // Add tools configuration if provided
            if (updates.tools || agent.tools) {
              const tools = updates.tools || agent.tools;
              const toolConfigs: any[] = [];
              
              // Handle system tools
              if (tools.systemTools) {
                // End call tool
                if (tools.systemTools.endCall?.enabled) {
                  toolConfigs.push({
                    type: 'system',
                    name: 'end_call',
                    description: tools.systemTools.endCall.description || 'Allows agent to end the call'
                  });
                }
                
                // Detect language tool
                if (tools.systemTools.detectLanguage?.enabled) {
                  toolConfigs.push({
                    type: 'system',
                    name: 'language_detection',
                    description: tools.systemTools.detectLanguage.description || 'Detect and switch languages',
                    config: {
                      supported_languages: tools.systemTools.detectLanguage.supportedLanguages || []
                    }
                  });
                }
                
                // Skip turn tool
                if (tools.systemTools.skipTurn?.enabled) {
                  toolConfigs.push({
                    type: 'system',
                    name: 'skip_turn',
                    description: tools.systemTools.skipTurn.description || 'Skip agent turn when user needs a moment'
                  });
                }
                
                // Transfer to agent tool
                if (tools.systemTools.transferToAgent?.enabled) {
                  toolConfigs.push({
                    type: 'system',
                    name: 'transfer_to_agent',
                    description: tools.systemTools.transferToAgent.description || 'Transfer to another AI agent',
                    config: {
                      target_agent_id: tools.systemTools.transferToAgent.targetAgentId
                    }
                  });
                }
                
                // Transfer to number tool
                if (tools.systemTools.transferToNumber?.enabled) {
                  toolConfigs.push({
                    type: 'system',
                    name: 'transfer_to_number',
                    description: tools.systemTools.transferToNumber.description || 'Transfer to human operator',
                    config: {
                      phone_numbers: tools.systemTools.transferToNumber.phoneNumbers || []
                    }
                  });
                }
                
                // Play keypad tone tool (DTMF)
                if (tools.systemTools.playKeypadTone?.enabled) {
                  toolConfigs.push({
                    type: 'system',
                    name: 'play_dtmf',
                    description: tools.systemTools.playKeypadTone.description || 'Play keypad touch tones'
                  });
                }
                
                // Voicemail detection tool
                if (tools.systemTools.voicemailDetection?.enabled) {
                  toolConfigs.push({
                    type: 'system',
                    name: 'voicemail_detection',
                    description: tools.systemTools.voicemailDetection.description || 'Detect voicemail systems',
                    config: {
                      leave_message: tools.systemTools.voicemailDetection.leaveMessage || false,
                      message_content: tools.systemTools.voicemailDetection.messageContent
                    }
                  });
                }
              }
              
              // Handle custom tools (webhooks, integrations)
              if (tools.customTools && tools.customTools.length > 0) {
                for (const customTool of tools.customTools) {
                  if (customTool.enabled && customTool.name) {
                    if (customTool.type === 'webhook' && customTool.url) {
                      try {
                        // Create webhook tool in ElevenLabs
                        const toolResponse = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
                          method: 'POST',
                          headers: {
                            'xi-api-key': decryptedKey,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            type: 'webhook',
                            name: customTool.name,
                            description: customTool.description || '',
                            webhook: {
                              url: customTool.url,
                              method: customTool.method || 'POST',
                              headers: customTool.headers || {}
                            },
                          }),
                        });
                        
                        if (toolResponse.ok) {
                          const toolData = await toolResponse.json();
                          toolConfigs.push({
                            type: 'custom',
                            tool_id: toolData.tool_id,
                            name: customTool.name
                          });
                        } else {
                          console.error(`Failed to create webhook tool ${customTool.name}:`, await toolResponse.text());
                        }
                      } catch (toolError) {
                        console.error(`Error creating webhook tool ${customTool.name}:`, toolError);
                      }
                    }
                  }
                }
              }
              
              // Set tools configuration in payload
              if (toolConfigs.length > 0) {
                elevenLabsPayload.conversation_config.agent.tools = toolConfigs;
              }
            }

            // Add dynamic variables if provided
            if (updates.dynamicVariables || agent.dynamicVariables) {
              const vars = updates.dynamicVariables || agent.dynamicVariables;
              if (vars && Object.keys(vars).length > 0) {
                elevenLabsPayload.conversation_config.agent.dynamic_variables = vars;
              }
            }

            // Add evaluation criteria if provided
            if (updates.evaluationCriteria || agent.evaluationCriteria) {
              const evaluation = updates.evaluationCriteria || agent.evaluationCriteria;
              if (evaluation.enabled && evaluation.criteria) {
                elevenLabsPayload.platform_settings = {
                  ...elevenLabsPayload.platform_settings,
                  evaluation: {
                    criteria: evaluation.criteria.map((c: string) => ({
                      name: c,
                      description: `Evaluate if ${c}`,
                      type: "boolean"
                    }))
                  }
                };
              }
            }

            // Add data collection settings if provided
            if (updates.dataCollection || agent.dataCollection) {
              const collection = updates.dataCollection || agent.dataCollection;
              if (collection.enabled && collection.fields) {
                elevenLabsPayload.platform_settings = {
                  ...elevenLabsPayload.platform_settings,
                  data_collection: {
                    fields: collection.fields
                  }
                };
              }
            }

            console.log("\n=== UPDATING ELEVENLABS AGENT ===");
            console.log("Agent ID:", agent.elevenLabsAgentId);
            console.log("Payload:", JSON.stringify(elevenLabsPayload, null, 2));

            // Try updating with PUT instead of PATCH if PATCH fails
            let response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.elevenLabsAgentId}`, {
              method: "PATCH",
              headers: {
                "xi-api-key": decryptedKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(elevenLabsPayload),
            });
            
            // If PATCH fails with 500, try a simpler update with just the conversation config
            if (response.status === 500) {
              console.log("\n=== PATCH failed, trying simpler update ===");
              const simplePayload = {
                conversation_config: {
                  agent: {
                    prompt: updates.systemPrompt !== undefined ? updates.systemPrompt : agent.systemPrompt,
                    first_message: updates.firstMessage !== undefined ? updates.firstMessage : agent.firstMessage,
                  }
                }
              };
              
              response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.elevenLabsAgentId}`, {
                method: "PATCH",
                headers: {
                  "xi-api-key": decryptedKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(simplePayload),
              });
            }

            if (!response.ok) {
              const errorText = await response.text();
              console.error("\n=== ELEVENLABS UPDATE FAILED ===");
              console.error("Status:", response.status);
              console.error("Error:", errorText);
              console.error("================================\n");
              // Continue anyway - we'll still update locally
            } else {
              const responseData = await response.json();
              console.log("\n=== ELEVENLABS UPDATE SUCCESS ===");
              console.log("Response:", JSON.stringify(responseData, null, 2));
              console.log("================================\n");
            }
          } catch (elevenLabsError) {
            console.error("\n=== ELEVENLABS SYNC ERROR ===");
            console.error("Error:", elevenLabsError);
            console.error("================================\n");
            // Continue with local update even if ElevenLabs update fails
          }
        }
      }

      // Update the agent in our database
      const updatedAgent = await storage.updateAgent(agentId, user.organizationId, updates);
      res.json(updatedAgent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  // Call logs routes
  app.get("/api/call-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { limit = 50, offset = 0, agentId } = req.query;
      const callLogs = await storage.getCallLogs(
        user.organizationId,
        parseInt(limit as string),
        parseInt(offset as string),
        agentId as string
      );

      res.json(callLogs);
    } catch (error) {
      console.error("Error fetching call logs:", error);
      res.status(500).json({ message: "Failed to fetch call logs" });
    }
  });

  app.get("/api/call-logs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const callLog = await storage.getCallLog(req.params.id, user.organizationId);
      if (!callLog) {
        return res.status(404).json({ message: "Call log not found" });
      }

      res.json(callLog);
    } catch (error) {
      console.error("Error fetching call log:", error);
      res.status(500).json({ message: "Failed to fetch call log" });
    }
  });

  // Webhook endpoint for VoiceAI callbacks (new endpoint)
  app.post("/api/webhooks/voiceai", async (req, res) => {
    try {
      console.log("VoiceAI webhook received:", JSON.stringify(req.body, null, 2));
      
      const { type, data } = req.body;
      
      if (type === "post_call_transcription") {
        // Extract call data from webhook
        const {
          conversation_id,
          agent_id,
          transcript,
          duration_seconds,
          conversation_metadata,
          analysis
        } = data;

        // Find the agent in our system
        const agent = await storage.getAgentByElevenLabsId(agent_id, "");
        if (agent) {
          // Extract cost data if available from webhook
          const costData = {
            llm_cost: data.llm_cost,
            cost: data.cost,
            credits_used: data.credits_used,
          };
          
          // Store call log
          await storage.createCallLog({
            organizationId: agent.organizationId,
            agentId: agent.id,
            elevenLabsCallId: conversation_id,
            duration: duration_seconds || 0,
            transcript: transcript,
            audioUrl: "", // Will be populated from audio webhook if available
            cost: calculateCallCost(duration_seconds || 0, costData).toString(),
            status: "completed",
          });
          
          console.log("Call log saved for conversation:", conversation_id);
        }
      } else if (type === "post_call_audio") {
        // Update call log with audio URL
        const { conversation_id, full_audio } = data;
        
        // In production, you'd save the audio to cloud storage
        // For now, we'll just log that we received it
        console.log("Audio received for conversation:", conversation_id, "Size:", full_audio?.length || 0);
      }
      
      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });
  
  // Legacy webhook endpoint for backwards compatibility
  app.post("/api/webhooks/elevenlabs", async (req, res) => {
    try {
      console.log("Webhook received (legacy):", JSON.stringify(req.body, null, 2));
      
      const { type, data } = req.body;
      
      if (type === "post_call_transcription") {
        // Extract call data from webhook
        const {
          conversation_id,
          agent_id,
          transcript,
          duration_seconds,
          conversation_metadata,
          analysis
        } = data;

        // Find the agent in our system
        const agent = await storage.getAgentByElevenLabsId(agent_id, "");
        if (agent) {
          // Extract cost data if available from webhook
          const costData = {
            llm_cost: data.llm_cost,
            cost: data.cost,
            credits_used: data.credits_used,
          };
          
          // Store call log
          await storage.createCallLog({
            organizationId: agent.organizationId,
            agentId: agent.id,
            elevenLabsCallId: conversation_id,
            duration: duration_seconds || 0,
            transcript: transcript,
            audioUrl: "", // Will be populated from audio webhook if available
            cost: calculateCallCost(duration_seconds || 0, costData).toString(),
            status: "completed",
          });
          
          console.log("Call log saved for conversation:", conversation_id);
        }
      } else if (type === "post_call_audio") {
        // Update call log with audio URL
        const { conversation_id, full_audio } = data;
        
        // In production, you'd save the audio to cloud storage
        // For now, we'll just log that we received it
        console.log("Audio received for conversation:", conversation_id, "Size:", full_audio?.length || 0);
      }
      
      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Sync call logs from ElevenLabs API
  app.post("/api/sync-calls", isAuthenticated, async (req: any, res) => {
    console.log("=== SYNC CALLS REQUEST STARTED ===");
    try {
      const userId = req.user.id;
      console.log("User ID:", userId);
      
      const user = await storage.getUser(userId);
      if (!user) {
        console.log("User not found");
        return res.status(404).json({ message: "User not found" });
      }
      console.log("User found:", user.email, "Org ID:", user.organizationId);

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
        console.log("No active integration found");
        return res.status(400).json({ message: "Active ElevenLabs integration required" });
      }
      console.log("Integration found, status:", integration.status);

      const apiKey = decryptApiKey(integration.apiKey);
      console.log("API key decrypted successfully");
      
      const agents = await storage.getAgents(user.organizationId);
      console.log(`Found ${agents.length} agents to sync`);
      
      let totalSynced = 0;
      let totalErrors = 0;
      
      for (const agent of agents) {
        try {
          console.log(`\n--- Syncing agent: ${agent.name} (${agent.elevenLabsAgentId}) ---`);
          
          // Get conversations for this agent
          const conversations = await callElevenLabsAPI(
            apiKey, 
            `/v1/convai/conversations?agent_id=${agent.elevenLabsAgentId}&page_size=100`
          );
          
          console.log(`API response:`, conversations);
          console.log(`Found ${conversations.conversations?.length || 0} conversations for agent ${agent.name}`);
          
          for (const conversation of conversations.conversations || []) {
            try {
              console.log(`\n  Processing conversation: ${conversation.conversation_id}`);
              
              // Check if we already have this call log
              const existing = await storage.getCallLogByElevenLabsId(conversation.conversation_id, user.organizationId);
              if (existing) {
                console.log(`  Conversation ${conversation.conversation_id} already exists, skipping`);
                continue;
              }
              
              console.log(`  Fetching details for conversation: ${conversation.conversation_id}`);
              
              // Get detailed conversation data
              const details = await callElevenLabsAPI(
                apiKey,
                `/v1/convai/conversations/${conversation.conversation_id}`
              );
              
              console.log(`  Conversation details received:`, {
                id: details.conversation_id || details.id,
                duration: details.call_duration_secs,
                hasTranscript: !!details.transcript,
                transcriptLength: details.transcript?.length || 0,
                hasAudio: !!(details.audio_url || details.recording_url || details.audio || details.media_url)
              });
              
              // Try to get audio URL from the conversation details
              let audioUrl = "";
              
              // Check for audio in the response
              if (details.audio_url) {
                audioUrl = details.audio_url;
              } else if (details.recording_url) {
                audioUrl = details.recording_url;
              } else if (details.recordings && details.recordings.length > 0) {
                // Sometimes recordings are in an array
                audioUrl = details.recordings[0].url || details.recordings[0].recording_url || "";
              }
              
              // If no direct audio URL, use our proxy endpoint
              if (!audioUrl && conversation.conversation_id) {
                // Use our proxy endpoint that will fetch the audio with authentication
                audioUrl = `/api/audio/${conversation.conversation_id}`;
                console.log(`  Using proxy audio URL for conversation: ${conversation.conversation_id}`);
              }
              
              console.log(`  Audio URL found: ${audioUrl ? 'Yes' : 'No'}`);
              
              // Extract cost data from ElevenLabs response
              const costData = {
                llm_cost: details.llm_cost || conversation.llm_cost,
                cost: details.cost || conversation.cost,
                credits_used: details.credits_used || conversation.credits_used,
              };
              
              // Create call log with proper field mapping including timestamp
              const callData = {
                organizationId: user.organizationId,
                agentId: agent.id,
                elevenLabsCallId: conversation.conversation_id,
                duration: details.call_duration_secs || conversation.call_duration_secs || 0,
                transcript: details.transcript || "",
                audioUrl: audioUrl || "",
                cost: calculateCallCost(
                  details.call_duration_secs || conversation.call_duration_secs || 0,
                  costData
                ).toString(),
                status: "completed",
                // Use the actual call start time from ElevenLabs
                createdAt: conversation.start_time_unix_secs 
                  ? new Date(conversation.start_time_unix_secs * 1000)
                  : new Date(),
              };
              
              console.log("  Creating call log with data:", callData);
              const savedLog = await storage.createCallLog(callData);
              console.log("  Call log created successfully:", savedLog.id);
              
              totalSynced++;
            } catch (convError: any) {
              console.error(`  Error processing conversation ${conversation.conversation_id}:`, convError.message);
              totalErrors++;
            }
          }
        } catch (agentError: any) {
          console.error(`Error syncing calls for agent ${agent.id}:`, agentError.message);
          totalErrors++;
        }
      }
      
      console.log(`\n=== SYNC COMPLETE ===`);
      console.log(`Total synced: ${totalSynced}`);
      console.log(`Total errors: ${totalErrors}`);
      
      const message = totalSynced > 0 
        ? `Successfully synced ${totalSynced} new call logs` 
        : totalErrors > 0 
          ? `Sync completed with ${totalErrors} errors. No new calls found.`
          : "No new calls found to sync";
          
      res.json({ message, totalSynced, totalErrors });
    } catch (error: any) {
      console.error("=== SYNC FAILED ===", error);
      res.status(500).json({ message: `Failed to sync calls: ${error.message}` });
    }
  });

  // Audio proxy endpoint for ElevenLabs recordings
  app.get("/api/audio/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { conversationId } = req.params;
      
      // Get the ElevenLabs integration to get the API key
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
        return res.status(400).json({ message: "Active ElevenLabs integration required" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      // Fetch the audio from ElevenLabs
      const audioResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
        {
          headers: {
            "xi-api-key": apiKey,
          },
        }
      );

      if (!audioResponse.ok) {
        console.error(`Failed to fetch audio for conversation ${conversationId}: ${audioResponse.status}`);
        return res.status(404).json({ message: "Audio not found" });
      }

      // Stream the audio response to the client
      res.setHeader("Content-Type", audioResponse.headers.get("Content-Type") || "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      
      const audioBuffer = await audioResponse.arrayBuffer();
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("Error fetching audio:", error);
      res.status(500).json({ message: "Failed to fetch audio" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/organization", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const stats = await storage.getOrganizationStats(user.organizationId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Webhook endpoint for ElevenLabs
  app.post("/api/webhooks/elevenlabs", async (req, res) => {
    try {
      const { agent_id, duration, transcript, audio_url, cost } = req.body;

      if (!agent_id) {
        return res.status(400).json({ message: "agent_id is required" });
      }

      // Find the agent to get organization context
      // Note: This is a simplified approach - in production you might want additional verification
      const agents = await storage.getAgents(""); // This would need organization context
      const agent = agents.find(a => a.elevenLabsAgentId === agent_id);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const callLogData = insertCallLogSchema.parse({
        organizationId: agent.organizationId,
        agentId: agent.id,
        elevenLabsCallId: req.body.call_id,
        duration,
        transcript,
        audioUrl: audio_url,
        cost,
        status: "completed",
      });

      const callLog = await storage.createCallLog(callLogData);
      res.json({ message: "Webhook processed successfully", id: callLog.id });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Payment Routes
  app.post("/api/payments/create-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { packageId, amount } = req.body;
      const organizationId = req.user.organizationId;
      
      // Check if Stripe is configured
      const stripe = await import('./stripe');
      if (!stripe.isStripeConfigured()) {
        return res.status(400).json({ 
          error: 'Payment gateway is not configured. Please contact support.' 
        });
      }
      
      await stripe.createPaymentIntent({ 
        body: { organizationId, packageId, amount } 
      } as any, res);
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  app.post("/api/payments/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const stripe = await import('./stripe');
      await stripe.confirmPayment(req, res);
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  app.post("/api/payments/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const { priceId } = req.body;
      const organizationId = req.user.organizationId;
      const email = req.user.email;
      
      const stripe = await import('./stripe');
      await stripe.createSubscription({ 
        body: { organizationId, priceId, email } 
      } as any, res);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Stripe webhook endpoint (no auth required)
  app.post("/api/webhooks/stripe", async (req, res) => {
    try {
      const stripe = await import('./stripe');
      await stripe.handleWebhook(req, res);
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ error: "Webhook processing failed" });
    }
  });

  // Get payment history for an organization
  app.get("/api/payments/history", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const paymentHistory = await storage.getPaymentHistory(organizationId);
      res.json(paymentHistory);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  });

  // Playground - Start ElevenLabs session
  app.post("/api/playground/start-session", isAuthenticated, async (req: any, res) => {
    try {
      const { agentId } = req.body;
      const userId = req.user.id;
      
      console.log("Starting playground session with agent:", agentId);

      if (!agentId) {
        return res.status(400).json({ message: "Agent ID is required" });
      }

      // Get user and organization
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get ElevenLabs API key
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
        return res.status(400).json({ message: "VoiceAI integration not configured or inactive. Please configure your API key in the Integrations tab." });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      // Get signed URL from ElevenLabs for WebSocket connection
      // According to ElevenLabs docs, we need to use the conversation endpoint
      const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`;
      console.log("Calling VoiceAI API:", url);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        }
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error("ElevenLabs API error:", responseText);
        console.error("Status:", response.status);
        
        // Parse error message
        let errorMessage = "Failed to start conversation session";
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.detail?.message) {
            errorMessage = errorData.detail.message;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          errorMessage = responseText || `ElevenLabs API returned ${response.status}`;
        }
        
        // Provide specific error messages
        if (response.status === 401) {
          errorMessage = "Invalid API key. Please check your ElevenLabs API key in the Integrations tab.";
        } else if (response.status === 404) {
          errorMessage = "Agent not found. Please verify the agent ID is correct.";
        } else if (response.status === 403) {
          errorMessage = "Access denied. Your API key may not have permission to access this agent.";
        }
        
        return res.status(response.status).json({ 
          message: errorMessage
        });
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse ElevenLabs response:", responseText);
        return res.status(500).json({ message: "Invalid response from ElevenLabs API" });
      }
      
      console.log("ElevenLabs response:", data);
      
      // Validate the response has the required fields
      if (!data.signed_url) {
        console.error("No signed_url in response:", data);
        return res.status(500).json({ message: "Invalid response from ElevenLabs API: missing signed_url" });
      }
      
      // Return the signed URL for WebSocket connection
      res.json({ 
        signedUrl: data.signed_url,
        sessionId: data.conversation_id || null
      });
    } catch (error: any) {
      console.error("Error starting playground session:", error);
      res.status(500).json({ 
        message: error.message || "Failed to start session"
      });
    }
  });

  // Batch calling routes
  app.get("/api/batch-calls", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const batchCalls = await storage.getBatchCalls(organizationId);
      res.json(batchCalls);
    } catch (error: any) {
      console.error("Error fetching batch calls:", error);
      res.status(500).json({ error: error.message || "Failed to fetch batch calls" });
    }
  });

  app.post("/api/batch-calls", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;
      
      const batchCallData = insertBatchCallSchema.parse({
        ...req.body,
        organizationId,
        userId,
        status: "draft",
      });

      const batchCall = await storage.createBatchCall(batchCallData);
      res.json(batchCall);
    } catch (error: any) {
      console.error("Error creating batch call:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Invalid batch call data", details: error.errors });
      } else {
        res.status(500).json({ error: error.message || "Failed to create batch call" });
      }
    }
  });

  app.get("/api/batch-calls/:id", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const batchCall = await storage.getBatchCall(req.params.id, organizationId);
      
      if (!batchCall) {
        return res.status(404).json({ error: "Batch call not found" });
      }

      // Get recipients for this batch call
      const recipients = await storage.getBatchCallRecipients(req.params.id);
      
      res.json({ ...batchCall, recipients });
    } catch (error: any) {
      console.error("Error fetching batch call:", error);
      res.status(500).json({ error: error.message || "Failed to fetch batch call" });
    }
  });

  app.post("/api/batch-calls/:id/recipients", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const batchCall = await storage.getBatchCall(req.params.id, organizationId);
      
      if (!batchCall) {
        return res.status(404).json({ error: "Batch call not found" });
      }

      // Parse recipients from request body
      const { recipients } = req.body;
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "No recipients provided" });
      }

      // Create recipient records
      const recipientData = recipients.map((r: any) => {
        // Extract phone number and store all data as variables
        const phoneNumber = r.phone_number || r.phoneNumber;
        if (!phoneNumber) {
          throw new Error("Each recipient must have a phone_number field");
        }
        return {
          batchCallId: req.params.id,
          phoneNumber,
          variables: r, // Store all fields including overrides
        };
      });

      const createdRecipients = await storage.createBatchCallRecipients(recipientData);
      
      // Update batch call with total recipients count
      await storage.updateBatchCall(req.params.id, organizationId, {
        totalRecipients: createdRecipients.length,
      });

      res.json({ message: "Recipients added successfully", count: createdRecipients.length });
    } catch (error: any) {
      console.error("Error adding recipients:", error);
      res.status(500).json({ error: error.message || "Failed to add recipients" });
    }
  });

  app.post("/api/batch-calls/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required for test call" });
      }
      
      const batchCall = await storage.getBatchCall(req.params.id, organizationId);
      
      if (!batchCall) {
        return res.status(404).json({ error: "Batch call not found" });
      }

      // Get the integration
      const integration = await storage.getIntegration(organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
        return res.status(400).json({ 
          error: "ElevenLabs integration not configured or active" 
        });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      // Get agent details
      const agent = await storage.getAgent(batchCall.agentId, organizationId);
      if (!agent) {
        return res.status(400).json({ error: "Agent not found" });
      }

      // Get phone number details
      const phoneNumberRecord = await storage.getPhoneNumber(batchCall.phoneNumberId || "", organizationId);
      if (!phoneNumberRecord) {
        return res.status(400).json({ error: "Phone number not found" });
      }

      // Make a single test call using ElevenLabs conversational AI API
      // This creates a single outbound call for testing
      const payload = {
        agent_id: agent.elevenLabsAgentId,
        phone_number_id: phoneNumberRecord.elevenLabsPhoneId,
        customer_phone_number: phoneNumber,
        initial_message: "This is a test call for your batch calling campaign.",
      };

      // Call ElevenLabs to initiate the test call
      const response = await callElevenLabsAPI(
        apiKey,
        "/v1/convai/conversations",
        "POST",
        payload
      );

      res.json({ 
        message: "Test call initiated successfully", 
        conversationId: response.conversation_id || response.id,
        status: response.status
      });
    } catch (error: any) {
      console.error("Error initiating test call:", error);
      res.status(500).json({ error: error.message || "Failed to initiate test call" });
    }
  });

  app.post("/api/batch-calls/:id/submit", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const batchCall = await storage.getBatchCall(req.params.id, organizationId);
      
      if (!batchCall) {
        return res.status(404).json({ error: "Batch call not found" });
      }

      // Get the integration
      const integration = await storage.getIntegration(organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
        return res.status(400).json({ 
          error: "ElevenLabs integration not configured or active" 
        });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      // Get recipients
      const recipients = await storage.getBatchCallRecipients(req.params.id);
      if (recipients.length === 0) {
        return res.status(400).json({ error: "No recipients found for this batch call" });
      }

      // Get agent details
      const agent = await storage.getAgent(batchCall.agentId, organizationId);
      if (!agent) {
        return res.status(400).json({ error: "Agent not found" });
      }

      // Prepare ElevenLabs batch call payload
      const payload = {
        name: batchCall.name,
        agent_id: agent.elevenLabsAgentId,
        phone_number_id: batchCall.phoneNumberId,
        recipients: recipients.map(r => {
          const recipientData: any = {
            phone_number: r.phoneNumber,
          };
          
          // Add all variables including overrides
          if (r.variables && typeof r.variables === 'object') {
            // Include all fields from the CSV, ElevenLabs will handle overrides
            Object.entries(r.variables).forEach(([key, value]) => {
              // Skip undefined or empty string values for override fields
              if (value !== undefined && value !== '') {
                recipientData[key] = value;
              }
            });
          }
          
          return recipientData;
        }),
      };

      // Submit to ElevenLabs
      const response = await callElevenLabsAPI(
        apiKey,
        "/v1/convai/batch-calling",
        "POST",
        payload
      );

      // Update batch call with ElevenLabs ID and status
      await storage.updateBatchCall(req.params.id, organizationId, {
        elevenlabsBatchId: response.batch_id || response.id,
        status: "pending",
        startedAt: new Date(),
      });

      res.json({ 
        message: "Batch call submitted successfully", 
        batchId: response.batch_id || response.id 
      });
    } catch (error: any) {
      console.error("Error submitting batch call:", error);
      res.status(500).json({ error: error.message || "Failed to submit batch call" });
    }
  });

  app.delete("/api/batch-calls/:id", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      await storage.deleteBatchCall(req.params.id, organizationId);
      res.json({ message: "Batch call deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting batch call:", error);
      res.status(500).json({ error: error.message || "Failed to delete batch call" });
    }
  });

  // Admin: Get all payments
  app.get("/api/admin/payments", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allPayments = await storage.getAllPayments();
      res.json(allPayments);
    } catch (error) {
      console.error("Error fetching all payments:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Vector Database Document Routes
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  // Initialize vector database endpoint
  app.post("/api/vector-db/initialize", isAuthenticated, async (req: any, res) => {
    try {
      const { apiKey } = req.body;
      const { getVectorDatabaseService } = await import('./vectorDatabase');
      const vectorDb = getVectorDatabaseService();
      
      await vectorDb.initialize(apiKey);
      
      res.json({ message: "Vector database initialized successfully" });
    } catch (error: any) {
      console.error("Error initializing vector database:", error);
      res.status(500).json({ error: error.message || "Failed to initialize vector database" });
    }
  });

  // Upload documents endpoint
  app.post("/api/documents/upload", isAuthenticated, upload.array('files', 10), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const { agentId } = req.body;
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const { getDocumentProcessor } = await import('./documentProcessor');
      const { getVectorDatabaseService } = await import('./vectorDatabase');
      
      const processor = getDocumentProcessor();
      const vectorDb = getVectorDatabaseService();

      const results = [];
      
      for (const file of files) {
        // Check if file type is supported
        if (!processor.isFileTypeSupported(file.originalname)) {
          results.push({
            fileName: file.originalname,
            success: false,
            error: `File type not supported. Supported types: ${processor.getSupportedFileTypes().join(', ')}`
          });
          continue;
        }

        try {
          // Process the document
          const processed = await processor.processBuffer(file.buffer, file.originalname);
          
          // Add chunks to vector database
          const documents = processed.chunks.map((chunk, index) => ({
            content: chunk,
            metadata: {
              source: file.originalname,
              fileType: processed.metadata.fileType,
              pageNumber: index + 1,
              agentId
            }
          }));

          const ids = await vectorDb.addDocuments(documents);
          
          results.push({
            fileName: file.originalname,
            success: true,
            metadata: processed.metadata,
            chunksCreated: ids.length
          });
        } catch (error: any) {
          results.push({
            fileName: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      res.json({ results });
    } catch (error: any) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ error: error.message || "Failed to upload documents" });
    }
  });

  // Search documents endpoint
  app.post("/api/documents/search", isAuthenticated, async (req: any, res) => {
    try {
      const { query, agentId, limit = 5 } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const { getVectorDatabaseService } = await import('./vectorDatabase');
      const vectorDb = getVectorDatabaseService();
      
      const results = await vectorDb.searchDocuments(query, limit, agentId);
      
      res.json({ results });
    } catch (error: any) {
      console.error("Error searching documents:", error);
      res.status(500).json({ error: error.message || "Failed to search documents" });
    }
  });

  // Get document statistics endpoint
  app.get("/api/documents/stats", isAuthenticated, async (req: any, res) => {
    try {
      const { agentId } = req.query;
      
      const { getVectorDatabaseService } = await import('./vectorDatabase');
      const vectorDb = getVectorDatabaseService();
      
      const stats = await vectorDb.getDocumentStats(agentId as string);
      
      res.json(stats);
    } catch (error: any) {
      console.error("Error getting document stats:", error);
      res.status(500).json({ error: error.message || "Failed to get document statistics" });
    }
  });

  // Delete documents by source endpoint
  app.delete("/api/documents/source/:source", isAuthenticated, async (req: any, res) => {
    try {
      const { source } = req.params;
      
      const { getVectorDatabaseService } = await import('./vectorDatabase');
      const vectorDb = getVectorDatabaseService();
      
      await vectorDb.deleteDocumentsBySource(source);
      
      res.json({ message: `Documents from source '${source}' deleted successfully` });
    } catch (error: any) {
      console.error("Error deleting documents:", error);
      res.status(500).json({ error: error.message || "Failed to delete documents" });
    }
  });

  // Delete documents by agent endpoint
  app.delete("/api/documents/agent/:agentId", isAuthenticated, async (req: any, res) => {
    try {
      const { agentId } = req.params;
      
      const { getVectorDatabaseService } = await import('./vectorDatabase');
      const vectorDb = getVectorDatabaseService();
      
      await vectorDb.deleteDocumentsByAgent(agentId);
      
      res.json({ message: `Documents for agent '${agentId}' deleted successfully` });
    } catch (error: any) {
      console.error("Error deleting documents:", error);
      res.status(500).json({ error: error.message || "Failed to delete documents" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
