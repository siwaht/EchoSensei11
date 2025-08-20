import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  json,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  pgEnum,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  organizationId: varchar("organization_id").notNull(),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing package enum
export const billingPackageEnum = pgEnum("billing_package", ["starter", "professional", "enterprise", "custom"]);

// Organizations table for multi-tenancy
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  billingPackage: billingPackageEnum("billing_package").default("starter"),
  perCallRate: decimal("per_call_rate", { precision: 10, scale: 4 }).default('0.30'),
  perMinuteRate: decimal("per_minute_rate", { precision: 10, scale: 4 }).default('0.30'),
  monthlyCredits: integer("monthly_credits").default(0),
  usedCredits: integer("used_credits").default(0),
  creditResetDate: timestamp("credit_reset_date"),
  customRateEnabled: boolean("custom_rate_enabled").default(false),
  maxAgents: integer("max_agents").default(5),
  maxUsers: integer("max_users").default(10),
  stripeCustomerId: varchar("stripe_customer_id"),
  subscriptionId: varchar("subscription_id"),
  billingStatus: varchar("billing_status").default('inactive'), // active, inactive, past_due
  lastPaymentDate: timestamp("last_payment_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Integration status enum
export const integrationStatusEnum = pgEnum("integration_status", ["ACTIVE", "INACTIVE", "ERROR"]);

// Phone number provider enum
export const phoneProviderEnum = pgEnum("phone_provider", ["twilio", "sip_trunk"]);

// Phone number status enum  
export const phoneStatusEnum = pgEnum("phone_status", ["active", "inactive", "pending"]);

// Integrations table for storing API keys
export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  provider: varchar("provider").notNull(), // 'elevenlabs'
  apiKey: varchar("api_key").notNull(), // encrypted
  status: integrationStatusEnum("status").notNull().default("INACTIVE"),
  lastTested: timestamp("last_tested"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on organizationId and provider for upsert operations
  uniqueOrgProvider: unique("unique_org_provider").on(table.organizationId, table.provider),
}));

// Phone numbers table
export const phoneNumbers = pgTable("phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  label: varchar("label").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  countryCode: varchar("country_code").notNull().default("+1"),
  provider: phoneProviderEnum("provider").notNull(),
  twilioAccountSid: varchar("twilio_account_sid"),
  twilioAuthToken: varchar("twilio_auth_token"), // encrypted
  sipTrunkUri: varchar("sip_trunk_uri"),
  sipUsername: varchar("sip_username"),
  sipPassword: varchar("sip_password"), // encrypted
  elevenLabsPhoneId: varchar("eleven_labs_phone_id"),
  status: phoneStatusEnum("status").notNull().default("pending"),
  lastSynced: timestamp("last_synced"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agents table
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  elevenLabsAgentId: varchar("eleven_labs_agent_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  firstMessage: text("first_message"),
  systemPrompt: text("system_prompt"),
  language: varchar("language").default("en"),
  voiceId: varchar("voice_id"),
  voiceSettings: json("voice_settings").$type<{
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  }>(),
  llmSettings: json("llm_settings").$type<{
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }>(),
  tools: json("tools").$type<{
    toolIds?: string[];
    webhooks?: Array<{
      id: string;
      name: string;
      url: string;
      method: string;
      description?: string;
    }>;
  }>(),
  dynamicVariables: json("dynamic_variables").$type<Record<string, string>>(),
  evaluationCriteria: json("evaluation_criteria").$type<{
    enabled?: boolean;
    criteria?: string[];
  }>(),
  dataCollection: json("data_collection").$type<{
    enabled?: boolean;
    fields?: Array<{
      name: string;
      type: string;
      description?: string;
    }>;
  }>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Call logs table
export const callLogs = pgTable("call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  agentId: varchar("agent_id").notNull(),
  elevenLabsCallId: varchar("eleven_labs_call_id"),
  duration: integer("duration"), // in seconds
  transcript: text("transcript"),
  audioUrl: varchar("audio_url"),
  cost: decimal("cost", { precision: 10, scale: 4 }),
  status: varchar("status").notNull().default("completed"), // completed, failed, in_progress
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment status enum
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed", "refunded"]);

// Payments table for tracking all payments
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  packageId: varchar("package_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default('usd'),
  status: paymentStatusEnum("status").notNull().default("pending"),
  paymentMethod: varchar("payment_method"), // stripe, paypal
  transactionId: varchar("transaction_id"), // External payment provider transaction ID
  description: text("description"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});



// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  integrations: many(integrations),
  agents: many(agents),
  callLogs: many(callLogs),
  payments: many(payments),
  phoneNumbers: many(phoneNumbers),
  batchCalls: many(batchCalls),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrations.organizationId],
    references: [organizations.id],
  }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [agents.organizationId],
    references: [organizations.id],
  }),
  callLogs: many(callLogs),
}));

export const callLogsRelations = relations(callLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [callLogs.organizationId],
    references: [organizations.id],
  }),
  agent: one(agents, {
    fields: [callLogs.agentId],
    references: [agents.id],
  }),
}));

// Zod schemas
export const upsertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCallLogSchema = createInsertSchema(callLogs).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export const insertPhoneNumberSchema = createInsertSchema(phoneNumbers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Batch Calls table for outbound calling
export const batchCalls = pgTable("batch_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  agentId: varchar("agent_id").notNull(),
  phoneNumberId: varchar("phone_number_id"),
  voiceId: varchar("voice_id"), // Optional voice override for the batch
  elevenlabsBatchId: varchar("elevenlabs_batch_id"),
  status: varchar("status").notNull().default("draft"), // draft, pending, in_progress, completed, failed, cancelled
  totalRecipients: integer("total_recipients").default(0),
  completedCalls: integer("completed_calls").default(0),
  failedCalls: integer("failed_calls").default(0),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 4 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Batch Call Recipients table
export const batchCallRecipients = pgTable("batch_call_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchCallId: varchar("batch_call_id").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  status: varchar("status").notNull().default("pending"), // pending, calling, completed, failed, no_answer, busy
  variables: jsonb("variables"), // Dynamic variables for personalization
  callDuration: integer("call_duration"), // in seconds
  callCost: decimal("call_cost", { precision: 10, scale: 4 }),
  errorMessage: text("error_message"),
  conversationId: varchar("conversation_id"),
  calledAt: timestamp("called_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing Packages table
export const billingPackages = pgTable("billing_packages", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  displayName: varchar("display_name").notNull(),
  perCallRate: decimal("per_call_rate", { precision: 10, scale: 4 }).notNull(),
  perMinuteRate: decimal("per_minute_rate", { precision: 10, scale: 4 }).notNull(),
  monthlyCredits: integer("monthly_credits").notNull(),
  maxAgents: integer("max_agents").notNull(),
  maxUsers: integer("max_users").notNull(),
  features: jsonb("features").notNull().default('[]'),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
  stripeProductId: varchar("stripe_product_id"),
  stripePriceId: varchar("stripe_price_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBillingPackageSchema = createInsertSchema(billingPackages).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertBatchCallSchema = createInsertSchema(batchCalls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBatchCallRecipientSchema = createInsertSchema(batchCallRecipients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Payment relations (defined after billingPackages table)
export const paymentsRelations = relations(payments, ({ one }) => ({
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
  package: one(billingPackages, {
    fields: [payments.packageId],
    references: [billingPackages.id],
  }),
}));

export const billingPackagesRelations = relations(billingPackages, ({ many }) => ({
  payments: many(payments),
}));

// Batch call relations (must be after table definitions)
export const batchCallsRelations = relations(batchCalls, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [batchCalls.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [batchCalls.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [batchCalls.agentId],
    references: [agents.id],
  }),
  phoneNumber: one(phoneNumbers, {
    fields: [batchCalls.phoneNumberId],
    references: [phoneNumbers.id],
  }),
  recipients: many(batchCallRecipients),
}));

export const batchCallRecipientsRelations = relations(batchCallRecipients, ({ one }) => ({
  batchCall: one(batchCalls, {
    fields: [batchCallRecipients.batchCallId],
    references: [batchCalls.id],
  }),
}));

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = z.infer<typeof insertCallLogSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type PhoneNumber = typeof phoneNumbers.$inferSelect;
export type InsertPhoneNumber = z.infer<typeof insertPhoneNumberSchema>;
export type BillingPackage = typeof billingPackages.$inferSelect;
export type InsertBillingPackage = z.infer<typeof insertBillingPackageSchema>;
export type BatchCall = typeof batchCalls.$inferSelect;
export type InsertBatchCall = z.infer<typeof insertBatchCallSchema>;
export type BatchCallRecipient = typeof batchCallRecipients.$inferSelect;
export type InsertBatchCallRecipient = z.infer<typeof insertBatchCallRecipientSchema>;
