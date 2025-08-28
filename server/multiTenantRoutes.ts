import type { Express } from "express";
import { storage } from "./storage";
import { 
  requireAuth, 
  requireSuperAdmin, 
  requireAgency, 
  requireClient,
  requireAgencyOrSuperAdmin,
  requireAgencyAccess,
  requireClientAccess,
  validateResourceOwnership,
  AuthenticatedRequest
} from "./rbac";
import type { 
  Agency, 
  InsertAgency, 
  Client, 
  InsertClient, 
  AgencyPlan, 
  InsertAgencyPlan,
  WhiteLabelSettings,
  InsertWhiteLabelSettings,
  User 
} from "@shared/schema";

export function registerMultiTenantRoutes(app: Express) {
  
  // ========== SUPER ADMIN ROUTES ==========
  
  /**
   * Get all agencies (Super Admin only)
   */
  app.get('/api/admin/agencies', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const agencies = await storage.getAgencies();
      res.json(agencies);
    } catch (error) {
      console.error('Error fetching agencies:', error);
      res.status(500).json({ message: 'Failed to fetch agencies' });
    }
  });

  /**
   * Create new agency (Super Admin only)
   */
  app.post('/api/admin/agencies', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { name, email, ownerId, organizationId, masterCharacterQuota, maxClients, subscriptionPlan } = req.body;
      
      const agencyData: InsertAgency = {
        name,
        email,
        ownerId,
        organizationId,
        masterCharacterQuota: masterCharacterQuota || 100000,
        maxClients: maxClients || 10,
        subscriptionPlan,
        billingStatus: 'active',
        isActive: true
      };

      const agency = await storage.createAgency(agencyData);
      
      // Update user role to agency
      await storage.updateUser(ownerId, { role: 'agency' });
      
      res.status(201).json(agency);
    } catch (error) {
      console.error('Error creating agency:', error);
      res.status(500).json({ message: 'Failed to create agency' });
    }
  });

  /**
   * Update agency (Super Admin only)
   */
  app.put('/api/admin/agencies/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const agency = await storage.updateAgency(id, updates);
      res.json(agency);
    } catch (error) {
      console.error('Error updating agency:', error);
      res.status(500).json({ message: 'Failed to update agency' });
    }
  });

  /**
   * Delete agency (Super Admin only)
   */
  app.delete('/api/admin/agencies/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAgency(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting agency:', error);
      res.status(500).json({ message: 'Failed to delete agency' });
    }
  });

  /**
   * Get platform-wide analytics (Super Admin only)
   */
  app.get('/api/admin/analytics', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const agencies = await storage.getAgencies();
      const totalAgencies = agencies.length;
      const activeAgencies = agencies.filter(a => a.isActive).length;
      
      let totalClients = 0;
      let totalRevenue = 0;
      
      for (const agency of agencies) {
        const clients = await storage.getClients(agency.id);
        totalClients += clients.length;
        // Calculate revenue logic here based on subscription plans
      }

      res.json({
        totalAgencies,
        activeAgencies,
        totalClients,
        totalRevenue
      });
    } catch (error) {
      console.error('Error fetching platform analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  // ========== AGENCY ROUTES ==========

  /**
   * Get agency dashboard data
   */
  app.get('/api/agency/dashboard', requireAuth, requireAgency, requireAgencyAccess, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const agencyId = authReq.agencyId!;
      
      const [agency, clients, plans] = await Promise.all([
        storage.getAgency(agencyId),
        storage.getClients(agencyId),
        storage.getAgencyPlans(agencyId)
      ]);

      if (!agency) {
        return res.status(404).json({ message: 'Agency not found' });
      }

      const activeClients = clients.filter(c => c.isActive).length;
      const totalRevenue = clients.reduce((sum, client) => {
        // Calculate revenue based on client subscriptions
        return sum + (client.subscribedPlanId ? 100 : 0); // Placeholder logic
      }, 0);

      res.json({
        agency,
        stats: {
          totalClients: clients.length,
          activeClients,
          totalPlans: plans.length,
          totalRevenue,
          characterQuotaUsed: agency.usedCharacters,
          characterQuotaTotal: agency.masterCharacterQuota
        },
        recentClients: clients.slice(0, 5)
      });
    } catch (error) {
      console.error('Error fetching agency dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard data' });
    }
  });

  /**
   * Get agency's clients
   */
  app.get('/api/agency/clients', requireAuth, requireAgency, requireAgencyAccess, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const clients = await storage.getClients(authReq.agencyId!);
      res.json(clients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      res.status(500).json({ message: 'Failed to fetch clients' });
    }
  });

  /**
   * Create new client
   */
  app.post('/api/agency/clients', requireAuth, requireAgency, requireAgencyAccess, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name, email, userId, characterQuota, maxAgents, subscribedPlanId } = req.body;
      
      const clientData: InsertClient = {
        name,
        email,
        agencyId: authReq.agencyId!,
        userId,
        characterQuota: characterQuota || 1000,
        maxAgents: maxAgents || 1,
        subscribedPlanId,
        subscriptionStatus: 'active',
        isActive: true
      };

      const client = await storage.createClient(clientData);
      
      // Update user role to client
      await storage.updateUser(userId, { role: 'client', agencyId: authReq.agencyId });
      
      res.status(201).json(client);
    } catch (error) {
      console.error('Error creating client:', error);
      res.status(500).json({ message: 'Failed to create client' });
    }
  });

  /**
   * Update client
   */
  app.put('/api/agency/clients/:id', 
    requireAuth, 
    requireAgency, 
    validateResourceOwnership('client'), 
    async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const client = await storage.updateClient(id, updates);
      res.json(client);
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ message: 'Failed to update client' });
    }
  });

  /**
   * Delete client
   */
  app.delete('/api/agency/clients/:id', 
    requireAuth, 
    requireAgency, 
    validateResourceOwnership('client'), 
    async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteClient(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({ message: 'Failed to delete client' });
    }
  });

  /**
   * Get agency's plans
   */
  app.get('/api/agency/plans', requireAuth, requireAgency, requireAgencyAccess, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const plans = await storage.getAgencyPlans(authReq.agencyId!);
      res.json(plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      res.status(500).json({ message: 'Failed to fetch plans' });
    }
  });

  /**
   * Create new agency plan
   */
  app.post('/api/agency/plans', requireAuth, requireAgency, requireAgencyAccess, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name, description, characterQuota, maxAgents, features, monthlyPrice, yearlyPrice } = req.body;
      
      const planData: InsertAgencyPlan = {
        agencyId: authReq.agencyId!,
        name,
        description,
        characterQuota,
        maxAgents: maxAgents || 1,
        features: features || [],
        monthlyPrice,
        yearlyPrice,
        isActive: true
      };

      const plan = await storage.createAgencyPlan(planData);
      res.status(201).json(plan);
    } catch (error) {
      console.error('Error creating plan:', error);
      res.status(500).json({ message: 'Failed to create plan' });
    }
  });

  /**
   * Update agency plan
   */
  app.put('/api/agency/plans/:id', 
    requireAuth, 
    requireAgency, 
    validateResourceOwnership('plan'), 
    async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const plan = await storage.updateAgencyPlan(id, updates);
      res.json(plan);
    } catch (error) {
      console.error('Error updating plan:', error);
      res.status(500).json({ message: 'Failed to update plan' });
    }
  });

  /**
   * Delete agency plan
   */
  app.delete('/api/agency/plans/:id', 
    requireAuth, 
    requireAgency, 
    validateResourceOwnership('plan'), 
    async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAgencyPlan(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting plan:', error);
      res.status(500).json({ message: 'Failed to delete plan' });
    }
  });

  /**
   * Get/Update white label settings
   */
  app.get('/api/agency/white-label', requireAuth, requireAgency, requireAgencyAccess, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const settings = await storage.getWhiteLabelSettings(authReq.agencyId!);
      res.json(settings || {});
    } catch (error) {
      console.error('Error fetching white label settings:', error);
      res.status(500).json({ message: 'Failed to fetch white label settings' });
    }
  });

  app.put('/api/agency/white-label', requireAuth, requireAgency, requireAgencyAccess, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const settingsData: InsertWhiteLabelSettings = {
        agencyId: authReq.agencyId!,
        ...req.body
      };

      const settings = await storage.upsertWhiteLabelSettings(settingsData);
      res.json(settings);
    } catch (error) {
      console.error('Error updating white label settings:', error);
      res.status(500).json({ message: 'Failed to update white label settings' });
    }
  });

  // ========== CLIENT ROUTES ==========

  /**
   * Get client dashboard data
   */
  app.get('/api/client/dashboard', requireAuth, requireClient, requireClientAccess, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = req.user as User;
      
      const client = await storage.getClientByUserId(user.id);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      const [agency, subscribedPlan, currentUsage] = await Promise.all([
        storage.getAgency(client.agencyId),
        client.subscribedPlanId ? storage.getAgencyPlan(client.subscribedPlanId) : null,
        storage.getResourceUsage(client.id, new Date().getFullYear(), new Date().getMonth() + 1)
      ]);

      res.json({
        client,
        agency,
        subscribedPlan,
        usage: {
          charactersUsed: currentUsage?.charactersUsed || 0,
          characterQuota: client.characterQuota,
          callsMade: currentUsage?.callsMade || 0,
          minutesUsed: currentUsage?.minutesUsed || 0
        }
      });
    } catch (error) {
      console.error('Error fetching client dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard data' });
    }
  });

  /**
   * Get available plans for client
   */
  app.get('/api/client/available-plans', requireAuth, requireClient, requireClientAccess, async (req, res) => {
    try {
      const user = req.user as User;
      const client = await storage.getClientByUserId(user.id);
      
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      const plans = await storage.getAgencyPlans(client.agencyId);
      const activePlans = plans.filter(p => p.isActive);
      
      res.json(activePlans);
    } catch (error) {
      console.error('Error fetching available plans:', error);
      res.status(500).json({ message: 'Failed to fetch available plans' });
    }
  });

  /**
   * Get white label settings for client's agency
   */
  app.get('/api/client/branding', requireAuth, requireClient, requireClientAccess, async (req, res) => {
    try {
      const user = req.user as User;
      const client = await storage.getClientByUserId(user.id);
      
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      const settings = await storage.getWhiteLabelSettings(client.agencyId);
      res.json(settings || {});
    } catch (error) {
      console.error('Error fetching branding settings:', error);
      res.status(500).json({ message: 'Failed to fetch branding settings' });
    }
  });

  // ========== SHARED UTILITY ROUTES ==========

  /**
   * Get current user's role and permissions
   */
  app.get('/api/user/role-info', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      let roleData: any = { role: user.role };

      if (user.role === 'agency') {
        const agency = await storage.getAgencyByOwnerId(user.id);
        roleData.agency = agency;
      } else if (user.role === 'client') {
        const client = await storage.getClientByUserId(user.id);
        roleData.client = client;
      }

      res.json(roleData);
    } catch (error) {
      console.error('Error fetching role info:', error);
      res.status(500).json({ message: 'Failed to fetch role information' });
    }
  });
}