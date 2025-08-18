import {
  users,
  organizations,
  integrations,
  agents,
  callLogs,
  billingPackages,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sum, avg, max } from "drizzle-orm";

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
  upsertIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegrationStatus(id: string, status: "ACTIVE" | "INACTIVE" | "ERROR", lastTested?: Date): Promise<void>;

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
  createCallLog(callLog: InsertCallLog): Promise<CallLog>;

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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
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
    const [integration] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.organizationId, organizationId), eq(integrations.provider, provider)));
    return integration;
  }

  async upsertIntegration(integrationData: InsertIntegration): Promise<Integration> {
    const [integration] = await db
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

  async updateIntegrationStatus(id: string, status: "ACTIVE" | "INACTIVE" | "ERROR", lastTested?: Date): Promise<void> {
    await db
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
    return db.select().from(agents).where(eq(agents.organizationId, organizationId));
  }

  async getAgent(id: string, organizationId: string): Promise<Agent | undefined> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
    return agent;
  }

  async getAgentByElevenLabsId(elevenLabsAgentId: string, organizationId: string): Promise<Agent | undefined> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.elevenLabsAgentId, elevenLabsAgentId), eq(agents.organizationId, organizationId)));
    return agent;
  }

  async createAgent(agentData: InsertAgent): Promise<Agent> {
    const [agent] = await db.insert(agents).values(agentData).returning();
    return agent;
  }

  async updateAgent(id: string, organizationId: string, updates: Partial<InsertAgent>): Promise<Agent> {
    const [agent] = await db
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)))
      .returning();
    return agent;
  }

  async deleteAgent(id: string, organizationId: string): Promise<void> {
    await db
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
  }

  // Call log operations
  async getCallLogs(organizationId: string, limit = 50, offset = 0, agentId?: string): Promise<CallLog[]> {
    let query = db
      .select()
      .from(callLogs)
      .where(eq(callLogs.organizationId, organizationId))
      .orderBy(desc(callLogs.createdAt))
      .limit(limit)
      .offset(offset);

    if (agentId) {
      query = db
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
    const [callLog] = await db
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.id, id), eq(callLogs.organizationId, organizationId)));
    return callLog;
  }

  async createCallLog(callLogData: InsertCallLog): Promise<CallLog> {
    const [callLog] = await db.insert(callLogs).values(callLogData).returning();
    return callLog;
  }

  async getCallLogByElevenLabsId(elevenLabsCallId: string, organizationId: string): Promise<CallLog | undefined> {
    const [callLog] = await db
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
    const [callStats] = await db
      .select({
        totalCalls: count(callLogs.id),
        totalMinutes: sum(callLogs.duration),
        estimatedCost: sum(callLogs.cost),
        lastSync: max(callLogs.createdAt),
      })
      .from(callLogs)
      .where(eq(callLogs.organizationId, organizationId));

    const [agentStats] = await db
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
    return await db.select().from(users);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db
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
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations);
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    const [updatedOrg] = await db
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
    const [userCount] = await db.select({ count: count(users.id) }).from(users);
    const [orgCount] = await db.select({ count: count(organizations.id) }).from(organizations);
    const [callCount] = await db.select({ 
      count: count(callLogs.id),
      totalCost: sum(callLogs.cost) 
    }).from(callLogs);

    // Get organization-specific data
    const orgs = await db.select().from(organizations);
    const organizationsData = await Promise.all(
      orgs.map(async (org) => {
        const [userStats] = await db
          .select({ count: count(users.id) })
          .from(users)
          .where(eq(users.organizationId, org.id));

        const [callStats] = await db
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
    return await db.select().from(billingPackages);
  }

  async getBillingPackage(id: string): Promise<BillingPackage | undefined> {
    const [pkg] = await db.select().from(billingPackages).where(eq(billingPackages.id, id));
    return pkg;
  }

  async createBillingPackage(pkg: Partial<BillingPackage>): Promise<BillingPackage> {
    const [newPkg] = await db.insert(billingPackages).values(pkg as any).returning();
    return newPkg;
  }

  async updateBillingPackage(id: string, updates: Partial<BillingPackage>): Promise<BillingPackage> {
    const [updatedPkg] = await db
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
    await db.delete(billingPackages).where(eq(billingPackages.id, id));
  }
}

export const storage = new DatabaseStorage();
