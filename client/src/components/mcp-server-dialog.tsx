import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Shield, ShieldAlert, ShieldOff } from "lucide-react";
import type { CustomTool } from "@shared/schema";

interface MCPServerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tool: Partial<CustomTool>) => void;
  tool?: CustomTool;
}

interface HTTPHeader {
  key: string;
  value: string;
}

export function MCPServerDialog({ isOpen, onClose, onSave, tool }: MCPServerDialogProps) {
  const [name, setName] = useState(tool?.name || "");
  const [description, setDescription] = useState(tool?.description || "");
  const [serverType, setServerType] = useState<'sse' | 'streamable_http'>(
    tool?.mcpConfig?.serverType || 'sse'
  );
  const [url, setUrl] = useState(tool?.url || "");
  const [secretToken, setSecretToken] = useState(tool?.mcpConfig?.secretToken || "");
  const [headers, setHeaders] = useState<HTTPHeader[]>(
    tool?.headers ? Object.entries(tool.headers).map(([key, value]) => ({ key, value })) : []
  );
  const [approvalMode, setApprovalMode] = useState<'always_ask' | 'fine_grained' | 'no_approval'>(
    tool?.mcpConfig?.approvalMode || 'always_ask'
  );
  const [trusted, setTrusted] = useState(tool?.mcpConfig?.trusted || false);

  const handleSave = () => {
    const mcpTool: Partial<CustomTool> = {
      id: tool?.id || `mcp-${Date.now()}`,
      name,
      description,
      type: 'mcp',
      url,
      enabled: tool?.enabled ?? true,
      mcpConfig: {
        serverType,
        secretToken: secretToken || undefined,
        approvalMode,
        trusted,
      },
      headers: headers.reduce((acc, header) => {
        if (header.key && header.value) {
          acc[header.key] = header.value;
        }
        return acc;
      }, {} as Record<string, string>),
    };

    onSave(mcpTool);
    handleClose();
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setServerType('sse');
    setUrl("");
    setSecretToken("");
    setHeaders([]);
    setApprovalMode('always_ask');
    setTrusted(false);
    onClose();
  };

  const addHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = value;
    setHeaders(newHeaders);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tool ? "Edit" : "New"} Custom MCP Server</DialogTitle>
          <DialogDescription>
            Connect a custom Model Context Protocol (MCP) server to add powerful capabilities to your agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Basic Information</h3>
            <p className="text-xs text-muted-foreground">
              Identify your MCP server with a clear name and description.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Custom MCP Server"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this MCP server does..."
                rows={3}
              />
            </div>
          </div>

          {/* Server Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Server Configuration</h3>
            <p className="text-xs text-muted-foreground">
              Specify how to connect to your MCP server.
            </p>

            <div className="space-y-2">
              <Label>Server Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={serverType === 'sse' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setServerType('sse')}
                >
                  SSE
                </Button>
                <Button
                  type="button"
                  variant={serverType === 'streamable_http' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setServerType('streamable_http')}
                >
                  Streamable HTTP
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Server URL</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/sse"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secret">
                Secret Token
                <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
              </Label>
              <Input
                id="secret"
                type="password"
                value={secretToken}
                onChange={(e) => setSecretToken(e.target.value)}
                placeholder="twilio_token_account_AC5246..."
              />
              <p className="text-xs text-muted-foreground">
                Configure a secret token for secure server access.
              </p>
            </div>
          </div>

          {/* HTTP Headers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">HTTP Headers</h3>
                <p className="text-xs text-muted-foreground">
                  Add custom headers for additional configuration or authentication.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHeader}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add header
              </Button>
            </div>

            {headers.length > 0 && (
              <div className="space-y-2">
                {headers.map((header, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Header name"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    />
                    <Input
                      placeholder="Header value"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHeader(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tool Approval Mode */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Tool Approval Mode</h3>
            <p className="text-xs text-muted-foreground">
              Control how the agent requests permission to use tools from this MCP server.
            </p>

            <RadioGroup value={approvalMode} onValueChange={(value: any) => setApprovalMode(value)}>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="always_ask" id="always_ask" />
                  <Label htmlFor="always_ask" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span className="font-medium">Always Ask</span>
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded">Recommended</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Maximum security. The agent will request your permission before each tool use.
                    </p>
                  </Label>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="fine_grained" id="fine_grained" />
                  <Label htmlFor="fine_grained" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      <span className="font-medium">Fine-Grained Tool Approval</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Disable & pre-select tools which can run automatically & those requiring approval.
                    </p>
                  </Label>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="no_approval" id="no_approval" />
                  <Label htmlFor="no_approval" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <ShieldOff className="h-4 w-4" />
                      <span className="font-medium">No Approval</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      The assistant can use any tool without approval.
                    </p>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Confirmation */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium">Confirmation</h3>
            <p className="text-xs text-muted-foreground">
              Custom MCP servers are not verified by ElevenLabs
            </p>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="trust"
                checked={trusted}
                onCheckedChange={(checked) => setTrusted(checked as boolean)}
              />
              <Label htmlFor="trust" className="cursor-pointer">
                I trust this server
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!name || !url || !trusted}
          >
            {tool ? "Update" : "Add"} Server
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}