import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Phone, Users, Clock, AlertCircle, Upload, Download, Play, Pause, Trash2, TestTube } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agent, PhoneNumber, BatchCall } from "@shared/schema";

export default function OutboundCalling() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedBatchCall, setSelectedBatchCall] = useState<BatchCall | null>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state for creating batch call
  const [formData, setFormData] = useState({
    name: "",
    agentId: "",
    phoneNumberId: "",
    recipients: [] as any[],
  });

  // Fetch batch calls
  const { data: batchCalls = [], isLoading: loadingBatchCalls } = useQuery<BatchCall[]>({
    queryKey: ["/api/batch-calls"],
  });

  // Fetch agents
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch phone numbers
  const { data: phoneNumbers = [] } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  // Create batch call mutation
  const createBatchCall = useMutation({
    mutationFn: async (data: any) => {
      // First create the batch call
      const batchCall: any = await apiRequest("POST", "/api/batch-calls", data);
      
      // Then add recipients if provided  
      if (data.recipients && data.recipients.length > 0 && batchCall && batchCall.id) {
        await apiRequest("POST", `/api/batch-calls/${batchCall.id}/recipients`, {
          recipients: data.recipients,
        });
      }
      
      return batchCall;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batch-calls"] });
      setShowCreateDialog(false);
      setFormData({ name: "", agentId: "", phoneNumberId: "", recipients: [] });
      toast({
        title: "Batch call created",
        description: "Your batch call has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create batch call",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Submit batch call mutation
  const submitBatchCall = useMutation({
    mutationFn: async (batchCallId: string) => {
      return await apiRequest("POST", `/api/batch-calls/${batchCallId}/submit`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batch-calls"] });
      toast({
        title: "Batch call submitted",
        description: "Your batch call has been submitted to ElevenLabs.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit batch call",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Test call mutation
  const testCall = useMutation({
    mutationFn: async (data: { batchCallId: string; phoneNumber: string }) => {
      return await apiRequest("POST", `/api/batch-calls/${data.batchCallId}/test`, {
        phoneNumber: data.phoneNumber,
      });
    },
    onSuccess: () => {
      setShowTestDialog(false);
      setTestPhoneNumber("");
      toast({
        title: "Test call initiated",
        description: "Your test call has been started. You should receive a call shortly.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start test call",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Delete batch call mutation
  const deleteBatchCall = useMutation({
    mutationFn: async (batchCallId: string) => {
      return await apiRequest("DELETE", `/api/batch-calls/${batchCallId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batch-calls"] });
      toast({
        title: "Batch call deleted",
        description: "The batch call has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete batch call",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Parse CSV (simplified - in production, use a proper CSV parser)
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/\r/g, ''));
      const recipients = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
          const values = line.split(',').map(v => v.trim().replace(/\r/g, ''));
          const recipient: any = {};
          headers.forEach((header, index) => {
            const value = values[index] || '';
            // Store empty strings as undefined for optional override fields
            if (value === '' && ['language', 'voice_id', 'first_message', 'prompt'].includes(header)) {
              recipient[header] = undefined;
            } else {
              recipient[header] = value;
            }
          });
          return recipient;
        });
      
      // Validate that phone_number column exists
      if (!headers.includes('phone_number')) {
        toast({
          title: "Invalid file format",
          description: "The CSV file must contain a 'phone_number' column.",
          variant: "destructive",
        });
        return;
      }
      
      setFormData({ ...formData, recipients });
      toast({
        title: "File uploaded",
        description: `${recipients.length} recipients loaded from file.`,
      });
    };
    reader.readAsText(file);
  };

  // Download template
  const downloadTemplate = () => {
    const template = "phone_number,language,voice_id,first_message,prompt,city,other_dyn_variable\n1234567890,en,,,,London,\n4851706793,pl,,,,Warsaw,";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_call_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter batch calls
  const filteredBatchCalls = batchCalls.filter((call) =>
    call.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get status badge color
  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "draft": return "secondary";
      case "pending": return "default";
      case "in_progress": return "default";
      case "completed": return "outline";
      case "failed": return "destructive";
      case "cancelled": return "secondary";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
            Batch Calling
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Create and manage outbound calling campaigns
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="gap-2"
          data-testid="button-create-batch-call"
        >
          <Plus className="w-4 h-4" />
          Create a batch call
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search Batch Calls..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-batch-calls"
        />
      </div>

      {/* Batch Calls List */}
      {loadingBatchCalls ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      ) : filteredBatchCalls.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Phone className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2" data-testid="text-no-batch-calls">
              No batch calls found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              You have not created any batch calls yet.
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              data-testid="button-create-first-batch-call"
            >
              Create your first batch call
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBatchCalls.map((batchCall) => (
            <Card
              key={batchCall.id}
              className="p-4 hover:shadow-md transition-shadow"
              data-testid={`card-batch-call-${batchCall.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {batchCall.name}
                    </h3>
                    <Badge variant={getStatusColor(batchCall.status || "draft")}>
                      {batchCall.status || "draft"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-6 mt-2 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{batchCall.totalRecipients || 0} recipients</span>
                    </div>
                    {batchCall.completedCalls !== undefined && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        <span>{batchCall.completedCalls} completed</span>
                      </div>
                    )}
                    {batchCall.createdAt && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(batchCall.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {batchCall.status === "draft" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedBatchCall(batchCall);
                          setFormData({
                            name: batchCall.name,
                            agentId: batchCall.agentId,
                            phoneNumberId: batchCall.phoneNumberId || "",
                            recipients: [],
                          });
                          setShowCreateDialog(true);
                        }}
                        data-testid={`button-edit-${batchCall.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedBatchCall(batchCall);
                          setShowTestDialog(true);
                        }}
                        disabled={!batchCall.agentId || !batchCall.phoneNumberId}
                        data-testid={`button-test-${batchCall.id}`}
                      >
                        <TestTube className="w-4 h-4 mr-1" />
                        Test
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => submitBatchCall.mutate(batchCall.id)}
                        disabled={submitBatchCall.isPending || !batchCall.totalRecipients}
                        data-testid={`button-submit-${batchCall.id}`}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Submit
                      </Button>
                    </>
                  )}
                  {batchCall.status === "in_progress" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      data-testid={`button-pause-${batchCall.id}`}
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      In Progress
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this batch call?")) {
                        deleteBatchCall.mutate(batchCall.id);
                      }
                    }}
                    data-testid={`button-delete-${batchCall.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Batch Call Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBatchCall ? "Edit batch call" : "Create a batch call"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Batch name</Label>
              <Input
                id="name"
                placeholder="Untitled Batch"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-batch-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Select
                value={formData.phoneNumberId}
                onValueChange={(value) => setFormData({ ...formData, phoneNumberId: value })}
              >
                <SelectTrigger id="phone" data-testid="select-phone-number">
                  <SelectValue placeholder="Please add a phone number to start batch calling" />
                </SelectTrigger>
                <SelectContent>
                  {phoneNumbers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No phone numbers available
                    </SelectItem>
                  ) : (
                    phoneNumbers.map((phone) => (
                      <SelectItem key={phone.id} value={phone.id}>
                        {phone.label} ({phone.phoneNumber})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent">Select Agent</Label>
              <Select
                value={formData.agentId}
                onValueChange={(value) => setFormData({ ...formData, agentId: value })}
              >
                <SelectTrigger id="agent" data-testid="select-agent">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No agents available
                    </SelectItem>
                  ) : (
                    agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Recipients</Label>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>25.0 MB</span>
                  <Badge variant="secondary" className="text-xs">CSV</Badge>
                  <Badge variant="secondary" className="text-xs">XLS</Badge>
                </div>
              </div>
              {formData.recipients.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload"
                  >
                    Upload
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-lg p-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{formData.recipients.length} recipients</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData({ ...formData, recipients: [] });
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        data-testid="button-clear-recipients"
                      >
                        Clear
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                      data-testid="button-reupload"
                    >
                      Upload different file
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              )}
            </div>

            {formData.recipients.length > 0 && (
              <div className="space-y-2">
                <Label>Formatting</Label>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    The <span className="font-mono text-gray-900 dark:text-gray-100">phone_number</span> column is
                    required. You can also pass certain <span className="font-mono text-gray-900 dark:text-gray-100">overrides</span>.
                    Any other columns will be passed as dynamic variables.
                  </p>
                  {/* Preview table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="h-8">
                          {Object.keys(formData.recipients[0] || {}).slice(0, 4).map((col) => (
                            <TableHead key={col} className="text-xs py-1">{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.recipients.slice(0, 3).map((recipient, idx) => (
                          <TableRow key={idx} className="h-8">
                            {Object.keys(recipient).slice(0, 4).map((col) => (
                              <TableCell key={col} className="text-xs py-1">
                                {recipient[col] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadTemplate}
                className="gap-2"
                data-testid="button-download-template"
              >
                <Download className="w-4 h-4" />
                Template
              </Button>
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedBatchCall({
                  id: 'temp',
                  name: formData.name || 'Test Batch',
                  agentId: formData.agentId,
                  phoneNumberId: formData.phoneNumberId,
                  organizationId: '',
                  userId: '',
                  status: 'draft',
                  totalRecipients: formData.recipients.length,
                  completedCalls: 0,
                  failedCalls: 0,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                } as BatchCall);
                setShowTestDialog(true);
              }}
              disabled={!formData.agentId || !formData.phoneNumberId}
              data-testid="button-test-call"
            >
              Test call
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setSelectedBatchCall(null);
                  setFormData({ name: "", agentId: "", phoneNumberId: "", recipients: [] });
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedBatchCall && selectedBatchCall.id !== 'temp') {
                    // Update existing batch call
                    // Not implemented yet
                  } else {
                    createBatchCall.mutate(formData);
                  }
                }}
                disabled={
                  !formData.name ||
                  !formData.agentId ||
                  createBatchCall.isPending
                }
                data-testid="button-save-batch-call"
              >
                {createBatchCall.isPending ? "Submitting..." : "Submit a Batch Call"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Call Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Test Batch Call</DialogTitle>
            <DialogDescription>
              Make a test call to verify your agent and settings are working correctly before submitting the full batch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-phone">Test Phone Number</Label>
              <Input
                id="test-phone"
                placeholder="+1234567890"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
                data-testid="input-test-phone-number"
              />
              <p className="text-xs text-gray-500">
                Enter the phone number where you want to receive the test call
              </p>
            </div>

            <div className="space-y-2">
              <Label>Note</Label>
              <p className="text-xs text-gray-500">
                The test call will use the agent and phone number you selected. Recipients file is not required for testing.
              </p>
            </div>

            {selectedBatchCall && (
              <div className="space-y-2">
                <Label>Test Call Details</Label>
                <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                  <p>• Batch: {selectedBatchCall.name}</p>
                  <p>• Agent: {agents.find(a => a.id === selectedBatchCall.agentId)?.name || "Unknown"}</p>
                  <p>• From: {phoneNumbers.find(p => p.id === selectedBatchCall.phoneNumberId)?.phoneNumber || "Unknown"}</p>
                </div>
              </div>
            )}

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium">Test calls are billed at regular rates</p>
                  <p className="text-xs mt-1">Standard per-minute charges apply to test calls</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTestDialog(false);
                setTestPhoneNumber("");
                setSelectedBatchCall(null);
              }}
              data-testid="button-cancel-test"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedBatchCall && testPhoneNumber) {
                  testCall.mutate({
                    batchCallId: selectedBatchCall.id,
                    phoneNumber: testPhoneNumber,
                  });
                }
              }}
              disabled={
                !testPhoneNumber ||
                !selectedBatchCall ||
                testCall.isPending
              }
              data-testid="button-start-test-call"
            >
              {testCall.isPending ? "Starting..." : "Start Test Call"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}