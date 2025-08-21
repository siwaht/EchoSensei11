import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TransferRule {
  agentId: string;
  agentName?: string;
  condition: string;
  delayMs?: number;
  transferMessage?: string;
  enableFirstMessage?: boolean;
}

interface SystemToolConfig {
  enabled: boolean;
  description?: string;
  disableInterruptions?: boolean;
  transferRules?: TransferRule[];
  phoneNumbers?: Array<{
    number: string;
    label: string;
    condition?: string;
  }>;
  supportedLanguages?: string[];
  leaveMessage?: boolean;
  messageContent?: string;
}

interface SystemToolConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolType: string;
  toolName: string;
  config: SystemToolConfig;
  onSave: (config: SystemToolConfig) => void;
  availableAgents?: Array<{ id: string; name: string; elevenLabsAgentId: string }>;
}

export function SystemToolConfigModal({
  isOpen,
  onClose,
  toolType,
  toolName,
  config,
  onSave,
  availableAgents = [],
}: SystemToolConfigModalProps) {
  const [localConfig, setLocalConfig] = useState<SystemToolConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  const addTransferRule = () => {
    const newRule: TransferRule = {
      agentId: "",
      agentName: "",
      condition: "",
      delayMs: 0,
      transferMessage: "",
      enableFirstMessage: true,
    };
    setLocalConfig({
      ...localConfig,
      transferRules: [...(localConfig.transferRules || []), newRule],
    });
  };

  const updateTransferRule = (index: number, updates: Partial<TransferRule>) => {
    const rules = [...(localConfig.transferRules || [])];
    rules[index] = { ...rules[index], ...updates };
    setLocalConfig({ ...localConfig, transferRules: rules });
  };

  const removeTransferRule = (index: number) => {
    const rules = (localConfig.transferRules || []).filter((_, i) => i !== index);
    setLocalConfig({ ...localConfig, transferRules: rules });
  };

  const addPhoneNumber = () => {
    const newNumber = {
      number: "",
      label: "",
      condition: "",
    };
    setLocalConfig({
      ...localConfig,
      phoneNumbers: [...(localConfig.phoneNumbers || []), newNumber],
    });
  };

  const updatePhoneNumber = (index: number, updates: any) => {
    const numbers = [...(localConfig.phoneNumbers || [])];
    numbers[index] = { ...numbers[index], ...updates };
    setLocalConfig({ ...localConfig, phoneNumbers: numbers });
  };

  const removePhoneNumber = (index: number) => {
    const numbers = (localConfig.phoneNumbers || []).filter((_, i) => i !== index);
    setLocalConfig({ ...localConfig, phoneNumbers: numbers });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit system tool: {toolName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Configuration Section */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Configuration</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Describe to the LLM how and when to use the tool.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Leave blank to use the default optimized LLM prompt."
                value={localConfig.description || ""}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, description: e.target.value })
                }
                className="min-h-[100px]"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="disable-interruptions">Disable interruptions</Label>
                <p className="text-sm text-muted-foreground">
                  Select this box to disable interruptions while the tool is running.
                </p>
              </div>
              <Switch
                id="disable-interruptions"
                checked={localConfig.disableInterruptions || false}
                onCheckedChange={(checked) =>
                  setLocalConfig({ ...localConfig, disableInterruptions: checked })
                }
              />
            </div>
          </div>

          {/* Transfer Rules for transfer_to_agent */}
          {toolType === "transferToAgent" && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Transfer Rules</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Define the conditions for transferring to different agents.
                </p>
              </div>

              {(localConfig.transferRules || []).map((rule, index) => (
                <Card key={index} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Target Agent</Label>
                          <Select
                            value={rule.agentId}
                            onValueChange={(value) => {
                              const agent = availableAgents.find(a => a.elevenLabsAgentId === value);
                              updateTransferRule(index, { 
                                agentId: value,
                                agentName: agent?.name || ""
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an agent" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableAgents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.elevenLabsAgentId}>
                                  {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Delay (ms)</Label>
                          <Input
                            type="number"
                            value={rule.delayMs || 0}
                            onChange={(e) =>
                              updateTransferRule(index, { delayMs: parseInt(e.target.value) })
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Condition</Label>
                        <Textarea
                          placeholder="e.g., User asks about billing or payment issues"
                          value={rule.condition}
                          onChange={(e) =>
                            updateTransferRule(index, { condition: e.target.value })
                          }
                          className="min-h-[60px]"
                        />
                      </div>

                      <div>
                        <Label>Transfer Message (optional)</Label>
                        <Input
                          placeholder="Message to play during transfer"
                          value={rule.transferMessage || ""}
                          onChange={(e) =>
                            updateTransferRule(index, { transferMessage: e.target.value })
                          }
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={rule.enableFirstMessage !== false}
                          onCheckedChange={(checked) =>
                            updateTransferRule(index, { enableFirstMessage: checked })
                          }
                        />
                        <Label>Enable first message from transferred agent</Label>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTransferRule(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}

              <Button
                variant="outline"
                onClick={addTransferRule}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>
          )}

          {/* Phone Numbers for transfer_to_number */}
          {toolType === "transferToNumber" && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Phone Numbers</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure phone numbers for human transfer.
                </p>
              </div>

              {(localConfig.phoneNumbers || []).map((phone, index) => (
                <Card key={index} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Phone Number</Label>
                          <Input
                            placeholder="+1234567890"
                            value={phone.number}
                            onChange={(e) =>
                              updatePhoneNumber(index, { number: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Label</Label>
                          <Input
                            placeholder="Support Team"
                            value={phone.label}
                            onChange={(e) =>
                              updatePhoneNumber(index, { label: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Condition (optional)</Label>
                        <Input
                          placeholder="When to transfer to this number"
                          value={phone.condition || ""}
                          onChange={(e) =>
                            updatePhoneNumber(index, { condition: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePhoneNumber(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}

              <Button
                variant="outline"
                onClick={addPhoneNumber}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Phone Number
              </Button>
            </div>
          )}

          {/* Language Detection */}
          {toolType === "detectLanguage" && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Supported Languages</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter supported language codes (e.g., en, es, fr).
                </p>
              </div>
              <Textarea
                placeholder="en, es, fr, de, it"
                value={(localConfig.supportedLanguages || []).join(", ")}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    supportedLanguages: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                  })
                }
              />
            </div>
          )}

          {/* Voicemail Detection */}
          {toolType === "voicemailDetection" && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={localConfig.leaveMessage || false}
                  onCheckedChange={(checked) =>
                    setLocalConfig({ ...localConfig, leaveMessage: checked })
                  }
                />
                <Label>Leave voicemail message</Label>
              </div>

              {localConfig.leaveMessage && (
                <div>
                  <Label>Voicemail Message</Label>
                  <Textarea
                    placeholder="Enter the message to leave on voicemail"
                    value={localConfig.messageContent || ""}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, messageContent: e.target.value })
                    }
                    className="min-h-[100px]"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}