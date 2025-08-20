import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Edit2, Trash2, Save, X, GripVertical, 
  User, Shield, Webhook, Sheet, Calendar, Database, 
  FileText, Sparkles, Zap, Globe, Brain, Wrench
} from "lucide-react";

interface QuickActionButton {
  id: string;
  name: string;
  prompt: string;
  icon: string;
  color: string;
  category?: string;
  order: number;
  isSystem: boolean;
  isActive: boolean;
  createdBy?: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const iconOptions = [
  { value: "User", label: "User", icon: User },
  { value: "Shield", label: "Shield", icon: Shield },
  { value: "Webhook", label: "Webhook", icon: Webhook },
  { value: "Sheet", label: "Sheet", icon: Sheet },
  { value: "Calendar", label: "Calendar", icon: Calendar },
  { value: "Database", label: "Database", icon: Database },
  { value: "FileText", label: "FileText", icon: FileText },
  { value: "Sparkles", label: "Sparkles", icon: Sparkles },
  { value: "Zap", label: "Zap", icon: Zap },
  { value: "Globe", label: "Globe", icon: Globe },
  { value: "Brain", label: "Brain", icon: Brain },
  { value: "Wrench", label: "Wrench", icon: Wrench },
];

const colorOptions = [
  { value: "bg-blue-500 hover:bg-blue-600", label: "Blue", display: "bg-blue-500" },
  { value: "bg-green-500 hover:bg-green-600", label: "Green", display: "bg-green-500" },
  { value: "bg-red-500 hover:bg-red-600", label: "Red", display: "bg-red-500" },
  { value: "bg-purple-500 hover:bg-purple-600", label: "Purple", display: "bg-purple-500" },
  { value: "bg-yellow-500 hover:bg-yellow-600", label: "Yellow", display: "bg-yellow-500" },
  { value: "bg-pink-500 hover:bg-pink-600", label: "Pink", display: "bg-pink-500" },
  { value: "bg-indigo-500 hover:bg-indigo-600", label: "Indigo", display: "bg-indigo-500" },
  { value: "bg-gray-500 hover:bg-gray-600", label: "Gray", display: "bg-gray-500" },
];

export default function AdminQuickActions() {
  const { toast } = useToast();
  const [editingButton, setEditingButton] = useState<QuickActionButton | null>(null);
  const [newButton, setNewButton] = useState<Partial<QuickActionButton>>({
    name: "",
    prompt: "",
    icon: "Sparkles",
    color: "bg-blue-500 hover:bg-blue-600",
    category: "",
    order: 0,
    isActive: true,
  });
  const [activeTab, setActiveTab] = useState("system");

  // Fetch quick action buttons
  const { data: buttons = [], isLoading } = useQuery<QuickActionButton[]>({
    queryKey: ["/api/admin/quick-action-buttons"],
  });

  // Create button mutation
  const createButtonMutation = useMutation({
    mutationFn: (data: Partial<QuickActionButton>) =>
      apiRequest("/api/admin/quick-action-buttons", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quick-action-buttons"] });
      toast({
        title: "Success",
        description: "Quick action button created successfully",
      });
      setNewButton({
        name: "",
        prompt: "",
        icon: "Sparkles",
        color: "bg-blue-500 hover:bg-blue-600",
        category: "",
        order: 0,
        isActive: true,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create quick action button",
        variant: "destructive",
      });
    },
  });

  // Update button mutation
  const updateButtonMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<QuickActionButton> }) =>
      apiRequest(`/api/admin/quick-action-buttons/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quick-action-buttons"] });
      toast({
        title: "Success",
        description: "Quick action button updated successfully",
      });
      setEditingButton(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update quick action button",
        variant: "destructive",
      });
    },
  });

  // Delete button mutation
  const deleteButtonMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/quick-action-buttons/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quick-action-buttons"] });
      toast({
        title: "Success",
        description: "Quick action button deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete quick action button",
        variant: "destructive",
      });
    },
  });

  const handleCreateButton = () => {
    if (!newButton.name || !newButton.prompt) {
      toast({
        title: "Error",
        description: "Name and prompt are required",
        variant: "destructive",
      });
      return;
    }
    createButtonMutation.mutate(newButton);
  };

  const handleUpdateButton = () => {
    if (!editingButton || !editingButton.name || !editingButton.prompt) {
      toast({
        title: "Error",
        description: "Name and prompt are required",
        variant: "destructive",
      });
      return;
    }
    updateButtonMutation.mutate({
      id: editingButton.id,
      data: editingButton,
    });
  };

  const systemButtons = buttons.filter(b => b.isSystem);
  const userButtons = buttons.filter(b => !b.isSystem);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quick Action Buttons</h1>
        <p className="text-muted-foreground">Manage system and user quick action buttons for agent prompts</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="system">System Buttons</TabsTrigger>
          <TabsTrigger value="user">User Buttons</TabsTrigger>
          <TabsTrigger value="create">Create New</TabsTrigger>
        </TabsList>

        {/* System Buttons Tab */}
        <TabsContent value="system" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">System Quick Action Buttons</h2>
            <div className="space-y-3">
              {systemButtons.map((button) => {
                const IconComponent = iconOptions.find(i => i.value === button.icon)?.icon || Sparkles;
                const isEditing = editingButton?.id === button.id;

                return (
                  <div key={button.id} className="border rounded-lg p-4">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Name</Label>
                            <Input
                              value={editingButton.name}
                              onChange={(e) => setEditingButton({ ...editingButton, name: e.target.value })}
                              placeholder="Button name"
                            />
                          </div>
                          <div>
                            <Label>Category</Label>
                            <Input
                              value={editingButton.category || ""}
                              onChange={(e) => setEditingButton({ ...editingButton, category: e.target.value })}
                              placeholder="Category (optional)"
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Prompt</Label>
                          <Textarea
                            value={editingButton.prompt}
                            onChange={(e) => setEditingButton({ ...editingButton, prompt: e.target.value })}
                            placeholder="Prompt text to insert"
                            className="min-h-[100px]"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Icon</Label>
                            <Select
                              value={editingButton.icon}
                              onValueChange={(value) => setEditingButton({ ...editingButton, icon: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {iconOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                      <option.icon className="w-4 h-4" />
                                      {option.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Color</Label>
                            <Select
                              value={editingButton.color}
                              onValueChange={(value) => setEditingButton({ ...editingButton, color: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {colorOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-4 h-4 rounded ${option.display}`} />
                                      {option.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Order</Label>
                            <Input
                              type="number"
                              value={editingButton.order}
                              onChange={(e) => setEditingButton({ ...editingButton, order: parseInt(e.target.value) })}
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editingButton.isActive}
                              onCheckedChange={(checked) => setEditingButton({ ...editingButton, isActive: checked })}
                            />
                            <Label>Active</Label>
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={handleUpdateButton} size="sm">
                              <Save className="w-4 h-4 mr-2" />
                              Save
                            </Button>
                            <Button onClick={() => setEditingButton(null)} size="sm" variant="outline">
                              <X className="w-4 h-4 mr-2" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <Button
                            size="sm"
                            className={`text-white ${
                              button.color === 'bg-blue-500 hover:bg-blue-600' ? 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700' :
                              button.color === 'bg-green-500 hover:bg-green-600' ? 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700' :
                              button.color === 'bg-red-500 hover:bg-red-600' ? 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700' :
                              button.color === 'bg-purple-500 hover:bg-purple-600' ? 'bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700' :
                              button.color === 'bg-yellow-500 hover:bg-yellow-600' ? 'bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700' :
                              button.color === 'bg-pink-500 hover:bg-pink-600' ? 'bg-pink-500 hover:bg-pink-600 dark:bg-pink-600 dark:hover:bg-pink-700' :
                              button.color === 'bg-indigo-500 hover:bg-indigo-600' ? 'bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700' :
                              'bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700'
                            }`}
                            variant="default"
                          >
                            <IconComponent className="w-4 h-4 mr-2" />
                            {button.name}
                          </Button>
                          <div className="text-sm text-muted-foreground">
                            {button.category && <span className="mr-2">[{button.category}]</span>}
                            <span>{button.isActive ? "Active" : "Inactive"}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => setEditingButton(button)}
                            size="sm"
                            variant="outline"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => deleteButtonMutation.mutate(button.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {systemButtons.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No system buttons created yet
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* User Buttons Tab */}
        <TabsContent value="user" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">User Quick Action Buttons</h2>
            <div className="space-y-3">
              {userButtons.map((button) => {
                const IconComponent = iconOptions.find(i => i.value === button.icon)?.icon || Sparkles;

                return (
                  <div key={button.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          className={`${button.color} text-white`}
                          variant="default"
                        >
                          <IconComponent className="w-4 h-4 mr-2" />
                          {button.name}
                        </Button>
                        <div className="text-sm text-muted-foreground">
                          {button.category && <span className="mr-2">[{button.category}]</span>}
                          <span>{button.isActive ? "Active" : "Inactive"}</span>
                          <span className="ml-2">Org: {button.organizationId}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {userButtons.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No user buttons created yet
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Create New Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Create New System Button</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={newButton.name}
                    onChange={(e) => setNewButton({ ...newButton, name: e.target.value })}
                    placeholder="Button name"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={newButton.category || ""}
                    onChange={(e) => setNewButton({ ...newButton, category: e.target.value })}
                    placeholder="Category (optional)"
                  />
                </div>
              </div>

              <div>
                <Label>Prompt</Label>
                <Textarea
                  value={newButton.prompt}
                  onChange={(e) => setNewButton({ ...newButton, prompt: e.target.value })}
                  placeholder="Prompt text that will be inserted when the button is clicked"
                  className="min-h-[150px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Icon</Label>
                  <Select
                    value={newButton.icon}
                    onValueChange={(value) => setNewButton({ ...newButton, icon: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="w-4 h-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Color</Label>
                  <Select
                    value={newButton.color}
                    onValueChange={(value) => setNewButton({ ...newButton, color: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded ${option.display}`} />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Order</Label>
                  <Input
                    type="number"
                    value={newButton.order}
                    onChange={(e) => setNewButton({ ...newButton, order: parseInt(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={newButton.isActive}
                  onCheckedChange={(checked) => setNewButton({ ...newButton, isActive: checked })}
                />
                <Label>Active</Label>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleCreateButton}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Button
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}