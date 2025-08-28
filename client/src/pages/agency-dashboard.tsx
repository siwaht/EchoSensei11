import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, CreditCard, Settings, Activity, DollarSign, Palette, Link2, BarChart3, Upload, Phone } from "lucide-react";
import type { Client, ClientSubscription } from "@shared/schema";

export default function AgencyDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [isWhiteLabelSettingsOpen, setIsWhiteLabelSettingsOpen] = useState(false);

  // Fetch agency info
  const { data: agencyInfo } = useQuery({
    queryKey: ["/api/agency/info"],
  });

  // Fetch agency stats
  const { data: stats } = useQuery({
    queryKey: ["/api/agency/stats"],
  });

  // Fetch clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/agency/clients"],
  });

  // Fetch subscription plans
  const { data: subscriptionPlans } = useQuery({
    queryKey: ["/api/agency/subscription-plans"],
  });

  // Fetch white-label settings
  const { data: whiteLabelSettings } = useQuery({
    queryKey: ["/api/agency/white-label"],
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/agency/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/clients"] });
      toast({ title: "Client created successfully" });
      setIsCreateClientOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create client", description: error.message, variant: "destructive" });
    }
  });

  // Update client status mutation
  const updateClientStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/agency/clients/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/clients"] });
      toast({ title: "Client status updated" });
    }
  });

  // Update white-label settings mutation
  const updateWhiteLabelMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", "/api/agency/white-label", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/white-label"] });
      toast({ title: "White-label settings updated" });
      setIsWhiteLabelSettingsOpen(false);
    }
  });

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Agency Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your clients and business operations</p>
      </div>

      {/* Agency Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-stat-clients">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-clients-count">{stats?.activeClients || 0}</span>
              <Users className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {stats?.maxClients ? `of ${stats.maxClients} max` : 'Unlimited'}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-revenue">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-revenue">${stats?.monthlyRevenue || 0}</span>
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {stats?.revenueGrowth ? `${stats.revenueGrowth}% growth` : ''}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-usage">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Character Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-usage">{stats?.characterUsage || 0}%</span>
              <Activity className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {stats?.charactersUsed?.toLocaleString() || 0} of {stats?.characterQuota?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-calls">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-calls">{stats?.totalCalls || 0}</span>
              <Phone className="h-5 w-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-profit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-profit">${stats?.netProfit || 0}</span>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients" data-testid="tab-clients">Clients</TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">Billing & Subscriptions</TabsTrigger>
          <TabsTrigger value="whitelabel" data-testid="tab-whitelabel">White Label</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Agency Settings</TabsTrigger>
        </TabsList>

        {/* Clients Tab */}
        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Client Management</CardTitle>
                  <CardDescription>Manage your client accounts and subscriptions</CardDescription>
                </div>
                <Dialog open={isCreateClientOpen} onOpenChange={setIsCreateClientOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-client">Add New Client</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Client</DialogTitle>
                      <DialogDescription>Set up a new client account</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      createClientMutation.mutate({
                        businessName: formData.get("businessName"),
                        email: formData.get("email"),
                        phone: formData.get("phone"),
                        subscriptionPlanId: formData.get("subscriptionPlanId"),
                      });
                    }}>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="businessName">Business Name</Label>
                          <Input id="businessName" name="businessName" required data-testid="input-client-name" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Contact Email</Label>
                          <Input id="email" name="email" type="email" required data-testid="input-client-email" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input id="phone" name="phone" data-testid="input-client-phone" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subscriptionPlanId">Subscription Plan</Label>
                          <Select name="subscriptionPlanId" required>
                            <SelectTrigger data-testid="select-client-plan">
                              <SelectValue placeholder="Choose a plan" />
                            </SelectTrigger>
                            <SelectContent>
                              {subscriptionPlans?.map((plan: any) => (
                                <SelectItem key={plan.id} value={plan.id} data-testid={`option-plan-${plan.id}`}>
                                  {plan.name} - ${plan.price}/mo
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={createClientMutation.isPending} data-testid="button-submit-client">
                          Create Client
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients?.map((client: any) => (
                      <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-client-name-${client.id}`}>
                              {client.businessName}
                            </div>
                            <div className="text-sm text-gray-500">{client.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-plan-${client.id}`}>
                            {client.subscriptionPlan}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div data-testid={`text-usage-${client.id}`}>
                              {client.charactersUsed?.toLocaleString() || 0} chars
                            </div>
                            <div className="text-gray-500">
                              {client.callsCount || 0} calls
                            </div>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-revenue-${client.id}`}>
                          ${client.monthlyRevenue || 0}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={client.status === 'active' ? 'default' : 'secondary'}
                            data-testid={`badge-status-${client.id}`}
                          >
                            {client.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedClient(client)}
                              data-testid={`button-view-${client.id}`}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant={client.status === 'active' ? 'destructive' : 'default'}
                              onClick={() => updateClientStatusMutation.mutate({
                                id: client.id,
                                status: client.status === 'active' ? 'suspended' : 'active'
                              })}
                              data-testid={`button-toggle-${client.id}`}
                            >
                              {client.status === 'active' ? 'Suspend' : 'Activate'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* White Label Tab */}
        <TabsContent value="whitelabel">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>White Label Settings</CardTitle>
                  <CardDescription>Customize your agency branding and domain</CardDescription>
                </div>
                <Button 
                  onClick={() => setIsWhiteLabelSettingsOpen(true)}
                  disabled={!agencyInfo?.whitelabelEnabled}
                  data-testid="button-edit-whitelabel"
                >
                  Edit Settings
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!agencyInfo?.whitelabelEnabled ? (
                <div className="text-center py-8 text-gray-500">
                  <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>White-label features are not enabled for your agency plan.</p>
                  <p className="text-sm mt-2">Upgrade your plan to access white-label branding.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="text-sm text-gray-500">Brand Name</Label>
                      <p className="font-medium" data-testid="text-brand-name">
                        {whiteLabelSettings?.brandName || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Custom Domain</Label>
                      <p className="font-medium" data-testid="text-custom-domain">
                        {whiteLabelSettings?.customDomain || 'Not configured'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Primary Color</Label>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded border"
                          style={{ backgroundColor: whiteLabelSettings?.primaryColor || '#000000' }}
                          data-testid="color-primary"
                        />
                        <span>{whiteLabelSettings?.primaryColor || '#000000'}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Logo</Label>
                      <p className="font-medium" data-testid="text-logo-status">
                        {whiteLabelSettings?.logoUrl ? 'Uploaded' : 'Not uploaded'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* White Label Settings Dialog */}
      <Dialog open={isWhiteLabelSettingsOpen} onOpenChange={setIsWhiteLabelSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>White Label Settings</DialogTitle>
            <DialogDescription>Customize your agency's branding</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            updateWhiteLabelMutation.mutate({
              brandName: formData.get("brandName"),
              customDomain: formData.get("customDomain"),
              primaryColor: formData.get("primaryColor"),
              secondaryColor: formData.get("secondaryColor"),
            });
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name</Label>
                <Input 
                  id="brandName" 
                  name="brandName" 
                  defaultValue={whiteLabelSettings?.brandName}
                  data-testid="input-brand-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customDomain">Custom Domain (CNAME)</Label>
                <Input 
                  id="customDomain" 
                  name="customDomain" 
                  placeholder="app.yourdomain.com"
                  defaultValue={whiteLabelSettings?.customDomain}
                  data-testid="input-custom-domain"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <Input 
                    id="primaryColor" 
                    name="primaryColor" 
                    type="color"
                    defaultValue={whiteLabelSettings?.primaryColor || '#000000'}
                    data-testid="input-primary-color"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <Input 
                    id="secondaryColor" 
                    name="secondaryColor" 
                    type="color"
                    defaultValue={whiteLabelSettings?.secondaryColor || '#666666'}
                    data-testid="input-secondary-color"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={updateWhiteLabelMutation.isPending}
                data-testid="button-save-whitelabel"
              >
                Save Settings
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}