import { db } from "./db";
import { systemTemplates } from "@shared/schema";
import { sql } from "drizzle-orm";

const defaultTemplates = [
  {
    name: "Persona",
    content: `## Persona
You are {agent_name}, a {role_description}.

### Key Characteristics:
- {characteristic_1}
- {characteristic_2}
- {characteristic_3}

### Background:
{background_info}

### Communication Style:
{communication_style}`,
    icon: "User",
    color: "bg-blue-500 hover:bg-blue-600",
    order: 1,
  },
  {
    name: "Guardrails",
    content: `## Safety & Guidelines

### Never:
- Provide financial, medical, or legal advice
- Share personal or confidential information
- Make promises beyond your capabilities
- Engage in harmful or inappropriate conversations

### Always:
- Be respectful and professional
- Redirect to appropriate professionals when needed
- Maintain conversation boundaries
- Protect user privacy`,
    icon: "Shield",
    color: "bg-red-500 hover:bg-red-600",
    order: 2,
  },
  {
    name: "Webhook",
    content: `## Webhook Integration

### Available Webhooks:
- **{webhook_name}**: {webhook_description}
  - Endpoint: {webhook_url}
  - Method: {method}
  - Trigger: {trigger_condition}

### Usage:
When {trigger_condition}, call the {webhook_name} webhook to {action_description}.`,
    icon: "Webhook",
    color: "bg-purple-500 hover:bg-purple-600",
    order: 3,
  },
  {
    name: "Sheets",
    content: `## Google Sheets Integration

### Connected Sheet:
- Sheet ID: {sheet_id}
- Sheet Name: {sheet_name}

### Available Actions:
- Read data from {range}
- Write data to {range}
- Update existing records
- Search for specific values

### Usage:
Use this integration to {use_case_description}.`,
    icon: "Sheet",
    color: "bg-green-500 hover:bg-green-600",
    order: 4,
  },
  {
    name: "Calendar",
    content: `## Calendar Integration

### Available Actions:
- Check availability
- Schedule appointments
- Send reminders
- Reschedule or cancel bookings

### Business Hours:
{business_hours}

### Booking Rules:
- Minimum notice: {min_notice}
- Maximum advance booking: {max_advance}
- Duration: {appointment_duration}`,
    icon: "Calendar",
    color: "bg-indigo-500 hover:bg-indigo-600",
    order: 5,
  },
  {
    name: "RAG",
    content: `## Knowledge Base (RAG)

### Available Documents:
- {document_1_name}: {document_1_description}
- {document_2_name}: {document_2_description}

### Usage Instructions:
When asked about {topic}, search the knowledge base for relevant information and provide accurate, contextual responses based on the available documents.

### Important:
- Only provide information from the knowledge base
- Cite sources when possible
- Acknowledge when information is not available`,
    icon: "Database",
    color: "bg-amber-500 hover:bg-amber-600",
    order: 6,
  },
  {
    name: "All Tools",
    content: `## Complete Tool Integration

You have access to multiple tools and integrations:

### Available Tools:
1. **Webhooks**: Trigger external actions and retrieve data
2. **Google Sheets**: Read/write spreadsheet data
3. **Calendar**: Manage appointments and scheduling
4. **Knowledge Base**: Access document information via RAG
5. **Data Collection**: Gather and store user information
6. **Dynamic Variables**: Use context-aware variables

### Tool Usage Guidelines:
- Use the appropriate tool for each task
- Combine tools when necessary for complex workflows
- Always confirm successful tool execution
- Handle errors gracefully and inform the user

### Priority Order:
1. Check knowledge base first for information queries
2. Use calendar for scheduling requests
3. Update sheets for data tracking
4. Trigger webhooks for external actions`,
    icon: "Sparkles",
    color: "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600",
    order: 7,
  },
];

async function seedSystemTemplates() {
  try {
    console.log("Seeding system templates...");
    
    // Check if templates already exist
    const existingTemplates = await db.select().from(systemTemplates);
    
    if (existingTemplates.length === 0) {
      // Insert default templates
      for (const template of defaultTemplates) {
        await db.insert(systemTemplates).values({
          name: template.name,
          content: template.content,
          icon: template.icon,
          color: template.color,
          order: template.order,
          isActive: true,
        });
        console.log(`Added template: ${template.name}`);
      }
      console.log("System templates seeded successfully!");
    } else {
      console.log("System templates already exist, skipping seed.");
    }
  } catch (error) {
    console.error("Error seeding system templates:", error);
  }
}

// Run the seed function
seedSystemTemplates().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("Failed to seed system templates:", error);
  process.exit(1);
});