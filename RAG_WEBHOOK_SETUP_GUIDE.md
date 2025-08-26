# RAG Webhook Tool Setup Guide for ElevenLabs Agents

## Problem
The RAG webhook is working (returning correct data) but the agent isn't using the tool when answering questions.

## Solution: Manual Webhook Configuration in ElevenLabs

### Step 1: Open Your Agent in ElevenLabs Dashboard
1. Go to [ElevenLabs Dashboard](https://elevenlabs.io)
2. Navigate to **Agents** section
3. Click on your agent to edit it

### Step 2: Add the RAG Webhook Tool
1. Scroll down to **Tools** section
2. Click **"Add Tool"** or **"+ Custom Tool"**
3. Select **"Webhook"** as the tool type

### Step 3: Configure the Webhook Tool

Fill in these exact settings:

**Basic Configuration:**
- **Name**: `RAG Knowledge Base Search`
- **Description**: `Search the knowledge base for information about people, companies, and facts. Use this tool whenever someone asks about specific information, locations, preferences, or details about entities in the knowledge base.`

**Webhook Settings:**
- **Method**: `GET`
- **URL**: `https://your-app-domain.replit.app/api/public/rag`
  - Replace `your-app-domain` with your actual Replit app domain
  - Example: `https://voiceai-dashboard.replit.app/api/public/rag`

**Parameters:**
- Click **"Add Parameter"**
- **Parameter Name**: `query`
- **Parameter Type**: `Query Parameter`
- **Data Type**: `String`
- **Required**: `Yes`
- **Value Type**: `LLM Prompt`
- **Description**: `The search query to find relevant information in the knowledge base`

### Step 4: Update Agent Prompt

Add this instruction to your agent's system prompt:

```
When users ask about specific information, people, companies, or facts, always use the "RAG Knowledge Base Search" tool to search for relevant information before responding. The tool will provide accurate, up-to-date information from the knowledge base.

For example:
- If asked "Where does John live?", use the tool with query "where does John live"
- If asked "What does Sarah eat?", use the tool with query "what does Sarah eat"
- If asked about company services, use the tool with query about the company

Always cite the information from the knowledge base in your response.
```

### Step 5: Save and Test

1. Click **"Save"** to save the webhook tool
2. Click **"Save Agent"** to save all changes
3. Test in the playground with questions like:
   - "Where does John Smith live?"
   - "What does John like to eat?"
   - "Tell me about John's hobbies"

## Troubleshooting

### If the agent still doesn't use the tool:

1. **Check Tool Activation**: Make sure the webhook tool is enabled/active in the agent settings
2. **Verify URL**: Ensure the webhook URL is accessible publicly (test in browser)
3. **Test Response Format**: The webhook should return JSON with a `message` field:
   ```json
   {
     "message": "John Smith lives in Berlin, Germany..."
   }
   ```

### If you get "Unable to find information":

1. **Check Knowledge Base**: Ensure documents are uploaded in the RAG System tab
2. **Test Webhook Directly**: 
   - Open browser: `https://your-app.replit.app/api/public/rag?query=test`
   - Should return a JSON response
3. **Review Agent Logs**: Check the conversation logs to see if the tool is being called

## Quick Setup Using Template (Alternative)

If you haven't added the webhook yet, you can use our template:

1. Go to **Tools** page in the VoiceAI Dashboard
2. Click **"Webhooks"** tab
3. Click **"Add Webhook"**
4. Select **"RAG Knowledge Base"** template
5. The form will auto-fill with correct settings
6. Click **"Save"**
7. Click **"Sync to Agent"** to update the ElevenLabs agent

## Important Notes

- The webhook tool must be manually added to each agent in ElevenLabs
- The agent's prompt should explicitly mention using the tool
- The webhook URL must be publicly accessible (Replit apps are public by default)
- Test the webhook directly in your browser first to ensure it's working

## Testing the Setup

After configuration, test with these queries:
1. "Where does John Smith live?" → Should return: "John Smith lives in Berlin, Germany"
2. "What does John like to eat?" → Should return: "He likes Italian food, vegan burgers, and sushi"
3. "What are John's hobbies?" → Should return: "John enjoys cycling and photography"

If the agent responds with the correct information from your knowledge base, the setup is complete!