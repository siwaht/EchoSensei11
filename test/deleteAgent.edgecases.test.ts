import { db } from "../server/db";
import { agents, organizations } from "../shared/schema";
import { storage } from "../server/storage";
import { eq, and } from "drizzle-orm";

async function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function agentExists(agentId: string, orgId: string) {
  const rows = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.organizationId, orgId)));
  return rows.length > 0;
}

async function main() {
  const ts = Date.now();

  // Setup organizations
  const orgA = `org-a-${ts}`;
  const orgB = `org-b-${ts}`;
  await db.insert(organizations).values([
    { id: orgA, name: "Org A", createdAt: new Date() },
    { id: orgB, name: "Org B", createdAt: new Date() },
  ]);

  // Case 1: Delete agent that exists
  const agent1 = `agent-1-${ts}`;
  await db.insert(agents).values({
    id: agent1,
    organizationId: orgA,
    elevenLabsAgentId: `ele-${ts}-1`,
    name: "Agent 1",
    description: "exists then delete",
    isActive: true,
    createdAt: new Date(),
  });

  // Precondition
  assert(await agentExists(agent1, orgA), "Case1: agent should exist before deletion");

  await storage.deleteAgent(agent1, orgA);
  assert(!(await agentExists(agent1, orgA)), "Case1: agent should be deleted");

  console.log("PASS: Case 1 - delete existing agent works");

  // Case 2: Delete non-existent agent (should be idempotent/no throw)
  const nonexistent = `agent-nonexistent-${ts}`;
  await storage.deleteAgent(nonexistent, orgA);
  // Nothing to assert other than no throw
  console.log("PASS: Case 2 - deleting non-existent agent does not throw");

  // Case 3: Agent in Org A must not be deletable via Org B
  const agentCross = `agent-cross-${ts}`;
  await db.insert(agents).values({
    id: agentCross,
    organizationId: orgA,
    elevenLabsAgentId: `ele-${ts}-cross`,
    name: "Cross Org Agent",
    description: "ensure other org cannot delete",
    isActive: true,
    createdAt: new Date(),
  });

  // Attempt delete with wrong org
  await storage.deleteAgent(agentCross, orgB);
  // Ensure still exists
  assert(await agentExists(agentCross, orgA), "Case3: agent should NOT be deleted by other org");

  // Now delete with correct org
  await storage.deleteAgent(agentCross, orgA);
  assert(!(await agentExists(agentCross, orgA)), "Case3: agent should be deleted by owning org");

  console.log("PASS: Case 3 - cross-org protection works");

  // Case 4: Double delete should be safe/idempotent
  const agentDouble = `agent-double-${ts}`;
  await db.insert(agents).values({
    id: agentDouble,
    organizationId: orgA,
    elevenLabsAgentId: `ele-${ts}-double`,
    name: "Double Delete Agent",
    description: "delete twice",
    isActive: true,
    createdAt: new Date(),
  });
  await storage.deleteAgent(agentDouble, orgA);
  await storage.deleteAgent(agentDouble, orgA); // second time should not throw
  assert(!(await agentExists(agentDouble, orgA)), "Case4: agent should remain deleted after double delete");

  console.log("PASS: Case 4 - double delete is idempotent");

  console.log("All deleteAgent edge cases passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
