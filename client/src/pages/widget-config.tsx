import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Code, Settings, Eye, Save, RefreshCw,
  Monitor, Smartphone, Tablet, Copy, ExternalLink,
  Image, MessageSquare, Bot, Sparkles
} from "lucide-react";

interface WidgetConfig {
  enabled: boolean;
  agent_id?: string;
  theme: {
    primary_color: string;
    secondary_color: string;
    background_color: string;
    text_color: string;
    font_family: string;
    border_radius: number;
  };
  position: {
    horizontal: 'left' | 'right';
    vertical: 'top' | 'bottom';
    offset_x: number;
    offset_y: number;
  };
  size: {
    width: number;
    height: number;
    mobile_width?: number;
    mobile_height?: number;
  };
  behavior: {
    auto_open: boolean;
    auto_open_delay: number;
    close_on_outside_click: boolean;
    remember_state: boolean;
    expandable: boolean;
  };
  branding: {
    logo_url?: string;
    title: string;
    subtitle?: string;
    welcome_message: string;
    placeholder_text: string;
  };
  avatar?: {
    type: 'default' | 'custom' | 'animated';
    url?: string;
    animation?: string;
  };
}

// Simple color picker component
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex gap-2 items-center">
      <Input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-16 h-10 p-1 cursor-pointer"
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="flex-1"
      />
    </div>
  );
}

export default function WidgetConfig() {
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [embedCode, setEmbedCode] = useState("");
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const { toast } = useToast();

  // Fetch agents
  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch widget configuration
  const { data: widgetData, isLoading, refetch } = useQuery({
    queryKey: ["/api/convai/widget"],
    queryFn: async () => {
      const response = await fetch("/api/convai/widget", {
        credentials: "include",
      });
      
      if (!response.ok) {
        if (response.status === 400) {
          const error = await response.json();
          if (error.message?.includes("API key not configured")) {
            return { 
              error: "Please configure your ElevenLabs API key in Integrations",
              config: getDefaultConfig()
            };
          }
        }
        throw new Error("Failed to fetch widget configuration");
      }
      
      return { config: await response.json() };
    },
  });

  const config = widgetData?.config || getDefaultConfig();
  const apiError = widgetData?.error;
  const [localConfig, setLocalConfig] = useState<WidgetConfig>(getDefaultConfig());

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async (configData: WidgetConfig) => {
      const response = await fetch("/api/convai/widget", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(configData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to save widget configuration");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Widget settings have been updated successfully.",
      });
      refetch();
      generateEmbedCode();
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: "Failed to save widget configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create avatar mutation
  const createAvatarMutation = useMutation({
    mutationFn: async (avatarData: any) => {
      const response = await fetch("/api/convai/widget/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(avatarData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create avatar");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Avatar Created",
        description: "Custom avatar has been created successfully.",
      });
      setLocalConfig({
        ...localConfig,
        avatar: {
          type: 'custom',
          url: data.avatar_url,
        },
      });
    },
    onError: (error) => {
      toast({
        title: "Avatar Creation Failed",
        description: "Failed to create custom avatar. Please try again.",
        variant: "destructive",
      });
    },
  });

  function getDefaultConfig(): WidgetConfig {
    return {
      enabled: false,
      theme: {
        primary_color: '#6366f1',
        secondary_color: '#8b5cf6',
        background_color: '#ffffff',
        text_color: '#1f2937',
        font_family: 'Inter, sans-serif',
        border_radius: 12,
      },
      position: {
        horizontal: 'right',
        vertical: 'bottom',
        offset_x: 20,
        offset_y: 20,
      },
      size: {
        width: 400,
        height: 600,
        mobile_width: 320,
        mobile_height: 500,
      },
      behavior: {
        auto_open: false,
        auto_open_delay: 3000,
        close_on_outside_click: true,
        remember_state: true,
        expandable: true,
      },
      branding: {
        title: 'AI Assistant',
        subtitle: 'How can I help you today?',
        welcome_message: 'Hello! I\'m here to assist you with any questions you might have.',
        placeholder_text: 'Type your message...',
      },
    };
  }

  const handleSave = () => {
    saveMutation.mutate(localConfig);
  };

  const generateEmbedCode = () => {
    const code = `<!-- ElevenLabs Conversational AI Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://widget.elevenlabs.io/v1/widget.js';
    script.async = true;
    script.onload = function() {
      ElevenLabsWidget.init({
        agentId: '${localConfig.agent_id || 'YOUR_AGENT_ID'}',
        apiKey: 'YOUR_API_KEY', // Optional: Use server-side proxy for security
        config: ${JSON.stringify(localConfig, null, 2)}
      });
    };
    document.head.appendChild(script);
  })();
</script>
<!-- End ElevenLabs Widget -->`;
    
    setEmbedCode(code);
    setShowEmbedDialog(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    toast({
      title: "Copied!",
      description: "Embed code has been copied to clipboard.",
    });
  };

  if (apiError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Widget Configuration</h1>
          <p className="text-muted-foreground">Customize your conversational AI widget</p>
        </div>
        
        <Card className="p-6">
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">API Key Required</p>
            <p className="text-muted-foreground">{apiError}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Widget Configuration</h1>
          <p className="text-muted-foreground">Customize your conversational AI widget for web embedding</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateEmbedCode} variant="outline">
            <Code className="h-4 w-4 mr-2" />
            Get Embed Code
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="behavior">Behavior</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Widget</Label>
                      <p className="text-sm text-muted-foreground">Make the widget available for embedding</p>
                    </div>
                    <Switch
                      checked={localConfig.enabled}
                      onCheckedChange={(checked) => 
                        setLocalConfig({ ...localConfig, enabled: checked })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="agent-select">Select Agent</Label>
                    <Select 
                      value={localConfig.agent_id} 
                      onValueChange={(value) => 
                        setLocalConfig({ ...localConfig, agent_id: value })
                      }
                    >
                      <SelectTrigger id="agent-select">
                        <SelectValue placeholder="Choose an agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.elevenLabsAgentId}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Widget Position</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <Select 
                        value={localConfig.position.horizontal}
                        onValueChange={(value: 'left' | 'right') => 
                          setLocalConfig({
                            ...localConfig,
                            position: { ...localConfig.position, horizontal: value }
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select 
                        value={localConfig.position.vertical}
                        onValueChange={(value: 'top' | 'bottom') => 
                          setLocalConfig({
                            ...localConfig,
                            position: { ...localConfig.position, vertical: value }
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Position Offset (px)</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Label className="text-xs">X Offset</Label>
                        <Input
                          type="number"
                          value={localConfig.position.offset_x}
                          onChange={(e) => 
                            setLocalConfig({
                              ...localConfig,
                              position: { ...localConfig.position, offset_x: parseInt(e.target.value) }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Y Offset</Label>
                        <Input
                          type="number"
                          value={localConfig.position.offset_y}
                          onChange={(e) => 
                            setLocalConfig({
                              ...localConfig,
                              position: { ...localConfig.position, offset_y: parseInt(e.target.value) }
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-4">
              <Card className="p-4">
                <div className="space-y-4">
                  <div>
                    <Label>Primary Color</Label>
                    <ColorPicker
                      value={localConfig.theme.primary_color}
                      onChange={(color) => 
                        setLocalConfig({
                          ...localConfig,
                          theme: { ...localConfig.theme, primary_color: color }
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label>Secondary Color</Label>
                    <ColorPicker
                      value={localConfig.theme.secondary_color}
                      onChange={(color) => 
                        setLocalConfig({
                          ...localConfig,
                          theme: { ...localConfig.theme, secondary_color: color }
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label>Background Color</Label>
                    <ColorPicker
                      value={localConfig.theme.background_color}
                      onChange={(color) => 
                        setLocalConfig({
                          ...localConfig,
                          theme: { ...localConfig.theme, background_color: color }
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label>Text Color</Label>
                    <ColorPicker
                      value={localConfig.theme.text_color}
                      onChange={(color) => 
                        setLocalConfig({
                          ...localConfig,
                          theme: { ...localConfig.theme, text_color: color }
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label>Border Radius</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[localConfig.theme.border_radius]}
                        onValueChange={([value]) => 
                          setLocalConfig({
                            ...localConfig,
                            theme: { ...localConfig.theme, border_radius: value }
                          })
                        }
                        min={0}
                        max={24}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm w-12">{localConfig.theme.border_radius}px</span>
                    </div>
                  </div>

                  <div>
                    <Label>Widget Size</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Label className="text-xs">Width (px)</Label>
                        <Input
                          type="number"
                          value={localConfig.size.width}
                          onChange={(e) => 
                            setLocalConfig({
                              ...localConfig,
                              size: { ...localConfig.size, width: parseInt(e.target.value) }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Height (px)</Label>
                        <Input
                          type="number"
                          value={localConfig.size.height}
                          onChange={(e) => 
                            setLocalConfig({
                              ...localConfig,
                              size: { ...localConfig.size, height: parseInt(e.target.value) }
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="behavior" className="space-y-4">
              <Card className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-open Widget</Label>
                      <p className="text-sm text-muted-foreground">Automatically open after page load</p>
                    </div>
                    <Switch
                      checked={localConfig.behavior.auto_open}
                      onCheckedChange={(checked) => 
                        setLocalConfig({
                          ...localConfig,
                          behavior: { ...localConfig.behavior, auto_open: checked }
                        })
                      }
                    />
                  </div>

                  {localConfig.behavior.auto_open && (
                    <div>
                      <Label>Auto-open Delay (ms)</Label>
                      <Input
                        type="number"
                        value={localConfig.behavior.auto_open_delay}
                        onChange={(e) => 
                          setLocalConfig({
                            ...localConfig,
                            behavior: { ...localConfig.behavior, auto_open_delay: parseInt(e.target.value) }
                          })
                        }
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Close on Outside Click</Label>
                      <p className="text-sm text-muted-foreground">Close widget when clicking outside</p>
                    </div>
                    <Switch
                      checked={localConfig.behavior.close_on_outside_click}
                      onCheckedChange={(checked) => 
                        setLocalConfig({
                          ...localConfig,
                          behavior: { ...localConfig.behavior, close_on_outside_click: checked }
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Remember State</Label>
                      <p className="text-sm text-muted-foreground">Remember open/closed state between visits</p>
                    </div>
                    <Switch
                      checked={localConfig.behavior.remember_state}
                      onCheckedChange={(checked) => 
                        setLocalConfig({
                          ...localConfig,
                          behavior: { ...localConfig.behavior, remember_state: checked }
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Expandable</Label>
                      <p className="text-sm text-muted-foreground">Allow users to expand widget to fullscreen</p>
                    </div>
                    <Switch
                      checked={localConfig.behavior.expandable}
                      onCheckedChange={(checked) => 
                        setLocalConfig({
                          ...localConfig,
                          behavior: { ...localConfig.behavior, expandable: checked }
                        })
                      }
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="branding" className="space-y-4">
              <Card className="p-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="widget-title">Widget Title</Label>
                    <Input
                      id="widget-title"
                      value={localConfig.branding.title}
                      onChange={(e) => 
                        setLocalConfig({
                          ...localConfig,
                          branding: { ...localConfig.branding, title: e.target.value }
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="widget-subtitle">Subtitle (Optional)</Label>
                    <Input
                      id="widget-subtitle"
                      value={localConfig.branding.subtitle}
                      onChange={(e) => 
                        setLocalConfig({
                          ...localConfig,
                          branding: { ...localConfig.branding, subtitle: e.target.value }
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="welcome-message">Welcome Message</Label>
                    <Textarea
                      id="welcome-message"
                      value={localConfig.branding.welcome_message}
                      onChange={(e) => 
                        setLocalConfig({
                          ...localConfig,
                          branding: { ...localConfig.branding, welcome_message: e.target.value }
                        })
                      }
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="placeholder-text">Input Placeholder</Label>
                    <Input
                      id="placeholder-text"
                      value={localConfig.branding.placeholder_text}
                      onChange={(e) => 
                        setLocalConfig({
                          ...localConfig,
                          branding: { ...localConfig.branding, placeholder_text: e.target.value }
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="logo-url">Logo URL (Optional)</Label>
                    <Input
                      id="logo-url"
                      type="url"
                      value={localConfig.branding.logo_url}
                      onChange={(e) => 
                        setLocalConfig({
                          ...localConfig,
                          branding: { ...localConfig.branding, logo_url: e.target.value }
                        })
                      }
                      placeholder="https://example.com/logo.png"
                    />
                  </div>

                  <div>
                    <Label>Avatar Type</Label>
                    <Select 
                      value={localConfig.avatar?.type || 'default'}
                      onValueChange={(value: 'default' | 'custom' | 'animated') => 
                        setLocalConfig({
                          ...localConfig,
                          avatar: { 
                            type: value,
                            url: localConfig.avatar?.url,
                            animation: localConfig.avatar?.animation
                          }
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="custom">Custom Image</SelectItem>
                        <SelectItem value="animated">Animated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {localConfig.avatar?.type === 'custom' && (
                    <div>
                      <Label htmlFor="avatar-url">Avatar URL</Label>
                      <Input
                        id="avatar-url"
                        type="url"
                        value={localConfig.avatar?.url}
                        onChange={(e) => 
                          setLocalConfig({
                            ...localConfig,
                            avatar: { 
                              type: localConfig.avatar?.type || 'custom',
                              url: e.target.value,
                              animation: localConfig.avatar?.animation
                            }
                          })
                        }
                        placeholder="https://example.com/avatar.png"
                      />
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Widget Preview</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={previewDevice === 'desktop' ? 'default' : 'outline'}
                  onClick={() => setPreviewDevice('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={previewDevice === 'tablet' ? 'default' : 'outline'}
                  onClick={() => setPreviewDevice('tablet')}
                >
                  <Tablet className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                  onClick={() => setPreviewDevice('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="relative bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden" style={{ height: '600px' }}>
              {/* Preview Container */}
              <div 
                className="absolute"
                style={{
                  [localConfig.position.horizontal]: `${localConfig.position.offset_x}px`,
                  [localConfig.position.vertical]: `${localConfig.position.offset_y}px`,
                  width: previewDevice === 'mobile' ? '320px' : localConfig.size.width + 'px',
                  height: previewDevice === 'mobile' ? '500px' : localConfig.size.height + 'px',
                  maxWidth: '90%',
                  maxHeight: '90%',
                }}
              >
                <div 
                  className="h-full shadow-2xl flex flex-col"
                  style={{
                    backgroundColor: localConfig.theme.background_color,
                    borderRadius: localConfig.theme.border_radius + 'px',
                    border: `2px solid ${localConfig.theme.primary_color}`,
                  }}
                >
                  {/* Widget Header */}
                  <div 
                    className="p-4 border-b"
                    style={{
                      backgroundColor: localConfig.theme.primary_color,
                      color: '#ffffff',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {localConfig.branding.logo_url ? (
                          <img 
                            src={localConfig.branding.logo_url} 
                            alt="Logo" 
                            className="h-8 w-8 rounded"
                          />
                        ) : (
                          <Bot className="h-8 w-8" />
                        )}
                        <div>
                          <h4 className="font-semibold">{localConfig.branding.title}</h4>
                          {localConfig.branding.subtitle && (
                            <p className="text-xs opacity-90">{localConfig.branding.subtitle}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Widget Body */}
                  <div className="flex-1 p-4 overflow-y-auto">
                    <div 
                      className="p-3 rounded-lg mb-4"
                      style={{
                        backgroundColor: localConfig.theme.secondary_color + '20',
                        color: localConfig.theme.text_color,
                      }}
                    >
                      {localConfig.branding.welcome_message}
                    </div>
                  </div>

                  {/* Widget Footer */}
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder={localConfig.branding.placeholder_text}
                        className="flex-1"
                        style={{
                          borderColor: localConfig.theme.primary_color,
                        }}
                        disabled
                      />
                      <Button
                        style={{
                          backgroundColor: localConfig.theme.primary_color,
                          color: '#ffffff',
                        }}
                        disabled
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={generateEmbedCode}
              >
                <Code className="h-4 w-4 mr-2" />
                Generate Embed Code
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => window.open('https://elevenlabs.io/docs/conversational-ai/widget', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Documentation
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Embed Code Dialog */}
      {showEmbedDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Embed Code</h3>
                <p className="text-sm text-muted-foreground">
                  Copy this code and paste it into your website's HTML
                </p>
              </div>
              
              <div className="relative">
                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-sm max-h-[50vh]">
                  <code>{embedCode}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={copyToClipboard}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="border-t p-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEmbedDialog(false)}>
                Close
              </Button>
              <Button onClick={copyToClipboard}>
                Copy to Clipboard
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}