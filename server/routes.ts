import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertIntegrationSchema, insertAgentSchema, insertCallLogSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import type { RequestHandler } from "express";
import { seedAdminUser } from "./seedAdmin";

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
            const kbConfig = conversationConfig.knowledge_base || {};
            
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
            
            if (kbConfig.use_rag !== undefined) {
              agentData.knowledgeBase = {
                useRag: kbConfig.use_rag || false,
                maxChunks: kbConfig.max_chunks || 5,
                vectorDistance: kbConfig.vector_distance || 0.8,
                embeddingModel: kbConfig.embedding_model || 'e5_mistral_7b_instruct',
                documents: [],
              };
            }
            
            if (agentConfig.tool_ids) {
              agentData.tools = {
                toolIds: agentConfig.tool_ids,
                webhooks: [],
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

      // Delete the agent
      await storage.deleteAgent(agentId, user.organizationId);
      
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
      const agent = await storage.getAgent(user.organizationId, agentId);
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
                                     updates.knowledgeBase !== undefined ||
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
            
            // Build the update payload, preserving existing structure
            const elevenLabsPayload: any = {
              name: agent.name,
              conversation_config: {
                ...currentAgentConfig.conversation_config,
                agent: {
                  ...currentAgentConfig.conversation_config?.agent,
                  prompt: updates.systemPrompt !== undefined ? updates.systemPrompt : (agent.systemPrompt || ""),
                  first_message: updates.firstMessage !== undefined ? updates.firstMessage : (agent.firstMessage || ""),
                  language: updates.language !== undefined ? updates.language : (agent.language || "en"),
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

            // Add voice/TTS settings if provided
            if (updates.voiceId || updates.voiceSettings || agent.voiceId || agent.voiceSettings) {
              const voiceSettings = updates.voiceSettings || agent.voiceSettings || {};
              elevenLabsPayload.conversation_config.tts = {
                voice_id: updates.voiceId || agent.voiceId,
                agent_output_audio_format: "pcm_16000",
                optimize_streaming_latency: 3,
                stability: voiceSettings.stability || 0.5,
                similarity_boost: voiceSettings.similarityBoost || 0.75,
                style: voiceSettings.style || 0,
                use_speaker_boost: voiceSettings.useSpeakerBoost ?? true
              };
            }

            // Add knowledge base/RAG settings if provided
            if (updates.knowledgeBase || agent.knowledgeBase) {
              const kb = updates.knowledgeBase || agent.knowledgeBase;
              elevenLabsPayload.conversation_config.knowledge_base = {
                use_rag: kb.useRag || false,
                max_chunks: kb.maxChunks || 5,
                vector_distance: kb.vectorDistance || 0.8,
                embedding_model: kb.embeddingModel || "e5_mistral_7b_instruct",
              };
              
              // Handle knowledge base documents
              if (kb.documents && kb.documents.length > 0) {
                // First, get the agent's knowledge base ID from ElevenLabs
                const agentResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.elevenLabsAgentId}`, {
                  headers: {
                    "xi-api-key": decryptedKey,
                    "Content-Type": "application/json",
                  },
                });
                
                if (agentResponse.ok) {
                  const agentData = await agentResponse.json();
                  const knowledgeBaseId = agentData.knowledge_base_id || agentData.conversation_config?.knowledge_base?.knowledge_base_id;
                  
                  if (knowledgeBaseId) {
                    // Upload each document to the knowledge base
                    for (const doc of kb.documents) {
                      try {
                        if (doc.type === 'text') {
                          // Upload text content
                          const uploadResponse = await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${knowledgeBaseId}/add-from-text`, {
                            method: "POST",
                            headers: {
                              "xi-api-key": decryptedKey,
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              name: doc.name,
                              text: doc.content || '',
                            }),
                          });
                          
                          if (!uploadResponse.ok) {
                            console.error(`Failed to upload text document ${doc.name}:`, await uploadResponse.text());
                          }
                        } else if (doc.type === 'url') {
                          // Upload URL
                          const uploadResponse = await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${knowledgeBaseId}/add-from-url`, {
                            method: "POST",
                            headers: {
                              "xi-api-key": decryptedKey,
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              url: doc.url,
                              name: doc.name,
                            }),
                          });
                          
                          if (!uploadResponse.ok) {
                            console.error(`Failed to upload URL document ${doc.name}:`, await uploadResponse.text());
                          }
                        } else if (doc.type === 'file') {
                          // For file uploads, we'd need to handle the actual file content
                          // This would require storing the file content or URL somewhere
                          console.log(`File upload for ${doc.name} requires file content handling`);
                        }
                      } catch (docError) {
                        console.error(`Error uploading document ${doc.name}:`, docError);
                      }
                    }
                  } else {
                    // Create a new knowledge base if none exists
                    const createKbResponse = await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base`, {
                      method: "POST",
                      headers: {
                        "xi-api-key": decryptedKey,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        name: `${agent.name} Knowledge Base`,
                        description: `Knowledge base for ${agent.name}`,
                      }),
                    });
                    
                    if (createKbResponse.ok) {
                      const kbData = await createKbResponse.json();
                      const newKnowledgeBaseId = kbData.knowledge_base_id;
                      
                      // Associate the knowledge base with the agent
                      elevenLabsPayload.conversation_config.knowledge_base.knowledge_base_id = newKnowledgeBaseId;
                      
                      // Now upload documents to the new knowledge base
                      for (const doc of kb.documents) {
                        try {
                          if (doc.type === 'text') {
                            await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${newKnowledgeBaseId}/add-from-text`, {
                              method: "POST",
                              headers: {
                                "xi-api-key": decryptedKey,
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                name: doc.name,
                                text: doc.content || '',
                              }),
                            });
                          } else if (doc.type === 'url') {
                            await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${newKnowledgeBaseId}/add-from-url`, {
                              method: "POST",
                              headers: {
                                "xi-api-key": decryptedKey,
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                url: doc.url,
                                name: doc.name,
                              }),
                            });
                          }
                        } catch (docError) {
                          console.error(`Error uploading document ${doc.name}:`, docError);
                        }
                      }
                    }
                  }
                }
              }
            }

            // Add tools configuration if provided
            if (updates.tools || agent.tools) {
              const tools = updates.tools || agent.tools;
              
              // Handle webhook tools
              if (tools.webhooks && tools.webhooks.length > 0) {
                const webhookToolIds = [];
                
                for (const webhook of tools.webhooks) {
                  if (webhook.name && webhook.url) {
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
                          name: webhook.name,
                          description: webhook.description || '',
                          webhook: {
                            url: webhook.url,
                            method: webhook.method || 'POST',
                          },
                        }),
                      });
                      
                      if (toolResponse.ok) {
                        const toolData = await toolResponse.json();
                        webhookToolIds.push(toolData.tool_id);
                      } else {
                        console.error(`Failed to create webhook tool ${webhook.name}:`, await toolResponse.text());
                      }
                    } catch (toolError) {
                      console.error(`Error creating webhook tool ${webhook.name}:`, toolError);
                    }
                  }
                }
                
                // Combine webhook tool IDs with existing tool IDs
                const allToolIds = [...(tools.toolIds || []), ...webhookToolIds];
                if (allToolIds.length > 0) {
                  elevenLabsPayload.conversation_config.agent.tool_ids = allToolIds;
                }
              } else if (tools.toolIds && tools.toolIds.length > 0) {
                elevenLabsPayload.conversation_config.agent.tool_ids = tools.toolIds;
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
      const updatedAgent = await storage.updateAgent(user.organizationId, agentId, updates);
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

  const httpServer = createServer(app);
  return httpServer;
}
