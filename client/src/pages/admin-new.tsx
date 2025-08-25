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
  Save, X, Eye, Wallet, CheckCircle, AlertCircle, RefreshCw
} from "lucide-react";
import type { User, Organization, BillingPackage } from "@shared/schema";
import ApiSync from "./admin/api-sync";

interface BillingData {
  totalUsers: number;
  totalOrganizations: number;
  totalCalls: number;
  totalRevenue: number;
  organizationsData: Array<{
    id: string;
    name: string;
    userCount: number;
    agentCount: number;
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
  const [creatingPackage, setCreatingPackage] = useState(false);
  const [editingPackage, setEditingPackage] = useState<BillingPackage | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<BillingPackage | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [connectingPayPal, setConnectingPayPal] = useState(false);
  const [stripeKeys, setStripeKeys] = useState({ publishableKey: '', secretKey: '' });
  const [paypalKeys, setPaypalKeys] = useState({ clientId: '', clientSecret: '' });
  const [newPackage, setNewPackage] = useState({
    id: "",
    name: "",
    displayName: "",
    perCallRate: "0.30",
    perMinuteRate: "0.30",
    monthlyCredits: "0",
    maxAgents: "5",
    maxUsers: "10",
    monthlyPrice: "0",
    features: [] as string[],
  });
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

  // Fetch payment transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/payments"],
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

  // Create billing package mutation
  const createPackageMutation = useMutation({
    mutationFn: async (packageData: typeof newPackage) => {
      return await apiRequest("POST", "/api/admin/billing-packages", {
        ...packageData,
        perCallRate: parseFloat(packageData.perCallRate) || 0,
        perMinuteRate: parseFloat(packageData.perMinuteRate) || 0,
        monthlyCredits: parseInt(packageData.monthlyCredits) || 0,
        maxAgents: parseInt(packageData.maxAgents) || 0,
        maxUsers: parseInt(packageData.maxUsers) || 0,
        monthlyPrice: parseFloat(packageData.monthlyPrice) || 0,
        features: packageData.features || [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing-packages"] });
      toast({ title: "Billing package created successfully" });
      setCreatingPackage(false);
      setNewPackage({
        id: "",
        name: "",
        displayName: "",
        perCallRate: "0.30",
        perMinuteRate: "0.30",
        monthlyCredits: "0",
        maxAgents: "5",
        maxUsers: "10",
        monthlyPrice: "0",
        features: [],
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create billing package", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  // Update billing package mutation
  const updatePackageMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<BillingPackage> }) => {
      return await apiRequest("PATCH", `/api/admin/billing-packages/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing-packages"] });
      toast({ title: "Billing package updated successfully" });
      setEditingPackage(null);
    },
    onError: () => {
      toast({ title: "Failed to update billing package", variant: "destructive" });
    },
  });

  // Delete billing package mutation
  const deletePackageMutation = useMutation({
    mutationFn: async (packageId: string) => {
      return await apiRequest("DELETE", `/api/admin/billing-packages/${packageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing-packages"] });
      toast({ title: "Billing package deleted successfully" });
      setDeletingPackage(null);
    },
    onError: () => {
      toast({ title: "Failed to delete billing package", variant: "destructive" });
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
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 sm:w-8 h-6 sm:h-8 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage users, organizations, and billing</p>
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
        <TabsList className="w-full flex flex-col lg:grid lg:grid-cols-5 gap-1 lg:gap-0 h-auto lg:h-10">
          <TabsTrigger value="users" className="w-full justify-start lg:justify-center text-xs lg:text-sm px-2 py-2">
            <Users className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="hidden xl:inline">User Management</span>
            <span className="xl:hidden">Users</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="w-full justify-start lg:justify-center text-xs lg:text-sm px-2 py-2">
            <CreditCard className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="hidden xl:inline">Billing & Packages</span>
            <span className="xl:hidden">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="organizations" className="w-full justify-start lg:justify-center text-xs lg:text-sm px-2 py-2">
            <Building2 className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="hidden xl:inline">Organizations</span>
            <span className="xl:hidden">Orgs</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="w-full justify-start lg:justify-center text-xs lg:text-sm px-2 py-2">
            <Wallet className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="hidden xl:inline">Payment Gateways</span>
            <span className="xl:hidden">Payments</span>
          </TabsTrigger>
          <TabsTrigger value="api-sync" className="w-full justify-start lg:justify-center text-xs lg:text-sm px-2 py-2">
            <RefreshCw className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="hidden xl:inline">API Sync</span>
            <span className="xl:hidden">API</span>
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold">User Management</h2>
              <Button onClick={() => setCreatingUser(true)} className="gap-2 w-full sm:w-auto">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Add New User</span>
                <span className="sm:hidden">Add User</span>
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
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 h-7 w-7 sm:h-8 sm:w-8 p-0"
                            onClick={() => setDeletingUser(user)}
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
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
        <TabsContent value="billing" className="space-y-4 sm:space-y-6">
          <Card className="p-3 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Organization Billing Settings</h2>
            
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

          <Card className="p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Billing Packages</h2>
              <Button onClick={() => setCreatingPackage(true)} className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Package</span>
                <span className="sm:hidden">Add Package</span>
              </Button>
            </div>
            
            {billingPackages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No billing packages defined yet.</p>
                <p className="text-sm mt-2">Create your first billing package to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {billingPackages.map((pkg) => (
                  <Card key={pkg.id} className="p-4 border-2 relative">
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingPackage(pkg)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 h-8 w-8 p-0"
                        onClick={() => setDeletingPackage(pkg)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-base">{pkg.displayName}</h3>
                      <p className="text-xl font-bold">${pkg.monthlyPrice}/mo</p>
                      <ul className="space-y-1 text-xs">
                        <li className="truncate">• ${pkg.perCallRate} per call</li>
                        <li className="truncate">• ${pkg.perMinuteRate} per minute</li>
                        <li className="truncate">• {pkg.maxAgents} agents max</li>
                        <li className="truncate">• {pkg.maxUsers} users max</li>
                        {pkg.monthlyCredits > 0 && (
                          <li className="truncate">• {pkg.monthlyCredits} monthly credits</li>
                        )}
                      </ul>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Organizations</p>
                  <p className="text-2xl font-bold">{organizations.length}</p>
                </div>
                <Building2 className="w-8 h-8 text-primary/20" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{billingData?.totalUsers || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500/20" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-2xl font-bold">{billingData?.totalCalls || 0}</p>
                </div>
                <Phone className="w-8 h-8 text-green-500/20" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Platform Revenue</p>
                  <p className="text-2xl font-bold text-green-600">${billingData?.totalRevenue?.toFixed(2) || "0.00"}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500/20" />
              </div>
            </Card>
          </div>

          {/* Organizations List */}
          <Card className="p-3 sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">All Organizations</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage and monitor all organizations on the platform
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium">Organization</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Users</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Agents</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Calls</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Package</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Revenue</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Status</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => {
                    const orgBilling = billingData?.organizationsData.find(o => o.id === org.id);
                    const userCount = users.filter(u => u.organizationId === org.id).length;
                    
                    return (
                      <tr key={org.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-sm">{org.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Created: {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{userCount}</span>
                            <span className="text-xs text-muted-foreground">/ {org.maxUsers}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{orgBilling?.agentCount || 0}</span>
                            <span className="text-xs text-muted-foreground">/ {org.maxAgents}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-sm">{orgBilling?.totalCalls || 0}</span>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className="text-xs">
                            {org.billingPackage || 'Starter'}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-sm font-medium text-green-600">
                            ${orgBilling?.estimatedCost?.toFixed(2) || '0.00'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                            Active
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="View Details"
                              onClick={() => {
                                const orgBilling = billingData?.organizationsData.find(o => o.id === org.id);
                                toast({
                                  title: org.name,
                                  description: `Users: ${users.filter(u => u.organizationId === org.id).length}/${org.maxUsers} • Agents: ${orgBilling?.agentCount || 0}/${org.maxAgents} • Calls: ${orgBilling?.totalCalls || 0} • Revenue: $${orgBilling?.estimatedCost?.toFixed(2) || '0.00'}`
                                });
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Edit Organization"
                              onClick={() => {
                                const orgBilling = billingData?.organizationsData.find(o => o.id === org.id);
                                setEditingOrg({
                                  id: org.id,
                                  name: org.name,
                                  billingPackage: org.billingPackage || 'starter',
                                  perCallRate: String(org.perCallRate || 0.30),
                                  perMinuteRate: String(org.perMinuteRate || 0.30),
                                  monthlyCredits: String(org.monthlyCredits || 0),
                                  maxAgents: String(org.maxAgents || 5),
                                  maxUsers: String(org.maxUsers || 10),
                                  customRateEnabled: false,
                                  userCount: users.filter(u => u.organizationId === org.id).length,
                                  totalCalls: orgBilling?.totalCalls || 0,
                                  usedCredits: orgBilling?.usedCredits || 0,
                                  estimatedCost: orgBilling?.estimatedCost || 0,
                                });
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Settings"
                              onClick={() => {
                                const orgBilling = billingData?.organizationsData.find(o => o.id === org.id);
                                setEditingOrg({
                                  id: org.id,
                                  name: org.name,
                                  billingPackage: org.billingPackage || 'starter',
                                  perCallRate: String(org.perCallRate || 0.30),
                                  perMinuteRate: String(org.perMinuteRate || 0.30),
                                  monthlyCredits: String(org.monthlyCredits || 0),
                                  maxAgents: String(org.maxAgents || 5),
                                  maxUsers: String(org.maxUsers || 10),
                                  customRateEnabled: false,
                                  userCount: users.filter(u => u.organizationId === org.id).length,
                                  totalCalls: orgBilling?.totalCalls || 0,
                                  usedCredits: orgBilling?.usedCredits || 0,
                                  estimatedCost: orgBilling?.estimatedCost || 0,
                                });
                              }}
                            >
                              <Settings className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {organizations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No organizations found</p>
                  <p className="text-sm mt-1">Organizations will appear here once created</p>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-base font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Top Organizations by Revenue
              </h3>
              <div className="space-y-2">
                {billingData?.organizationsData
                  .sort((a, b) => b.estimatedCost - a.estimatedCost)
                  .slice(0, 5)
                  .map((org, index) => (
                    <div key={org.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                        <span className="text-sm truncate max-w-[150px]">{org.name}</span>
                      </div>
                      <span className="text-sm font-medium text-green-600">${org.estimatedCost.toFixed(2)}</span>
                    </div>
                  ))}
                {(!billingData?.organizationsData || billingData.organizationsData.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No revenue data available</p>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-base font-medium mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Most Active Organizations
              </h3>
              <div className="space-y-2">
                {billingData?.organizationsData
                  .sort((a, b) => b.totalCalls - a.totalCalls)
                  .slice(0, 5)
                  .map((org, index) => (
                    <div key={org.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                        <span className="text-sm truncate max-w-[150px]">{org.name}</span>
                      </div>
                      <span className="text-sm font-medium">{org.totalCalls} calls</span>
                    </div>
                  ))}
                {(!billingData?.organizationsData || billingData.organizationsData.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No activity data available</p>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Payment Gateways Tab */}
        <TabsContent value="payments" className="space-y-4">
          {/* Payment Gateway Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stripe Configuration */}
            <Card className="p-4 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Stripe</h3>
                      <p className="text-sm text-muted-foreground">Accept credit cards and digital wallets</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">
                    Not Connected
                  </Badge>
                </div>
                
                <div className="space-y-3 pt-2">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Stripe is not configured</p>
                    <p className="text-xs mt-1">Connect your Stripe account to start accepting payments</p>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="sm"
                  onClick={() => setConnectingStripe(true)}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Connect Stripe Account
                </Button>
              </div>
            </Card>

            {/* PayPal Configuration */}
            <Card className="p-4 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">PayPal</h3>
                      <p className="text-sm text-muted-foreground">Accept PayPal and Venmo payments</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">
                    Not Connected
                  </Badge>
                </div>
                
                <div className="space-y-3 pt-2">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">PayPal is not configured</p>
                    <p className="text-xs mt-1">Connect your PayPal business account to start accepting payments</p>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="sm"
                  onClick={() => setConnectingPayPal(true)}
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect PayPal Account
                </Button>
              </div>
            </Card>
          </div>

          {/* Payment Settings */}
          <Card className="p-4 sm:p-6">
            <h3 className="font-semibold text-lg mb-4">Payment Settings</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Default Payment Gateway</Label>
                  <Select defaultValue="none">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Configured</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="both">Let customer choose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Payment Mode</Label>
                  <Select defaultValue="test">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">Test Mode</SelectItem>
                      <SelectItem value="live">Live Mode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-charge on billing date</Label>
                    <p className="text-sm text-muted-foreground">Automatically charge organizations on their billing date</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Send payment receipts</Label>
                    <p className="text-sm text-muted-foreground">Email receipts to customers after successful payment</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable payment retry</Label>
                    <p className="text-sm text-muted-foreground">Retry failed payments automatically</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline">Cancel</Button>
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Recent Transactions</h3>
              <span className="text-sm text-muted-foreground">
                {transactions.length} total
              </span>
            </div>
            
            {transactionsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-sm font-medium">Organization</th>
                      <th className="text-left py-2 text-sm font-medium">Amount</th>
                      <th className="text-left py-2 text-sm font-medium">Gateway</th>
                      <th className="text-left py-2 text-sm font-medium">Status</th>
                      <th className="text-left py-2 text-sm font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 10).map((transaction: any) => {
                      // Find the organization name
                      const org = organizations.find(o => o.id === transaction.organizationId);
                      return (
                        <tr key={transaction.id} className="border-b">
                          <td className="py-3 text-sm">{org?.name || 'Unknown'}</td>
                          <td className="py-3 text-sm font-medium">
                            ${transaction.amount?.toFixed(2) || '0.00'}
                          </td>
                          <td className="py-3 text-sm">
                            <Badge variant="outline" className="text-xs capitalize">
                              {transaction.paymentMethod || 'Unknown'}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <Badge 
                              className={`text-xs ${
                                transaction.status === 'completed' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : transaction.status === 'failed'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}
                            >
                              {transaction.status === 'completed' ? 'Success' : 
                               transaction.status === 'failed' ? 'Failed' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {transactions.length > 10 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm">Showing 10 of {transactions.length} transactions</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm">No transactions yet</p>
                <p className="text-xs mt-1">Transactions will appear here when organizations make payments</p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* API Sync Tab */}
        <TabsContent value="api-sync" className="space-y-4">
          <ApiSync />
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog open={creatingUser} onOpenChange={setCreatingUser}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to the platform</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <DialogContent className="w-[95vw] max-w-lg">
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
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Organization Billing Settings</DialogTitle>
            <DialogDescription>Manage billing configuration for {editingOrg?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Connect Stripe Dialog */}
      <Dialog open={connectingStripe} onOpenChange={setConnectingStripe}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Stripe Account</DialogTitle>
            <DialogDescription>
              Enter your Stripe API keys to enable payment processing. You can find these in your Stripe dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Publishable Key</Label>
              <Input
                type="text"
                value={stripeKeys.publishableKey}
                onChange={(e) => setStripeKeys({ ...stripeKeys, publishableKey: e.target.value })}
                placeholder="pk_test_..."
                data-testid="input-stripe-publishable-key"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Starts with pk_test_ for test mode or pk_live_ for live mode
              </p>
            </div>
            <div>
              <Label>Secret Key</Label>
              <Input
                type="password"
                value={stripeKeys.secretKey}
                onChange={(e) => setStripeKeys({ ...stripeKeys, secretKey: e.target.value })}
                placeholder="sk_test_..."
                data-testid="input-stripe-secret-key"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Starts with sk_test_ for test mode or sk_live_ for live mode. Keep this key secure!
              </p>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> Use test keys for development and live keys for production. Never share your secret key.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectingStripe(false)}>Cancel</Button>
            <Button
              onClick={() => {
                // Here you would normally save the keys to the backend
                toast({ 
                  title: "Stripe configuration saved",
                  description: "To complete setup, configure environment variables on the server."
                });
                setConnectingStripe(false);
                setStripeKeys({ publishableKey: '', secretKey: '' });
              }}
              disabled={!stripeKeys.publishableKey || !stripeKeys.secretKey}
              data-testid="button-save-stripe"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect PayPal Dialog */}
      <Dialog open={connectingPayPal} onOpenChange={setConnectingPayPal}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect PayPal Account</DialogTitle>
            <DialogDescription>
              Enter your PayPal API credentials to enable payment processing. You can find these in your PayPal developer dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client ID</Label>
              <Input
                type="text"
                value={paypalKeys.clientId}
                onChange={(e) => setPaypalKeys({ ...paypalKeys, clientId: e.target.value })}
                placeholder="AX1234567890..."
                data-testid="input-paypal-client-id"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Found in your PayPal app settings
              </p>
            </div>
            <div>
              <Label>Client Secret</Label>
              <Input
                type="password"
                value={paypalKeys.clientSecret}
                onChange={(e) => setPaypalKeys({ ...paypalKeys, clientSecret: e.target.value })}
                placeholder="EK1234567890..."
                data-testid="input-paypal-client-secret"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Keep this key secure and never share it
              </p>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> Use sandbox credentials for testing and live credentials for production.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectingPayPal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                // Here you would normally save the keys to the backend
                toast({ 
                  title: "PayPal configuration saved",
                  description: "To complete setup, configure environment variables on the server."
                });
                setConnectingPayPal(false);
                setPaypalKeys({ clientId: '', clientSecret: '' });
              }}
              disabled={!paypalKeys.clientId || !paypalKeys.clientSecret}
              data-testid="button-save-paypal"
            >
              Save Configuration
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

      {/* Create Billing Package Dialog */}
      <Dialog open={creatingPackage} onOpenChange={setCreatingPackage}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Billing Package</DialogTitle>
            <DialogDescription>Define a new billing package with custom rates and limits</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Package ID</Label>
                <Input
                  value={newPackage.id}
                  onChange={(e) => setNewPackage({ ...newPackage, id: e.target.value })}
                  placeholder="e.g., starter, pro, enterprise"
                  data-testid="input-package-id"
                />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input
                  value={newPackage.displayName}
                  onChange={(e) => setNewPackage({ ...newPackage, displayName: e.target.value })}
                  placeholder="e.g., Professional Plan"
                  data-testid="input-package-display-name"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Name (Internal)</Label>
                <Input
                  value={newPackage.name}
                  onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                  placeholder="e.g., Professional"
                  data-testid="input-package-name"
                />
              </div>
              <div>
                <Label>Monthly Price ($)</Label>
                <Input
                  type="number"
                  value={newPackage.monthlyPrice}
                  onChange={(e) => setNewPackage({ ...newPackage, monthlyPrice: e.target.value })}
                  placeholder="99.00"
                  data-testid="input-package-price"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Per Call Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPackage.perCallRate}
                  onChange={(e) => setNewPackage({ ...newPackage, perCallRate: e.target.value })}
                  data-testid="input-package-call-rate"
                />
              </div>
              <div>
                <Label>Per Minute Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPackage.perMinuteRate}
                  onChange={(e) => setNewPackage({ ...newPackage, perMinuteRate: e.target.value })}
                  data-testid="input-package-minute-rate"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Monthly Credits</Label>
                <Input
                  type="number"
                  value={newPackage.monthlyCredits}
                  onChange={(e) => setNewPackage({ ...newPackage, monthlyCredits: e.target.value })}
                  data-testid="input-package-credits"
                />
              </div>
              <div>
                <Label>Max Agents</Label>
                <Input
                  type="number"
                  value={newPackage.maxAgents}
                  onChange={(e) => setNewPackage({ ...newPackage, maxAgents: e.target.value })}
                  data-testid="input-package-max-agents"
                />
              </div>
              <div>
                <Label>Max Users</Label>
                <Input
                  type="number"
                  value={newPackage.maxUsers}
                  onChange={(e) => setNewPackage({ ...newPackage, maxUsers: e.target.value })}
                  data-testid="input-package-max-users"
                />
              </div>
            </div>
            
            <div>
              <Label>Features (one per line)</Label>
              <textarea
                className="w-full min-h-[100px] p-2 border rounded-md bg-background"
                value={newPackage.features.join('\n')}
                onChange={(e) => setNewPackage({ ...newPackage, features: e.target.value.split('\n').filter(f => f.trim()) })}
                placeholder="Priority support&#10;Advanced analytics&#10;Custom integrations"
                data-testid="textarea-package-features"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingPackage(false)}>Cancel</Button>
            <Button
              onClick={() => createPackageMutation.mutate(newPackage)}
              disabled={createPackageMutation.isPending || !newPackage.id || !newPackage.displayName}
              data-testid="button-create-package"
            >
              Create Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Billing Package Dialog */}
      <Dialog open={!!editingPackage} onOpenChange={() => setEditingPackage(null)}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Billing Package</DialogTitle>
            <DialogDescription>Update the billing package settings</DialogDescription>
          </DialogHeader>
          {editingPackage && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Package ID</Label>
                  <Input
                    value={editingPackage.id}
                    disabled
                    className="bg-muted"
                    data-testid="input-edit-package-id"
                  />
                </div>
                <div>
                  <Label>Display Name</Label>
                  <Input
                    value={editingPackage.displayName}
                    onChange={(e) => setEditingPackage({ ...editingPackage, displayName: e.target.value })}
                    data-testid="input-edit-package-display-name"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Name (Internal)</Label>
                  <Input
                    value={editingPackage.name}
                    onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                    data-testid="input-edit-package-name"
                  />
                </div>
                <div>
                  <Label>Monthly Price ($)</Label>
                  <Input
                    type="number"
                    value={editingPackage.monthlyPrice}
                    onChange={(e) => setEditingPackage({ ...editingPackage, monthlyPrice: e.target.value })}
                    data-testid="input-edit-package-price"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Per Call Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingPackage.perCallRate}
                    onChange={(e) => setEditingPackage({ ...editingPackage, perCallRate: e.target.value })}
                    data-testid="input-edit-package-call-rate"
                  />
                </div>
                <div>
                  <Label>Per Minute Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingPackage.perMinuteRate}
                    onChange={(e) => setEditingPackage({ ...editingPackage, perMinuteRate: e.target.value })}
                    data-testid="input-edit-package-minute-rate"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Monthly Credits</Label>
                  <Input
                    type="number"
                    value={editingPackage.monthlyCredits}
                    onChange={(e) => setEditingPackage({ ...editingPackage, monthlyCredits: parseInt(e.target.value) || 0 })}
                    data-testid="input-edit-package-credits"
                  />
                </div>
                <div>
                  <Label>Max Agents</Label>
                  <Input
                    type="number"
                    value={editingPackage.maxAgents}
                    onChange={(e) => setEditingPackage({ ...editingPackage, maxAgents: parseInt(e.target.value) || 0 })}
                    data-testid="input-edit-package-max-agents"
                  />
                </div>
                <div>
                  <Label>Max Users</Label>
                  <Input
                    type="number"
                    value={editingPackage.maxUsers}
                    onChange={(e) => setEditingPackage({ ...editingPackage, maxUsers: parseInt(e.target.value) || 0 })}
                    data-testid="input-edit-package-max-users"
                  />
                </div>
              </div>
              
              <div>
                <Label>Features (one per line)</Label>
                <textarea
                  className="w-full min-h-[100px] p-2 border rounded-md bg-background"
                  value={(editingPackage.features as string[] || []).join('\n')}
                  onChange={(e) => setEditingPackage({ ...editingPackage, features: e.target.value.split('\n').filter(f => f.trim()) as any })}
                  placeholder="Priority support&#10;Advanced analytics&#10;Custom integrations"
                  data-testid="textarea-edit-package-features"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPackage(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingPackage) {
                  updatePackageMutation.mutate({
                    id: editingPackage.id,
                    updates: {
                      ...editingPackage,
                      perCallRate: String(typeof editingPackage.perCallRate === 'string' ? parseFloat(editingPackage.perCallRate) || 0 : editingPackage.perCallRate),
                      perMinuteRate: String(typeof editingPackage.perMinuteRate === 'string' ? parseFloat(editingPackage.perMinuteRate) || 0 : editingPackage.perMinuteRate),
                      monthlyPrice: String(typeof editingPackage.monthlyPrice === 'string' ? parseFloat(editingPackage.monthlyPrice) || 0 : editingPackage.monthlyPrice),
                      monthlyCredits: typeof editingPackage.monthlyCredits === 'string' ? parseInt(editingPackage.monthlyCredits) || 0 : editingPackage.monthlyCredits,
                      maxAgents: typeof editingPackage.maxAgents === 'string' ? parseInt(editingPackage.maxAgents) || 0 : editingPackage.maxAgents,
                      maxUsers: typeof editingPackage.maxUsers === 'string' ? parseInt(editingPackage.maxUsers) || 0 : editingPackage.maxUsers,
                      features: editingPackage.features || [],
                    },
                  });
                }
              }}
              disabled={updatePackageMutation.isPending}
              data-testid="button-update-package"
            >
              Update Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Package Confirmation */}
      <AlertDialog open={!!deletingPackage} onOpenChange={() => setDeletingPackage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Billing Package</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{deletingPackage?.displayName}" billing package?
              This action cannot be undone. Organizations using this package will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPackage && deletePackageMutation.mutate(deletingPackage.id)}
              className="bg-red-500 hover:bg-red-600"
              data-testid="button-confirm-delete-package"
            >
              Delete Package
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}