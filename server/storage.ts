import {
  users,
  organizations,
  integrations,
  agents,
  callLogs,
  billingPackages,
  payments,
  phoneNumbers,
  batchCalls,
  batchCallRecipients,
  systemTemplates,
  quickActionButtons,
  adminTasks,
  ragConfigurations,
  approvalWebhooks,
  type User,
  type UpsertUser,
  type Organization,
  type InsertOrganization,
  type Integration,
  type InsertIntegration,
  type Agent,
  type InsertAgent,
  type CallLog,
  type InsertCallLog,
  type BillingPackage,
  type Payment,
  type InsertPayment,
  type PhoneNumber,
  type InsertPhoneNumber,
  type BatchCall,
  type InsertBatchCall,
  type BatchCallRecipient,
  type InsertBatchCallRecipient,
  type SystemTemplate,
  type InsertSystemTemplate,
  type QuickActionButton,
  type InsertQuickActionButton,
  type AdminTask,
  type InsertAdminTask,
  type ApprovalWebhook,
  type InsertApprovalWebhook,
  type RagConfiguration,
  type InsertRagConfiguration,
  // Multi-tenant types
  agencies,
  clients,
  agencyPlans,
  whiteLabelSettings,
  resourceUsage,
  type Agency,
  type InsertAgency,
  type Client,
  type InsertClient,
  type AgencyPlan,
  type InsertAgencyPlan,
  type WhiteLabelSettings,
  type InsertWhiteLabelSettings,
  type ResourceUsage,
  type InsertResourceUsage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sum, avg, max, or } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: Partial<User>): Promise<User>;

  // Organization operations
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | undefined>;

  // Integration operations
  getIntegration(organizationId: string, provider: string): Promise<Integration | undefined>;
  getAllIntegrations(): Promise<Integration[]>;
  upsertIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegrationStatus(id: string, status: "ACTIVE" | "INACTIVE" | "ERROR" | "PENDING_APPROVAL", lastTested?: Date): Promise<void>;
  
  // Admin task operations
  createAdminTask(task: InsertAdminTask): Promise<AdminTask>;
  getAdminTasks(status?: "pending" | "in_progress" | "completed" | "rejected"): Promise<AdminTask[]>;
  getAdminTask(id: string): Promise<AdminTask | undefined>;
  updateAdminTask(id: string, updates: Partial<AdminTask>): Promise<AdminTask>;
  completeApprovalTask(taskId: string, adminId: string): Promise<void>;

  // Agent operations
  getAgents(organizationId: string): Promise<Agent[]>;
  getAgent(id: string, organizationId: string): Promise<Agent | undefined>;
  getAgentByElevenLabsId(elevenLabsAgentId: string, organizationId: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, organizationId: string, updates: Partial<InsertAgent>): Promise<Agent>;
  deleteAgent(id: string, organizationId: string): Promise<void>;

  // Call log operations
  getCallLogs(organizationId: string, limit?: number, offset?: number, agentId?: string): Promise<CallLog[]>;
  getCallLog(id: string, organizationId: string): Promise<CallLog | undefined>;
  getCallLogByElevenLabsId(elevenLabsCallId: string, organizationId: string): Promise<CallLog | undefined>;
  createCallLog(callLog: InsertCallLog & { createdAt?: Date }): Promise<CallLog>;

  // Phone number operations
  getPhoneNumbers(organizationId: string): Promise<PhoneNumber[]>;
  getPhoneNumber(id: string, organizationId: string): Promise<PhoneNumber | undefined>;
  createPhoneNumber(phoneNumber: InsertPhoneNumber): Promise<PhoneNumber>;
  updatePhoneNumber(id: string, organizationId: string, updates: Partial<InsertPhoneNumber>): Promise<PhoneNumber>;
  deletePhoneNumber(id: string, organizationId: string): Promise<void>;

  // Analytics operations
  getOrganizationStats(organizationId: string): Promise<{
    totalCalls: number;
    totalMinutes: number;
    estimatedCost: number;
    activeAgents: number;
    lastSync?: Date;
  }>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getAllOrganizations(): Promise<Organization[]>;
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization>;
  getAdminBillingData(): Promise<{
    totalUsers: number;
    totalOrganizations: number;
    totalCalls: number;
    totalRevenue: number;
    organizationsData: Array<{
      id: string;
      name: string;
      userCount: number;
      totalCalls: number;
      totalMinutes: number;
      estimatedCost: number;
      billingPackage?: string;
      perCallRate?: number;
      perMinuteRate?: number;
      monthlyCredits?: number;
      usedCredits?: number;
    }>;
  }>;
  
  // Billing operations
  getBillingPackages(): Promise<BillingPackage[]>;
  getBillingPackage(id: string): Promise<BillingPackage | undefined>;
  createBillingPackage(pkg: Partial<BillingPackage>): Promise<BillingPackage>;
  updateBillingPackage(id: string, updates: Partial<BillingPackage>): Promise<BillingPackage>;
  deleteBillingPackage(id: string): Promise<void>;

  // Payment operations  
  getPaymentHistory(organizationId: string): Promise<Payment[]>;
  getAllPayments(): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<Payment>): Promise<Payment>;

  // Batch call operations
  getBatchCalls(organizationId: string): Promise<BatchCall[]>;
  getBatchCall(id: string, organizationId: string): Promise<BatchCall | undefined>;
  createBatchCall(data: InsertBatchCall): Promise<BatchCall>;
  updateBatchCall(id: string, organizationId: string, data: Partial<BatchCall>): Promise<BatchCall>;
  deleteBatchCall(id: string, organizationId: string): Promise<void>;

  // System template operations (admin only)
  getSystemTemplates(): Promise<SystemTemplate[]>;
  getSystemTemplate(id: string): Promise<SystemTemplate | undefined>;
  createSystemTemplate(template: InsertSystemTemplate): Promise<SystemTemplate>;
  updateSystemTemplate(id: string, updates: Partial<InsertSystemTemplate>): Promise<SystemTemplate>;
  deleteSystemTemplate(id: string): Promise<void>;
  
  // Quick Action Button operations
  getQuickActionButtons(organizationId?: string): Promise<QuickActionButton[]>;
  getQuickActionButton(id: string): Promise<QuickActionButton | undefined>;
  createQuickActionButton(button: InsertQuickActionButton): Promise<QuickActionButton>;
  updateQuickActionButton(id: string, updates: Partial<InsertQuickActionButton>): Promise<QuickActionButton>;
  deleteQuickActionButton(id: string): Promise<void>;
  
  // Batch call recipient operations
  getBatchCallRecipients(batchCallId: string): Promise<BatchCallRecipient[]>;
  createBatchCallRecipients(recipients: InsertBatchCallRecipient[]): Promise<BatchCallRecipient[]>;
  updateBatchCallRecipient(id: string, data: Partial<BatchCallRecipient>): Promise<BatchCallRecipient>;
  
  // Approval webhook operations
  getApprovalWebhooks(): Promise<ApprovalWebhook[]>;
  getApprovalWebhook(id: string): Promise<ApprovalWebhook | undefined>;
  createApprovalWebhook(webhook: InsertApprovalWebhook): Promise<ApprovalWebhook>;
  updateApprovalWebhook(id: string, updates: Partial<InsertApprovalWebhook>): Promise<ApprovalWebhook>;
  deleteApprovalWebhook(id: string): Promise<void>;

  // ========== MULTI-TENANT OPERATIONS ==========
  
  // Agency operations
  getAgencies(): Promise<Agency[]>;
  getAgency(id: string): Promise<Agency | undefined>;
  getAgencyByOwnerId(ownerId: string): Promise<Agency | undefined>;
  createAgency(agencyData: InsertAgency): Promise<Agency>;
  updateAgency(id: string, updates: Partial<Agency>): Promise<Agency>;
  deleteAgency(id: string): Promise<void>;
  
  // Client operations
  getClients(agencyId: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByUserId(userId: string): Promise<Client | undefined>;
  createClient(clientData: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<Client>): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  
  // Agency Plan operations
  getAgencyPlans(agencyId: string): Promise<AgencyPlan[]>;
  getAgencyPlan(id: string): Promise<AgencyPlan | undefined>;
  createAgencyPlan(planData: InsertAgencyPlan): Promise<AgencyPlan>;
  updateAgencyPlan(id: string, updates: Partial<AgencyPlan>): Promise<AgencyPlan>;
  deleteAgencyPlan(id: string): Promise<void>;
  
  // White Label Settings operations
  getWhiteLabelSettings(agencyId: string): Promise<WhiteLabelSettings | undefined>;
  upsertWhiteLabelSettings(settingsData: InsertWhiteLabelSettings): Promise<WhiteLabelSettings>;
  
  // Resource Usage operations
  getResourceUsage(entityId: string, year: number, month: number): Promise<ResourceUsage | undefined>;
  upsertResourceUsage(usageData: InsertResourceUsage): Promise<ResourceUsage>;
  getAgencyResourceUsage(agencyId: string, year: number, month: number): Promise<ResourceUsage[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db().select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(userData: Partial<User>): Promise<User> {
    // If no organization exists for this user, create one
    let organizationId = userData.organizationId;
    
    if (!organizationId) {
      const [org] = await db.insert(organizations).values({
        name: userData.email?.split('@')[0] || 'Personal Organization'
      }).returning();
      organizationId = org.id;
    }

    const [user] = await db.insert(users).values({
      email: userData.email!,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      organizationId,
      isAdmin: userData.email === "cc@siwaht.com",
    }).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // If no organizationId provided, create a new organization for the user
    let organizationId = userData.organizationId;
    if (!organizationId) {
      const orgName = userData.email ? userData.email.split('@')[0] + "'s Organization" : "Personal Organization";
      const organization = await this.createOrganization({ name: orgName });
      organizationId = organization.id;
    }

    // Check if this is the admin user
    const isAdmin = userData.email === 'cc@siwaht.com';

    const [user] = await db
      .insert(users)
      .values({ ...userData, organizationId, isAdmin })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          organizationId,
          isAdmin,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Organization operations
  async createOrganization(orgData: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(orgData).returning();
    return org;
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  // Integration operations
  async getIntegration(organizationId: string, provider: string): Promise<Integration | undefined> {
    const [integration] = await db()
      .select()
      .from(integrations)
      .where(and(eq(integrations.organizationId, organizationId), eq(integrations.provider, provider)));
    return integration;
  }

  async getAllIntegrations(): Promise<Integration[]> {
    return await db()
      .select()
      .from(integrations);
  }

  async upsertIntegration(integrationData: InsertIntegration): Promise<Integration> {
    const [integration] = await db()
      .insert(integrations)
      .values(integrationData)
      .onConflictDoUpdate({
        target: [integrations.organizationId, integrations.provider],
        set: {
          ...integrationData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return integration;
  }

  async updateIntegrationStatus(id: string, status: "ACTIVE" | "INACTIVE" | "ERROR" | "PENDING_APPROVAL", lastTested?: Date): Promise<void> {
    await db()
      .update(integrations)
      .set({
        status,
        lastTested,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id));
  }

  // Agent operations
  async getAgents(organizationId: string): Promise<Agent[]> {
    return db().select().from(agents).where(eq(agents.organizationId, organizationId));
  }

  async getAgent(id: string, organizationId: string): Promise<Agent | undefined> {
    const [agent] = await db()
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
    return agent;
  }

  async getAgentByElevenLabsId(elevenLabsAgentId: string, organizationId: string): Promise<Agent | undefined> {
    const [agent] = await db()
      .select()
      .from(agents)
      .where(and(eq(agents.elevenLabsAgentId, elevenLabsAgentId), eq(agents.organizationId, organizationId)));
    return agent;
  }

  async createAgent(agentData: any): Promise<Agent> {
    // Ensure the JSON fields are properly typed
    const data = {
      ...agentData,
      voiceSettings: agentData.voiceSettings || null,
      llmSettings: agentData.llmSettings || null,
      tools: agentData.tools || null,
      dynamicVariables: agentData.dynamicVariables || null,
      evaluationCriteria: agentData.evaluationCriteria || null,
      dataCollection: agentData.dataCollection || null,
    };
    const [agent] = await db().insert(agents).values([data]).returning();
    return agent;
  }

  async updateAgent(id: string, organizationId: string, updates: Partial<Omit<Agent, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<Agent> {
    const [agent] = await db()
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)))
      .returning();
    return agent;
  }

  async deleteAgent(organizationId: string, id: string): Promise<void> {
    await db()
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
  }

  // Call log operations
  async getCallLogs(organizationId: string, limit = 50, offset = 0, agentId?: string): Promise<CallLog[]> {
    let query = db()
      .select()
      .from(callLogs)
      .where(eq(callLogs.organizationId, organizationId))
      .orderBy(desc(callLogs.createdAt))
      .limit(limit)
      .offset(offset);

    if (agentId) {
      query = db()
        .select()
        .from(callLogs)
        .where(and(eq(callLogs.organizationId, organizationId), eq(callLogs.agentId, agentId)))
        .orderBy(desc(callLogs.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return query;
  }

  async getCallLog(id: string, organizationId: string): Promise<CallLog | undefined> {
    const [callLog] = await db()
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.id, id), eq(callLogs.organizationId, organizationId)));
    return callLog;
  }

  async createCallLog(callLogData: InsertCallLog & { createdAt?: Date }): Promise<CallLog> {
    const [callLog] = await db().insert(callLogs).values(callLogData).returning();
    return callLog;
  }

  async getCallLogByElevenLabsId(elevenLabsCallId: string, organizationId: string): Promise<CallLog | undefined> {
    const [callLog] = await db()
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.elevenLabsCallId, elevenLabsCallId), eq(callLogs.organizationId, organizationId)));
    return callLog;
  }

  // Analytics operations
  async getOrganizationStats(organizationId: string): Promise<{
    totalCalls: number;
    totalMinutes: number;
    estimatedCost: number;
    activeAgents: number;
    lastSync?: Date;
  }> {
    const [callStats] = await db()
      .select({
        totalCalls: count(callLogs.id),
        totalMinutes: sum(callLogs.duration),
        estimatedCost: sum(callLogs.cost),
        lastSync: max(callLogs.createdAt),
      })
      .from(callLogs)
      .where(eq(callLogs.organizationId, organizationId));

    const [agentStats] = await db()
      .select({
        activeAgents: count(agents.id),
      })
      .from(agents)
      .where(and(eq(agents.organizationId, organizationId), eq(agents.isActive, true)));

    return {
      totalCalls: Number(callStats.totalCalls) || 0,
      totalMinutes: Math.round(Number(callStats.totalMinutes) / 60) || 0,
      estimatedCost: Number(callStats.estimatedCost) || 0,
      activeAgents: Number(agentStats.activeAgents) || 0,
      lastSync: callStats.lastSync || undefined,
    };
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db().select().from(users);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db()
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!updatedUser) {
      throw new Error("User not found");
    }
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    await db().delete(users).where(eq(users.id, id));
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db().select().from(organizations);
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    const [updatedOrg] = await db()
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    if (!updatedOrg) {
      throw new Error("Organization not found");
    }
    return updatedOrg;
  }

  async getAdminBillingData(): Promise<{
    totalUsers: number;
    totalOrganizations: number;
    totalCalls: number;
    totalRevenue: number;
    organizationsData: Array<{
      id: string;
      name: string;
      userCount: number;
      totalCalls: number;
      totalMinutes: number;
      estimatedCost: number;
      billingPackage?: string;
      perCallRate?: number;
      perMinuteRate?: number;
      monthlyCredits?: number;
      usedCredits?: number;
    }>;
  }> {
    // Get total counts
    const [userCount] = await db().select({ count: count(users.id) }).from(users);
    const [orgCount] = await db().select({ count: count(organizations.id) }).from(organizations);
    const [callCount] = await db().select({ 
      count: count(callLogs.id),
      totalCost: sum(callLogs.cost) 
    }).from(callLogs);

    // Get organization-specific data
    const orgs = await db().select().from(organizations);
    const organizationsData = await Promise.all(
      orgs.map(async (org) => {
        const [userStats] = await db()
          .select({ count: count(users.id) })
          .from(users)
          .where(eq(users.organizationId, org.id));

        const [callStats] = await db()
          .select({
            totalCalls: count(callLogs.id),
            totalMinutes: sum(callLogs.duration),
            estimatedCost: sum(callLogs.cost),
          })
          .from(callLogs)
          .where(eq(callLogs.organizationId, org.id));

        return {
          id: org.id,
          name: org.name,
          userCount: Number(userStats.count) || 0,
          totalCalls: Number(callStats.totalCalls) || 0,
          totalMinutes: Math.round(Number(callStats.totalMinutes) / 60) || 0,
          estimatedCost: Number(callStats.estimatedCost) || 0,
          billingPackage: org.billingPackage || 'starter',
          perCallRate: Number(org.perCallRate) || 0.30,
          perMinuteRate: Number(org.perMinuteRate) || 0.30,
          monthlyCredits: org.monthlyCredits || 0,
          usedCredits: org.usedCredits || 0,
        };
      })
    );

    return {
      totalUsers: Number(userCount.count) || 0,
      totalOrganizations: Number(orgCount.count) || 0,
      totalCalls: Number(callCount.count) || 0,
      totalRevenue: Number(callCount.totalCost) || 0,
      organizationsData,
    };
  }

  // Billing operations
  async getBillingPackages(): Promise<BillingPackage[]> {
    return await db().select().from(billingPackages);
  }

  async getBillingPackage(id: string): Promise<BillingPackage | undefined> {
    const [pkg] = await db().select().from(billingPackages).where(eq(billingPackages.id, id));
    return pkg;
  }

  async createBillingPackage(pkg: Partial<BillingPackage>): Promise<BillingPackage> {
    const [newPkg] = await db().insert(billingPackages).values(pkg as any).returning();
    return newPkg;
  }

  async updateBillingPackage(id: string, updates: Partial<BillingPackage>): Promise<BillingPackage> {
    const [updatedPkg] = await db()
      .update(billingPackages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(billingPackages.id, id))
      .returning();
    if (!updatedPkg) {
      throw new Error("Billing package not found");
    }
    return updatedPkg;
  }

  async deleteBillingPackage(id: string): Promise<void> {
    await db().delete(billingPackages).where(eq(billingPackages.id, id));
  }

  // Payment operations
  async getPaymentHistory(organizationId: string): Promise<Payment[]> {
    return await db()
      .select()
      .from(payments)
      .where(eq(payments.organizationId, organizationId))
      .orderBy(desc(payments.createdAt));
  }

  async getAllPayments(): Promise<Payment[]> {
    return await db()
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const [payment] = await db().insert(payments).values(data).returning();
    return payment;
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment> {
    const [updated] = await db()
      .update(payments)
      .set(data)
      .where(eq(payments.id, id))
      .returning();
    if (!updated) {
      throw new Error("Payment not found");
    }
    return updated;
  }

  // Phone number operations
  async getPhoneNumbers(organizationId: string): Promise<PhoneNumber[]> {
    return await db()
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.organizationId, organizationId))
      .orderBy(desc(phoneNumbers.createdAt));
  }

  async getPhoneNumber(id: string, organizationId: string): Promise<PhoneNumber | undefined> {
    const [phoneNumber] = await db()
      .select()
      .from(phoneNumbers)
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)));
    return phoneNumber;
  }

  async createPhoneNumber(phoneNumber: InsertPhoneNumber): Promise<PhoneNumber> {
    const [newPhoneNumber] = await db().insert(phoneNumbers).values(phoneNumber).returning();
    return newPhoneNumber;
  }

  async updatePhoneNumber(id: string, organizationId: string, updates: Partial<InsertPhoneNumber>): Promise<PhoneNumber> {
    const [updated] = await db()
      .update(phoneNumbers)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)))
      .returning();
    if (!updated) {
      throw new Error("Phone number not found");
    }
    return updated;
  }

  async deletePhoneNumber(id: string, organizationId: string): Promise<void> {
    await db()
      .delete(phoneNumbers)
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)));
  }

  // Batch call operations
  async getBatchCalls(organizationId: string): Promise<BatchCall[]> {
    return await db()
      .select()
      .from(batchCalls)
      .where(eq(batchCalls.organizationId, organizationId))
      .orderBy(desc(batchCalls.createdAt));
  }

  async getBatchCall(id: string, organizationId: string): Promise<BatchCall | undefined> {
    const [batchCall] = await db()
      .select()
      .from(batchCalls)
      .where(and(eq(batchCalls.id, id), eq(batchCalls.organizationId, organizationId)));
    return batchCall;
  }

  async createBatchCall(data: InsertBatchCall): Promise<BatchCall> {
    const [batchCall] = await db().insert(batchCalls).values(data).returning();
    return batchCall;
  }

  async updateBatchCall(id: string, organizationId: string, data: Partial<BatchCall>): Promise<BatchCall> {
    const [updated] = await db()
      .update(batchCalls)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(batchCalls.id, id), eq(batchCalls.organizationId, organizationId)))
      .returning();
    if (!updated) {
      throw new Error("Batch call not found");
    }
    return updated;
  }

  async deleteBatchCall(id: string, organizationId: string): Promise<void> {
    await db()
      .delete(batchCalls)
      .where(and(eq(batchCalls.id, id), eq(batchCalls.organizationId, organizationId)));
  }

  // Batch call recipient operations
  async getBatchCallRecipients(batchCallId: string): Promise<BatchCallRecipient[]> {
    return await db()
      .select()
      .from(batchCallRecipients)
      .where(eq(batchCallRecipients.batchCallId, batchCallId))
      .orderBy(batchCallRecipients.createdAt);
  }

  async createBatchCallRecipients(recipients: InsertBatchCallRecipient[]): Promise<BatchCallRecipient[]> {
    const created = await db().insert(batchCallRecipients).values(recipients).returning();
    return created;
  }

  async updateBatchCallRecipient(id: string, data: Partial<BatchCallRecipient>): Promise<BatchCallRecipient> {
    const [updated] = await db()
      .update(batchCallRecipients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(batchCallRecipients.id, id))
      .returning();
    if (!updated) {
      throw new Error("Batch call recipient not found");
    }
    return updated;
  }

  // System template operations (admin only)
  async getSystemTemplates(): Promise<SystemTemplate[]> {
    return await db()
      .select()
      .from(systemTemplates)
      .where(eq(systemTemplates.isActive, true))
      .orderBy(systemTemplates.order);
  }

  async getSystemTemplate(id: string): Promise<SystemTemplate | undefined> {
    const [template] = await db()
      .select()
      .from(systemTemplates)
      .where(eq(systemTemplates.id, id));
    return template;
  }

  async createSystemTemplate(template: InsertSystemTemplate): Promise<SystemTemplate> {
    const [created] = await db().insert(systemTemplates).values(template).returning();
    return created;
  }

  async updateSystemTemplate(id: string, updates: Partial<InsertSystemTemplate>): Promise<SystemTemplate> {
    const [updated] = await db()
      .update(systemTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(systemTemplates.id, id))
      .returning();
    if (!updated) {
      throw new Error("System template not found");
    }
    return updated;
  }

  async deleteSystemTemplate(id: string): Promise<void> {
    await db().delete(systemTemplates).where(eq(systemTemplates.id, id));
  }

  // Quick Action Button operations
  async getQuickActionButtons(organizationId?: string): Promise<QuickActionButton[]> {
    if (organizationId) {
      // Get system buttons and user's organization buttons
      return await db()
        .select()
        .from(quickActionButtons)
        .where(
          and(
            eq(quickActionButtons.isActive, true),
            or(
              eq(quickActionButtons.isSystem, true),
              eq(quickActionButtons.organizationId, organizationId)
            )
          )
        )
        .orderBy(quickActionButtons.order);
    } else {
      // Get only system buttons
      return await db()
        .select()
        .from(quickActionButtons)
        .where(
          and(
            eq(quickActionButtons.isActive, true),
            eq(quickActionButtons.isSystem, true)
          )
        )
        .orderBy(quickActionButtons.order);
    }
  }

  async getQuickActionButton(id: string): Promise<QuickActionButton | undefined> {
    const [button] = await db()
      .select()
      .from(quickActionButtons)
      .where(eq(quickActionButtons.id, id));
    return button;
  }

  async createQuickActionButton(button: InsertQuickActionButton): Promise<QuickActionButton> {
    const [created] = await db().insert(quickActionButtons).values(button).returning();
    return created;
  }

  async updateQuickActionButton(id: string, updates: Partial<InsertQuickActionButton>): Promise<QuickActionButton> {
    const [updated] = await db()
      .update(quickActionButtons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quickActionButtons.id, id))
      .returning();
    if (!updated) {
      throw new Error("Quick action button not found");
    }
    return updated;
  }

  async deleteQuickActionButton(id: string): Promise<void> {
    await db().delete(quickActionButtons).where(eq(quickActionButtons.id, id));
  }

  // Admin task operations
  async createAdminTask(task: InsertAdminTask): Promise<AdminTask> {
    const [adminTask] = await db().insert(adminTasks).values(task).returning();
    return adminTask;
  }

  async getAdminTasks(status?: "pending" | "in_progress" | "completed" | "rejected"): Promise<AdminTask[]> {
    if (status) {
      return db().select().from(adminTasks).where(eq(adminTasks.status, status));
    }
    return db().select().from(adminTasks).orderBy(desc(adminTasks.createdAt));
  }

  async getAdminTask(id: string): Promise<AdminTask | undefined> {
    const [task] = await db().select().from(adminTasks).where(eq(adminTasks.id, id));
    return task;
  }

  async updateAdminTask(id: string, updates: Partial<AdminTask>): Promise<AdminTask> {
    const [task] = await db()
      .update(adminTasks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(adminTasks.id, id))
      .returning();
    return task;
  }

  async completeApprovalTask(taskId: string, adminId: string): Promise<void> {
    // Get the task
    const task = await this.getAdminTask(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Update the task status
    await this.updateAdminTask(taskId, {
      status: "completed",
      approvedBy: adminId,
      completedAt: new Date(),
    });

    // Update the related entity based on type
    if (task.relatedEntityType === "integration") {
      await this.updateIntegrationStatus(task.relatedEntityId, "ACTIVE");
    } else if (task.relatedEntityType === "rag_configuration") {
      // Update RAG configuration approval status
      await this.approveRagConfiguration(task.relatedEntityId, adminId);
    }
    // Add more entity types as needed (webhook, agent, etc.)
  }

  // RAG Configuration operations
  async getRagConfiguration(organizationId: string): Promise<RagConfiguration | undefined> {
    const [config] = await db()
      .select()
      .from(ragConfigurations)
      .where(eq(ragConfigurations.organizationId, organizationId))
      .orderBy(desc(ragConfigurations.createdAt))
      .limit(1);
    return config;
  }

  async createRagConfiguration(data: InsertRagConfiguration): Promise<RagConfiguration> {
    const [config] = await db().insert(ragConfigurations).values(data).returning();
    return config;
  }

  async updateRagConfiguration(id: string, data: Partial<InsertRagConfiguration>): Promise<RagConfiguration> {
    const [updated] = await db()
      .update(ragConfigurations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ragConfigurations.id, id))
      .returning();
    if (!updated) {
      throw new Error("RAG configuration not found");
    }
    return updated;
  }

  async approveRagConfiguration(id: string, adminId: string): Promise<void> {
    await db()
      .update(ragConfigurations)
      .set({
        approvalStatus: "ACTIVE",
        approvedBy: adminId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ragConfigurations.id, id));
  }

  // Approval webhook operations
  async getApprovalWebhooks(): Promise<ApprovalWebhook[]> {
    return await db().select().from(approvalWebhooks).orderBy(desc(approvalWebhooks.createdAt));
  }

  async getApprovalWebhook(id: string): Promise<ApprovalWebhook | undefined> {
    const [webhook] = await db()
      .select()
      .from(approvalWebhooks)
      .where(eq(approvalWebhooks.id, id));
    return webhook;
  }

  async createApprovalWebhook(webhookData: InsertApprovalWebhook): Promise<ApprovalWebhook> {
    const [webhook] = await db()
      .insert(approvalWebhooks)
      .values(webhookData as any)
      .returning();
    return webhook;
  }

  async updateApprovalWebhook(id: string, updates: Partial<InsertApprovalWebhook>): Promise<ApprovalWebhook> {
    const [webhook] = await db()
      .update(approvalWebhooks)
      .set({ ...updates as any, updatedAt: new Date() })
      .where(eq(approvalWebhooks.id, id))
      .returning();
    if (!webhook) {
      throw new Error("Approval webhook not found");
    }
    return webhook;
  }

  // ========== MULTI-TENANT OPERATIONS ==========

  // Agency operations
  async getAgencies(): Promise<Agency[]> {
    return await db().select().from(agencies).orderBy(desc(agencies.createdAt));
  }

  async getAgency(id: string): Promise<Agency | undefined> {
    const [agency] = await db().select().from(agencies).where(eq(agencies.id, id));
    return agency;
  }

  async getAgencyByOwnerId(ownerId: string): Promise<Agency | undefined> {
    const [agency] = await db().select().from(agencies).where(eq(agencies.ownerId, ownerId));
    return agency;
  }

  async createAgency(agencyData: InsertAgency): Promise<Agency> {
    const [agency] = await db().insert(agencies).values(agencyData).returning();
    return agency;
  }

  async updateAgency(id: string, updates: Partial<Agency>): Promise<Agency> {
    const [updated] = await db()
      .update(agencies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agencies.id, id))
      .returning();
    if (!updated) {
      throw new Error("Agency not found");
    }
    return updated;
  }

  async deleteAgency(id: string): Promise<void> {
    await db().delete(agencies).where(eq(agencies.id, id));
  }

  // Client operations
  async getClients(agencyId: string): Promise<Client[]> {
    return await db()
      .select()
      .from(clients)
      .where(eq(clients.agencyId, agencyId))
      .orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db().select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByUserId(userId: string): Promise<Client | undefined> {
    const [client] = await db().select().from(clients).where(eq(clients.userId, userId));
    return client;
  }

  async createClient(clientData: InsertClient): Promise<Client> {
    const [client] = await db().insert(clients).values(clientData).returning();
    return client;
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const [updated] = await db()
      .update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    if (!updated) {
      throw new Error("Client not found");
    }
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    await db().delete(clients).where(eq(clients.id, id));
  }

  // Agency Plan operations
  async getAgencyPlans(agencyId: string): Promise<AgencyPlan[]> {
    return await db()
      .select()
      .from(agencyPlans)
      .where(eq(agencyPlans.agencyId, agencyId))
      .orderBy(desc(agencyPlans.createdAt));
  }

  async getAgencyPlan(id: string): Promise<AgencyPlan | undefined> {
    const [plan] = await db().select().from(agencyPlans).where(eq(agencyPlans.id, id));
    return plan;
  }

  async createAgencyPlan(planData: InsertAgencyPlan): Promise<AgencyPlan> {
    const [plan] = await db().insert(agencyPlans).values(planData).returning();
    return plan;
  }

  async updateAgencyPlan(id: string, updates: Partial<AgencyPlan>): Promise<AgencyPlan> {
    const [updated] = await db()
      .update(agencyPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agencyPlans.id, id))
      .returning();
    if (!updated) {
      throw new Error("Agency plan not found");
    }
    return updated;
  }

  async deleteAgencyPlan(id: string): Promise<void> {
    await db().delete(agencyPlans).where(eq(agencyPlans.id, id));
  }

  // White Label Settings operations
  async getWhiteLabelSettings(agencyId: string): Promise<WhiteLabelSettings | undefined> {
    const [settings] = await db()
      .select()
      .from(whiteLabelSettings)
      .where(eq(whiteLabelSettings.agencyId, agencyId));
    return settings;
  }

  async upsertWhiteLabelSettings(settingsData: InsertWhiteLabelSettings): Promise<WhiteLabelSettings> {
    const [settings] = await db()
      .insert(whiteLabelSettings)
      .values(settingsData)
      .onConflictDoUpdate({
        target: whiteLabelSettings.agencyId,
        set: { ...settingsData, updatedAt: new Date() },
      })
      .returning();
    return settings;
  }

  // Resource Usage operations
  async getResourceUsage(entityId: string, year: number, month: number): Promise<ResourceUsage | undefined> {
    const [usage] = await db()
      .select()
      .from(resourceUsage)
      .where(
        and(
          eq(resourceUsage.entityId, entityId),
          eq(resourceUsage.year, year),
          eq(resourceUsage.month, month)
        )
      );
    return usage;
  }

  async upsertResourceUsage(usageData: InsertResourceUsage): Promise<ResourceUsage> {
    const [usage] = await db()
      .insert(resourceUsage)
      .values(usageData)
      .onConflictDoUpdate({
        target: [resourceUsage.entityId, resourceUsage.year, resourceUsage.month],
        set: { ...usageData, updatedAt: new Date() },
      })
      .returning();
    return usage;
  }

  async getAgencyResourceUsage(agencyId: string, year: number, month: number): Promise<ResourceUsage[]> {
    return await db()
      .select()
      .from(resourceUsage)
      .where(
        and(
          eq(resourceUsage.agencyId, agencyId),
          eq(resourceUsage.year, year),
          eq(resourceUsage.month, month)
        )
      );
  }

  async deleteApprovalWebhook(id: string): Promise<void> {
    await db()
      .delete(approvalWebhooks)
      .where(eq(approvalWebhooks.id, id));
  }
}

export const storage = new DatabaseStorage();
