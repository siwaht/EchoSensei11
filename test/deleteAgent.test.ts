import { db } from "../server/db";
import { agents, organizations } from "../shared/schema";
import { storage } from "../server/storage";
import { eq, and } from "drizzle-orm";

async function main() {
  const ts = Date.now();
  const orgId = `test-org-${ts}`;
  const agentId = `test-agent-${ts}`;

  console.log("Setting up test data...");
  // Insert test organization
  await db.insert(organizations).values({
    id: orgId,
    name: `Test Org ${new Date(ts).toISOString()}`,
    createdAt: new Date()
  });

  // Insert test agent
  await db.insert(agents).values({
    id: agentId,
    organizationId: orgId,
    elevenLabsAgentId: "fake-elevenlabs-agent",
    name: "Test Agent For Delete",
    description: "Temporary agent for deleteAgent test",
    isActive: true,
    createdAt: new Date()
  });

  // Verify agent exists before delete
  const before = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.organizationId, orgId)));

  if (before.length !== 1) {
    throw new Error("Setup failed: agent not found after insert");
  }
  console.log("Setup complete. Agent exists before deletion.");

  // Execute deletion with the corrected parameter order: (id, organizationId)
  console.log("Calling storage.deleteAgent(id, organizationId)...");
  await storage.deleteAgent(agentId, orgId);

  // Verify agent is deleted
  const after = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.organizationId, orgId)));

  if (after.length !== 0) {
    throw new Error("Delete failed: agent still present after deletion");
  }

  console.log("PASS: storage.deleteAgent(id, organizationId) deleted the agent successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
