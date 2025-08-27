import crypto from "crypto";

export interface ElevenLabsConfig {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

class ElevenLabsService {
  private config: ElevenLabsConfig;
  private defaultHeaders: HeadersInit;

  constructor(config: ElevenLabsConfig) {
    this.config = {
      baseUrl: "https://api.elevenlabs.io",
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };

    this.defaultHeaders = {
      "xi-api-key": this.config.apiKey,
      "Content-Type": "application/json",
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const maxRetries = this.config.maxRetries || 3;
    const retryDelay = this.config.retryDelay || 1000;

    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.defaultHeaders,
            ...options.headers,
          },
        });

        const responseText = await response.text();
        
        if (!response.ok) {
          // Don't retry on client errors (400-499)
          if (response.status >= 400 && response.status < 500) {
            let errorMessage = `API Error: ${response.status} ${response.statusText}`;
            try {
              const errorData = JSON.parse(responseText);
              errorMessage = errorData.message || errorData.detail?.message || errorMessage;
            } catch {
              errorMessage = responseText || errorMessage;
            }
            
            return {
              success: false,
              error: errorMessage,
              statusCode: response.status,
            };
          }
          
          // Retry on server errors (500-599)
          throw new Error(`Server error: ${response.status}`);
        }

        // Parse successful response
        let data: T;
        try {
          data = responseText ? JSON.parse(responseText) : null;
        } catch {
          data = responseText as unknown as T;
        }

        return {
          success: true,
          data,
          statusCode: response.status,
        };
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on the last attempt
        if (attempt < maxRetries - 1) {
          // Exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          console.log(`Retrying ElevenLabs API call (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || "Failed after maximum retries",
    };
  }

  // User endpoints
  async getUser() {
    return this.makeRequest<any>("/v1/user");
  }

  async getSubscription() {
    const result = await this.getUser();
    return {
      success: result.success,
      data: result.data?.subscription,
      error: result.error,
    };
  }

  // Agent endpoints
  async getAgents() {
    return this.makeRequest<any>("/v1/convai/agents");
  }

  async getAgent(agentId: string) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}`);
  }

  async createAgent(agentData: any) {
    return this.makeRequest<any>("/v1/convai/agents", {
      method: "POST",
      body: JSON.stringify(agentData),
    });
  }

  async updateAgent(agentId: string, updates: any) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteAgent(agentId: string) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}`, {
      method: "DELETE",
    });
  }

  // Conversation endpoints
  async getConversations(params?: {
    agent_id?: string;
    page_size?: number;
    page?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.agent_id) queryParams.append("agent_id", params.agent_id);
    if (params?.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params?.page) queryParams.append("page", params.page.toString());
    
    const endpoint = `/v1/convai/conversations${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.makeRequest<any>(endpoint);
  }

  async getConversation(conversationId: string) {
    return this.makeRequest<any>(`/v1/convai/conversations/${conversationId}`);
  }

  async getConversationTranscript(conversationId: string) {
    return this.makeRequest<any>(`/v1/convai/conversations/${conversationId}/transcript`);
  }

  async sendConversationFeedback(conversationId: string, feedback: any) {
    return this.makeRequest<any>(`/v1/convai/conversations/${conversationId}/feedback`, {
      method: "POST",
      body: JSON.stringify(feedback),
    });
  }

  // Voice endpoints
  async getVoices() {
    return this.makeRequest<any>("/v1/voices");
  }

  async getVoice(voiceId: string) {
    return this.makeRequest<any>(`/v1/voices/${voiceId}`);
  }

  // Text-to-speech endpoints
  async textToSpeech(text: string, voiceId: string, modelId?: string) {
    const response = await fetch(`${this.config.baseUrl}/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        ...this.defaultHeaders,
      },
      body: JSON.stringify({
        text,
        model_id: modelId || "eleven_multilingual_v2",
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.status}`);
    }

    return response.arrayBuffer();
  }

  // WebRTC session endpoints
  async createWebRTCSession(agentId: string, enableMicrophone: boolean = true) {
    return this.makeRequest<any>("/v1/convai/conversation/websocket", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agentId,
        enable_microphone: enableMicrophone,
      }),
    });
  }

  async createWebSocketSession(agentId: string) {
    return this.makeRequest<any>("/v1/convai/conversation/websocket", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agentId,
      }),
    });
  }

  // Phone endpoints
  async getPhoneNumbers(agentId?: string) {
    const endpoint = agentId 
      ? `/v1/convai/phone-numbers?agent_id=${agentId}`
      : "/v1/convai/phone-numbers";
    return this.makeRequest<any>(endpoint);
  }

  async createPhoneNumber(phoneNumberData: any) {
    return this.makeRequest<any>("/v1/convai/phone-numbers", {
      method: "POST",
      body: JSON.stringify(phoneNumberData),
    });
  }

  async deletePhoneNumber(phoneNumberId: string) {
    return this.makeRequest<any>(`/v1/convai/phone-numbers/${phoneNumberId}`, {
      method: "DELETE",
    });
  }

  // Analytics endpoints
  async getUsageAnalytics(startDate?: string, endDate?: string) {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append("start_date", startDate);
    if (endDate) queryParams.append("end_date", endDate);
    
    const endpoint = `/v1/usage/character-stats${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.makeRequest<any>(endpoint);
  }

  async getMCPStatus() {
    return this.makeRequest<any>("/v1/convai/mcp/status");
  }

  async updateMCPConfig(config: any) {
    return this.makeRequest<any>("/v1/convai/mcp/config", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  // Tool endpoints
  async getTools() {
    return this.makeRequest<any>("/v1/convai/tools");
  }

  async createTool(toolData: any) {
    return this.makeRequest<any>("/v1/convai/tools", {
      method: "POST",
      body: JSON.stringify(toolData),
    });
  }

  async updateTool(toolId: string, updates: any) {
    return this.makeRequest<any>(`/v1/convai/tools/${toolId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async deleteTool(toolId: string) {
    return this.makeRequest<any>(`/v1/convai/tools/${toolId}`, {
      method: "DELETE",
    });
  }
}

// Helper function to decrypt API key
export function decryptApiKey(encryptedApiKey: string): string {
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
    throw new Error("Failed to decrypt API key. Please re-enter your API key.");
  }
}

// Factory function to create client with encrypted key
export function createElevenLabsClient(encryptedApiKey: string): ElevenLabsService {
  const decryptedKey = decryptApiKey(encryptedApiKey);
  return new ElevenLabsService({ apiKey: decryptedKey });
}

export default ElevenLabsService;