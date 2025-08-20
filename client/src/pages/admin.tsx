import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Users, Building2, DollarSign, Edit, Trash2, Plus, Shield, Phone, Sparkles } from "lucide-react";
import type { User, Organization, BillingPackage } from "@shared/schema";
import AdminQuickActions from "./admin-quick-actions";

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
  }>;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    organizationId: "",
    isAdmin: false,
  });

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Fetch all organizations
  const { data: organizations = [], isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/admin/organizations"],
  });

  // Fetch billing data
  const { data: billingData, isLoading: billingLoading } = useQuery<BillingData>({
    queryKey: ["/api/admin/billing"],
  });

  // Fetch billing packages
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
      toast({ title: "User created successfully" });
      setCreatingUser(false);
      setNewUser({
        email: "",
        firstName: "",
        lastName: "",
        password: "",
        organizationId: "",
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
      toast({ title: "Organization updated successfully" });
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Users className="w-10 h-10 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-3xl font-bold">{billingData?.totalUsers || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Building2 className="w-10 h-10 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Organizations</p>
              <p className="text-3xl font-bold">{billingData?.totalOrganizations || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Phone className="w-10 h-10 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Calls</p>
              <p className="text-3xl font-bold">{billingData?.totalCalls || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <DollarSign className="w-10 h-10 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-3xl font-bold">${billingData?.totalRevenue?.toFixed(2) || "0.00"}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs for different admin sections */}
      <Tabs defaultValue="users" className="w-full mt-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 mb-6">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="billing">Billing & Packages</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="quick-actions" className="flex items-center justify-center">
            <Sparkles className="w-4 h-4 mr-1" />
            Quick Actions
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">User Management</h2>
              <Badge variant="secondary">{users.length} users</Badge>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">User</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Organization</th>
                    <th className="text-left py-3 px-4">Admin</th>
                    <th className="text-left py-3 px-4">Created</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {user.profileImageUrl && (
                            <img src={user.profileImageUrl} alt="" className="w-8 h-8 rounded-full" />
                          )}
                          <span>{user.firstName} {user.lastName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">{user.email}</td>
                      <td className="py-3 px-4">
                        {organizations.find(org => org.id === user.organizationId)?.name || "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        {user.isAdmin ? (
                          <Badge variant="default">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingUser(user)}
                            data-testid={`button-edit-user-${user.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
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
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {users.map((user) => (
                <div key={user.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {user.profileImageUrl && (
                        <img src={user.profileImageUrl} alt="" className="w-10 h-10 rounded-full" />
                      )}
                      <div>
                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    {user.isAdmin ? (
                      <Badge variant="default">Admin</Badge>
                    ) : (
                      <Badge variant="secondary">User</Badge>
                    )}
                  </div>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Organization:</span> {organizations.find(org => org.id === user.organizationId)?.name || "N/A"}</p>
                    <p><span className="text-muted-foreground">Created:</span> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingUser(user)}
                      data-testid={`button-edit-user-mobile-${user.id}`}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeletingUser(user)}
                      data-testid={`button-delete-user-mobile-${user.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-4">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Organization Management</h2>
              <Badge variant="secondary">{organizations.length} organizations</Badge>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Organization</th>
                    <th className="text-left py-3 px-4">Users</th>
                    <th className="text-left py-3 px-4">Total Calls</th>
                    <th className="text-left py-3 px-4">Total Minutes</th>
                    <th className="text-left py-3 px-4">Revenue</th>
                    <th className="text-left py-3 px-4">Created</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {billingData?.organizationsData.map((org) => {
                    const orgDetails = organizations.find(o => o.id === org.id);
                    return (
                      <tr key={org.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{org.name}</td>
                        <td className="py-3 px-4">{org.userCount}</td>
                        <td className="py-3 px-4">{org.totalCalls}</td>
                        <td className="py-3 px-4">{org.totalMinutes}</td>
                        <td className="py-3 px-4">${org.estimatedCost.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          {orgDetails?.createdAt ? new Date(orgDetails.createdAt).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingOrg({ ...orgDetails, ...org })}
                            data-testid={`button-edit-org-${org.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {billingData?.organizationsData.map((org) => {
                const orgDetails = organizations.find(o => o.id === org.id);
                return (
                  <div key={org.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-lg">{org.name}</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingOrg({ ...orgDetails, ...org })}
                        data-testid={`button-edit-org-mobile-${org.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Users</p>
                        <p className="font-medium">{org.userCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Calls</p>
                        <p className="font-medium">{org.totalCalls}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Minutes</p>
                        <p className="font-medium">{org.totalMinutes}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-medium">${org.estimatedCost.toFixed(2)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created: {orgDetails?.createdAt ? new Date(orgDetails.createdAt).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* Billing Overview Tab */}
        <TabsContent value="billing" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Billing Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Platform Statistics
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Users</span>
                    <span className="font-medium">{billingData?.totalUsers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Organizations</span>
                    <span className="font-medium">{billingData?.totalOrganizations || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total API Calls</span>
                    <span className="font-medium">{billingData?.totalCalls || 0}</span>
                  </div>
                  <div className="flex justify-between">
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
                      <div key={org.id} className="flex justify-between">
                        <span className="text-muted-foreground truncate max-w-[200px]">{org.name}</span>
                        <span className="font-medium">${org.estimatedCost.toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Quick Actions Tab */}
        <TabsContent value="quick-actions" className="space-y-4">
          <AdminQuickActions />
        </TabsContent>
      </Tabs>

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
              <input
                type="checkbox"
                id="isAdmin"
                checked={editingUser?.isAdmin || false}
                onChange={(e) => setEditingUser(editingUser ? { ...editingUser, isAdmin: e.target.checked } : null)}
                data-testid="checkbox-user-admin"
              />
              <Label htmlFor="isAdmin">Admin Access</Label>
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

      {/* Edit Organization Dialog */}
      <Dialog open={!!editingOrg} onOpenChange={() => setEditingOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Organization Name</Label>
              <Input
                value={editingOrg?.name || ""}
                onChange={(e) => setEditingOrg(editingOrg ? { ...editingOrg, name: e.target.value } : null)}
                data-testid="input-org-name"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Organization ID: {editingOrg?.id}</p>
              <p className="text-sm text-muted-foreground">Users: {editingOrg?.userCount}</p>
              <p className="text-sm text-muted-foreground">Total Calls: {editingOrg?.totalCalls}</p>
              <p className="text-sm text-muted-foreground">Revenue: ${editingOrg?.estimatedCost?.toFixed(2)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingOrg) {
                  updateOrgMutation.mutate({
                    id: editingOrg.id,
                    updates: { name: editingOrg.name },
                  });
                }
              }}
              disabled={updateOrgMutation.isPending}
              data-testid="button-save-org"
            >
              Save Changes
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
              onClick={() => {
                if (deletingUser) {
                  deleteUserMutation.mutate(deletingUser.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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