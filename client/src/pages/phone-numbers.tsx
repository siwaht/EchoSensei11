import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Phone, Plus, ChevronDown, Trash2, Edit, Globe, Server, User, RefreshCw, HelpCircle, ArrowRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { PhoneNumber, InsertPhoneNumber } from "@shared/schema";

const countryCodes = [
  { code: "+1", country: "US/Canada", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+91", country: "India", flag: "🇮🇳" },
];

export default function PhoneNumbers() {
  const { toast } = useToast();
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProvider, setImportProvider] = useState<"twilio" | "sip_trunk" | null>(null);
  const [phoneToDelete, setPhoneToDelete] = useState<PhoneNumber | null>(null);
  const [phoneToEdit, setPhoneToEdit] = useState<PhoneNumber | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState<string | null>(null);
  const [syncingPhoneId, setSyncingPhoneId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InsertPhoneNumber>>({
    label: "",
    phoneNumber: "",
    countryCode: "+1",
    provider: "twilio",
    twilioAccountSid: "",
    sipTrunkUri: "",
    sipUsername: "",
    sipPassword: "",
  });
  
  const [editFormData, setEditFormData] = useState<Partial<InsertPhoneNumber>>({
    label: "",
    phoneNumber: "",
    countryCode: "+1",
    provider: "twilio",
    twilioAccountSid: "",
    twilioAuthToken: "",
    sipTrunkUri: "",
    sipUsername: "",
    sipPassword: "",
  });

  // Fetch phone numbers
  const { data: phoneNumbers = [], isLoading } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  // Fetch agents for assignment
  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  // Create phone number mutation
  const createPhoneNumber = useMutation({
    mutationFn: async (data: Partial<InsertPhoneNumber>) => {
      return await apiRequest("POST", "/api/phone-numbers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setShowImportModal(false);
      setImportProvider(null);
      setFormData({
        label: "",
        phoneNumber: "",
        countryCode: "+1",
        provider: "twilio",
        twilioAccountSid: "",
        sipTrunkUri: "",
        sipUsername: "",
        sipPassword: "",
      });
      toast({
        title: "Phone number imported",
        description: "Your phone number has been successfully imported.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import phone number",
        variant: "destructive",
      });
    },
  });

  // Resync phone number with ElevenLabs
  const resyncPhoneNumber = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      return await apiRequest("POST", `/api/phone-numbers/${phoneNumberId}/resync`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setSyncingPhoneId(null);
      toast({
        title: "Phone number synced",
        description: data?.message || "Phone number has been re-synced with ElevenLabs.",
      });
    },
    onError: (error: any) => {
      setSyncingPhoneId(null);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync phone number with ElevenLabs",
        variant: "destructive",
      });
    },
  });

  // Delete phone number mutation
  const deletePhoneNumber = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/phone-numbers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setPhoneToDelete(null);
      toast({
        title: "Phone number deleted",
        description: "The phone number has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete phone number",
        variant: "destructive",
      });
    },
  });
  
  // Assign agent to phone number mutation
  const assignAgent = useMutation({
    mutationFn: async ({ phoneNumberId, agentId }: { phoneNumberId: string; agentId: string | null }) => {
      return await apiRequest("PATCH", `/api/phone-numbers/${phoneNumberId}/assign-agent`, { agentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setAssigningAgent(null);
      toast({
        title: "Agent assigned",
        description: "The agent has been successfully assigned to this phone number.",
      });
    },
    onError: (error: any) => {
      setAssigningAgent(null);
      toast({
        title: "Assignment failed",
        description: error.message || "Failed to assign agent to phone number",
        variant: "destructive",
      });
    },
  });

  // Update phone number mutation
  const updatePhoneNumber = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<InsertPhoneNumber> }) => {
      return await apiRequest("PATCH", `/api/phone-numbers/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setShowEditModal(false);
      setPhoneToEdit(null);
      toast({
        title: "Phone number updated",
        description: "Your phone number has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update phone number",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!importProvider) return;

    const dataToSubmit: Partial<InsertPhoneNumber> = {
      label: formData.label,
      phoneNumber: formData.phoneNumber,
      countryCode: formData.countryCode,
      provider: importProvider,
    };

    if (importProvider === "twilio") {
      dataToSubmit.twilioAccountSid = formData.twilioAccountSid;
      dataToSubmit.twilioAuthToken = formData.twilioAuthToken;
    } else if (importProvider === "sip_trunk") {
      dataToSubmit.sipTrunkUri = formData.sipTrunkUri;
      dataToSubmit.sipUsername = formData.sipUsername;
      dataToSubmit.sipPassword = formData.sipPassword;
    }

    createPhoneNumber.mutate(dataToSubmit);
  };
  
  const handleEdit = () => {
    if (!phoneToEdit) return;
    
    const updates: Partial<InsertPhoneNumber> = {
      label: editFormData.label,
      phoneNumber: editFormData.phoneNumber,
      countryCode: editFormData.countryCode,
    };
    
    if (phoneToEdit.provider === "twilio") {
      if (editFormData.twilioAccountSid) {
        updates.twilioAccountSid = editFormData.twilioAccountSid;
      }
      if (editFormData.twilioAuthToken) {
        updates.twilioAuthToken = editFormData.twilioAuthToken;
      }
    } else if (phoneToEdit.provider === "sip_trunk") {
      if (editFormData.sipTrunkUri) {
        updates.sipTrunkUri = editFormData.sipTrunkUri;
      }
      if (editFormData.sipUsername) {
        updates.sipUsername = editFormData.sipUsername;
      }
      if (editFormData.sipPassword) {
        updates.sipPassword = editFormData.sipPassword;
      }
    }
    
    updatePhoneNumber.mutate({ id: phoneToEdit.id, updates });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
            Phone numbers
          </h2>
          <p className="text-gray-600 dark:text-gray-400" data-testid="text-page-description">
            Connect phone numbers to your voice AI agents
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button data-testid="button-import-number">
              <Plus className="w-4 h-4 mr-2" />
              Import number
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setImportProvider("twilio");
                setShowImportModal(true);
              }}
              data-testid="menu-import-twilio"
            >
              <Globe className="w-4 h-4 mr-2" />
              From Twilio
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setImportProvider("sip_trunk");
                setShowImportModal(true);
              }}
              data-testid="menu-import-sip"
            >
              <Server className="w-4 h-4 mr-2" />
              From SIP Trunk
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {phoneNumbers.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <Phone className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2" data-testid="text-no-numbers">
              No phone numbers yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              Import phone numbers from Twilio or connect SIP trunks to enable voice calling for your AI agents.
            </p>
            
            {/* Quick Setup Steps */}
            <div className="max-w-md mx-auto mb-6 text-left space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-semibold">1</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Choose your provider</p>
                  <p className="text-xs text-muted-foreground">Import from Twilio or configure SIP trunk</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-semibold">2</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Connect your number</p>
                  <p className="text-xs text-muted-foreground">Enter phone number and credentials</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-semibold">3</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Assign to an agent</p>
                  <p className="text-xs text-muted-foreground">Link the number to your AI voice agent</p>
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="button-import-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Import number
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    setImportProvider("twilio");
                    setShowImportModal(true);
                  }}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  From Twilio
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setImportProvider("sip_trunk");
                    setShowImportModal(true);
                  }}
                >
                  <Server className="w-4 h-4 mr-2" />
                  From SIP Trunk
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {phoneNumbers.map((phone) => (
            <Card key={phone.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-lg" data-testid={`text-phone-label-${phone.id}`}>
                      {phone.label}
                    </h3>
                    <Badge variant={phone.status === "active" ? "default" : "secondary"}>
                      {phone.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Phone className="w-4 h-4" />
                    <span data-testid={`text-phone-number-${phone.id}`}>
                      {phone.countryCode} {phone.phoneNumber}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-2">
                  <span className="text-gray-500">Provider:</span>
                  <span className="font-medium capitalize text-right">
                    {phone.provider === "sip_trunk" ? "SIP Trunk" : phone.provider === "twilio" ? "Twilio" : phone.provider}
                  </span>
                </div>
                {phone.twilioAccountSid && (
                  <div className="grid grid-cols-2 gap-x-2">
                    <span className="text-gray-500">Twilio SID:</span>
                    <span className="font-mono text-xs text-right truncate" title={phone.twilioAccountSid}>
                      {phone.twilioAccountSid.slice(0, 10)}...
                    </span>
                  </div>
                )}
                {phone.sipTrunkUri && (
                  <div className="grid grid-cols-2 gap-x-2">
                    <span className="text-gray-500">SIP URI:</span>
                    <span className="font-mono text-xs text-right truncate" title={phone.sipTrunkUri}>
                      {phone.sipTrunkUri}
                    </span>
                  </div>
                )}
                {phone.lastSynced && (
                  <div className="grid grid-cols-2 gap-x-2">
                    <span className="text-gray-500">Last synced:</span>
                    <span className="text-right">
                      {new Date(phone.lastSynced).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Agent Assignment */}
              <div className="mt-4 pt-4 border-t">
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Assigned Agent
                    </Label>
                    <span className="text-sm text-gray-500">
                      {phone.agentId ? agents.find((a: any) => a.id === phone.agentId)?.name || "Unknown" : "Unknown"}
                    </span>
                  </div>
                </div>
                <Select
                  value={phone.agentId || "none"}
                  onValueChange={(value) => {
                    setAssigningAgent(phone.id);
                    assignAgent.mutate({
                      phoneNumberId: phone.id,
                      agentId: value === "none" ? null : value,
                    });
                  }}
                  disabled={assigningAgent === phone.id}
                >
                  <SelectTrigger className="w-full" data-testid={`select-agent-${phone.id}`}>
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">No agent assigned</span>
                    </SelectItem>
                    {agents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                {!phone.elevenLabsPhoneId && phone.status === "pending" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setSyncingPhoneId(phone.id);
                      resyncPhoneNumber.mutate(phone.id);
                    }}
                    disabled={syncingPhoneId === phone.id}
                    data-testid={`button-sync-${phone.id}`}
                  >
                    {syncingPhoneId === phone.id ? (
                      <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-1" /> Sync</>
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={phone.elevenLabsPhoneId ? "flex-1" : ""}
                  onClick={() => {
                    setPhoneToEdit(phone);
                    setEditFormData({
                      label: phone.label,
                      phoneNumber: phone.phoneNumber,
                      countryCode: phone.countryCode || "+1",
                      provider: phone.provider,
                      twilioAccountSid: phone.twilioAccountSid || "",
                      twilioAuthToken: "", // Don't pre-fill sensitive data
                      sipTrunkUri: phone.sipTrunkUri || "",
                      sipUsername: phone.sipUsername || "",
                      sipPassword: "", // Don't pre-fill sensitive data
                    });
                    setShowEditModal(true);
                  }}
                  data-testid={`button-edit-${phone.id}`}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPhoneToDelete(phone)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  data-testid={`button-delete-${phone.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Import phone number from {importProvider === "twilio" ? "Twilio" : "SIP Trunk"}
              </div>
            </DialogTitle>
            <DialogDescription>
              {importProvider === "twilio" 
                ? "Connect your Twilio phone number to receive calls"
                : "Connect your SIP trunk to receive calls"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                placeholder="Easy to identify name of the phone number"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                data-testid="input-label"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.countryCode}
                  onValueChange={(value) => setFormData({ ...formData, countryCode: value })}
                >
                  <SelectTrigger className="w-[120px]" data-testid="select-country-code">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countryCodes.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        <div className="flex items-center gap-2">
                          <span>{country.flag}</span>
                          <span>{country.code}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="phone"
                  placeholder="Enter phone number"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="flex-1"
                  data-testid="input-phone-number"
                />
              </div>
            </div>

            {importProvider === "twilio" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="twilioSid">Twilio Account SID</Label>
                  <Input
                    id="twilioSid"
                    placeholder="Twilio Account SID"
                    value={formData.twilioAccountSid || ""}
                    onChange={(e) => setFormData({ ...formData, twilioAccountSid: e.target.value })}
                    data-testid="input-twilio-sid"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twilioToken">Twilio Auth Token</Label>
                  <Input
                    id="twilioToken"
                    type="password"
                    placeholder="Twilio Auth Token (Required)"
                    value={formData.twilioAuthToken || ""}
                    onChange={(e) => setFormData({ ...formData, twilioAuthToken: e.target.value })}
                    data-testid="input-twilio-token"
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for connecting to ElevenLabs. Find it in your Twilio Console.
                  </p>
                </div>
              </>
            )}

            {importProvider === "sip_trunk" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="sipUri">SIP Trunk URI</Label>
                  <Input
                    id="sipUri"
                    placeholder="sip.example.com"
                    value={formData.sipTrunkUri || ""}
                    onChange={(e) => setFormData({ ...formData, sipTrunkUri: e.target.value })}
                    data-testid="input-sip-uri"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sipUsername">SIP Username (Optional)</Label>
                  <Input
                    id="sipUsername"
                    placeholder="Username"
                    value={formData.sipUsername || ""}
                    onChange={(e) => setFormData({ ...formData, sipUsername: e.target.value })}
                    data-testid="input-sip-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sipPassword">SIP Password (Optional)</Label>
                  <Input
                    id="sipPassword"
                    type="password"
                    placeholder="Password"
                    value={formData.sipPassword || ""}
                    onChange={(e) => setFormData({ ...formData, sipPassword: e.target.value })}
                    data-testid="input-sip-password"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportModal(false);
                setImportProvider(null);
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!formData.label || !formData.phoneNumber || (importProvider === "twilio" && (!formData.twilioAccountSid || !formData.twilioAuthToken)) || createPhoneNumber.isPending}
              data-testid="button-import"
            >
              {createPhoneNumber.isPending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Edit phone number
              </div>
            </DialogTitle>
            <DialogDescription>
              Update the details of your phone number
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-label">Label</Label>
              <Input
                id="edit-label"
                placeholder="Easy to identify name of the phone number"
                value={editFormData.label}
                onChange={(e) => setEditFormData({ ...editFormData, label: e.target.value })}
                data-testid="input-edit-label"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone number</Label>
              <div className="flex gap-2">
                <Select
                  value={editFormData.countryCode}
                  onValueChange={(value) => setEditFormData({ ...editFormData, countryCode: value })}
                >
                  <SelectTrigger className="w-[120px]" data-testid="select-edit-country-code">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countryCodes.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        <div className="flex items-center gap-2">
                          <span>{country.flag}</span>
                          <span>{country.code}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="edit-phone"
                  placeholder="Enter phone number"
                  value={editFormData.phoneNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                  className="flex-1"
                  data-testid="input-edit-phone-number"
                />
              </div>
            </div>

            {phoneToEdit?.provider === "twilio" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-twilioSid">Twilio Account SID</Label>
                  <Input
                    id="edit-twilioSid"
                    placeholder="Twilio Account SID"
                    value={editFormData.twilioAccountSid || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, twilioAccountSid: e.target.value })}
                    data-testid="input-edit-twilio-sid"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-twilioToken">Twilio Auth Token</Label>
                  <Input
                    id="edit-twilioToken"
                    type="password"
                    placeholder="Enter new token (leave blank to keep existing)"
                    value={editFormData.twilioAuthToken || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, twilioAuthToken: e.target.value })}
                    data-testid="input-edit-twilio-token"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only enter if you want to update the token
                  </p>
                </div>
              </>
            )}

            {phoneToEdit?.provider === "sip_trunk" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-sipUri">SIP Trunk URI</Label>
                  <Input
                    id="edit-sipUri"
                    placeholder="sip.example.com"
                    value={editFormData.sipTrunkUri || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, sipTrunkUri: e.target.value })}
                    data-testid="input-edit-sip-uri"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sipUsername">SIP Username</Label>
                  <Input
                    id="edit-sipUsername"
                    placeholder="Username"
                    value={editFormData.sipUsername || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, sipUsername: e.target.value })}
                    data-testid="input-edit-sip-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sipPassword">SIP Password</Label>
                  <Input
                    id="edit-sipPassword"
                    type="password"
                    placeholder="Enter new password (leave blank to keep existing)"
                    value={editFormData.sipPassword || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, sipPassword: e.target.value })}
                    data-testid="input-edit-sip-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only enter if you want to update the password
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setPhoneToEdit(null);
              }}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!editFormData.label || !editFormData.phoneNumber || updatePhoneNumber.isPending}
              data-testid="button-save-edit"
            >
              {updatePhoneNumber.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!phoneToDelete} onOpenChange={(open) => !open && setPhoneToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Phone Number</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{phoneToDelete?.label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => phoneToDelete && deletePhoneNumber.mutate(phoneToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}