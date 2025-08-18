import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Settings as SettingsIcon, User, Bell, Shield, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    firstName: (user as any)?.firstName || "",
    lastName: (user as any)?.lastName || "",
    email: (user as any)?.email || "",
    notifications: true,
    emailAlerts: true,
    webhookNotifications: false,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      await apiRequest("PATCH", "/api/auth/profile", data);
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      firstName: formData.firstName,
      lastName: formData.lastName,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
          Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400" data-testid="text-page-description">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold" data-testid="text-profile-title">Profile Settings</h3>
              <p className="text-sm text-muted-foreground">Update your personal information</p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Enter your first name"
                data-testid="input-first-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Enter your last name"
                data-testid="input-last-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="opacity-50"
                data-testid="input-email"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Card>

        {/* Notification Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold" data-testid="text-notifications-title">Notifications</h3>
              <p className="text-sm text-muted-foreground">Configure your notification preferences</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications about call activity
                </p>
              </div>
              <Switch
                checked={formData.notifications}
                onCheckedChange={(checked) => setFormData({ ...formData, notifications: checked })}
                data-testid="switch-notifications"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Email Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get email notifications for important events
                </p>
              </div>
              <Switch
                checked={formData.emailAlerts}
                onCheckedChange={(checked) => setFormData({ ...formData, emailAlerts: checked })}
                data-testid="switch-email-alerts"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Webhook Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send notifications to external webhook URLs
                </p>
              </div>
              <Switch
                checked={formData.webhookNotifications}
                onCheckedChange={(checked) => setFormData({ ...formData, webhookNotifications: checked })}
                data-testid="switch-webhook-notifications"
              />
            </div>
          </div>
        </Card>

        {/* Security Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold" data-testid="text-security-title">Security</h3>
              <p className="text-sm text-muted-foreground">Manage your account security</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Account ID</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-mono" data-testid="text-account-id">{(user as any)?.id}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Organization</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm" data-testid="text-organization-id">{(user as any)?.organizationId}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="font-medium text-red-600 mb-2">Danger Zone</h4>
              <p className="text-sm text-muted-foreground mb-4">
                These actions cannot be undone. Please be careful.
              </p>
              <Button 
                variant="destructive" 
                size="sm"
                className="flex items-center gap-2"
                data-testid="button-delete-account"
                onClick={() => {
                  toast({
                    title: "Feature Coming Soon",
                    description: "Account deletion will be available in a future update",
                  });
                }}
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}