import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertIntegrationSchema, insertAgentSchema, insertCallLogSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

// ElevenLabs API helper
async function callElevenLabsAPI(apiKey: string, endpoint: string, method = "GET", body?: any) {
  const response = await fetch(`https://api.elevenlabs.io${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Encryption helpers
function encryptApiKey(apiKey: string): string {
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  return `${iv.toString("hex")}:${encrypted}`;
}

function decryptApiKey(encryptedApiKey: string): string {
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
  
  const [ivHex, encrypted] = encryptedApiKey.split(":");
  const iv = Buffer.from(ivHex, "hex");
  
  const decipher = crypto.createDecipher(algorithm, key);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("Fetching user for ID:", userId);
      const user = await storage.getUser(userId);
      if (!user) {
        console.log("User not found in database:", userId);
        return res.status(404).json({ message: "User not found" });
      }
      console.log("User found:", user.id, user.email);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Integration routes
  app.post("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.post("/api/integrations/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
        await callElevenLabsAPI(apiKey, "/v1/user");
        await storage.updateIntegrationStatus(integration.id, "ACTIVE", new Date());
        res.json({ message: "Connection successful", status: "ACTIVE" });
      } catch (error) {
        await storage.updateIntegrationStatus(integration.id, "ERROR", new Date());
        res.status(400).json({ message: "Connection failed", status: "ERROR" });
      }
    } catch (error) {
      console.error("Error testing integration:", error);
      res.status(500).json({ message: "Failed to test integration" });
    }
  });

  app.get("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
        const agentData = await callElevenLabsAPI(apiKey, `/v1/agents/${elevenLabsAgentId}`);
        res.json({ 
          message: "Agent validated successfully", 
          agentData: {
            id: agentData.id,
            name: agentData.name,
            description: agentData.description,
          }
        });
      } catch (error) {
        res.status(400).json({ message: "Invalid agent ID or API error" });
      }
    } catch (error) {
      console.error("Error validating agent:", error);
      res.status(500).json({ message: "Failed to validate agent" });
    }
  });

  app.post("/api/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

      const agent = await storage.createAgent(agentData);
      res.json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.get("/api/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // Call logs routes
  app.get("/api/call-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  // Analytics routes
  app.get("/api/analytics/organization", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  const httpServer = createServer(app);
  return httpServer;
}
