import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Users, Building2, DollarSign, Phone, Edit, Trash2, Plus, Shield, 
  Activity, TrendingUp, Package, CreditCard, UserPlus, Settings,
  Save, X
} from "lucide-react";
import type { User, Organization, BillingPackage } from "@shared/schema";

interface BillingData {
  totalUsers: number;
  totalOrganizations: number;
  totalCalls: number;
  totalRevenue: number;
  organizationsData: Array<{
    id: string;
    name: string;
    userCount: number;
    totalCalls: number;
    totalMinutes: number;
    estimatedCost: number;
    billingPackage?: string;
    perCallRate?: number;
    perMinuteRate?: number;
    monthlyCredits?: number;
    usedCredits?: number;
  }>;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  
  // State management
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editingOrg, setEditingOrg] = useState<{
    id: string;
    name: string;
    billingPackage: string;
    perCallRate: string;
    perMinuteRate: string;
    monthlyCredits: string;
    maxAgents: string;
    maxUsers: string;
    customRateEnabled: boolean;
    userCount?: number;
    totalCalls?: number;
    usedCredits?: number;
    estimatedCost?: number;
  } | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    companyName: "",
    isAdmin: false,
  });

  // Queries
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: organizations = [], isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/admin/organizations"],
  });

  const { data: billingData, isLoading: billingLoading } = useQuery<BillingData>({
    queryKey: ["/api/admin/billing"],
  });

  const { data: billingPackages = [], isLoading: packagesLoading } = useQuery<BillingPackage[]>({
    queryKey: ["/api/admin/billing-packages"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      return await apiRequest("POST", "/api/admin/users", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({ title: "User created successfully" });
      setCreatingUser(false);
      setNewUser({
        email: "",
        firstName: "",
        lastName: "",
        password: "",
        companyName: "",
        isAdmin: false,
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create user", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<User> }) => {
      return await apiRequest("PATCH", `/api/admin/users/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated successfully" });
      setEditingUser(null);
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
      toast({ title: "User deleted successfully" });
      setDeletingUser(null);
    },
    onError: () => {
      toast({ title: "Failed to delete user", variant: "destructive" });
    },
  });

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Organization> }) => {
      return await apiRequest("PATCH", `/api/admin/organizations/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
      toast({ title: "Organization billing updated successfully" });
      setEditingOrg(null);
    },
    onError: () => {
      toast({ title: "Failed to update organization", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Admin Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Manage users, organizations, and billing</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 flex-shrink-0">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Total Users</p>
              <p className="text-2xl font-bold truncate">{billingData?.totalUsers || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20 border-green-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20 flex-shrink-0">
              <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Organizations</p>
              <p className="text-2xl font-bold truncate">{billingData?.totalOrganizations || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20 flex-shrink-0">
              <Phone className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Total Calls</p>
              <p className="text-2xl font-bold truncate">{billingData?.totalCalls || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/10 dark:from-amber-500/20 dark:to-amber-600/20 border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 flex-shrink-0">
              <DollarSign className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Total Revenue</p>
              <p className="text-2xl font-bold truncate">${billingData?.totalRevenue?.toFixed(2) || "0.00"}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs for different admin sections */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="billing">Billing & Packages</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">User Management</h2>
              <Button onClick={() => setCreatingUser(true)} className="gap-2">
                <UserPlus className="w-4 h-4" />
                Add New User
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium">User</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Email</th>
                    <th className="text-left py-3 px-2 text-sm font-medium hidden md:table-cell">Company</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Role</th>
                    <th className="text-left py-3 px-2 text-sm font-medium hidden lg:table-cell">Created</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {user.profileImageUrl ? (
                            <img src={user.profileImageUrl} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </span>
                            </div>
                          )}
                          <span className="truncate text-sm">{user.firstName} {user.lastName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="block truncate text-sm max-w-[200px]">{user.email}</span>
                      </td>
                      <td className="py-3 px-2 hidden md:table-cell">
                        <span className="block truncate text-sm max-w-[150px]">
                          {organizations.find(org => org.id === user.organizationId)?.name || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        {user.isAdmin ? (
                          <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-xs">Admin</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">User</Badge>
                        )}
                      </td>
                      <td className="py-3 px-2 hidden lg:table-cell">
                        <span className="text-sm">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingUser(user)}
                            data-testid={`button-edit-user-${user.id}`}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 h-8 w-8 p-0"
                            onClick={() => setDeletingUser(user)}
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Billing & Packages Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Organization Billing Settings</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium">Organization</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Package</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Per Call</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Per Min</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Credits</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Used</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {billingData?.organizationsData.map((org) => {
                    const orgDetails = organizations.find(o => o.id === org.id);
                    return (
                      <tr key={org.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <span className="font-medium text-sm truncate block max-w-[150px]">{org.name}</span>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className="text-xs">{org.billingPackage || 'Starter'}</Badge>
                        </td>
                        <td className="py-3 px-2 text-sm">${org.perCallRate || '0.30'}</td>
                        <td className="py-3 px-2 text-sm">${org.perMinuteRate || '0.30'}</td>
                        <td className="py-3 px-2 text-sm">{org.monthlyCredits || 0}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{org.usedCredits || 0}</span>
                            {org.monthlyCredits && org.monthlyCredits > 0 && (
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden hidden lg:block">
                                <div 
                                  className="h-full bg-primary"
                                  style={{ width: `${Math.min(100, ((org.usedCredits || 0) / org.monthlyCredits) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const orgDetails = organizations.find(o => o.id === org.id);
                              setEditingOrg({
                                id: org.id,
                                name: org.name,
                                billingPackage: String(org.billingPackage || 'starter'),
                                perCallRate: String(org.perCallRate || '0.30'),
                                perMinuteRate: String(org.perMinuteRate || '0.30'),
                                monthlyCredits: String(org.monthlyCredits || 0),
                                maxAgents: String(orgDetails?.maxAgents || 5),
                                maxUsers: String(orgDetails?.maxUsers || 10),
                                customRateEnabled: orgDetails?.customRateEnabled || false,
                                userCount: org.userCount,
                                totalCalls: org.totalCalls,
                                usedCredits: org.usedCredits || 0,
                                estimatedCost: org.estimatedCost,
                              });
                            }}
                            data-testid={`button-edit-billing-${org.id}`}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Billing Packages</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="p-4 border-2 border-blue-500/20">
                <div className="space-y-2">
                  <h3 className="font-semibold text-base">Starter</h3>
                  <p className="text-xl font-bold">$0/mo</p>
                  <ul className="space-y-1 text-xs">
                    <li className="truncate">• $0.30 per call</li>
                    <li className="truncate">• $0.30 per minute</li>
                    <li className="truncate">• 5 agents max</li>
                    <li className="truncate">• 10 users max</li>
                  </ul>
                </div>
              </Card>
              <Card className="p-4 border-2 border-purple-500/20">
                <div className="space-y-2">
                  <h3 className="font-semibold text-base">Professional</h3>
                  <p className="text-xl font-bold">$99/mo</p>
                  <ul className="space-y-1 text-xs">
                    <li className="truncate">• $0.25 per call</li>
                    <li className="truncate">• $0.25 per minute</li>
                    <li className="truncate">• 20 agents max</li>
                    <li className="truncate">• 50 users max</li>
                    <li className="truncate">• 500 monthly credits</li>
                  </ul>
                </div>
              </Card>
              <Card className="p-4 border-2 border-amber-500/20">
                <div className="space-y-2">
                  <h3 className="font-semibold text-base">Enterprise</h3>
                  <p className="text-xl font-bold">Custom</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Custom rates</li>
                    <li>• Unlimited agents</li>
                    <li>• Unlimited users</li>
                    <li>• Custom credits</li>
                    <li>• Priority support</li>
                  </ul>
                </div>
              </Card>
            </div>
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-4">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Organization Overview</h2>
              <Badge variant="secondary">{organizations.length} organizations</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Platform Statistics
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 rounded hover:bg-muted/50">
                    <span className="text-muted-foreground">Active Users</span>
                    <span className="font-medium">{billingData?.totalUsers || 0}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded hover:bg-muted/50">
                    <span className="text-muted-foreground">Active Organizations</span>
                    <span className="font-medium">{billingData?.totalOrganizations || 0}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded hover:bg-muted/50">
                    <span className="text-muted-foreground">Total API Calls</span>
                    <span className="font-medium">{billingData?.totalCalls || 0}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded hover:bg-muted/50">
                    <span className="text-muted-foreground">Platform Revenue</span>
                    <span className="font-medium text-green-500">${billingData?.totalRevenue?.toFixed(2) || "0.00"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Top Organizations by Revenue
                </h3>
                <div className="space-y-2">
                  {billingData?.organizationsData
                    .sort((a, b) => b.estimatedCost - a.estimatedCost)
                    .slice(0, 5)
                    .map((org) => (
                      <div key={org.id} className="flex justify-between p-2 rounded hover:bg-muted/50">
                        <span className="text-muted-foreground truncate max-w-[200px]">{org.name}</span>
                        <span className="font-medium">${org.estimatedCost.toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog open={creatingUser} onOpenChange={setCreatingUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to the platform</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name</Label>
                <Input
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  placeholder="John"
                  data-testid="input-new-user-firstname"
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  placeholder="Doe"
                  data-testid="input-new-user-lastname"
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="john.doe@example.com"
                data-testid="input-new-user-email"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="••••••••"
                data-testid="input-new-user-password"
              />
            </div>
            <div>
              <Label>Company Name (Optional)</Label>
              <Input
                value={newUser.companyName}
                onChange={(e) => setNewUser({ ...newUser, companyName: e.target.value })}
                placeholder="Acme Corp (optional)"
                data-testid="input-new-user-company"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="newUserAdmin"
                checked={newUser.isAdmin}
                onCheckedChange={(checked) => setNewUser({ ...newUser, isAdmin: checked })}
                data-testid="switch-new-user-admin"
              />
              <Label htmlFor="newUserAdmin">Grant Admin Access</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingUser(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createUserMutation.mutate(newUser)}
              disabled={createUserMutation.isPending || !newUser.email || !newUser.password}
              data-testid="button-create-user"
            >
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>First Name</Label>
              <Input
                value={editingUser?.firstName || ""}
                onChange={(e) => setEditingUser(editingUser ? { ...editingUser, firstName: e.target.value } : null)}
                data-testid="input-user-firstname"
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input
                value={editingUser?.lastName || ""}
                onChange={(e) => setEditingUser(editingUser ? { ...editingUser, lastName: e.target.value } : null)}
                data-testid="input-user-lastname"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="editUserAdmin"
                checked={editingUser?.isAdmin || false}
                onCheckedChange={(checked) => setEditingUser(editingUser ? { ...editingUser, isAdmin: checked } : null)}
                data-testid="switch-user-admin"
              />
              <Label htmlFor="editUserAdmin">Admin Access</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingUser) {
                  updateUserMutation.mutate({
                    id: editingUser.id,
                    updates: {
                      firstName: editingUser.firstName,
                      lastName: editingUser.lastName,
                      isAdmin: editingUser.isAdmin,
                    },
                  });
                }
              }}
              disabled={updateUserMutation.isPending}
              data-testid="button-save-user"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Billing Dialog */}
      <Dialog open={!!editingOrg} onOpenChange={() => setEditingOrg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Organization Billing Settings</DialogTitle>
            <DialogDescription>Manage billing configuration for {editingOrg?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Organization Name</Label>
                <Input
                  value={editingOrg?.name || ""}
                  onChange={(e) => setEditingOrg(editingOrg ? { ...editingOrg, name: e.target.value } : null)}
                  data-testid="input-org-name"
                />
              </div>
              <div>
                <Label>Billing Package</Label>
                <Select
                  value={editingOrg?.billingPackage || "starter"}
                  onValueChange={(value) => setEditingOrg(editingOrg ? { ...editingOrg, billingPackage: value } : null)}
                >
                  <SelectTrigger data-testid="select-org-package">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Per Call Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingOrg?.perCallRate || "0.30"}
                  onChange={(e) => setEditingOrg(editingOrg ? { ...editingOrg, perCallRate: e.target.value } : null)}
                  data-testid="input-org-per-call-rate"
                />
              </div>
              <div>
                <Label>Per Minute Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingOrg?.perMinuteRate || "0.30"}
                  onChange={(e) => setEditingOrg(editingOrg ? { ...editingOrg, perMinuteRate: e.target.value } : null)}
                  data-testid="input-org-per-minute-rate"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Monthly Credits</Label>
                <Input
                  type="number"
                  value={editingOrg?.monthlyCredits || "0"}
                  onChange={(e) => setEditingOrg(editingOrg ? { ...editingOrg, monthlyCredits: e.target.value } : null)}
                  data-testid="input-org-monthly-credits"
                />
              </div>
              <div>
                <Label>Max Agents</Label>
                <Input
                  type="number"
                  value={editingOrg?.maxAgents || "5"}
                  onChange={(e) => setEditingOrg(editingOrg ? { ...editingOrg, maxAgents: e.target.value } : null)}
                  data-testid="input-org-max-agents"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Max Users</Label>
                <Input
                  type="number"
                  value={editingOrg?.maxUsers || "10"}
                  onChange={(e) => setEditingOrg(editingOrg ? { ...editingOrg, maxUsers: e.target.value } : null)}
                  data-testid="input-org-max-users"
                />
              </div>
              <div>
                <Label>Custom Rate</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Switch
                    id="customRate"
                    checked={editingOrg?.customRateEnabled || false}
                    onCheckedChange={(checked) => setEditingOrg(editingOrg ? { ...editingOrg, customRateEnabled: checked } : null)}
                    data-testid="switch-org-custom-rate"
                  />
                  <Label htmlFor="customRate">Enable custom rates</Label>
                </div>
              </div>
            </div>
            
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm"><strong>Organization ID:</strong> {editingOrg?.id}</p>
              <p className="text-sm"><strong>Current Users:</strong> {editingOrg?.userCount || 0}</p>
              <p className="text-sm"><strong>Total Calls:</strong> {editingOrg?.totalCalls || 0}</p>
              <p className="text-sm"><strong>Used Credits:</strong> {editingOrg?.usedCredits || 0}</p>
              <p className="text-sm"><strong>Revenue Generated:</strong> ${editingOrg?.estimatedCost?.toFixed(2) || "0.00"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingOrg) {
                  updateOrgMutation.mutate({
                    id: editingOrg.id,
                    updates: {
                      name: editingOrg.name,
                      billingPackage: editingOrg.billingPackage as "starter" | "professional" | "enterprise" | "custom",
                      perCallRate: String(parseFloat(editingOrg.perCallRate)),
                      perMinuteRate: String(parseFloat(editingOrg.perMinuteRate)),
                      monthlyCredits: parseInt(editingOrg.monthlyCredits),
                      maxAgents: parseInt(editingOrg.maxAgents),
                      maxUsers: parseInt(editingOrg.maxUsers),
                      customRateEnabled: editingOrg.customRateEnabled,
                    },
                  });
                }
              }}
              disabled={updateOrgMutation.isPending}
              data-testid="button-save-org"
            >
              Save Billing Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingUser?.firstName} {deletingUser?.lastName} ({deletingUser?.email})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteUserMutation.mutate(deletingUser.id)}
              className="bg-red-500 hover:bg-red-600"
              data-testid="button-confirm-delete-user"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}