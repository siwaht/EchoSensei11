// Optimized sync endpoint for ElevenLabs
export function setupOptimizedSync(app: any, storage: any, isAuthenticated: any, calculateCallCost: any) {
  app.post("/api/sync-calls", isAuthenticated, async (req: any, res: any) => {
    console.log("=== OPTIMIZED SYNC STARTED ===");
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

      const { createElevenLabsClient } = await import("./services/elevenlabs");
      const client = createElevenLabsClient(integration.apiKey);
      
      const agents = await storage.getAgents(user.organizationId);
      console.log(`Found ${agents.length} agents to sync`);
      
      let totalSynced = 0;
      let totalErrors = 0;
      let totalSkipped = 0;
      
      // Step 1: Fetch all conversations in parallel
      console.log("Fetching all conversations...");
      const agentConversations = await Promise.allSettled(
        agents.map(async (agent) => {
          const result = await client.getConversations({
            agent_id: agent.elevenLabsAgentId,
            page_size: 100
          });
          
          if (!result.success) {
            console.error(`Failed for agent ${agent.name}:`, result.error);
            return { agent, conversations: [] };
          }
          
          return { 
            agent, 
            conversations: result.data.conversations || [] 
          };
        })
      );
      
      // Step 2: Filter existing conversations
      const allConversationsToSync = [];
      
      for (const result of agentConversations) {
        if (result.status === 'fulfilled' && result.value) {
          const { agent, conversations } = result.value;
          
          // Check existing conversations in parallel
          const checks = await Promise.all(
            conversations.map(async (conv: any) => {
              const existing = await storage.getCallLogByElevenLabsId(
                conv.conversation_id, 
                user.organizationId
              );
              return { conversation: conv, agent, exists: !!existing };
            })
          );
          
          for (const check of checks) {
            if (!check.exists) {
              allConversationsToSync.push({
                conversation: check.conversation,
                agent: check.agent
              });
            } else {
              totalSkipped++;
            }
          }
        }
      }
      
      console.log(`${allConversationsToSync.length} new conversations, ${totalSkipped} skipped`);
      
      // Step 3: Process in parallel batches
      const BATCH_SIZE = 10;
      
      for (let i = 0; i < allConversationsToSync.length; i += BATCH_SIZE) {
        const batch = allConversationsToSync.slice(i, i + BATCH_SIZE);
        console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allConversationsToSync.length/BATCH_SIZE)}`);
        
        const batchResults = await Promise.allSettled(
          batch.map(async ({ conversation, agent }) => {
            try {
              const detailsResult = await client.getConversation(conversation.conversation_id);
              
              if (!detailsResult.success) {
                throw new Error(`Failed to fetch details`);
              }
              
              const details = detailsResult.data;
              
              // Get audio URL
              let audioUrl = details.audio_url || 
                            details.recording_url || 
                            (details.recordings?.[0]?.url) || 
                            `/api/audio/${conversation.conversation_id}`;
              
              // Process transcript
              let transcriptJson: any = [];
              if (details.transcript) {
                if (typeof details.transcript === 'string') {
                  transcriptJson = [{ role: 'system', message: details.transcript }];
                } else if (Array.isArray(details.transcript)) {
                  transcriptJson = details.transcript.map((msg: any) => ({
                    role: msg.role || (msg.is_agent ? 'agent' : 'user'),
                    message: msg.text || msg.message || msg.content || "",
                    time_in_call_secs: msg.time_in_call_secs
                  }));
                } else if (details.transcript.messages) {
                  transcriptJson = details.transcript.messages.map((msg: any) => ({
                    role: msg.role || (msg.is_agent ? 'agent' : 'user'),
                    message: msg.text || msg.message || msg.content || "",
                    time_in_call_secs: msg.time_in_call_secs
                  }));
                }
              }
              
              // Extract cost data
              const costData = {
                llm_cost: details.llm_cost || conversation.llm_cost,
                cost: details.cost || conversation.cost,
                credits_used: details.credits_used || conversation.credits_used,
              };
              
              // Create call log
              const callData = {
                organizationId: user.organizationId,
                agentId: agent.id,
                conversationId: conversation.conversation_id,
                elevenLabsCallId: conversation.conversation_id,
                duration: details.call_duration_secs || conversation.call_duration_secs || 0,
                transcript: transcriptJson,
                audioUrl: audioUrl,
                cost: calculateCallCost(
                  details.call_duration_secs || conversation.call_duration_secs || 0,
                  costData
                ).toString(),
                status: "completed",
                createdAt: conversation.start_time_unix_secs 
                  ? new Date(conversation.start_time_unix_secs * 1000)
                  : new Date(),
              };
              
              await storage.createCallLog(callData);
              return { success: true };
            } catch (error: any) {
              console.error(`Error: ${error.message}`);
              return { success: false };
            }
          })
        );
        
        // Count results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.success) {
            totalSynced++;
          } else {
            totalErrors++;
          }
        }
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`=== SYNC COMPLETE in ${elapsed}ms ===`);
      console.log(`Synced: ${totalSynced}, Errors: ${totalErrors}, Skipped: ${totalSkipped}`);
      
      const message = totalSynced > 0 
        ? `Synced ${totalSynced} calls in ${(elapsed/1000).toFixed(1)}s` 
        : totalErrors > 0 
          ? `Sync completed with ${totalErrors} errors`
          : "No new calls to sync";
          
      res.json({ message, totalSynced, totalErrors, totalSkipped, timeMs: elapsed });
    } catch (error: any) {
      console.error("SYNC FAILED:", error);
      res.status(500).json({ message: `Failed: ${error.message}` });
    }
  });
}