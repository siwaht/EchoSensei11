// Optimized ElevenLabs sync using best practices from official documentation
import * as crypto from 'crypto';

// Decrypt API key helper (matching the working decryption from services/elevenlabs.ts)
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
    // Don't throw, just return the key as-is
    return encryptedApiKey;
  }
}

export function setupElevenLabsSyncOptimized(app: any, storage: any, isAuthenticated: any, calculateCallCost: any) {
  
  // Helper function to fetch all conversations using pagination
  async function fetchAllConversationsWithPagination(apiKey: string, agentId?: string) {
    const conversations = [];
    let cursor: string | null = null;
    let hasMore = true;
    
    while (hasMore) {
      const params = new URLSearchParams({
        limit: '100', // Latest API uses 'limit' instead of 'page_size'
        ...(cursor && { cursor }),
        ...(agentId && { agent_id: agentId })
      });
      
      // Ensure API key is valid before making the request
      if (!apiKey || apiKey.length < 10) {
        throw new Error('Invalid API key format. Please check your ElevenLabs API key in Integrations.');
      }
      
      console.log(`Making request to: https://api.elevenlabs.io/v1/convai/conversations?${params}`);
      console.log(`Using API key starting with: ${apiKey.substring(0, 10)}...`);
      
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations?${params}`,
        {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error Response (${response.status}):`, errorText);
        
        if (response.status === 401) {
          throw new Error(`Authentication failed (401). Please check your ElevenLabs API key in Integrations.`);
        } else if (response.status === 403) {
          throw new Error(`Access forbidden (403). Your API key may not have the required permissions.`);
        } else {
          throw new Error(`Failed to fetch conversations: ${response.status} - ${errorText}`);
        }
      }
      
      // Monitor concurrency from response headers
      const currentConcurrent = response.headers.get('current-concurrent-requests');
      const maxConcurrent = response.headers.get('maximum-concurrent-requests');
      
      if (currentConcurrent && maxConcurrent) {
        console.log(`Concurrency: ${currentConcurrent}/${maxConcurrent}`);
      }
      
      // First check if the response is JSON
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();
      
      // Log full response details for debugging
      console.log('Response status:', response.status);
      console.log('Response content-type:', contentType);
      console.log('Response text preview (first 500 chars):', responseText.substring(0, 500));
      
      if (!contentType || !contentType.includes('application/json')) {
        console.error('=== AUTHENTICATION ERROR ===');
        console.error('API returned HTML instead of JSON. This typically means:');
        console.error('1. The API key is invalid or not being sent correctly');
        console.error('2. The API endpoint URL is incorrect');
        console.error('3. Rate limiting or IP blocking');
        console.error('Response HTML:', responseText.substring(0, 1000));
        throw new Error(`Authentication failed - API returned HTML instead of JSON. Please check your ElevenLabs API key.`);
      }
      
      // Try to parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Raw response:', responseText);
        throw new Error('Failed to parse API response as JSON');
      }
      
      // Log the first conversation to understand the structure
      if (data.conversations && data.conversations.length > 0) {
        console.log("Sample conversation structure:", JSON.stringify(data.conversations[0], null, 2));
      }
      
      conversations.push(...(data.conversations || []));
      
      hasMore = data.has_more;
      cursor = data.next_cursor;
      
      console.log(`Fetched ${data.conversations?.length || 0} conversations, has_more: ${hasMore}`);
    }
    
    return conversations;
  }
  
  // Helper function to respect concurrency limits
  async function fetchWithConcurrencyControl(
    requests: (() => Promise<any>)[],
    maxConcurrent: number = 5 // Conservative default
  ) {
    const results = [];
    
    for (let i = 0; i < requests.length; i += maxConcurrent) {
      const batch = requests.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(batch.map(fn => fn()));
      results.push(...batchResults);
      
      // Small delay between batches to avoid overwhelming the API
      if (i + maxConcurrent < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }
  
  app.post("/api/sync-calls", isAuthenticated, async (req: any, res: any) => {
    console.log("=== ELEVENLABS SYNC STARTED (BEST PRACTICES) ===");
    const startTime = Date.now();
    
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

      // Decrypt API key - always decrypt since the storage encrypts all API keys
      let apiKey = integration.apiKey;
      console.log("Raw API key length:", apiKey.length);
      console.log("API key format check - starts with 'enc_':", apiKey.startsWith('enc_'));
      console.log("API key format check - includes ':':", apiKey.includes(':'));
      console.log("First few chars of encrypted key:", apiKey.substring(0, 20));
      
      // Always try to decrypt since the storage encrypts all API keys
      try {
        apiKey = decryptApiKey(apiKey);
        console.log("API key decrypted, length:", apiKey.length);
        console.log("Decrypted key starts with 'sk-':", apiKey.startsWith('sk-'));
      } catch (error) {
        console.error("Failed to decrypt API key, using as-is:", error);
      }
      
      // Step 1: Fetch ALL conversations using the List API with pagination
      console.log("Fetching all conversations with pagination...");
      let allConversations = [];
      
      try {
        // Option 1: Fetch all conversations at once (no agent filter)
        allConversations = await fetchAllConversationsWithPagination(apiKey);
        console.log(`Total conversations fetched: ${allConversations.length}`);
        
        // Get agent mapping for later use
        const agents = await storage.getAgents(user.organizationId);
        const agentMap = new Map(agents.map(a => [a.elevenLabsAgentId, a]));
        
        // Add agent info to conversations - check both 'id' and 'conversation_id' fields
        allConversations = allConversations.map(conv => {
          // The API might return 'id' or 'conversation_id' - check both
          const conversationId = conv.conversation_id || conv.id;
          const agentId = conv.agent_id;
          
          if (!conversationId) {
            console.error('Missing conversation ID in object. Keys available:', Object.keys(conv));
            console.error('Full conversation object:', JSON.stringify(conv, null, 2));
            return null;
          }
          
          console.log(`Found conversation: ${conversationId} for agent: ${agentId}`);
          
          return {
            ...conv,
            conversation_id: conversationId, // Normalize to conversation_id
            agent_id: agentId,
            localAgent: agentMap.get(agentId)
          };
        }).filter(conv => conv && conv.localAgent); // Filter out null entries and conversations for unknown agents
        
      } catch (error: any) {
        console.error("Failed to fetch conversations:", error);
        return res.status(500).json({ message: `Failed to fetch conversations: ${error.message}` });
      }
      
      // Step 2: Filter out existing conversations
      console.log("Filtering existing conversations...");
      const existingChecks = await Promise.all(
        allConversations.map(async (conv) => {
          // Use conversation_id field from API response (already normalized)
          const convId = conv.conversation_id;
          if (!convId) {
            console.error('Conversation ID is null for conv:', conv);
            return { conversation: conv, exists: false };
          }
          const existing = await storage.getCallLogByElevenLabsId(
            convId,
            user.organizationId
          );
          return { conversation: conv, exists: !!existing };
        })
      );
      
      const conversationsToSync = existingChecks
        .filter(check => !check.exists)
        .map(check => check.conversation);
      
      const skippedCount = allConversations.length - conversationsToSync.length;
      console.log(`New conversations to sync: ${conversationsToSync.length}`);
      console.log(`Existing conversations skipped: ${skippedCount}`);
      
      // Step 3: Fetch details for new conversations with concurrency control
      let totalSynced = 0;
      let totalErrors = 0;
      
      if (conversationsToSync.length > 0) {
        // Create request functions for each conversation
        const detailRequests = conversationsToSync.map(conv => async () => {
          const convId = conv.conversation_id;  // Use normalized conversation_id
          
          if (!convId) {
            console.error('Conversation ID is null when fetching details:', conv);
            return { success: false, conversationId: null, error: 'Missing conversation ID' };
          }
          
          try {
            const response = await fetch(
              `https://api.elevenlabs.io/v1/convai/conversations/${convId}`,
              {
                headers: {
                  'xi-api-key': apiKey,
                  'Content-Type': 'application/json'
                }
              }
            );
            
            if (!response.ok) {
              throw new Error(`Failed to fetch details for ${convId}`);
            }
            
            const details = await response.json();
            
            // Process audio URL
            let audioUrl = details.metadata?.audio_url || 
                          details.metadata?.recording_url || 
                          `/api/audio/${convId}`;
            
            // Process transcript
            let transcriptJson: any = [];
            if (details.transcript) {
              if (Array.isArray(details.transcript)) {
                transcriptJson = details.transcript.map((msg: any) => ({
                  role: msg.role || (msg.is_agent ? 'agent' : 'user'),
                  message: msg.text || msg.message || msg.content || "",
                  time_in_call_secs: msg.time_in_call_secs
                }));
              } else {
                transcriptJson = [{ role: 'system', message: JSON.stringify(details.transcript) }];
              }
            }
            
            // Extract metadata
            const metadata = details.metadata || {};
            const costData = {
              llm_cost: metadata.llm_cost || 0,
              cost: metadata.cost || 0,
              credits_used: metadata.credits_used || 0,
            };
            
            // Create call log - ensure convId is not null
            if (!convId) {
              throw new Error('Conversation ID is null when creating call log');
            }
            
            const callData = {
              organizationId: user.organizationId,
              agentId: conv.localAgent.id,
              conversationId: convId,
              elevenLabsCallId: convId,
              duration: metadata.call_duration_secs || 0,
              transcript: transcriptJson,
              audioUrl: audioUrl,
              cost: calculateCallCost(
                metadata.call_duration_secs || 0,
                costData
              ).toString(),
              status: details.status || "completed",
              createdAt: conv.start_time_unix_secs 
                ? new Date(conv.start_time_unix_secs * 1000)
                : new Date(),
            };
            
            await storage.createCallLog(callData);
            return { success: true, conversationId: convId };
          } catch (error: any) {
            console.error(`Error processing ${convId}:`, error.message);
            return { success: false, conversationId: convId, error: error.message };
          }
        });
        
        // Fetch details with concurrency control (5 concurrent requests)
        console.log("Fetching conversation details with concurrency control...");
        const results = await fetchWithConcurrencyControl(detailRequests, 5);
        
        // Count results
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            totalSynced++;
          } else {
            totalErrors++;
          }
        }
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`=== SYNC COMPLETE in ${(elapsed/1000).toFixed(1)}s ===`);
      console.log(`Synced: ${totalSynced}, Errors: ${totalErrors}, Skipped: ${skippedCount}`);
      
      const message = totalSynced > 0 
        ? `Synced ${totalSynced} calls in ${(elapsed/1000).toFixed(1)}s` 
        : totalErrors > 0 
          ? `Sync completed with ${totalErrors} errors`
          : "No new calls to sync";
          
      res.json({ 
        message, 
        totalSynced, 
        totalErrors, 
        totalSkipped: skippedCount,
        totalProcessed: allConversations.length,
        timeMs: elapsed 
      });
    } catch (error: any) {
      console.error("SYNC FAILED:", error);
      res.status(500).json({ message: `Failed: ${error.message}` });
    }
  });
}