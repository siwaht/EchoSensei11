import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Wrench, Plus, Search, Settings, Code, Globe, 
  Phone, PhoneOff, Languages, SkipForward, UserPlus,
  Voicemail, Hash, ExternalLink, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: any;
  category: 'builtin' | 'custom' | 'mcp';
  enabled: boolean;
  configurable?: boolean;
}

export default function Tools() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'all' | 'builtin' | 'custom' | 'mcp'>('all');
  
  const [tools, setTools] = useState<Tool[]>([
    {
      id: "end_call",
      name: "End call",
      description: "Gives agent the ability to end the call with the user.",
      icon: PhoneOff,
      category: "builtin",
      enabled: true,
      configurable: true
    },
    {
      id: "detect_language",
      name: "Detect language",
      description: "Gives agent the ability to change the language during conversation.",
      icon: Languages,
      category: "builtin",
      enabled: true,
      configurable: true
    },
    {
      id: "skip_turn",
      name: "Skip turn",
      description: "Agent will skip its turn if user explicitly indicates they need a moment.",
      icon: SkipForward,
      category: "builtin",
      enabled: false,
      configurable: true
    },
    {
      id: "transfer_to_agent",
      name: "Transfer to agent",
      description: "Gives agent the ability to transfer the call to another AI agent.",
      icon: UserPlus,
      category: "builtin",
      enabled: false,
      configurable: true
    },
    {
      id: "transfer_to_number",
      name: "Transfer to number",
      description: "Gives agent the ability to transfer the call to a human.",
      icon: Phone,
      category: "builtin",
      enabled: false,
      configurable: true
    },
    {
      id: "play_keypad_touch_tone",
      name: "Play keypad touch tone",
      description: "Gives agent the ability to play keypad touch tones during a phone call.",
      icon: Hash,
      category: "builtin",
      enabled: false,
      configurable: true
    },
    {
      id: "voicemail_detection",
      name: "Voicemail detection",
      description: "Allows agent to detect voicemail systems and optionally leave a message.",
      icon: Voicemail,
      category: "builtin",
      enabled: false,
      configurable: true
    },
    {
      id: "webhook_integration",
      name: "Webhook Integration",
      description: "Custom webhook to integrate with external services.",
      icon: Globe,
      category: "custom",
      enabled: true,
      configurable: true
    },
    {
      id: "crm_lookup",
      name: "CRM Lookup",
      description: "Look up customer information from your CRM system.",
      icon: Search,
      category: "custom",
      enabled: true,
      configurable: true
    }
  ]);

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || tool.category === activeTab;
    return matchesSearch && matchesTab;
  });

  const toggleTool = (toolId: string) => {
    setTools(tools.map(tool => 
      tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool
    ));
    const tool = tools.find(t => t.id === toolId);
    toast({
      title: tool?.enabled ? "Tool disabled" : "Tool enabled",
      description: `${tool?.name} has been ${tool?.enabled ? 'disabled' : 'enabled'}.`
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'builtin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'custom':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'mcp':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Tools</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure tools and capabilities for your agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" data-testid="button-add-mcp">
            <Zap className="h-4 w-4 mr-2" />
            Add MCP Server
          </Button>
          <Button className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white" data-testid="button-add-tool">
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Tool
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-tools"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'builtin', 'custom', 'mcp'] as const).map(tab => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? "bg-black dark:bg-white dark:text-black" : ""}
            >
              {tab === 'all' ? 'All Tools' : 
               tab === 'builtin' ? 'Built-in' : 
               tab === 'custom' ? 'Custom' : 'MCP Servers'}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card key={tool.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{tool.name}</h3>
                      <Badge variant="outline" className={cn("text-xs", getCategoryColor(tool.category))}>
                        {tool.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {tool.description}
                    </p>
                    {tool.configurable && (
                      <Button variant="outline" size="sm" data-testid={`button-configure-${tool.id}`}>
                        <Settings className="h-3 w-3 mr-1" />
                        Configure
                      </Button>
                    )}
                  </div>
                </div>
                <Switch
                  checked={tool.enabled}
                  onCheckedChange={() => toggleTool(tool.id)}
                  data-testid={`switch-tool-${tool.id}`}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-12">
          <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No tools found</h3>
          <p className="text-muted-foreground">
            {searchQuery ? `No tools match "${searchQuery}"` : "No tools available"}
          </p>
        </div>
      )}

      {/* Add Custom Tool Section */}
      <Card className="p-6 border-dashed">
        <div className="text-center">
          <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Custom Tools</h3>
          <p className="text-muted-foreground mb-4">
            Extend your agents' capabilities with custom tools and integrations
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Documentation
            </Button>
            <Button className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Tool
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}