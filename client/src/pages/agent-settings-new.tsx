import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Trash2, Globe, FileText, ExternalLink, TestTube2,
  ChevronDown, ChevronRight, Copy, Settings, X
} from "lucide-react";
import type { Agent } from "@shared/schema";

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels?: {
    accent?: string;
    age?: string;
    gender?: string;
    description?: string;
  };
  preview_url?: string;
}

// Available tools for ElevenLabs agents
const AVAILABLE_TOOLS = [
  { id: "end_call", name: "End call", description: "Gives agent the ability to end the call with the user." },
  { id: "detect_language", name: "Detect language", description: "Gives agent the ability to change the language during conversation." },
  { id: "skip_turn", name: "Skip turn", description: "Agent will skip its turn if user explicitly indicates they need a moment." },
  { id: "transfer_to_agent", name: "Transfer to agent", description: "Gives agent the ability to transfer the call to another AI agent." },
  { id: "transfer_to_number", name: "Transfer to number", description: "Gives agent the ability to transfer the call to a human." },
  { id: "play_keypad_touch_tone", name: "Play keypad touch tone", description: "Gives agent the ability to play keypad touch tones during a phone call." },
  { id: "voicemail_detection", name: "Voicemail detection", description: "Allows agent to detect voicemail systems and optionally leave a message." },
];

const LLM_MODELS = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  { id: "claude-3-opus", name: "Claude 3 Opus" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
];

export default function AgentSettingsNew() {
  const { agentId } = useParams() as { agentId: string };
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("agent");
  const [showAddVariable, setShowAddVariable] = useState(false);
  const [newVariableName, setNewVariableName] = useState("");
  const [newVariableValue, setNewVariableValue] = useState("");

  const [settings, setSettings] = useState({
    // Agent tab settings
    name: "",
    language: "en",
    additionalLanguages: [] as string[],
    firstMessage: "",
    systemPrompt: "",
    dynamicVariables: {} as Record<string, string>,
    
    // LLM settings
    model: "gemini-2.0-flash",
    temperature: 0.7,
    maxTokens: 0,
    
    // Knowledge base
    documents: [] as Array<{ id: string; name: string; type: string; url?: string }>,
    
    // Tools
    enabledTools: [] as string[],
    customTools: [] as Array<{ id: string; name: string; description: string; url: string }>,
    
    // Voice settings
    voiceId: "",
    voiceSettings: {
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      useSpeakerBoost: true,
    },
    
    // Analysis settings
    evaluationEnabled: false,
    evaluationCriteria: [] as string[],
    
    // Security settings
    authEnabled: false,
    authMethods: [] as string[],
    
    // Advanced settings
    webhooks: [] as Array<{ id: string; url: string; events: string[] }>,
    dataCollection: {
      enabled: false,
      fields: [] as Array<{ name: string; type: string; required: boolean }>,
    },
  });

  // Fetch agent data
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agent = agents.find(a => a.id === agentId);

  // Fetch available voices
  const { data: voices = [], isLoading: voicesLoading } = useQuery<Voice[]>({
    queryKey: ["/api/voiceai/voices"],
    enabled: !!agent,
  });

  // Update settings when agent data is loaded
  useEffect(() => {
    if (agent) {
      setSettings({
        name: agent.name,
        language: agent.language || "en",
        additionalLanguages: [],
        firstMessage: agent.firstMessage || "",
        systemPrompt: agent.systemPrompt || "",
        dynamicVariables: agent.dynamicVariables || {},
        model: agent.llmSettings?.model || "gemini-2.0-flash",
        temperature: agent.llmSettings?.temperature || 0.7,
        maxTokens: agent.llmSettings?.maxTokens || 0,
        documents: agent.knowledgeBase?.documents || [],
        enabledTools: agent.tools?.toolIds || [],
        customTools: [],
        voiceId: agent.voiceId || "",
        voiceSettings: {
          stability: agent.voiceSettings?.stability ?? 0.5,
          similarityBoost: agent.voiceSettings?.similarityBoost ?? 0.75,
          style: agent.voiceSettings?.style ?? 0,
          useSpeakerBoost: agent.voiceSettings?.useSpeakerBoost ?? true,
        },
        evaluationEnabled: agent.evaluationCriteria?.enabled || false,
        evaluationCriteria: agent.evaluationCriteria?.criteria || [],
        authEnabled: false,
        authMethods: [],
        webhooks: [],
        dataCollection: {
          enabled: agent.dataCollection?.enabled ?? false,
          fields: agent.dataCollection?.fields?.map(f => ({
            name: f.name,
            type: f.type,
            required: f.description ? true : false,
          })) || [],
        },
      });
    }
  }, [agent]);

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/agents/${agentId}`, {
        name: settings.name,
        firstMessage: settings.firstMessage,
        systemPrompt: settings.systemPrompt,
        language: settings.language,
        voiceId: settings.voiceId,
        voiceSettings: settings.voiceSettings,
        llmSettings: {
          model: settings.model,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
        },
        knowledgeBase: {
          useRag: settings.documents.length > 0,
          documents: settings.documents,
        },
        tools: {
          toolIds: settings.enabledTools,
          webhooks: settings.customTools,
        },
        dynamicVariables: settings.dynamicVariables,
        evaluationCriteria: {
          enabled: settings.evaluationEnabled,
          criteria: settings.evaluationCriteria,
        },
        dataCollection: settings.dataCollection,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent settings updated successfully" });
      setLocation("/agents");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update agent settings", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const handleAddVariable = () => {
    if (newVariableName && !settings.dynamicVariables[newVariableName]) {
      setSettings({
        ...settings,
        dynamicVariables: {
          ...settings.dynamicVariables,
          [newVariableName]: newVariableValue,
        },
      });
      setNewVariableName("");
      setNewVariableValue("");
      setShowAddVariable(false);
    }
  };

  const handleRemoveVariable = (key: string) => {
    const newVars = { ...settings.dynamicVariables };
    delete newVars[key];
    setSettings({ ...settings, dynamicVariables: newVars });
  };

  const handleAddDocument = () => {
    const newDoc = {
      id: `doc_${Date.now()}`,
      name: "New Document",
      type: "text",
      url: "",
    };
    setSettings({
      ...settings,
      documents: [...settings.documents, newDoc],
    });
  };

  const handleRemoveDocument = (id: string) => {
    setSettings({
      ...settings,
      documents: settings.documents.filter(d => d.id !== id),
    });
  };

  const handleToggleTool = (toolId: string) => {
    const isEnabled = settings.enabledTools.includes(toolId);
    setSettings({
      ...settings,
      enabledTools: isEnabled 
        ? settings.enabledTools.filter(id => id !== toolId)
        : [...settings.enabledTools, toolId],
    });
  };

  if (agentsLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <p>Loading agent settings...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <p>Agent not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-950">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/agents">
                <a className="text-sm text-muted-foreground hover:text-foreground">Agents</a>
              </Link>
              <span className="text-muted-foreground">/</span>
              <h1 className="text-xl font-semibold">{agent.name}</h1>
              <Badge variant="outline" className="text-xs">
                Public
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/playground?agentId=${agent.id}`, '_blank')}
                data-testid="button-test-agent"
              >
                <TestTube2 className="h-4 w-4 mr-2" />
                Test AI agent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`agent_${agent.elevenLabsAgentId}`);
                  toast({ title: "Agent ID copied to clipboard" });
                }}
                data-testid="button-copy-link"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy link
              </Button>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground font-mono">
              agent_{agent.elevenLabsAgentId}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white dark:bg-gray-950">
        <div className="container mx-auto px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-12 bg-transparent border-0 p-0">
              <TabsTrigger 
                value="agent" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-black dark:data-[state=active]:border-white rounded-none"
              >
                Agent
              </TabsTrigger>
              <TabsTrigger 
                value="voice" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-black dark:data-[state=active]:border-white rounded-none"
              >
                Voice <Badge variant="secondary" className="ml-2 text-xs">New</Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="analysis" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-black dark:data-[state=active]:border-white rounded-none"
              >
                Analysis
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-black dark:data-[state=active]:border-white rounded-none"
              >
                Security
              </TabsTrigger>
              <TabsTrigger 
                value="advanced" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-black dark:data-[state=active]:border-white rounded-none"
              >
                Advanced
              </TabsTrigger>
              <TabsTrigger 
                value="widget" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-black dark:data-[state=active]:border-white rounded-none"
              >
                Widget <Badge variant="secondary" className="ml-2 text-xs">New + Chat</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Agent Tab */}
          <TabsContent value="agent" className="space-y-8 mt-0">
            {/* Agent Language */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="language" className="text-base font-medium">Agent Language</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose the default language the agent will communicate in.
                </p>
                <Select
                  value={settings.language}
                  onValueChange={(value) => setSettings({ ...settings, language: value })}
                >
                  <SelectTrigger className="w-full max-w-xs" data-testid="select-language">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🇺🇸</span>
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="ko">Korean</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Languages */}
              <div>
                <Label className="text-base font-medium">Additional Languages</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Specify additional languages which callers can choose from.
                </p>
                <Button variant="outline" size="sm" data-testid="button-add-language">
                  Add additional languages
                </Button>
              </div>
            </div>

            <div className="border-t pt-8">
              {/* First Message */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="first-message" className="text-base font-medium">First message</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    The first message the agent will say. If empty, the agent will wait for the user to start the conversation.
                  </p>
                  <Textarea
                    id="first-message"
                    value={settings.firstMessage}
                    onChange={(e) => setSettings({ ...settings, firstMessage: e.target.value })}
                    placeholder="Hey there, I'm Alexis from siwaht.com. How can I help you today?"
                    rows={2}
                    className="resize-none"
                    data-testid="textarea-first-message"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-8">
              {/* System Prompt */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-medium">System prompt</h3>
                    <p className="text-sm text-muted-foreground">
                      The system prompt is used to determine the persona of the agent and the context of the conversation.
                    </p>
                  </div>
                  <Button variant="link" className="text-sm">
                    Learn more
                  </Button>
                </div>
                <div className="relative">
                  <Textarea
                    value={settings.systemPrompt}
                    onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                    placeholder="Describe the desired agent (e.g., a customer support agent for ElevenLabs)"
                    rows={8}
                    className="resize-none pb-16"
                    data-testid="textarea-system-prompt"
                  />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowAddVariable(true)}
                      data-testid="button-add-variable"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Variable
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-add-timezone">
                      <Globe className="h-3 w-3 mr-1" />
                      Add timezone
                    </Button>
                  </div>
                </div>
              </div>

              {/* Dynamic Variables */}
              {Object.keys(settings.dynamicVariables).length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-medium">Dynamic Variables</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Variables like {"{{user_name}}"} in your prompts will be replaced with actual values when the conversation starts.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(settings.dynamicVariables).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                        <code className="text-sm font-mono flex-1">{`{{${key}}}`}</code>
                        <Input
                          value={value}
                          onChange={(e) => setSettings({
                            ...settings,
                            dynamicVariables: {
                              ...settings.dynamicVariables,
                              [key]: e.target.value,
                            },
                          })}
                          placeholder="Default value"
                          className="max-w-xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveVariable(key)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Variable Dialog */}
              {showAddVariable && (
                <Card className="p-4">
                  <div className="space-y-3">
                    <h4 className="font-medium">Add Dynamic Variable</h4>
                    <Input
                      placeholder="Variable name (e.g., user_name)"
                      value={newVariableName}
                      onChange={(e) => setNewVariableName(e.target.value)}
                    />
                    <Input
                      placeholder="Default value (optional)"
                      value={newVariableValue}
                      onChange={(e) => setNewVariableValue(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddVariable}>Add</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddVariable(false)}>Cancel</Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            <div className="border-t pt-8">
              {/* LLM Settings */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium">LLM</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select which provider and model to use for the LLM.
                  </p>
                  <Select
                    value={settings.model}
                    onValueChange={(value) => setSettings({ ...settings, model: value })}
                  >
                    <SelectTrigger className="w-full max-w-md" data-testid="select-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LLM_MODELS.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Temperature */}
                <div>
                  <Label className="text-base font-medium">Temperature</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Temperature is a parameter that controls the creativity or randomness of the responses generated by the LLM.
                  </p>
                  <div className="max-w-md">
                    <Slider
                      value={[settings.temperature]}
                      onValueChange={([value]) => setSettings({ ...settings, temperature: value })}
                      max={2}
                      step={0.1}
                      className="w-full"
                      data-testid="slider-temperature"
                    />
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>Deterministic</span>
                      <span>Creative</span>
                      <span>More Creative</span>
                    </div>
                  </div>
                </div>

                {/* Limit token usage */}
                <div>
                  <Label className="text-base font-medium">Limit token usage</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Configure the maximum number of tokens that the LLM can predict. A limit will be applied if the value is greater than 0.
                  </p>
                  <Input
                    type="number"
                    value={settings.maxTokens}
                    onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) || 0 })}
                    className="max-w-xs"
                    placeholder="-1"
                    data-testid="input-max-tokens"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-8">
              {/* Agent Knowledge Base */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-medium">Agent knowledge base</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Provide the LLM with domain-specific information to help it answer questions more accurately.
                  </p>
                </div>
                
                {settings.documents.length > 0 ? (
                  <div className="space-y-2">
                    {settings.documents.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 border rounded">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm">{doc.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDocument(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Your knowledge base is small enough to be included directly in the prompt for faster responses. 
                    We don't recommend RAG for small knowledge bases.
                  </p>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAddDocument}
                  data-testid="button-add-document"
                >
                  Add document
                </Button>
              </div>
            </div>

            <div className="border-t pt-8">
              {/* Tools */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-medium">Tools</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Let the agent perform specific actions.
                  </p>
                </div>

                <div className="space-y-2">
                  {AVAILABLE_TOOLS.map(tool => (
                    <div key={tool.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{tool.name}</div>
                        <div className="text-xs text-muted-foreground">{tool.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={settings.enabledTools.includes(tool.id)}
                          onCheckedChange={() => handleToggleTool(tool.id)}
                          data-testid={`switch-tool-${tool.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom tools */}
                <div className="pt-4">
                  <h4 className="font-medium mb-3">Custom tools</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Provide the agent with custom tools it can use to help users.
                  </p>
                  <Button variant="outline" size="sm" data-testid="button-add-tool">
                    Add tool
                  </Button>
                </div>

                {/* Custom MCP Servers */}
                <div className="pt-4">
                  <h4 className="font-medium mb-3">Custom MCP Servers</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Provide the agent with Model Context Protocol servers to extend its capabilities.
                  </p>
                  <Button variant="outline" size="sm" data-testid="button-add-server">
                    Add Server
                  </Button>
                </div>

                {/* Workspace Auth Connections */}
                <div className="pt-4">
                  <h4 className="font-medium mb-3">Workspace Auth Connections</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Create and manage authentication connections that can be used across your workspace.
                  </p>
                  <Button variant="outline" size="sm" data-testid="button-add-auth">
                    Add Auth
                  </Button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-8 border-t">
              <Button
                onClick={() => updateAgentMutation.mutate()}
                disabled={updateAgentMutation.isPending}
                data-testid="button-save-agent"
              >
                {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </TabsContent>

          {/* Voice Tab */}
          <TabsContent value="voice" className="space-y-8 mt-0">
            <div>
              <h3 className="text-base font-medium mb-4">Voice Selection</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose from our library of voices or create your own.
              </p>
              
              {voicesLoading ? (
                <p>Loading voices...</p>
              ) : (
                <Select
                  value={settings.voiceId}
                  onValueChange={(value) => setSettings({ ...settings, voiceId: value })}
                >
                  <SelectTrigger className="w-full max-w-md" data-testid="select-voice">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map(voice => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Voice Settings */}
            {settings.voiceId && (
              <div className="space-y-6">
                <div>
                  <Label>Stability</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Increasing stability will make the voice more consistent between generations.
                  </p>
                  <Slider
                    value={[settings.voiceSettings.stability]}
                    onValueChange={([value]) => setSettings({
                      ...settings,
                      voiceSettings: { ...settings.voiceSettings, stability: value }
                    })}
                    max={1}
                    step={0.01}
                    className="max-w-md"
                  />
                </div>

                <div>
                  <Label>Similarity Boost</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Increasing similarity boost will make the voice more similar to the original.
                  </p>
                  <Slider
                    value={[settings.voiceSettings.similarityBoost]}
                    onValueChange={([value]) => setSettings({
                      ...settings,
                      voiceSettings: { ...settings.voiceSettings, similarityBoost: value }
                    })}
                    max={1}
                    step={0.01}
                    className="max-w-md"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="speaker-boost"
                    checked={settings.voiceSettings.useSpeakerBoost}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      voiceSettings: { ...settings.voiceSettings, useSpeakerBoost: checked }
                    })}
                  />
                  <Label htmlFor="speaker-boost">Use Speaker Boost</Label>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-8 border-t">
              <Button
                onClick={() => updateAgentMutation.mutate()}
                disabled={updateAgentMutation.isPending}
              >
                {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-8 mt-0">
            <div>
              <h3 className="text-base font-medium mb-4">Conversation Analysis</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enable automatic analysis and evaluation of conversations.
              </p>
              <div className="flex items-center space-x-2">
                <Switch
                  id="evaluation"
                  checked={settings.evaluationEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, evaluationEnabled: checked })}
                />
                <Label htmlFor="evaluation">Enable conversation evaluation</Label>
              </div>
            </div>

            {settings.evaluationEnabled && (
              <div>
                <Label>Evaluation Criteria</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Define criteria to evaluate agent performance.
                </p>
                <Textarea
                  placeholder="e.g., Was the agent helpful? Did the agent resolve the issue?"
                  rows={4}
                  value={settings.evaluationCriteria.join("\n")}
                  onChange={(e) => setSettings({
                    ...settings,
                    evaluationCriteria: e.target.value.split("\n").filter(Boolean)
                  })}
                />
              </div>
            )}

            <div className="flex justify-end pt-8 border-t">
              <Button
                onClick={() => updateAgentMutation.mutate()}
                disabled={updateAgentMutation.isPending}
              >
                {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-8 mt-0">
            <div>
              <h3 className="text-base font-medium mb-4">Authentication</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure authentication requirements for accessing this agent.
              </p>
              <div className="flex items-center space-x-2">
                <Switch
                  id="auth"
                  checked={settings.authEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, authEnabled: checked })}
                />
                <Label htmlFor="auth">Require authentication</Label>
              </div>
            </div>

            <div className="flex justify-end pt-8 border-t">
              <Button
                onClick={() => updateAgentMutation.mutate()}
                disabled={updateAgentMutation.isPending}
              >
                {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-8 mt-0">
            <div>
              <h3 className="text-base font-medium mb-4">Webhooks</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure webhooks to receive real-time updates about conversations.
              </p>
              <Button variant="outline" size="sm">
                Add webhook
              </Button>
            </div>

            <div>
              <h3 className="text-base font-medium mb-4">Data Collection</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure what data to collect during conversations.
              </p>
              <div className="flex items-center space-x-2">
                <Switch
                  id="data-collection"
                  checked={settings.dataCollection.enabled}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    dataCollection: { ...settings.dataCollection, enabled: checked }
                  })}
                />
                <Label htmlFor="data-collection">Enable data collection</Label>
              </div>
            </div>

            <div className="flex justify-end pt-8 border-t">
              <Button
                onClick={() => updateAgentMutation.mutate()}
                disabled={updateAgentMutation.isPending}
              >
                {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </TabsContent>

          {/* Widget Tab */}
          <TabsContent value="widget" className="space-y-8 mt-0">
            <div>
              <h3 className="text-base font-medium mb-4">Widget Configuration</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Embed this agent as a widget on your website.
              </p>
              <Card className="p-4">
                <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-3 rounded">
                  {`<script src="https://voiceai.com/widget.js?agent=${agent.elevenLabsAgentId}"></script>`}
                </p>
              </Card>
            </div>

            <div className="flex justify-end pt-8 border-t">
              <Button
                onClick={() => updateAgentMutation.mutate()}
                disabled={updateAgentMutation.isPending}
              >
                {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}