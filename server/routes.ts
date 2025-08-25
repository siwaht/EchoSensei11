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
import { getVectorDatabaseService } from "./vectorDatabase";

// Authentication middleware
const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// ElevenLabs API helper
async function callElevenLabsAPI(apiKey: string, endpoint: string, method = "GET", body?: any, integrationId?: string) {
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
    
    // Check for authentication errors and mark integration as disconnected
    if ((response.status === 401 || response.status === 403) && integrationId) {
      console.log(`Authentication failed for integration ${integrationId}, marking as disconnected`);
      try {
        await storage.updateIntegrationStatus(integrationId, "ERROR", new Date());
      } catch (updateError) {
        console.error("Failed to update integration status:", updateError);
      }
    }
    
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
    
    // Add authentication-specific error messages
    if (response.status === 401) {
      errorMessage = "Authentication failed: Invalid API key. Please update your API key in Integrations.";
    } else if (response.status === 403) {
      errorMessage = "Access forbidden: Your API key may not have the required permissions.";
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
  
  // Google OAuth routes
  app.get('/api/auth/google', isAuthenticated, async (req: any, res) => {
    try {
      const { googleOAuthService } = await import('./services/google-oauth.js');
      
      // Check if OAuth is configured
      if (!googleOAuthService.isConfigured()) {
        return res.status(503).json({ 
          error: 'Google OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' 
        });
      }
      
      // Generate state token for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');
      req.session.googleOAuthState = state;
      req.session.googleOAuthReturnUrl = req.query.returnUrl || '/tools';
      
      const authUrl = googleOAuthService.getAuthUrl(state);
      res.json({ authUrl });
    } catch (error) {
      console.error('Google OAuth initiation error:', error);
      res.status(500).json({ error: 'Failed to initiate Google OAuth' });
    }
  });

  app.get('/api/auth/google/callback', async (req: any, res) => {
    try {
      const { googleOAuthService } = await import('./services/google-oauth.js');
      
      // Check if OAuth is configured
      if (!googleOAuthService.isConfigured()) {
        return res.status(503).send('Google OAuth is not configured');
      }
      
      const { code, state } = req.query;
      
      // Verify state token
      if (!state || state !== req.session.googleOAuthState) {
        return res.status(400).send('Invalid state token');
      }
      
      // Exchange code for tokens
      const tokens = await googleOAuthService.getTokens(code as string);
      
      // Get user info
      const userInfo = await googleOAuthService.getUserInfo(tokens.access_token!);
      
      // Save tokens to database
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;
      
      if (!userId || !organizationId) {
        return res.status(401).send('User not authenticated');
      }
      
      await googleOAuthService.saveTokens(
        organizationId,
        userId,
        userInfo.email,
        tokens
      );
      
      // Clear OAuth state
      delete req.session.googleOAuthState;
      const returnUrl = req.session.googleOAuthReturnUrl || '/tools';
      delete req.session.googleOAuthReturnUrl;
      
      // Redirect back to the app with success message
      res.redirect(`${returnUrl}?google_auth=success`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/tools?google_auth=error');
    }
  });
  
  app.post('/api/auth/google/disconnect', isAuthenticated, async (req: any, res) => {
    try {
      const { googleOAuthService } = await import('./services/google-oauth.js');
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;
      
      if (!userId || !organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      await googleOAuthService.removeTokens(organizationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Google OAuth disconnect error:', error);
      res.status(500).json({ error: 'Failed to disconnect Google account' });
    }
  });
  
  app.get('/api/auth/google/status', isAuthenticated, async (req: any, res) => {
    try {
      const { googleOAuthService } = await import('./services/google-oauth.js');
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;
      
      if (!userId || !organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Check if OAuth is configured
      if (!googleOAuthService.isConfigured()) {
        return res.json({
          connected: false,
          email: null,
          configured: false
        });
      }
      
      const hasTokens = await googleOAuthService.hasValidTokens(organizationId, userId);
      const tokens = hasTokens ? await googleOAuthService.getStoredTokens(organizationId, userId) : null;
      
      res.json({
        connected: hasTokens,
        email: tokens?.email || null,
        configured: true
      });
    } catch (error) {
      console.error('Google OAuth status error:', error);
      res.status(500).json({ error: 'Failed to check Google OAuth status' });
    }
  });

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
        const userData = await callElevenLabsAPI(apiKey, "/v1/user", "GET", undefined, integration.id);
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
        const agentData = await callElevenLabsAPI(apiKey, `/v1/convai/agents/${elevenLabsAgentId}`, "GET", undefined, integration.id);
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

  // Generate AI-powered system prompt from description
  app.post("/api/agents/generate-prompt", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { description } = req.body;
      if (!description || description.trim().length < 10) {
        return res.status(400).json({ message: "Please provide a more detailed description (at least 10 characters)" });
      }

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }

      // Generate system prompt using OpenAI
      const promptGenerationPrompt = `You are an expert AI prompt engineer. Generate a structured system prompt following the EXACT ElevenLabs format for: "${description}"

You MUST follow this EXACT format with markdown headers and structure:

# Personality
[Define agent identity, role, character traits. Use 2-4 sentences describing who the agent is, their background, and core personality traits]

# Environment  
[Describe where/how the agent operates. Mention communication medium, user context, and relevant situational factors. 2-3 sentences]

# Tone
[Specify conversational style. Include: natural speech patterns with brief affirmations like "Got it," "I see"; filler words like "actually," "essentially"; TTS optimization with strategic pauses (...); response length guidance; technical language adaptation. 4-6 sentences]

# Goal
[Define primary objectives and structured approach. Include numbered steps for handling interactions. Be specific about what success looks like. 3-5 sentences]

# Guardrails
[List boundaries and safety measures. Include: content limits, error handling, persona maintenance, professional standards. Use bullet points with - prefix]

# Tools
[List available capabilities. MUST include this exact text: "NEVER verbalize tool codes or function names to the user. NEVER say things like 'tool_code transfer_to_agent' or 'let me use the webhook tool'. When using tools, speak naturally without mentioning the technical process." Use bullet points with - prefix]

CRITICAL REQUIREMENTS:
1. Use EXACTLY these 6 section headers with # markdown formatting
2. Follow the structure shown above
3. Generate content that's specific to the agent description
4. Include the exact tool usage instruction shown above
5. Output ONLY the formatted prompt, no additional text

Example structure:
# Personality
You are [Name], a [role/identity with traits]. [Background/expertise]. [Key characteristics].

# Environment
[Context and medium]. [User situation]. [Available resources].

Generate the complete prompt now:`;

      console.log("Generating prompt for description:", description);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: promptGenerationPrompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("OpenAI API error:", errorData);
        return res.status(500).json({ message: "Failed to generate prompt" });
      }

      const data = await response.json();
      const generatedPrompt = data.choices[0]?.message?.content?.trim();

      if (!generatedPrompt) {
        return res.status(500).json({ message: "Failed to generate prompt" });
      }

      console.log("Prompt generated successfully");

      res.json({ 
        systemPrompt: generatedPrompt,
        description: description 
      });

    } catch (error) {
      console.error("Error generating prompt:", error);
      res.status(500).json({ message: "Failed to generate prompt" });
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
            language: language || "en",
            // Add default system tools - all enabled by default
            tools: [
              {
                type: 'system',
                name: 'end_call',
                description: 'Allows agent to end the call'
              },
              {
                type: 'system',
                name: 'language_detection',
                description: 'Automatically detect and switch languages',
                config: {
                  supported_languages: []
                }
              },
              {
                type: 'system',
                name: 'skip_turn',
                description: 'Skip agent turn when user needs a moment'
              },
              {
                type: 'system',
                name: 'transfer_to_agent',
                description: 'Transfer to another AI agent',
                config: {
                  target_agent_id: ""
                }
              },
              {
                type: 'system',
                name: 'transfer_to_number',
                description: 'Transfer to human operator',
                config: {
                  phone_numbers: []
                }
              },
              {
                type: 'system',
                name: 'play_dtmf',
                description: 'Play keypad touch tones'
              },
              {
                type: 'system',
                name: 'voicemail_detection',
                description: 'Detect voicemail systems',
                config: {
                  leave_message: false,
                  message_content: ""
                }
              }
            ]
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
            mode: "turn",
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
          },
          conversation_initiation_client_data_webhook: {
            enabled: false,
            url: ""
          },
          post_call_webhook: {
            enabled: false,
            url: ""
          }
        },
        client_config_override: {
          agent: {
            language: {},
            prompt: {
              prompt: {},
              first_message: {}
            },
            first_message: {},
            tools: {}
          },
          tts: {
            voice_id: {},
            stability: {},
            similarity_boost: {},
            style: {},
            use_speaker_boost: {},
            optimize_streaming_latency: {},
            agent_output_audio_format: {}
          },
          conversation: {
            text_only: {}
          },
          turn: {
            mode: {},
            threshold: {}
          },
          asr: {
            quality: {},
            provider: {}
          },
          llm: {
            model: {},
            temperature: {},
            max_tokens: {}
          },
          platform_settings: {
            conversation_initiation_client_data_webhook: {},
            post_call_webhook: {}
          }
        }
      };

      console.log("Creating agent on ElevenLabs:", agentPayload);
      
      const elevenLabsResponse = await callElevenLabsAPI(
        apiKey,
        "/v1/convai/agents/create",
        "POST",
        agentPayload,
        integration.id
      );

      console.log("ElevenLabs agent created:", elevenLabsResponse);

      // Save agent to our database with default tools configuration
      const agentData = insertAgentSchema.parse({
        organizationId: user.organizationId,
        elevenLabsAgentId: elevenLabsResponse.agent_id,
        name: name,
        description: `Created via VoiceAI Dashboard`,
        firstMessage: firstMessage,
        systemPrompt: systemPrompt,
        language: language || "en",
        voiceId: voiceId,
        isActive: true,
        // Save default tools configuration
        tools: {
          systemTools: {
            endCall: {
              enabled: true,
              description: "Allows agent to end the call"
            },
            detectLanguage: {
              enabled: true,
              description: "Automatically detect and switch languages",
              supportedLanguages: []
            },
            skipTurn: {
              enabled: true,
              description: "Skip agent turn when user needs a moment"
            },
            transferToAgent: {
              enabled: true,
              description: "Transfer to another AI agent",
              targetAgentId: ""
            },
            transferToNumber: {
              enabled: true,
              description: "Transfer to human operator",
              phoneNumbers: []
            },
            playKeypadTone: {
              enabled: true,
              description: "Play keypad touch tones"
            },
            voicemailDetection: {
              enabled: true,
              description: "Detect voicemail systems",
              leaveMessage: false,
              messageContent: ""
            }
          },
          webhooks: [],
          integrations: [],
          customTools: [],
          toolIds: []
        }
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
            
            
            // Always set up default tools with all system tools enabled
            agentData.tools = {
              systemTools: {
                endCall: {
                  enabled: true,
                  description: "Allows agent to end the call"
                },
                detectLanguage: {
                  enabled: true,
                  description: "Automatically detect and switch languages",
                  supportedLanguages: []
                },
                skipTurn: {
                  enabled: true,
                  description: "Skip agent turn when user needs a moment"
                },
                transferToAgent: {
                  enabled: true,
                  description: "Transfer to another AI agent",
                  targetAgentId: ""
                },
                transferToNumber: {
                  enabled: true,
                  description: "Transfer to human operator",
                  phoneNumbers: []
                },
                playKeypadTone: {
                  enabled: true,
                  description: "Play keypad touch tones"
                },
                voicemailDetection: {
                  enabled: true,
                  description: "Detect voicemail systems",
                  leaveMessage: false,
                  messageContent: ""
                }
              },
              webhooks: [],
              integrations: [],
              customTools: agentConfig.tool_ids ? agentConfig.tool_ids.map((id: string) => ({
                id,
                name: id,
                type: 'integration',
                enabled: true
              })) : [],
              toolIds: []
            };
            
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

      // Get ElevenLabs integration to sync agents
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (integration && integration.apiKey) {
        const decryptedKey = decryptApiKey(integration.apiKey);
        
        try {
          // Fetch all agents from ElevenLabs
          const elevenLabsResponse = await callElevenLabsAPI(
            decryptedKey,
            "/v1/convai/agents",
            "GET",
            undefined,
            integration.id
          );
          
          // Handle the response - ElevenLabs returns an object with agents array
          const elevenLabsAgents = elevenLabsResponse.agents || [];
          
          // Get local agents
          const localAgents = await storage.getAgents(user.organizationId);
          const localAgentsByElevenLabsId = new Map(
            localAgents.map(a => [a.elevenLabsAgentId, a])
          );
          
          // Sync agents from ElevenLabs
          const syncedAgents = [];
          
          for (const elevenLabsAgent of elevenLabsAgents) {
            const agentId = elevenLabsAgent.agent_id || elevenLabsAgent.id;
            const existingAgent = localAgentsByElevenLabsId.get(agentId);
            
            // Parse agent configuration from ElevenLabs
            const conversationConfig = elevenLabsAgent.conversation_config || {};
            const agentConfig = conversationConfig.agent || {};
            const promptConfig = agentConfig.prompt || {};
            const ttsConfig = conversationConfig.tts || {};
            const llmConfig = conversationConfig.llm || {};
            
            // Initialize with all system tools enabled by default
            const tools: any = {
              systemTools: {
                endCall: {
                  enabled: true,
                  description: "Allows agent to end the call"
                },
                detectLanguage: {
                  enabled: true,
                  description: "Automatically detect and switch languages",
                  supportedLanguages: []
                },
                skipTurn: {
                  enabled: true,
                  description: "Skip agent turn when user needs a moment"
                },
                transferToAgent: {
                  enabled: true,
                  description: "Transfer to another AI agent",
                  targetAgentId: ""
                },
                transferToNumber: {
                  enabled: true,
                  description: "Transfer to human operator",
                  phoneNumbers: []
                },
                playKeypadTone: {
                  enabled: true,
                  description: "Play keypad touch tones"
                },
                voicemailDetection: {
                  enabled: true,
                  description: "Detect voicemail systems",
                  leaveMessage: false,
                  messageContent: ""
                }
              },
              webhooks: [],
              integrations: [],
              customTools: [],
              toolIds: []
            };
            
            if (agentConfig.tools && Array.isArray(agentConfig.tools)) {
              for (const tool of agentConfig.tools) {
                if (tool.type === 'system') {
                  // Map ElevenLabs system tools to our format
                  switch (tool.name) {
                    case 'end_call':
                      tools.systemTools.endCall = {
                        enabled: true,
                        description: tool.description || "Allows agent to end the call"
                      };
                      break;
                    case 'language_detection':
                      tools.systemTools.detectLanguage = {
                        enabled: true,
                        description: tool.description || "Automatically detect and switch languages",
                        supportedLanguages: tool.config?.supported_languages || []
                      };
                      break;
                    case 'skip_turn':
                      tools.systemTools.skipTurn = {
                        enabled: true,
                        description: tool.description || "Skip agent turn when user needs a moment"
                      };
                      break;
                    case 'transfer_to_agent':
                      tools.systemTools.transferToAgent = {
                        enabled: true,
                        description: tool.description || "Transfer to another AI agent",
                        targetAgentId: tool.config?.target_agent_id || ""
                      };
                      break;
                    case 'transfer_to_number':
                      tools.systemTools.transferToNumber = {
                        enabled: true,
                        description: tool.description || "Transfer to human operator",
                        phoneNumbers: tool.config?.phone_numbers || []
                      };
                      break;
                    case 'play_dtmf':
                      tools.systemTools.playKeypadTone = {
                        enabled: true,
                        description: tool.description || "Play keypad touch tones"
                      };
                      break;
                    case 'voicemail_detection':
                      tools.systemTools.voicemailDetection = {
                        enabled: true,
                        description: tool.description || "Detect voicemail systems",
                        leaveMessage: tool.config?.leave_message || false,
                        messageContent: tool.config?.message_content || ""
                      };
                      break;
                  }
                } else if (tool.type === 'custom') {
                  tools.customTools.push({
                    id: tool.tool_id,
                    name: tool.name,
                    type: 'custom',
                    enabled: true,
                    description: tool.description
                  });
                  tools.toolIds.push(tool.tool_id);
                }
              }
            }
            
            const agentData = {
              organizationId: user.organizationId,
              elevenLabsAgentId: agentId,
              name: elevenLabsAgent.name || "Unnamed Agent",
              description: elevenLabsAgent.description || "Synced from ElevenLabs",
              firstMessage: promptConfig.first_message || agentConfig.first_message || "Hello! How can I help you today?",
              systemPrompt: promptConfig.prompt || "You are a helpful AI assistant",
              language: promptConfig.language || agentConfig.language || "en",
              voiceId: ttsConfig.voice_id || "21m00Tcm4TlvDq8ikWAM",
              voiceSettings: {
                stability: ttsConfig.stability ?? 0.5,
                similarityBoost: ttsConfig.similarity_boost ?? 0.75,
                style: ttsConfig.style ?? 0,
                useSpeakerBoost: ttsConfig.use_speaker_boost ?? true
              },
              llmSettings: llmConfig.model ? {
                model: llmConfig.model,
                temperature: llmConfig.temperature ?? 0.7,
                maxTokens: llmConfig.max_tokens ?? 150
              } : undefined,
              tools: tools,
              dynamicVariables: agentConfig.dynamic_variables || {},
              isActive: true,
              lastSynced: new Date()
            };
            
            if (existingAgent) {
              // Don't overwrite existing agent data - keep local data as source of truth
              // Just add the existing agent to the synced list without updating
              syncedAgents.push(existingAgent);
            } else {
              // Create new agent that exists in ElevenLabs but not locally
              const created = await storage.createAgent(agentData);
              syncedAgents.push(created);
            }
          }
          
          // Remove agents that no longer exist in ElevenLabs
          const elevenLabsAgentIds = new Set(elevenLabsAgents.map((a: any) => a.agent_id || a.id));
          for (const localAgent of localAgents) {
            if (localAgent.elevenLabsAgentId && !elevenLabsAgentIds.has(localAgent.elevenLabsAgentId)) {
              // Agent exists locally but not in ElevenLabs, mark as inactive or delete
              await storage.updateAgent(localAgent.id, user.organizationId, { isActive: false });
            }
          }
          
          // Return all active agents
          const allAgents = await storage.getAgents(user.organizationId);
          res.json(allAgents);
          
        } catch (syncError) {
          console.error("Error syncing with ElevenLabs:", syncError);
          // Fall back to local data if sync fails
          const agents = await storage.getAgents(user.organizationId);
          res.json(agents);
        }
      } else {
        // No integration, just return local agents
        const agents = await storage.getAgents(user.organizationId);
        res.json(agents);
      }
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  // Get a single agent with ElevenLabs sync
  app.get("/api/agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agentId = req.params.id;
      const agent = await storage.getAgent(agentId, user.organizationId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Don't sync from ElevenLabs - keep local data as source of truth
      // Just return the local agent data
      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  // Update agent and sync with ElevenLabs
  app.patch("/api/agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agentId = req.params.id;
      const updates = req.body;
      
      // Check if agent exists
      const agent = await storage.getAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // If agent has ElevenLabs ID and we're updating more than just isActive, sync with ElevenLabs
      if (agent.elevenLabsAgentId && Object.keys(updates).some(key => key !== 'isActive')) {
        const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
        if (integration && integration.apiKey) {
          try {
            const decryptedKey = decryptApiKey(integration.apiKey);
            
            // Convert updates to ElevenLabs format
            const elevenLabsPayload: any = {};
            
            if (updates.name !== undefined) {
              elevenLabsPayload.name = updates.name;
            }
            
            if (updates.firstMessage || updates.systemPrompt || updates.language || updates.voiceId || updates.voiceSettings || updates.llmSettings || updates.tools) {
              elevenLabsPayload.conversation_config = {};
              
              // Agent configuration
              if (updates.firstMessage || updates.systemPrompt || updates.language || updates.tools) {
                elevenLabsPayload.conversation_config.agent = {};
                
                // First message goes directly in agent, not in prompt
                if (updates.firstMessage) {
                  elevenLabsPayload.conversation_config.agent.first_message = updates.firstMessage;
                }
                
                // Check if RAG tool is enabled and enhance system prompt
                let enhancedSystemPrompt = updates.systemPrompt || agent.systemPrompt;
                
                // Add general tool usage instructions to prevent verbalizing tool codes
                const toolInstructions = '\n\n**CRITICAL TOOL USAGE INSTRUCTIONS:**\n' +
                  '- NEVER verbalize tool codes or function names to the user\n' +
                  '- NEVER say things like "tool_code transfer_to_agent" or "let me use the webhook tool"\n' +
                  '- When using tools, speak naturally without mentioning the technical process\n' +
                  '- For transfers: Simply say "I\'ll transfer you now" or "Let me connect you with..."\n' +
                  '- For searches: Say "Let me find that information for you" instead of mentioning tools\n' +
                  '- Tools are invoked automatically based on context - just speak naturally\n';
                
                if (enhancedSystemPrompt && !enhancedSystemPrompt.includes('CRITICAL TOOL USAGE INSTRUCTIONS')) {
                  enhancedSystemPrompt = enhancedSystemPrompt + toolInstructions;
                }
                
                if (updates.tools?.customTools) {
                  const ragTool = updates.tools.customTools.find((t: any) => t.type === 'rag' && t.enabled);
                  if (ragTool) {
                    const ragInstructions = '\n\nYou have a knowledge_base_rag webhook tool available. When users ask questions about information, people, companies, or facts, this tool will automatically search and provide relevant information.\n\n' +
                      'IMPORTANT: Use webhooks naturally in conversation:\n' +
                      '1. When a user asks a question, the webhook automatically searches based on their query\n' +
                      '2. Wait for the webhook response and incorporate it into your answer\n' +
                      '3. Speak naturally - don\'t mention you\'re "searching" or "using a tool"\n' +
                      '4. If no information is found, simply say you don\'t have that information\n\n' +
                      'The webhook extracts the search query from the conversation automatically. Just respond naturally based on what the webhook returns.';
                    if (enhancedSystemPrompt && !enhancedSystemPrompt.includes('knowledge_base_rag webhook')) {
                      enhancedSystemPrompt = enhancedSystemPrompt + ragInstructions;
                      console.log('Enhanced system prompt with RAG webhook instructions');
                    }
                  }
                }
                
                // System prompt and language go in the prompt object
                if (enhancedSystemPrompt || updates.language) {
                  elevenLabsPayload.conversation_config.agent.prompt = {
                    prompt: enhancedSystemPrompt,
                    language: updates.language || agent.language
                  };
                }
                
                // Convert tools to ElevenLabs format
                if (updates.tools) {
                  console.log('Received tools update from client:', JSON.stringify(updates.tools, null, 2));
                  const elevenLabsTools: any[] = [];
                  const systemTools = updates.tools.systemTools || {};
                  
                  // IMPORTANT: Only add tools that are explicitly enabled
                  // ElevenLabs interprets the presence of a tool in the array as enabling it
                  
                  if (systemTools.endCall?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "end_call",
                      description: systemTools.endCall.description || "Allows agent to end the call",
                      pre_tool_speech: systemTools.endCall.preToolSpeech || "Thank you for calling. Goodbye!"
                    };
                    if (systemTools.endCall.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.detectLanguage?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "language_detection",
                      description: systemTools.detectLanguage.description || "Automatically detect and switch languages",
                      pre_tool_speech: systemTools.detectLanguage.preToolSpeech || "I'll continue in your preferred language.",
                      config: {
                        supported_languages: systemTools.detectLanguage.supportedLanguages || []
                      }
                    };
                    if (systemTools.detectLanguage.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.skipTurn?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "skip_turn",
                      description: systemTools.skipTurn.description || "Skip agent turn when user needs a moment",
                      pre_tool_speech: systemTools.skipTurn.preToolSpeech || ""
                    };
                    if (systemTools.skipTurn.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.transferToAgent?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "transfer_to_agent",
                      description: systemTools.transferToAgent.description || "Transfer to another AI agent",
                      pre_tool_speech: systemTools.transferToAgent.preToolSpeech || "I'll transfer you to the right agent now."
                    };
                    
                    // Handle transfer rules for transfer_to_agent
                    if (systemTools.transferToAgent.transferRules && systemTools.transferToAgent.transferRules.length > 0) {
                      tool.transfer_rules = systemTools.transferToAgent.transferRules.map((rule: any) => ({
                        agent_id: rule.agentId,
                        condition: rule.condition,
                        delay_ms: rule.delayMs || 0,
                        transfer_message: rule.transferMessage || "",
                        enable_first_message: rule.enableFirstMessage !== false
                      }));
                    }
                    
                    if (systemTools.transferToAgent.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.transferToNumber?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "transfer_to_number",
                      description: systemTools.transferToNumber.description || "Transfer to human operator",
                      pre_tool_speech: systemTools.transferToNumber.preToolSpeech || "I'll connect you with a human agent right away.",
                      config: {
                        phone_numbers: (systemTools.transferToNumber.phoneNumbers || []).map((phone: any) => ({
                          number: phone.number,
                          label: phone.label,
                          condition: phone.condition || ""
                        }))
                      }
                    };
                    if (systemTools.transferToNumber.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.playKeypadTone?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "play_dtmf",
                      description: systemTools.playKeypadTone.description || "Play keypad touch tones",
                      pre_tool_speech: systemTools.playKeypadTone.preToolSpeech || ""
                    };
                    if (systemTools.playKeypadTone.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.voicemailDetection?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "voicemail_detection",
                      description: systemTools.voicemailDetection.description || "Detect voicemail systems",
                      pre_tool_speech: systemTools.voicemailDetection.preToolSpeech || "",
                      config: {
                        leave_message: systemTools.voicemailDetection.leaveMessage || false,
                        message_content: systemTools.voicemailDetection.messageContent || ""
                      }
                    };
                    if (systemTools.voicemailDetection.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  // Add MCP servers as webhooks
                  if (updates.tools.mcpServers && Array.isArray(updates.tools.mcpServers)) {
                    for (const mcpServer of updates.tools.mcpServers) {
                      if (mcpServer.enabled && mcpServer.url) {
                        const mcpTool: any = {
                          type: "webhook",
                          name: mcpServer.name || "mcp_server",
                          description: mcpServer.description || "MCP Server integration",
                          url: mcpServer.url,
                          method: "POST",
                          headers: mcpServer.headers || {},
                          query_parameters: [],
                          body_parameters: mcpServer.capabilities?.map((cap: any) => ({
                            identifier: cap.name,
                            data_type: "String",
                            required: cap.required || false,
                            value_type: "LLM Prompt",
                            description: cap.description || ""
                          })) || []
                        };
                        
                        // Add pre-tool speech if configured
                        if (mcpServer.preToolSpeech) {
                          mcpTool.pre_tool_speech = mcpServer.preToolSpeech;
                        }
                        
                        console.log('Adding MCP server as webhook:', mcpServer.name);
                        elevenLabsTools.push(mcpTool);
                      }
                    }
                  }
                  
                  // Add custom tools (webhooks, RAG, etc.)
                  if (updates.tools.customTools && Array.isArray(updates.tools.customTools)) {
                    for (const customTool of updates.tools.customTools) {
                      if (customTool.enabled) {
                        if (customTool.type === 'rag') {
                          // Add RAG tool as a webhook
                          const webhookUrl = process.env.REPLIT_DEV_DOMAIN 
                            ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/webhooks/rag-search`
                            : 'https://voiceai-dashboard.replit.app/api/webhooks/rag-search';
                          
                          const ragTool: any = {
                            type: "webhook",
                            name: customTool.name || "knowledge_base_rag",
                            description: "Searches the knowledge base for information about people, companies, facts, or documents. Automatically invoked when users ask questions.",
                            url: webhookUrl,
                            method: "GET",
                            headers: {},
                            query_parameters: [
                              {
                                identifier: "query",
                                data_type: "String",
                                required: true,
                                value_type: "LLM Prompt",
                                description: "Extract what the user is asking about. Examples: 'Who is John?' -> 'John', 'Tell me about company policy' -> 'company policy', 'What products do you sell?' -> 'products'"
                              }
                            ]
                          };
                          console.log('Adding RAG tool to agent with URL:', webhookUrl);
                          elevenLabsTools.push(ragTool);
                        } else if (customTool.type === 'webhook' && customTool.url) {
                          // Add regular webhooks with proper ElevenLabs format
                          const webhookTool: any = {
                            type: "webhook",
                            name: customTool.name,
                            description: customTool.description || "",
                            url: customTool.url,
                            method: customTool.method || "POST",
                            headers: customTool.headers || {},
                            query_parameters: customTool.queryParameters?.map((param: any) => ({
                              identifier: param.name,
                              data_type: param.type || "String",
                              required: param.required || false,
                              value_type: param.valueType || "LLM Prompt",
                              description: param.description || ""
                            })) || [],
                            body_parameters: customTool.bodyParameters?.map((param: any) => ({
                              identifier: param.name,
                              data_type: param.type || "String",
                              required: param.required || false,
                              value_type: param.valueType || "LLM Prompt",
                              description: param.description || ""
                            })) || [],
                            path_parameters: customTool.pathParameters?.map((param: any) => ({
                              identifier: param.name,
                              data_type: param.type || "String",
                              required: param.required || false,
                              value_type: param.valueType || "LLM Prompt",
                              description: param.description || ""
                            })) || []
                          };
                          elevenLabsTools.push(webhookTool);
                        }
                      }
                    }
                  }
                  
                  // Add configured webhooks with proper ElevenLabs format
                  if (updates.tools.webhooks && Array.isArray(updates.tools.webhooks)) {
                    for (const webhook of updates.tools.webhooks) {
                      if (webhook.enabled && webhook.url) {
                        // Ensure webhook has a valid name (required by ElevenLabs)
                        const webhookName = webhook.name && webhook.name.trim() 
                          ? webhook.name.replace(/\s+/g, '_').toLowerCase()
                          : `webhook_${Date.now()}`;
                        
                        const webhookTool: any = {
                          type: "webhook",
                          name: webhookName,
                          description: webhook.description || `Webhook tool ${webhookName}`,
                          url: webhook.url,
                          method: webhook.method || "POST",
                          headers: webhook.webhookConfig?.headers?.reduce((acc: any, header: any) => {
                            if (header.enabled && header.key) {
                              acc[header.key] = header.value || "";
                            }
                            return acc;
                          }, {}) || {},
                          query_parameters: webhook.webhookConfig?.queryParameters?.map((param: any) => ({
                            identifier: param.key || param.identifier,
                            data_type: param.dataType || "String",
                            required: param.required || false,
                            value_type: param.valueType || "LLM Prompt",
                            description: param.description || ""
                          })) || [],
                          body_parameters: webhook.webhookConfig?.bodyParameters?.map((param: any) => ({
                            identifier: param.identifier,
                            data_type: param.dataType || "String",
                            required: param.required || false,
                            value_type: param.valueType || "LLM Prompt",
                            description: param.description || ""
                          })) || [],
                          path_parameters: webhook.webhookConfig?.pathParameters?.map((param: any) => ({
                            identifier: param.key || param.identifier,
                            data_type: param.dataType || "String",
                            required: param.required || false,
                            value_type: param.valueType || "LLM Prompt",
                            description: param.description || ""
                          })) || []
                        };
                        console.log('Adding webhook tool to ElevenLabs:', JSON.stringify(webhookTool, null, 2));
                        elevenLabsTools.push(webhookTool);
                      }
                    }
                  }
                  
                  // Add a test webhook to verify the API works
                  // Uncomment this to test webhook functionality
                  if (updates.tools.webhooks && updates.tools.webhooks.length > 0) {
                    // Force add a simple test webhook to verify API accepts it
                    elevenLabsTools.push({
                      type: "webhook",
                      name: "simple_test",
                      description: "Simple test webhook",
                      url: "https://webhook.site/test123",
                      method: "GET"
                    });
                  }
                  
                  // Always send the tools array to ElevenLabs to ensure proper sync
                  // An empty array will clear all tools in ElevenLabs
                  elevenLabsPayload.conversation_config.agent.tools = elevenLabsTools;
                  
                  console.log('Final tools array being sent to ElevenLabs:', JSON.stringify(elevenLabsTools, null, 2));
                }
              }
              
              // TTS configuration
              if (updates.voiceId || updates.voiceSettings) {
                elevenLabsPayload.conversation_config.tts = {
                  voice_id: updates.voiceId || agent.voiceId,
                  ...(updates.voiceSettings ? {
                    stability: updates.voiceSettings.stability,
                    similarity_boost: updates.voiceSettings.similarityBoost,
                    style: updates.voiceSettings.style,
                    use_speaker_boost: updates.voiceSettings.useSpeakerBoost
                  } : {})
                };
              }
              
              // LLM configuration
              if (updates.llmSettings) {
                elevenLabsPayload.conversation_config.llm = {
                  model: updates.llmSettings.model,
                  temperature: updates.llmSettings.temperature,
                  max_tokens: updates.llmSettings.maxTokens
                };
              }
            }
            
            // Always add client_config_override to enable ALL overrides by default
            elevenLabsPayload.client_config_override = {
              agent: {
                language: {},
                prompt: {
                  prompt: {},
                  first_message: {}
                },
                first_message: {},
                tools: {}
              },
              tts: {
                voice_id: {},
                stability: {},
                similarity_boost: {},
                style: {},
                use_speaker_boost: {},
                optimize_streaming_latency: {},
                agent_output_audio_format: {}
              },
              conversation: {
                text_only: {}
              },
              turn: {
                mode: {},
                threshold: {}
              },
              asr: {
                quality: {},
                provider: {}
              },
              llm: {
                model: {},
                temperature: {},
                max_tokens: {}
              },
              platform_settings: {
                conversation_initiation_client_data_webhook: {},
                post_call_webhook: {}
              }
            };
            
            // Update in ElevenLabs if we have any changes
            if (Object.keys(elevenLabsPayload).length > 0) {
              console.log(`Updating agent in ElevenLabs with payload:`, JSON.stringify(elevenLabsPayload, null, 2));
              
              const response = await callElevenLabsAPI(
                decryptedKey,
                `/v1/convai/agents/${agent.elevenLabsAgentId}`,
                "PATCH",
                elevenLabsPayload,
                integration.id
              );
              
              console.log(`ElevenLabs update response:`, JSON.stringify(response, null, 2));
            }
          } catch (elevenLabsError) {
            console.error("Error updating agent in ElevenLabs:", elevenLabsError);
            // Continue with local update even if ElevenLabs sync fails
          }
        }
      }

      // Update local agent
      const updatedAgent = await storage.updateAgent(agentId, user.organizationId, {
        ...updates,
        lastSynced: new Date()
      });
      
      res.json(updatedAgent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ message: "Failed to update agent" });
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

  // Manual sync agents with ElevenLabs
  app.post("/api/agents/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs integration not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      
      // Fetch all agents from ElevenLabs
      const elevenLabsResponse = await callElevenLabsAPI(
        decryptedKey,
        "/v1/convai/agents",
        "GET",
        undefined,
        integration.id
      );
      
      // Handle the response - ElevenLabs returns an object with agents array
      const elevenLabsAgents = elevenLabsResponse.agents || [];
      
      let syncedCount = 0;
      let createdCount = 0;
      let updatedCount = 0;
      
      // Get local agents
      const localAgents = await storage.getAgents(user.organizationId);
      const localAgentsByElevenLabsId = new Map(
        localAgents.map(a => [a.elevenLabsAgentId, a])
      );
      
      for (const elevenLabsAgent of elevenLabsAgents) {
        const agentId = elevenLabsAgent.agent_id || elevenLabsAgent.id;
        const existingAgent = localAgentsByElevenLabsId.get(agentId);
        
        // Parse full agent configuration
        const conversationConfig = elevenLabsAgent.conversation_config || {};
        const agentConfig = conversationConfig.agent || {};
        const promptConfig = agentConfig.prompt || {};
        const ttsConfig = conversationConfig.tts || {};
        const llmConfig = conversationConfig.llm || {};
        
        // Parse tools
        const tools: any = {
          systemTools: {},
          webhooks: [],
          integrations: [],
          customTools: [],
          toolIds: []
        };
        
        if (agentConfig.tools && Array.isArray(agentConfig.tools)) {
          for (const tool of agentConfig.tools) {
            if (tool.type === 'system') {
              switch (tool.name) {
                case 'end_call':
                  tools.systemTools.endCall = { enabled: true, description: tool.description || "End call" };
                  break;
                case 'language_detection':
                  tools.systemTools.detectLanguage = { 
                    enabled: true, 
                    description: tool.description || "Detect language",
                    supportedLanguages: tool.config?.supported_languages || []
                  };
                  break;
                case 'skip_turn':
                  tools.systemTools.skipTurn = { enabled: true, description: tool.description || "Skip turn" };
                  break;
                case 'transfer_to_agent':
                  tools.systemTools.transferToAgent = { 
                    enabled: true, 
                    description: tool.description || "Transfer to agent",
                    targetAgentId: tool.config?.target_agent_id || ""
                  };
                  break;
                case 'transfer_to_number':
                  tools.systemTools.transferToNumber = { 
                    enabled: true, 
                    description: tool.description || "Transfer to number",
                    phoneNumbers: tool.config?.phone_numbers || []
                  };
                  break;
                case 'play_dtmf':
                  tools.systemTools.playKeypadTone = { enabled: true, description: tool.description || "Play DTMF" };
                  break;
                case 'voicemail_detection':
                  tools.systemTools.voicemailDetection = { 
                    enabled: true, 
                    description: tool.description || "Voicemail detection",
                    leaveMessage: tool.config?.leave_message || false,
                    messageContent: tool.config?.message_content || ""
                  };
                  break;
              }
            }
          }
        }
        
        const agentData = {
          organizationId: user.organizationId,
          elevenLabsAgentId: agentId,
          name: elevenLabsAgent.name || "Unnamed Agent",
          description: elevenLabsAgent.description || "Synced from ElevenLabs",
          firstMessage: promptConfig.first_message || agentConfig.first_message || "Hello!",
          systemPrompt: promptConfig.prompt || "You are a helpful assistant",
          language: promptConfig.language || agentConfig.language || "en",
          voiceId: ttsConfig.voice_id || "21m00Tcm4TlvDq8ikWAM",
          voiceSettings: {
            stability: ttsConfig.stability ?? 0.5,
            similarityBoost: ttsConfig.similarity_boost ?? 0.75,
            style: ttsConfig.style ?? 0,
            useSpeakerBoost: ttsConfig.use_speaker_boost ?? true
          },
          llmSettings: llmConfig.model ? {
            model: llmConfig.model,
            temperature: llmConfig.temperature ?? 0.7,
            maxTokens: llmConfig.max_tokens ?? 150
          } : undefined,
          tools: tools,
          dynamicVariables: agentConfig.dynamic_variables || {},
          isActive: true,
          lastSynced: new Date()
        };
        
        if (existingAgent) {
          await storage.updateAgent(existingAgent.id, user.organizationId, agentData);
          updatedCount++;
        } else {
          await storage.createAgent(agentData);
          createdCount++;
        }
        syncedCount++;
      }
      
      res.json({ 
        message: "Sync completed successfully",
        syncedCount,
        createdCount,
        updatedCount
      });
    } catch (error) {
      console.error("Error syncing agents:", error);
      res.status(500).json({ message: "Failed to sync agents" });
    }
  });


  // Get available VoiceAI voices - Updated with latest ElevenLabs API
  app.get("/api/voiceai/voices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      
      // Fetch voices from ElevenLabs API v1
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

  // Create voice clone - Latest ElevenLabs API endpoint
  app.post("/api/voiceai/voices/clone", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      const { name, description, files, remove_background_noise } = req.body;

      // Note: For actual implementation, files would need to be handled as multipart/form-data
      // This is a placeholder that shows the endpoint structure
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description || '');
      formData.append('remove_background_noise', String(remove_background_noise || false));
      
      // In a real implementation, files would be appended here
      // files.forEach((file: any) => formData.append('files', file));

      const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: {
          "xi-api-key": decryptedKey,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error cloning voice:", error);
      res.status(500).json({ message: "Failed to clone voice" });
    }
  });

  // Get single voice details - Latest ElevenLabs API endpoint
  app.get("/api/voiceai/voices/:voiceId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      const { voiceId } = req.params;
      
      const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        headers: {
          "xi-api-key": decryptedKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching voice details:", error);
      res.status(500).json({ message: "Failed to fetch voice details" });
    }
  });

  // Delete voice - Latest ElevenLabs API endpoint
  app.delete("/api/voiceai/voices/:voiceId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      const { voiceId } = req.params;
      
      const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: "DELETE",
        headers: {
          "xi-api-key": decryptedKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      res.json({ success: true, message: "Voice deleted successfully" });
    } catch (error) {
      console.error("Error deleting voice:", error);
      res.status(500).json({ message: "Failed to delete voice" });
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
            elevenLabsPayload,
            integration.id
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
          elevenLabsPayload,
          integration.id
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
                payload,
                integration.id
              );
              console.log("ElevenLabs PATCH response:", response);
            } catch (patchError: any) {
              console.log("PATCH failed, trying PUT:", patchError.message);
              response = await callElevenLabsAPI(
                decryptedKey,
                `/v1/convai/phone-numbers/${phoneNumber.elevenLabsPhoneId}`,
                "PUT",
                payload,
                integration.id
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
          "GET",
          undefined,
          integration.id
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
              "DELETE",
              undefined,
              integration.id
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
                  mode: "turn",
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

            // Add webhook settings if provided
            if (updates.tools || agent.tools) {
              const tools = updates.tools || agent.tools;
              
              // Add conversation initiation webhook
              if (tools.conversationInitiationWebhook) {
                elevenLabsPayload.platform_settings = {
                  ...elevenLabsPayload.platform_settings,
                  conversation_initiation_client_data_webhook: {
                    enabled: tools.conversationInitiationWebhook.enabled || false,
                    url: tools.conversationInitiationWebhook.url || ""
                  }
                };
              }
              
              // Add post-call webhook
              if (tools.postCallWebhook) {
                elevenLabsPayload.platform_settings = {
                  ...elevenLabsPayload.platform_settings,
                  post_call_webhook: {
                    enabled: tools.postCallWebhook.enabled || false,
                    url: tools.postCallWebhook.url || ""
                  }
                };
              }
            }

            // Always add client_config_override to enable ALL overrides by default
            elevenLabsPayload.client_config_override = {
              agent: {
                language: {},
                prompt: {
                  prompt: {},
                  first_message: {}
                },
                first_message: {},
                tools: {}
              },
              tts: {
                voice_id: {},
                stability: {},
                similarity_boost: {},
                style: {},
                use_speaker_boost: {},
                optimize_streaming_latency: {},
                agent_output_audio_format: {}
              },
              conversation: {
                text_only: {}
              },
              turn: {
                mode: {},
                threshold: {}
              },
              asr: {
                quality: {},
                provider: {}
              },
              llm: {
                model: {},
                temperature: {},
                max_tokens: {}
              },
              platform_settings: {
                conversation_initiation_client_data_webhook: {},
                post_call_webhook: {}
              }
            };
            
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

  // RAG Search Webhook endpoint for ElevenLabs agents
  // Test Webhook Tools for ElevenLabs Server Tools integration
  const handleSearchTool = async (req: any, res: any) => {
    try {
      console.log("=== SEARCH TOOL CALLED ===");
      console.log("Method:", req.method);
      console.log("Headers:", req.headers);
      console.log("Query Parameters:", req.query);
      console.log("Body:", req.body);
      
      // Get the search query from URL parameters (ElevenLabs Server Tools style)
      const searchQuery = req.query.query || req.query.q || req.body?.query || '';
      
      console.log("Search Query:", searchQuery);
      
      if (!searchQuery) {
        return res.json({
          error: "No search query provided",
          message: "Please provide a 'query' parameter",
          example: "?query=hotels in Paris"
        });
      }

      // Mock search results that the agent can use
      const mockResults = [
        {
          title: `Best ${searchQuery} - Option 1`,
          description: `Detailed information about ${searchQuery} with premium features and excellent reviews.`,
          rating: "4.8/5",
          location: "Prime location",
          price: "$150-300"
        },
        {
          title: `Popular ${searchQuery} - Option 2`, 
          description: `Highly rated ${searchQuery} with modern amenities and great customer service.`,
          rating: "4.6/5",
          location: "Central area",
          price: "$100-250"
        },
        {
          title: `Budget-friendly ${searchQuery} - Option 3`,
          description: `Affordable ${searchQuery} with good value for money and basic amenities.`,
          rating: "4.2/5", 
          location: "Convenient location",
          price: "$50-150"
        }
      ];

      // Return data in a format the agent can easily parse and use
      return res.json({
        success: true,
        query: searchQuery,
        results_count: mockResults.length,
        results: mockResults,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Search tool error:", error);
      res.status(500).json({ 
        success: false,
        error: "Search tool error occurred",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const handleInfoTool = async (req: any, res: any) => {
    try {
      console.log("=== INFO TOOL CALLED ===");
      console.log("Method:", req.method);
      console.log("Query Parameters:", req.query);
      console.log("Body:", req.body);
      
      const topic = req.query.topic || req.body?.topic || 'general';
      
      console.log("Info Topic:", topic);
      
      // Mock detailed information that the agent can use
      const mockInfo = {
        topic: topic,
        overview: `Comprehensive information about ${topic}`,
        key_points: [
          `${topic} is widely recognized for its quality and reliability`,
          `Key features include advanced functionality and user-friendly design`,
          `Popular among users for its effectiveness and versatility`
        ],
        details: {
          category: "Service/Product",
          availability: "Available 24/7",
          support: "Full customer support included",
          features: ["Feature A", "Feature B", "Feature C"]
        },
        recommendations: [
          "Best for first-time users",
          "Suitable for all experience levels", 
          "Highly recommended by experts"
        ]
      };

      return res.json({
        success: true,
        topic: topic,
        information: mockInfo,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Info tool error:", error);
      res.status(500).json({ 
        success: false,
        error: "Info tool error occurred",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // According to ElevenLabs docs, webhook tools use GET with query parameters
  const handleRagSearch = async (req: any, res: any) => {
    try {
      console.log("=== RAG WEBHOOK CALLED ===");
      console.log("Method:", req.method);
      console.log("Headers:", req.headers);
      console.log("Query Parameters:", req.query);
      console.log("Body:", req.body);
      
      // Get vector database service
      const vectorDb = getVectorDatabaseService();
      
      // Handle both GET (query params) and POST (body) for compatibility
      let searchQuery: string;
      let top_k: number = 5;
      
      if (req.method === 'GET') {
        // ElevenLabs standard: query parameters
        searchQuery = req.query.query as string;
        top_k = parseInt(req.query.top_k as string) || 5;
      } else {
        // Fallback for POST requests
        const { message, query } = req.body;
        searchQuery = message || query;
        top_k = req.body.top_k || 5;
      }
      
      console.log("Search query:", searchQuery);
      console.log("Top K:", top_k);
      
      if (!searchQuery) {
        return res.json({ 
          content: "I need a specific question to search the knowledge base. Please provide more details about what you'd like to know."
        });
      }

      // Initialize vector database
      await vectorDb.initialize();
      
      // Search the vector database
      const results = await vectorDb.searchDocuments(searchQuery, top_k);
      
      if (results.length === 0) {
        return res.json({ 
          content: "I couldn't find any relevant information in the knowledge base about that topic. Could you provide more context or rephrase your question?"
        });
      }

      // Format the response for the agent
      const formattedResults = results.map((result: any, index: number) => {
        return `[Source ${index + 1}]: ${result.content}`;
      }).join('\n\n');

      // ElevenLabs expects a 'content' field in the response
      const response = {
        content: formattedResults
      };

      console.log(`RAG search found ${results.length} results`);
      res.json(response);
      
    } catch (error) {
      console.error("Error in RAG search webhook:", error);
      res.json({ 
        content: "I'm having trouble accessing the knowledge base right now. Please try again in a moment."
      });
    }
  };

  // Support both GET (ElevenLabs standard) and POST (backward compatibility)
  app.get("/api/webhooks/rag-search", handleRagSearch);
  app.post("/api/webhooks/rag-search", handleRagSearch);

  // Server Tools test endpoints for ElevenLabs webhook tools
  app.get("/api/tools/search", handleSearchTool);
  app.post("/api/tools/search", handleSearchTool);
  app.get("/api/tools/info", handleInfoTool);
  app.post("/api/tools/info", handleInfoTool);

  // ElevenLabs MCP-style webhook tools
  const handleTextToSpeech = async (req: any, res: any) => {
    try {
      console.log("=== TEXT TO SPEECH TOOL CALLED ===");
      console.log("Query Parameters:", req.query);
      console.log("Body:", req.body);
      
      const text = req.query.text || req.body?.text || '';
      const voiceId = req.query.voice_id || req.body?.voice_id || '21m00Tcm4TlvDq8ikWAM'; // Default voice
      const modelId = req.query.model_id || req.body?.model_id || 'eleven_v3'; // Default to new v3 model (2025)
      
      if (!text) {
        return res.json({
          error: "No text provided",
          message: "Please provide 'text' parameter",
          example: "?text=Hello world&voice_id=21m00Tcm4TlvDq8ikWAM&model_id=eleven_v3",
          available_models: ["eleven_v3", "eleven_flash_v2_5", "eleven_monolingual_v1"],
          note: "eleven_v3 is the latest high-quality model (2025) supporting 70+ languages"
        });
      }

      // Get user's organization and ElevenLabs integration
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const integration = await storage.getIntegration(user.organizationId, 'elevenlabs');
      if (!integration || !integration.apiKey) {
        return res.status(400).json({
          error: "ElevenLabs integration not found",
          message: "Please configure your ElevenLabs API key in Integrations settings"
        });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      // Call ElevenLabs TTS API
      try {
        const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
          },
          body: JSON.stringify({
            text: text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5
            }
          })
        });

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          throw new Error(`ElevenLabs API error: ${ttsResponse.status} - ${errorText}`);
        }

        // Return success response with metadata
        return res.json({
          success: true,
          message: `Successfully generated speech for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
          details: {
            text_length: text.length,
            voice_id: voiceId,
            model_id: modelId,
            estimated_characters: text.length,
            audio_format: "mp3"
          },
          timestamp: new Date().toISOString()
        });

      } catch (error: any) {
        console.error("ElevenLabs TTS error:", error);
        return res.status(500).json({
          success: false,
          error: "TTS generation failed",
          message: error.message || "Unknown error occurred"
        });
      }
      
    } catch (error) {
      console.error("Text-to-speech tool error:", error);
      res.status(500).json({ 
        success: false,
        error: "Text-to-speech tool error occurred",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const handleGetVoices = async (req: any, res: any) => {
    try {
      console.log("=== GET VOICES TOOL CALLED ===");
      
      // Get user's organization and ElevenLabs integration
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const integration = await storage.getIntegration(user.organizationId, 'elevenlabs');
      if (!integration || !integration.apiKey) {
        return res.status(400).json({
          error: "ElevenLabs integration not found",
          message: "Please configure your ElevenLabs API key in Integrations settings"
        });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      try {
        const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: {
            'xi-api-key': apiKey
          }
        });

        if (!voicesResponse.ok) {
          const errorText = await voicesResponse.text();
          throw new Error(`ElevenLabs API error: ${voicesResponse.status} - ${errorText}`);
        }

        const voicesData = await voicesResponse.json();
        
        // Format voices for easy consumption by voice agents
        const formattedVoices = voicesData.voices?.map((voice: any) => ({
          id: voice.voice_id,
          name: voice.name,
          category: voice.category,
          description: voice.description || `${voice.name} voice`,
          accent: voice.labels?.accent,
          age: voice.labels?.age,
          gender: voice.labels?.gender,
          use_case: voice.labels?.use_case
        })) || [];

        return res.json({
          success: true,
          voices_count: formattedVoices.length,
          voices: formattedVoices.slice(0, 10), // Limit to first 10 for agent response
          message: `Found ${formattedVoices.length} available voices. Here are the first 10 options.`,
          timestamp: new Date().toISOString()
        });

      } catch (error: any) {
        console.error("ElevenLabs get voices error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch voices",
          message: error.message || "Unknown error occurred"
        });
      }
      
    } catch (error) {
      console.error("Get voices tool error:", error);
      res.status(500).json({ 
        success: false,
        error: "Get voices tool error occurred",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const handleVoiceClone = async (req: any, res: any) => {
    try {
      console.log("=== VOICE CLONE TOOL CALLED ===");
      console.log("Query Parameters:", req.query);
      console.log("Body:", req.body);
      
      const name = req.query.name || req.body?.name || '';
      const description = req.query.description || req.body?.description || '';
      
      if (!name) {
        return res.json({
          error: "No voice name provided",
          message: "Please provide 'name' parameter",
          example: "?name=My Custom Voice&description=A warm, friendly voice"
        });
      }

      // Get user's organization and ElevenLabs integration
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const integration = await storage.getIntegration(user.organizationId, 'elevenlabs');
      if (!integration || !integration.apiKey) {
        return res.status(400).json({
          error: "ElevenLabs integration not found",
          message: "Please configure your ElevenLabs API key in Integrations settings"
        });
      }

      // Return information about voice cloning process (actual implementation would need audio files)
      return res.json({
        success: true,
        message: `Voice cloning initiated for "${name}". In a real implementation, this would process audio samples to create a custom voice.`,
        details: {
          name: name,
          description: description || `Custom cloned voice: ${name}`,
          status: "would_process_audio_samples",
          requirements: [
            "High-quality audio samples (minimum 1 minute)",
            "Clear speech without background noise",
            "Multiple samples for better quality"
          ],
          next_steps: [
            "Upload audio samples",
            "Process voice characteristics", 
            "Generate voice model",
            "Test and refine"
          ]
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Voice clone tool error:", error);
      res.status(500).json({ 
        success: false,
        error: "Voice clone tool error occurred",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Register ElevenLabs MCP-style tools
  app.get("/api/tools/elevenlabs/text-to-speech", isAuthenticated, handleTextToSpeech);
  app.post("/api/tools/elevenlabs/text-to-speech", isAuthenticated, handleTextToSpeech);
  app.get("/api/tools/elevenlabs/get-voices", isAuthenticated, handleGetVoices);
  app.post("/api/tools/elevenlabs/get-voices", isAuthenticated, handleGetVoices);
  app.get("/api/tools/elevenlabs/voice-clone", isAuthenticated, handleVoiceClone);
  app.post("/api/tools/elevenlabs/voice-clone", isAuthenticated, handleVoiceClone);

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
            `/v1/convai/conversations?agent_id=${agent.elevenLabsAgentId}&page_size=100`,
            "GET",
            undefined,
            integration.id
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
                `/v1/convai/conversations/${conversation.conversation_id}`,
                "GET",
                undefined,
                integration.id
              );
              
              console.log(`  Conversation details received:`, {
                id: details.conversation_id || details.id,
                duration: details.call_duration_secs,
                hasTranscript: !!details.transcript,
                transcriptLength: details.transcript?.length || 0,
                transcriptType: typeof details.transcript,
                transcriptSample: typeof details.transcript === 'string' ? details.transcript.substring(0, 200) : JSON.stringify(details.transcript).substring(0, 200),
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
              
              // Parse and format the transcript properly
              let formattedTranscript = "";
              
              // Check if transcript is an array or object from ElevenLabs
              if (details.transcript) {
                try {
                  // If transcript is already a string, try to parse it
                  if (typeof details.transcript === 'string') {
                    formattedTranscript = details.transcript;
                  } else if (Array.isArray(details.transcript)) {
                    // If it's an array of messages, format them properly
                    const messages = details.transcript.map((msg: any) => ({
                      role: msg.role || (msg.is_agent ? 'agent' : 'user'),
                      message: msg.text || msg.message || msg.content || "",
                      time_in_call_secs: msg.time_in_call_secs || msg.timestamp || undefined
                    }));
                    formattedTranscript = messages.map((m: any) => JSON.stringify(m)).join('\n');
                  } else if (details.transcript.messages) {
                    // If transcript has a messages array
                    const messages = details.transcript.messages.map((msg: any) => ({
                      role: msg.role || (msg.is_agent ? 'agent' : 'user'),
                      message: msg.text || msg.message || msg.content || "",
                      time_in_call_secs: msg.time_in_call_secs || msg.timestamp || undefined
                    }));
                    formattedTranscript = messages.map((m: any) => JSON.stringify(m)).join('\n');
                  }
                  
                  // If we still don't have a formatted transcript, check for analysis field
                  if (!formattedTranscript && details.analysis && details.analysis.transcript) {
                    if (Array.isArray(details.analysis.transcript)) {
                      const messages = details.analysis.transcript.map((msg: any) => ({
                        role: msg.role || (msg.speaker === 'agent' ? 'agent' : 'user'),
                        message: msg.text || msg.message || msg.content || "",
                        time_in_call_secs: msg.time || msg.timestamp || undefined
                      }));
                      formattedTranscript = messages.map((m: any) => JSON.stringify(m)).join('\n');
                    } else {
                      formattedTranscript = details.analysis.transcript;
                    }
                  }
                } catch (e) {
                  console.error("Error formatting transcript:", e);
                  formattedTranscript = typeof details.transcript === 'string' ? details.transcript : JSON.stringify(details.transcript);
                }
              }
              
              // Create call log with proper field mapping including timestamp
              const callData = {
                organizationId: user.organizationId,
                agentId: agent.id,
                elevenLabsCallId: conversation.conversation_id,
                duration: details.call_duration_secs || conversation.call_duration_secs || 0,
                transcript: formattedTranscript || "",
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

  // Generate WebRTC conversation token (new ElevenLabs 2025 feature)
  app.post("/api/playground/webrtc-token", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { agentId } = req.body;
      if (!agentId) {
        return res.status(400).json({ message: "Agent ID is required" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);

      try {
        // Get WebRTC conversation token from ElevenLabs (2025 API)
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-webrtc-token?agent_id=${agentId}`, {
          method: "GET",
          headers: {
            "xi-api-key": decryptedKey,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
        }

        const tokenData = await response.json();
        res.json({
          conversationToken: tokenData.conversation_token,
          connectionType: "webrtc",
          message: "WebRTC token generated successfully"
        });
      } catch (error: any) {
        console.error("Error generating WebRTC token:", error);
        res.status(500).json({ message: `Failed to generate WebRTC token: ${error.message}` });
      }
    } catch (error) {
      console.error("Error in WebRTC token endpoint:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Playground - Start ElevenLabs session (supports both WebSocket and WebRTC)
  app.post("/api/playground/start-session", isAuthenticated, async (req: any, res) => {
    try {
      const { agentId, connectionType = "webrtc" } = req.body; // Default to WebRTC (2025 standard)
      const userId = req.user.id;
      
      console.log("Starting playground session with agent:", agentId, "connectionType:", connectionType);

      if (!agentId) {
        return res.status(400).json({ message: "Agent ID is required" });
      }

      // Validate connection type
      if (!['websocket', 'webrtc'].includes(connectionType)) {
        return res.status(400).json({ message: "Connection type must be 'websocket' or 'webrtc'" });
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

      let url, expectedField;
      if (connectionType === 'webrtc') {
        // Use new WebRTC token endpoint (2025)
        url = `https://api.elevenlabs.io/v1/convai/conversation/get-webrtc-token?agent_id=${agentId}`;
        expectedField = 'conversation_token';
      } else {
        // Use legacy WebSocket signed URL
        url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`;
        expectedField = 'signed_url';
      }
      
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
      if (!data[expectedField]) {
        console.error(`No ${expectedField} in response:`, data);
        return res.status(500).json({ message: `Invalid response from ElevenLabs API: missing ${expectedField}` });
      }
      
      // Return connection details based on type
      if (connectionType === 'webrtc') {
        res.json({ 
          conversationToken: data.conversation_token,
          connectionType: 'webrtc',
          sessionId: data.conversation_id || null,
          message: "WebRTC session ready"
        });
      } else {
        res.json({ 
          signedUrl: data.signed_url,
          connectionType: 'websocket',
          sessionId: data.conversation_id || null,
          message: "WebSocket session ready"
        });
      }
    } catch (error: any) {
      console.error("Error starting playground session:", error);
      res.status(500).json({ 
        message: error.message || "Failed to start session"
      });
    }
  });

  // ==========================================
  // CONVERSATIONAL AI ENDPOINTS (FULL SYNC)
  // ==========================================

  // Conversations API - List all conversations
  app.get("/api/convai/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { agent_id, user_id, page = 1, limit = 20 } = req.query;
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (agent_id) queryParams.append('agent_id', agent_id);
      if (user_id) queryParams.append('user_id', user_id);
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations?${queryParams}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: `Failed to fetch conversations: ${error.message}` });
    }
  });

  // Get conversation details
  app.get("/api/convai/conversations/:conversation_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { conversation_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching conversation details:", error);
      res.status(500).json({ message: `Failed to fetch conversation details: ${error.message}` });
    }
  });

  // Send conversation feedback
  app.post("/api/convai/conversations/:conversation_id/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { conversation_id } = req.params;
      const { feedback } = req.body;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}/feedback`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ feedback }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error sending feedback:", error);
      res.status(500).json({ message: `Failed to send feedback: ${error.message}` });
    }
  });

  // Tools API - Create custom tool
  app.post("/api/convai/tools", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const toolData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/tools",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toolData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error creating tool:", error);
      res.status(500).json({ message: `Failed to create tool: ${error.message}` });
    }
  });

  // List custom tools
  app.get("/api/convai/tools", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/tools",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching tools:", error);
      res.status(500).json({ message: `Failed to fetch tools: ${error.message}` });
    }
  });

  // Get tool details
  app.get("/api/convai/tools/:tool_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { tool_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tools/${tool_id}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching tool details:", error);
      res.status(500).json({ message: `Failed to fetch tool details: ${error.message}` });
    }
  });

  // Update tool
  app.patch("/api/convai/tools/:tool_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { tool_id } = req.params;
      const updateData = req.body;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tools/${tool_id}`,
        {
          method: "PATCH",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error updating tool:", error);
      res.status(500).json({ message: `Failed to update tool: ${error.message}` });
    }
  });

  // Delete tool
  app.delete("/api/convai/tools/:tool_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { tool_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tools/${tool_id}`,
        {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      res.json({ message: "Tool deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting tool:", error);
      res.status(500).json({ message: `Failed to delete tool: ${error.message}` });
    }
  });

  // Knowledge Base API - List documents
  app.get("/api/convai/knowledge-base", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/knowledge-base",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching knowledge base:", error);
      res.status(500).json({ message: `Failed to fetch knowledge base: ${error.message}` });
    }
  });

  // Configure multer for memory storage
  const kbUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
  });

  // Create knowledge base document
  app.post("/api/convai/knowledge-base", isAuthenticated, kbUpload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { name, type, url, agent_ids } = req.body;
      
      // Prepare FormData for ElevenLabs API
      const FormData = require('form-data');
      const formData = new FormData();
      
      // Add name if provided
      if (name) {
        formData.append('name', name);
      }

      // Add agent_ids if provided
      if (agent_ids) {
        const agentIdsArray = typeof agent_ids === 'string' ? JSON.parse(agent_ids) : agent_ids;
        agentIdsArray.forEach((id: string) => {
          formData.append('agent_ids', id);
        });
      }

      // Handle different document types
      if (type === 'url' && url) {
        formData.append('url', url);
      } else if (type === 'file' && req.file) {
        // Add the file
        formData.append('file', req.file.buffer, {
          filename: req.file.originalname,
          contentType: req.file.mimetype
        });
      } else {
        return res.status(400).json({ message: "Invalid document type. Please provide either a URL or file." });
      }

      // Send to ElevenLabs API
      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/knowledge-base",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            ...formData.getHeaders()
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error creating knowledge base document:", error);
      res.status(500).json({ message: `Failed to create document: ${error.message}` });
    }
  });

  // Get knowledge base document
  app.get("/api/convai/knowledge-base/:document_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { document_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/knowledge-base/${document_id}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: `Failed to fetch document: ${error.message}` });
    }
  });

  // Delete knowledge base document
  app.delete("/api/convai/knowledge-base/:document_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { document_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/knowledge-base/${document_id}`,
        {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      res.json({ message: "Document deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: `Failed to delete document: ${error.message}` });
    }
  });

  // Note: RAG indexing happens automatically in ElevenLabs when documents are added
  // No manual endpoint needed for computing RAG index

  // Get document content
  app.get("/api/convai/knowledge-base/:document_id/content", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { document_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/knowledge-base/${document_id}/content`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching document content:", error);
      res.status(500).json({ message: `Failed to fetch content: ${error.message}` });
    }
  });

  // Get document chunk
  app.get("/api/convai/knowledge-base/:document_id/chunks/:chunk_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { document_id, chunk_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/knowledge-base/${document_id}/chunks/${chunk_id}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching chunk:", error);
      res.status(500).json({ message: `Failed to fetch chunk: ${error.message}` });
    }
  });

  // Widget API - Get widget configuration
  app.get("/api/convai/widget", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      // Return a default widget configuration
      // Note: ElevenLabs doesn't have a dedicated widget API endpoint
      // Widget configuration would typically be part of agent configuration
      const widgetConfig = {
        enabled: false,
        theme: {
          primary_color: '#6366f1',
          secondary_color: '#8b5cf6',
          background_color: '#ffffff',
          text_color: '#1f2937',
          font_family: 'Inter, sans-serif',
          border_radius: 12,
        },
        position: {
          horizontal: 'right',
          vertical: 'bottom',
          offset_x: 20,
          offset_y: 20,
        },
        size: {
          width: 400,
          height: 600,
          mobile_width: 320,
          mobile_height: 500,
        },
        behavior: {
          auto_open: false,
          auto_open_delay: 3000,
          close_on_outside_click: true,
          remember_state: true,
          expandable: true,
        },
        branding: {
          title: 'AI Assistant',
          subtitle: 'How can I help you today?',
          welcome_message: 'Hello! I\'m here to assist you with any questions you might have.',
          placeholder_text: 'Type your message...',
        },
      };

      res.json(widgetConfig);
    } catch (error: any) {
      console.error("Error fetching widget configuration:", error);
      res.status(500).json({ message: `Failed to fetch widget: ${error.message}` });
    }
  });

  // Create widget avatar
  app.post("/api/convai/widget/avatar", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      // Return a mock response for avatar creation
      // Note: ElevenLabs doesn't have a dedicated widget avatar API endpoint
      const avatarData = req.body;
      
      // Mock response with the provided avatar data
      const avatarResponse = {
        ...avatarData,
        id: `avatar_${Date.now()}`,
        created_at: new Date().toISOString(),
        status: 'active'
      };

      res.json(avatarResponse);
    } catch (error: any) {
      console.error("Error creating widget avatar:", error);
      res.status(500).json({ message: `Failed to create avatar: ${error.message}` });
    }
  });

  // Workspace API - Get settings
  app.get("/api/convai/workspace/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/workspace/settings",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching workspace settings:", error);
      res.status(500).json({ message: `Failed to fetch settings: ${error.message}` });
    }
  });

  // Update workspace settings
  app.patch("/api/convai/workspace/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const settingsData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/workspace/settings",
        {
          method: "PATCH",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settingsData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error updating workspace settings:", error);
      res.status(500).json({ message: `Failed to update settings: ${error.message}` });
    }
  });

  // Get workspace secrets
  app.get("/api/convai/workspace/secrets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/workspace/secrets",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching workspace secrets:", error);
      res.status(500).json({ message: `Failed to fetch secrets: ${error.message}` });
    }
  });

  // Create workspace secret
  app.post("/api/convai/workspace/secrets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const secretData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/workspace/secrets",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(secretData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error creating workspace secret:", error);
      res.status(500).json({ message: `Failed to create secret: ${error.message}` });
    }
  });

  // Delete workspace secret
  app.delete("/api/convai/workspace/secrets/:secret_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { secret_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/workspace/secrets/${secret_id}`,
        {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      res.json({ message: "Secret deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting workspace secret:", error);
      res.status(500).json({ message: `Failed to delete secret: ${error.message}` });
    }
  });

  // Tests API - Create agent test
  app.post("/api/convai/tests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const testData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/tests",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error creating test:", error);
      res.status(500).json({ message: `Failed to create test: ${error.message}` });
    }
  });

  // List agent tests
  app.get("/api/convai/tests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { agent_id } = req.query;

      const queryParams = new URLSearchParams();
      if (agent_id) queryParams.append('agent_id', agent_id);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tests?${queryParams}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching tests:", error);
      res.status(500).json({ message: `Failed to fetch tests: ${error.message}` });
    }
  });

  // Get test details
  app.get("/api/convai/tests/:test_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { test_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tests/${test_id}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching test details:", error);
      res.status(500).json({ message: `Failed to fetch test details: ${error.message}` });
    }
  });

  // Delete test
  app.delete("/api/convai/tests/:test_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { test_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tests/${test_id}`,
        {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      res.json({ message: "Test deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting test:", error);
      res.status(500).json({ message: `Failed to delete test: ${error.message}` });
    }
  });

  // Twilio Integration - Make outbound call
  app.post("/api/convai/twilio/outbound-call", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const callData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(callData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error making Twilio outbound call:", error);
      res.status(500).json({ message: `Failed to make call: ${error.message}` });
    }
  });

  // SIP Trunk - List SIP trunks
  app.get("/api/convai/sip-trunks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/sip-trunks",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching SIP trunks:", error);
      res.status(500).json({ message: `Failed to fetch SIP trunks: ${error.message}` });
    }
  });

  // Create SIP trunk
  app.post("/api/convai/sip-trunks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const sipData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/sip-trunks",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sipData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error creating SIP trunk:", error);
      res.status(500).json({ message: `Failed to create SIP trunk: ${error.message}` });
    }
  });

  // Get SIP trunk details
  app.get("/api/convai/sip-trunks/:trunk_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { trunk_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/sip-trunks/${trunk_id}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching SIP trunk details:", error);
      res.status(500).json({ message: `Failed to fetch SIP trunk: ${error.message}` });
    }
  });

  // Update SIP trunk
  app.patch("/api/convai/sip-trunks/:trunk_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { trunk_id } = req.params;
      const updateData = req.body;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/sip-trunks/${trunk_id}`,
        {
          method: "PATCH",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error updating SIP trunk:", error);
      res.status(500).json({ message: `Failed to update SIP trunk: ${error.message}` });
    }
  });

  // Delete SIP trunk
  app.delete("/api/convai/sip-trunks/:trunk_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { trunk_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/sip-trunks/${trunk_id}`,
        {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      res.json({ message: "SIP trunk deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting SIP trunk:", error);
      res.status(500).json({ message: `Failed to delete SIP trunk: ${error.message}` });
    }
  });

  // LLM Usage API - Get LLM usage statistics
  app.get("/api/convai/llm-usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { start_date, end_date } = req.query;

      const queryParams = new URLSearchParams();
      if (start_date) queryParams.append('start_date', start_date);
      if (end_date) queryParams.append('end_date', end_date);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/llm-usage?${queryParams}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching LLM usage:", error);
      res.status(500).json({ message: `Failed to fetch LLM usage: ${error.message}` });
    }
  });

  // MCP (Model Context Protocol) API - Get MCP status
  app.get("/api/convai/mcp/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/mcp/status",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching MCP status:", error);
      res.status(500).json({ message: `Failed to fetch MCP status: ${error.message}` });
    }
  });

  // MCP - Configure MCP settings
  app.post("/api/convai/mcp/configure", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const configData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/mcp/configure",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(configData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error configuring MCP:", error);
      res.status(500).json({ message: `Failed to configure MCP: ${error.message}` });
    }
  });

  // ==========================================
  // END OF CONVERSATIONAL AI ENDPOINTS
  // ==========================================

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
        payload,
        integration.id
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
        payload,
        integration.id
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
          console.error(`Error processing ${file.originalname}:`, error);
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
