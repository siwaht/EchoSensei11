import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, CreditCard, Settings, Activity, DollarSign, Shield, Palette, Link2, BarChart3 } from "lucide-react";
import type { Agency, AgencyPlan } from "@shared/schema";

export default function SuperAdminDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [isCreateAgencyOpen, setIsCreateAgencyOpen] = useState(false);
  const [isEditPlanOpen, setIsEditPlanOpen] = useState(false);
  
  // Fetch platform stats
  const { data: stats } = useQuery({
    queryKey: ["/api/super-admin/stats"],
  });

  // Fetch all agencies
  const { data: agencies, isLoading: agenciesLoading } = useQuery({
    queryKey: ["/api/super-admin/agencies"],
  });

  // Fetch agency plans
  const { data: agencyPlans } = useQuery({
    queryKey: ["/api/super-admin/agency-plans"],
  });

  // Create agency mutation
  const createAgencyMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/super-admin/agencies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/agencies"] });
      toast({ title: "Agency created successfully" });
      setIsCreateAgencyOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create agency", description: error.message, variant: "destructive" });
    }
  });

  // Update agency status mutation
  const updateAgencyStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/super-admin/agencies/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/agencies"] });
      toast({ title: "Agency status updated" });
    }
  });

  // Update agency plan mutation
  const updateAgencyPlanMutation = useMutation({
    mutationFn: async ({ agencyId, planId }: { agencyId: string; planId: string }) => {
      return await apiRequest("PATCH", `/api/super-admin/agencies/${agencyId}/plan`, { planId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/agencies"] });
      toast({ title: "Agency plan updated" });
      setIsEditPlanOpen(false);
    }
  });

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Platform management and oversight</p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-stat-agencies">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Agencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-agencies-count">{stats?.totalAgencies || 0}</span>
              <Building2 className="h-5 w-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-clients">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-clients-count">{stats?.totalClients || 0}</span>
              <Users className="h-5 w-5 text-gray-400" />
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
          </CardContent>
        </Card>

        <Card data-testid="card-stat-active">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-active-subs">{stats?.activeSubscriptions || 0}</span>
              <Activity className="h-5 w-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-usage">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Platform Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-usage">{stats?.platformUsage || 0}%</span>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="agencies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agencies" data-testid="tab-agencies">Agencies</TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">Plans & Pricing</TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">Billing</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Platform Settings</TabsTrigger>
        </TabsList>

        {/* Agencies Tab */}
        <TabsContent value="agencies">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Agencies Management</CardTitle>
                  <CardDescription>Manage all agencies on the platform</CardDescription>
                </div>
                <Dialog open={isCreateAgencyOpen} onOpenChange={setIsCreateAgencyOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-agency">Create New Agency</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Agency</DialogTitle>
                      <DialogDescription>Set up a new agency account on the platform</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      createAgencyMutation.mutate({
                        name: formData.get("name"),
                        email: formData.get("email"),
                        planId: formData.get("planId"),
                      });
                    }}>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Agency Name</Label>
                          <Input id="name" name="name" required data-testid="input-agency-name" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Contact Email</Label>
                          <Input id="email" name="email" type="email" required data-testid="input-agency-email" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="planId">Select Plan</Label>
                          <Select name="planId" required>
                            <SelectTrigger data-testid="select-agency-plan">
                              <SelectValue placeholder="Choose a plan" />
                            </SelectTrigger>
                            <SelectContent>
                              {agencyPlans?.map((plan: AgencyPlan) => (
                                <SelectItem key={plan.id} value={plan.id} data-testid={`option-plan-${plan.id}`}>
                                  {plan.name} - ${plan.basePrice}/mo
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={createAgencyMutation.isPending} data-testid="button-submit-agency">
                          Create Agency
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {agenciesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agency</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Clients</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agencies?.map((agency: any) => (
                      <TableRow key={agency.id} data-testid={`row-agency-${agency.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-agency-name-${agency.id}`}>{agency.name}</div>
                            <div className="text-sm text-gray-500">{agency.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-plan-${agency.id}`}>
                            {agency.planName}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-clients-${agency.id}`}>{agency.clientCount || 0}</TableCell>
                        <TableCell data-testid={`text-revenue-${agency.id}`}>${agency.monthlyRevenue || 0}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={agency.status === 'active' ? 'default' : 'secondary'}
                            data-testid={`badge-status-${agency.id}`}
                          >
                            {agency.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedAgency(agency);
                                setIsEditPlanOpen(true);
                              }}
                              data-testid={`button-edit-${agency.id}`}
                            >
                              Edit Plan
                            </Button>
                            <Button
                              size="sm"
                              variant={agency.status === 'active' ? 'destructive' : 'default'}
                              onClick={() => updateAgencyStatusMutation.mutate({
                                id: agency.id,
                                status: agency.status === 'active' ? 'suspended' : 'active'
                              })}
                              data-testid={`button-toggle-${agency.id}`}
                            >
                              {agency.status === 'active' ? 'Suspend' : 'Activate'}
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

        {/* Plans & Pricing Tab */}
        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle>Agency Plans & Pricing</CardTitle>
              <CardDescription>Configure platform pricing tiers and features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {agencyPlans?.map((plan: AgencyPlan) => (
                  <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
                    <CardHeader>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="text-2xl font-bold">${plan.basePrice}/mo</div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">Max Clients: {plan.maxClients || 'Unlimited'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span className="text-sm">Characters: {plan.masterCharacterQuota?.toLocaleString() || 'Unlimited'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        <span className="text-sm">White-label: {plan.whitelabelEnabled ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        <span className="text-sm">Custom Domain: {plan.customDomainEnabled ? 'Yes' : 'No'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Plan Dialog */}
      <Dialog open={isEditPlanOpen} onOpenChange={setIsEditPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Agency Plan</DialogTitle>
            <DialogDescription>Update the subscription plan for {selectedAgency?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select
              onValueChange={(value) => {
                if (selectedAgency) {
                  updateAgencyPlanMutation.mutate({
                    agencyId: selectedAgency.id,
                    planId: value
                  });
                }
              }}
            >
              <SelectTrigger data-testid="select-change-plan">
                <SelectValue placeholder="Select new plan" />
              </SelectTrigger>
              <SelectContent>
                {agencyPlans?.map((plan: AgencyPlan) => (
                  <SelectItem key={plan.id} value={plan.id} data-testid={`option-change-${plan.id}`}>
                    {plan.name} - ${plan.basePrice}/mo
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}