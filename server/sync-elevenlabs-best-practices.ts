// Optimized ElevenLabs sync using best practices from official documentation
import * as crypto from 'crypto';

// Decrypt API key helper
function decryptApiKey(encryptedKey: string): string {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'your-32-byte-encryption-key-here', 'utf8');
  
  try {
    const encrypted = encryptedKey.replace('enc_', '');
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return encryptedKey; // Return as-is if decryption fails
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
        page_size: '100', // Max allowed per documentation
        ...(cursor && { cursor }),
        ...(agentId && { agent_id: agentId })
      });
      
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
        throw new Error(`Failed to fetch conversations: ${response.status}`);
      }
      
      // Monitor concurrency from response headers
      const currentConcurrent = response.headers.get('current-concurrent-requests');
      const maxConcurrent = response.headers.get('maximum-concurrent-requests');
      
      if (currentConcurrent && maxConcurrent) {
        console.log(`Concurrency: ${currentConcurrent}/${maxConcurrent}`);
      }
      
      const data = await response.json();
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

      const apiKey = integration.apiKey.startsWith('enc_') 
        ? decryptApiKey(integration.apiKey)
        : integration.apiKey;
      
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
        
        // Add agent info to conversations
        allConversations = allConversations.map(conv => ({
          ...conv,
          localAgent: agentMap.get(conv.agent_id)
        })).filter(conv => conv.localAgent); // Only sync conversations for known agents
        
      } catch (error: any) {
        console.error("Failed to fetch conversations:", error);
        return res.status(500).json({ message: `Failed to fetch conversations: ${error.message}` });
      }
      
      // Step 2: Filter out existing conversations
      console.log("Filtering existing conversations...");
      const existingChecks = await Promise.all(
        allConversations.map(async (conv) => {
          const existing = await storage.getCallLogByElevenLabsId(
            conv.conversation_id,
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
          try {
            const response = await fetch(
              `https://api.elevenlabs.io/v1/convai/conversations/${conv.conversation_id}`,
              {
                headers: {
                  'xi-api-key': apiKey,
                  'Content-Type': 'application/json'
                }
              }
            );
            
            if (!response.ok) {
              throw new Error(`Failed to fetch details for ${conv.conversation_id}`);
            }
            
            const details = await response.json();
            
            // Process audio URL
            let audioUrl = details.metadata?.audio_url || 
                          details.metadata?.recording_url || 
                          `/api/audio/${conv.conversation_id}`;
            
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
            
            // Create call log
            const callData = {
              organizationId: user.organizationId,
              agentId: conv.localAgent.id,
              conversationId: conv.conversation_id,
              elevenLabsCallId: conv.conversation_id,
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
            return { success: true, conversationId: conv.conversation_id };
          } catch (error: any) {
            console.error(`Error processing ${conv.conversation_id}:`, error.message);
            return { success: false, conversationId: conv.conversation_id, error: error.message };
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