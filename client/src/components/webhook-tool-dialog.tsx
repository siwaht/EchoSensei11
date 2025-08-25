import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Code } from "lucide-react";
// Simple ID generator
const generateId = () => `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

interface WebhookTool {
  id: string;
  type: 'webhook';
  name: string;
  description?: string;
  enabled: boolean;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  webhookConfig?: {
    responseTimeout?: number;
    disableInterruptions?: boolean;
    preToolSpeech?: 'auto' | 'force' | 'none';
    authentication?: {
      type?: string;
      credentials?: any;
    };
    headers?: Array<{
      key: string;
      value: string;
      enabled: boolean;
    }>;
    pathParameters?: Array<{
      key: string;
      description?: string;
    }>;
    queryParameters?: Array<{
      key: string;
      description?: string;
      required?: boolean;
      dataType?: 'String' | 'Number' | 'Boolean' | 'Object' | 'Array';
      valueType?: 'LLM Prompt' | 'Static' | 'Dynamic Variable';
    }>;
    bodyParameters?: Array<{
      identifier: string;
      dataType: 'String' | 'Number' | 'Boolean' | 'Object' | 'Array';
      description?: string;
      required?: boolean;
      valueType: 'LLM Prompt' | 'Static' | 'Dynamic Variable';
    }>;
    dynamicVariables?: Record<string, string>;
    dynamicVariableAssignments?: Array<{
      variable: string;
      jsonPath: string;
    }>;
  };
}

interface WebhookToolDialogProps {
  isOpen: boolean;
  onClose: () => void;
  webhook?: WebhookTool;
  onSave: (webhook: WebhookTool) => void;
}

export function WebhookToolDialog({ isOpen, onClose, webhook, onSave }: WebhookToolDialogProps) {
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonContent, setJsonContent] = useState("");
  const [formData, setFormData] = useState<WebhookTool>({
    id: webhook?.id || generateId(),
    type: 'webhook',
    name: webhook?.name || '',
    description: webhook?.description || '',
    enabled: webhook?.enabled !== false,
    url: webhook?.url || '',
    method: webhook?.method || 'POST',
    webhookConfig: {
      responseTimeout: webhook?.webhookConfig?.responseTimeout || 20,
      disableInterruptions: webhook?.webhookConfig?.disableInterruptions || false,
      preToolSpeech: webhook?.webhookConfig?.preToolSpeech || 'auto',
      authentication: webhook?.webhookConfig?.authentication,
      headers: webhook?.webhookConfig?.headers || [],
      pathParameters: webhook?.webhookConfig?.pathParameters || [],
      queryParameters: webhook?.webhookConfig?.queryParameters || [],
      bodyParameters: webhook?.webhookConfig?.bodyParameters || [],
      dynamicVariables: webhook?.webhookConfig?.dynamicVariables || {},
      dynamicVariableAssignments: webhook?.webhookConfig?.dynamicVariableAssignments || [],
    },
  });

  useEffect(() => {
    if (webhook) {
      setFormData({
        ...webhook,
        webhookConfig: {
          ...webhook.webhookConfig,
          responseTimeout: webhook.webhookConfig?.responseTimeout || 20,
          disableInterruptions: webhook.webhookConfig?.disableInterruptions || false,
          preToolSpeech: webhook.webhookConfig?.preToolSpeech || 'auto',
          headers: webhook.webhookConfig?.headers || [],
          pathParameters: webhook.webhookConfig?.pathParameters || [],
          queryParameters: webhook.webhookConfig?.queryParameters || [],
          bodyParameters: webhook.webhookConfig?.bodyParameters || [],
          dynamicVariables: webhook.webhookConfig?.dynamicVariables || {},
          dynamicVariableAssignments: webhook.webhookConfig?.dynamicVariableAssignments || [],
        },
      });
    }
  }, [webhook]);

  const handleSave = () => {
    if (showJsonEditor) {
      try {
        const parsed = JSON.parse(jsonContent);
        onSave(parsed);
      } catch (error) {
        return;
      }
    } else {
      onSave(formData);
    }
    onClose();
  };

  const addHeader = () => {
    setFormData({
      ...formData,
      webhookConfig: {
        ...formData.webhookConfig,
        headers: [
          ...(formData.webhookConfig?.headers || []),
          { key: '', value: '', enabled: true }
        ],
      },
    });
  };

  const updateHeader = (index: number, field: 'key' | 'value' | 'enabled', value: any) => {
    const headers = [...(formData.webhookConfig?.headers || [])];
    headers[index] = { ...headers[index], [field]: value };
    setFormData({
      ...formData,
      webhookConfig: { ...formData.webhookConfig, headers },
    });
  };

  const deleteHeader = (index: number) => {
    const headers = [...(formData.webhookConfig?.headers || [])];
    headers.splice(index, 1);
    setFormData({
      ...formData,
      webhookConfig: { ...formData.webhookConfig, headers },
    });
  };

  const addQueryParameter = () => {
    setFormData({
      ...formData,
      webhookConfig: {
        ...formData.webhookConfig,
        queryParameters: [
          ...(formData.webhookConfig?.queryParameters || []),
          { key: '', description: '', required: false, dataType: 'String', valueType: 'LLM Prompt' }
        ],
      },
    });
  };

  const addBodyParameter = () => {
    setFormData({
      ...formData,
      webhookConfig: {
        ...formData.webhookConfig,
        bodyParameters: [
          ...(formData.webhookConfig?.bodyParameters || []),
          { 
            identifier: '', 
            dataType: 'String' as const, 
            description: '', 
            required: false,
            valueType: 'LLM Prompt' as const
          }
        ],
      },
    });
  };

  const updateQueryParameter = (index: number, field: 'key' | 'description' | 'required' | 'dataType' | 'valueType', value: any) => {
    const params = [...(formData.webhookConfig?.queryParameters || [])];
    params[index] = { ...params[index], [field]: value };
    setFormData({
      ...formData,
      webhookConfig: { ...formData.webhookConfig, queryParameters: params },
    });
  };

  const deleteQueryParameter = (index: number) => {
    const params = [...(formData.webhookConfig?.queryParameters || [])];
    params.splice(index, 1);
    setFormData({
      ...formData,
      webhookConfig: { ...formData.webhookConfig, queryParameters: params },
    });
  };

  const updateBodyParameter = (index: number, field: string, value: any) => {
    const updatedParams = [...(formData.webhookConfig?.bodyParameters || [])];
    updatedParams[index] = { ...updatedParams[index], [field]: value };
    setFormData({
      ...formData,
      webhookConfig: {
        ...formData.webhookConfig,
        bodyParameters: updatedParams,
      },
    });
  };

  const deleteBodyParameter = (index: number) => {
    setFormData({
      ...formData,
      webhookConfig: {
        ...formData.webhookConfig,
        bodyParameters: formData.webhookConfig?.bodyParameters?.filter((_, i) => i !== index) || [],
      },
    });
  };

  const addDynamicVariableAssignment = () => {
    setFormData({
      ...formData,
      webhookConfig: {
        ...formData.webhookConfig,
        dynamicVariableAssignments: [
          ...(formData.webhookConfig?.dynamicVariableAssignments || []),
          { variable: '', jsonPath: '' }
        ],
      },
    });
  };

  const updateDynamicVariableAssignment = (index: number, field: 'variable' | 'jsonPath', value: string) => {
    const assignments = [...(formData.webhookConfig?.dynamicVariableAssignments || [])];
    assignments[index] = { ...assignments[index], [field]: value };
    setFormData({
      ...formData,
      webhookConfig: { ...formData.webhookConfig, dynamicVariableAssignments: assignments },
    });
  };

  const deleteDynamicVariableAssignment = (index: number) => {
    const assignments = [...(formData.webhookConfig?.dynamicVariableAssignments || [])];
    assignments.splice(index, 1);
    setFormData({
      ...formData,
      webhookConfig: { ...formData.webhookConfig, dynamicVariableAssignments: assignments },
    });
  };

  const toggleJsonEditor = () => {
    if (!showJsonEditor) {
      setJsonContent(JSON.stringify(formData, null, 2));
    } else {
      try {
        const parsed = JSON.parse(jsonContent);
        setFormData(parsed);
      } catch (error) {
        return;
      }
    }
    setShowJsonEditor(!showJsonEditor);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Add webhook tool</span>
          </DialogTitle>
        </DialogHeader>

        {showJsonEditor ? (
          <div className="space-y-4">
            <Textarea
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              className="font-mono text-sm min-h-[400px]"
              placeholder="Enter JSON configuration..."
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Configuration Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Configuration</h3>
                <p className="text-xs text-muted-foreground">Describe to the LLM how and when to use the tool.</p>
              </div>

              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter webhook name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this webhook does..."
                  className="mt-1 min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-4">
                <div>
                  <Label htmlFor="method">Method</Label>
                  <Select
                    value={formData.method}
                    onValueChange={(value: any) => setFormData({ ...formData, method: value })}
                  >
                    <SelectTrigger id="method" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://api.example.com/endpoint"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Response timeout (seconds)</Label>
                  <span className="text-sm text-muted-foreground">
                    {formData.webhookConfig?.responseTimeout || 20}s
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  How long to wait for the client tool to respond before timing out. Default is 20 seconds.
                </p>
                <Slider
                  value={[formData.webhookConfig?.responseTimeout || 20]}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    webhookConfig: { ...formData.webhookConfig, responseTimeout: value[0] }
                  })}
                  min={1}
                  max={60}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="disable-interruptions"
                  checked={formData.webhookConfig?.disableInterruptions || false}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    webhookConfig: { ...formData.webhookConfig, disableInterruptions: checked }
                  })}
                />
                <div>
                  <Label htmlFor="disable-interruptions" className="text-sm font-medium">
                    Disable interruptions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Select this box to disable interruptions while the tool is running.
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="pre-tool-speech">Pre-tool speech</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Force agent speech before tool execution or let it decide automatically based on recent execution times.
                </p>
                <Select
                  value={formData.webhookConfig?.preToolSpeech || 'auto'}
                  onValueChange={(value: any) => setFormData({
                    ...formData,
                    webhookConfig: { ...formData.webhookConfig, preToolSpeech: value }
                  })}
                >
                  <SelectTrigger id="pre-tool-speech" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="force">Force</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Authentication</Label>
                <div className="mt-1 p-3 border rounded-lg text-sm text-muted-foreground">
                  Workspace has no auth connections
                </div>
              </div>
            </div>

            {/* Headers Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold">Headers</h3>
                  <p className="text-xs text-muted-foreground">Define headers that will be sent with the request</p>
                </div>
                <Button onClick={addHeader} size="sm" variant="outline">
                  Add header
                </Button>
              </div>
              {formData.webhookConfig?.headers?.map((header, index) => (
                <div key={index} className="flex gap-2 items-center mt-2">
                  <Input
                    placeholder="Key"
                    value={header.key}
                    onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Value"
                    value={header.value}
                    onChange={(e) => updateHeader(index, 'value', e.target.value)}
                    className="flex-1"
                  />
                  <Switch
                    checked={header.enabled}
                    onCheckedChange={(checked) => updateHeader(index, 'enabled', checked)}
                  />
                  <Button
                    onClick={() => deleteHeader(index)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Path Parameters Section */}
            <div>
              <h3 className="text-sm font-semibold mb-1">Path parameters</h3>
              <p className="text-xs text-muted-foreground">
                Add path wrapped in curly braces to the URL to configure them here.
              </p>
            </div>

            {/* Query Parameters Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold">Query parameters</h3>
                  <p className="text-xs text-muted-foreground">
                    Define parameters that will be collected by the LLM and sent as the query of the request.
                  </p>
                </div>
                <Button onClick={addQueryParameter} size="sm" variant="outline">
                  Add param
                </Button>
              </div>
              {formData.webhookConfig?.queryParameters?.map((param, index) => (
                <div key={index} className="border rounded-lg p-3 mt-2 space-y-2 bg-muted/20">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Identifier</Label>
                      <Input
                        placeholder="e.g., searchQuery"
                        value={param.key}
                        onChange={(e) => updateQueryParameter(index, 'key', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data Type</Label>
                      <Select
                        value={param.dataType || 'String'}
                        onValueChange={(value) => updateQueryParameter(index, 'dataType', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="String">String</SelectItem>
                          <SelectItem value="Number">Number</SelectItem>
                          <SelectItem value="Boolean">Boolean</SelectItem>
                          <SelectItem value="Object">Object</SelectItem>
                          <SelectItem value="Array">Array</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input
                      placeholder="Describe how to extract this parameter"
                      value={param.description}
                      onChange={(e) => updateQueryParameter(index, 'description', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Value Type</Label>
                      <Select
                        value={param.valueType || 'LLM Prompt'}
                        onValueChange={(value) => updateQueryParameter(index, 'valueType', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LLM Prompt">LLM Prompt</SelectItem>
                          <SelectItem value="Static">Static</SelectItem>
                          <SelectItem value="Dynamic Variable">Dynamic Variable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <Switch
                        checked={param.required}
                        onCheckedChange={(checked) => updateQueryParameter(index, 'required', checked)}
                      />
                      <Label className="text-xs">Required</Label>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => deleteQueryParameter(index)}
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Body Parameters Section */}
            {(formData.method === 'POST' || formData.method === 'PUT' || formData.method === 'PATCH') && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold">Body parameters</h3>
                    <p className="text-xs text-muted-foreground">
                      Define parameters that will be collected by the LLM and sent as the body of the request.
                    </p>
                  </div>
                  <Button onClick={addBodyParameter} size="sm" variant="outline">
                    Add property
                  </Button>
                </div>
                {formData.webhookConfig?.bodyParameters?.map((param, index) => (
                  <div key={index} className="border rounded-lg p-4 mt-3 space-y-3 bg-muted/20">
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        placeholder="Extract the search query the user in looking to find more information on"
                        value={param.description}
                        onChange={(e) => updateBodyParameter(index, 'description', e.target.value)}
                        className="mt-1 min-h-[60px]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        This field will be passed to the LLM and should describe in detail how to extract the data from the transcript.
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-xs font-semibold">Properties</Label>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <Label className="text-xs">Data type</Label>
                          <Select
                            value={param.dataType}
                            onValueChange={(value) => updateBodyParameter(index, 'dataType', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="String">String</SelectItem>
                              <SelectItem value="Number">Number</SelectItem>
                              <SelectItem value="Boolean">Boolean</SelectItem>
                              <SelectItem value="Object">Object</SelectItem>
                              <SelectItem value="Array">Array</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Identifier</Label>
                          <Input
                            placeholder="searchQuery"
                            value={param.identifier}
                            onChange={(e) => updateBodyParameter(index, 'identifier', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Switch
                          checked={param.required}
                          onCheckedChange={(checked) => updateBodyParameter(index, 'required', checked)}
                        />
                        <Label className="text-xs">Required</Label>
                      </div>
                      <div className="mt-3">
                        <Label className="text-xs">Value Type</Label>
                        <Select
                          value={param.valueType}
                          onValueChange={(value) => updateBodyParameter(index, 'valueType', value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LLM Prompt">LLM Prompt</SelectItem>
                            <SelectItem value="Static">Static</SelectItem>
                            <SelectItem value="Dynamic Variable">Dynamic Variable</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          How the value will be determined (e.g., LLM will extract it from conversation)
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => deleteBodyParameter(index)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}              </div>
            )}

            {/* Dynamic Variables Section */}
            <div>
              <h3 className="text-sm font-semibold mb-1">Dynamic Variables</h3>
              <p className="text-xs text-muted-foreground">
                Variables in tool parameters will be replaced with actual values when the conversation starts.{' '}
                <a href="#" className="text-primary hover:underline">Learn more</a>
              </p>
            </div>

            {/* Dynamic Variable Assignments Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold">Dynamic Variable Assignments</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure which dynamic variables can be updated when this tool returns a response.{' '}
                    <a href="#" className="text-primary hover:underline">Learn more</a>
                  </p>
                </div>
                <Button onClick={addDynamicVariableAssignment} size="sm" variant="outline">
                  Add assignment
                </Button>
              </div>
              {formData.webhookConfig?.dynamicVariableAssignments?.map((assignment, index) => (
                <div key={index} className="flex gap-2 items-center mt-2">
                  <Input
                    placeholder="Variable name"
                    value={assignment.variable}
                    onChange={(e) => updateDynamicVariableAssignment(index, 'variable', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="JSON path"
                    value={assignment.jsonPath}
                    onChange={(e) => updateDynamicVariableAssignment(index, 'jsonPath', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => deleteDynamicVariableAssignment(index)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={toggleJsonEditor}
            className="flex items-center gap-2"
          >
            <Code className="w-4 h-4" />
            {showJsonEditor ? 'Edit as form' : 'Edit as JSON'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Add tool
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}