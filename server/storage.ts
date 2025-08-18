import {
  users,
  organizations,
  integrations,
  agents,
  callLogs,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sum, avg, max } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

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
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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

    const [user] = await db
      .insert(users)
      .values({ ...userData, organizationId })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          organizationId,
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
}

export const storage = new DatabaseStorage();
