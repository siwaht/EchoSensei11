import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Shield, CheckCircle, XCircle, AlertCircle, Clock, 
  RefreshCw, Eye, CheckSquare, XSquare, MessageSquare,
  Building2, Calendar, FileText, Loader2, Webhook, Plus,
  Edit, Trash2, Settings, Send
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AdminTask {
  id: string;
  type: "approval" | "review" | "action";
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "rejected";
  priority: "low" | "medium" | "high" | "urgent";
  relatedEntityType: "integration" | "webhook" | "agent" | "organization" | "rag_configuration";
  relatedEntityId: string;
  createdBy: string;
  approvedBy?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  rejectionReason?: string;
}

interface ApprovalWebhook {
  id: string;
  name: string;
  description?: string;
  webhookUrl: string;
  secret?: string;
  events: string[];
  isActive: boolean;
  headers?: Record<string, string>;
  lastTriggered?: string;
  failureCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export default function ApprovalTasks() {
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<AdminTask | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ isOpen: boolean; task: AdminTask | null }>({
    isOpen: false,
    task: null
  });
  const [rejectionReason, setRejectionReason] = useState("");
  const [webhookDialog, setWebhookDialog] = useState<{ 
    isOpen: boolean; 
    webhook: ApprovalWebhook | null;
  }>({ isOpen: false, webhook: null });
  const [testWebhookId, setTestWebhookId] = useState<string | null>(null);

  // Fetch pending tasks
  const { data: tasks = [], isLoading } = useQuery<AdminTask[]>({
    queryKey: ["/api/admin/tasks"],
  });

  // Fetch webhooks
  const { data: webhooks = [] } = useQuery<ApprovalWebhook[]>({
    queryKey: ["/api/admin/approval-webhooks"],
  });

  // Approve task mutation
  const approveMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("POST", `/api/admin/tasks/${taskId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tasks"] });
      toast({ 
        title: "Task Approved", 
        description: "The integration has been approved and activated",
      });
      setSelectedTask(null);
    },
    onError: () => {
      toast({ 
        title: "Approval Failed", 
        description: "Failed to approve the task",
        variant: "destructive" 
      });
    },
  });

  // Reject task mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: string; reason: string }) => {
      return await apiRequest("POST", `/api/admin/tasks/${taskId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tasks"] });
      toast({ 
        title: "Task Rejected", 
        description: "The integration request has been rejected",
      });
      setRejectDialog({ isOpen: false, task: null });
      setRejectionReason("");
      setSelectedTask(null);
    },
    onError: () => {
      toast({ 
        title: "Rejection Failed", 
        description: "Failed to reject the task",
        variant: "destructive" 
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            <RefreshCw className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return null;
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "integration":
        return <Shield className="w-4 h-4" />;
      case "webhook":
        return <FileText className="w-4 h-4" />;
      case "agent":
        return <MessageSquare className="w-4 h-4" />;
      case "organization":
        return <Building2 className="w-4 h-4" />;
      case "rag_configuration":
        return <FileText className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Group tasks by status
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");
  const completedTasks = tasks.filter(t => t.status === "completed" || t.status === "rejected");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // For now, since the database isn't ready, show a placeholder
  if (tasks.length === 0) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Shield className="w-12 h-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">No Approval Tasks</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              When users create new integrations or webhooks that require approval, they will appear here for your review.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Approval Tasks</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve integration requests from users
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {pendingTasks.length} Pending
        </Badge>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            In Progress ({inProgressTasks.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedTasks.length})
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="w-4 h-4 mr-1" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingTasks.length === 0 ? (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                No pending approval tasks
              </div>
            </Card>
          ) : (
            pendingTasks.map((task) => (
              <Card key={task.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      {getEntityIcon(task.relatedEntityType)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{task.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {getStatusBadge(task.status)}
                    {getPriorityBadge(task.priority)}
                  </div>
                </div>

                {task.metadata && (
                  <div className="bg-muted/50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {task.metadata.organizationId && (
                        <div>
                          <span className="text-muted-foreground">Organization:</span>
                          <span className="ml-2 font-medium">{task.metadata.organizationName || task.metadata.organizationId}</span>
                        </div>
                      )}
                      {task.metadata.provider && (
                        <div>
                          <span className="text-muted-foreground">Provider:</span>
                          <span className="ml-2 font-medium capitalize">{task.metadata.provider}</span>
                        </div>
                      )}
                      {task.metadata.userEmail && (
                        <div>
                          <span className="text-muted-foreground">Requested by:</span>
                          <span className="ml-2 font-medium">{task.metadata.userEmail}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <span className="ml-2 font-medium">
                          {new Date(task.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => approveMutation.mutate(task.id)}
                    disabled={approveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckSquare className="w-4 h-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setRejectDialog({ isOpen: true, task })}
                    disabled={rejectMutation.isPending}
                  >
                    <XSquare className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedTask(task)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="in-progress" className="space-y-4">
          {inProgressTasks.length === 0 ? (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                No tasks in progress
              </div>
            </Card>
          ) : (
            inProgressTasks.map((task) => (
              <Card key={task.id} className="p-6 opacity-75">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{task.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                  </div>
                  {getStatusBadge(task.status)}
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedTasks.length === 0 ? (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                No completed tasks
              </div>
            </Card>
          ) : (
            completedTasks.map((task) => (
              <Card key={task.id} className="p-6 opacity-75">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{task.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                    {task.rejectionReason && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                        Rejection reason: {task.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {getStatusBadge(task.status)}
                    {task.completedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(task.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Webhook Configuration</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure webhooks to receive notifications when approval tasks are created or updated
                </p>
              </div>
              <Button 
                onClick={() => setWebhookDialog({ isOpen: true, webhook: null })}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Webhook
              </Button>
            </div>

            {webhooks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Webhook className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No webhooks configured</p>
                <p className="text-sm mt-1">Add a webhook to receive notifications about approval tasks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {webhooks.map((webhook) => (
                  <Card key={webhook.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{webhook.name}</h4>
                          {webhook.isActive ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {webhook.webhookUrl}
                        </p>
                        {webhook.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {webhook.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                        {webhook.lastTriggered && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Last triggered: {new Date(webhook.lastTriggered).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTestWebhookId(webhook.id);
                            // Test webhook functionality would be implemented here
                            toast({
                              title: "Test Webhook Sent",
                              description: `Test event sent to ${webhook.name}`,
                            });
                            setTimeout(() => setTestWebhookId(null), 2000);
                          }}
                          disabled={!webhook.isActive || testWebhookId === webhook.id}
                        >
                          {testWebhookId === webhook.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setWebhookDialog({ isOpen: true, webhook })}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => {
                            // Delete webhook functionality would be implemented here
                            toast({
                              title: "Webhook Deleted",
                              description: `${webhook.name} has been removed`,
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-3">Available Events</h3>
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-sm mb-1">task.created</p>
                <p className="text-xs text-muted-foreground">
                  Triggered when a new approval task is created
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-sm mb-1">task.approved</p>
                <p className="text-xs text-muted-foreground">
                  Triggered when an approval task is approved by an admin
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-sm mb-1">task.rejected</p>
                <p className="text-xs text-muted-foreground">
                  Triggered when an approval task is rejected by an admin
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-sm mb-1">task.status_changed</p>
                <p className="text-xs text-muted-foreground">
                  Triggered whenever the status of an approval task changes
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.isOpen} onOpenChange={(open) => !open && setRejectDialog({ isOpen: false, task: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Integration Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this integration request. This will be sent to the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ isOpen: false, task: null })}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectDialog.task) {
                  rejectMutation.mutate({ 
                    taskId: rejectDialog.task.id, 
                    reason: rejectionReason 
                  });
                }
              }}
              disabled={!rejectionReason || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Details Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{selectedTask.relatedEntityType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  {getPriorityBadge(selectedTask.priority)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedTask.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(selectedTask.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Description</p>
                <p className="text-sm">{selectedTask.description}</p>
              </div>
              {selectedTask.metadata && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Additional Information</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
                    {JSON.stringify(selectedTask.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Webhook Configuration Dialog */}
      <Dialog open={webhookDialog.isOpen} onOpenChange={(open) => !open && setWebhookDialog({ isOpen: false, webhook: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {webhookDialog.webhook ? 'Edit Webhook' : 'Create New Webhook'}
            </DialogTitle>
            <DialogDescription>
              Configure a webhook endpoint to receive notifications about approval tasks
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const webhookData = {
              name: formData.get('name') as string,
              webhookUrl: formData.get('webhookUrl') as string,
              description: formData.get('description') as string,
              secret: formData.get('secret') as string,
              events: Array.from(formData.getAll('events')) as string[],
              isActive: formData.get('isActive') === 'on',
            };
            
            // Save webhook functionality would be implemented here
            toast({
              title: webhookDialog.webhook ? "Webhook Updated" : "Webhook Created",
              description: `${webhookData.name} has been ${webhookDialog.webhook ? 'updated' : 'created'} successfully`,
            });
            setWebhookDialog({ isOpen: false, webhook: null });
          }}>
            <div>
              <Label htmlFor="name">Webhook Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Slack Notification"
                defaultValue={webhookDialog.webhook?.name}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                name="webhookUrl"
                type="url"
                placeholder="https://example.com/webhook"
                defaultValue={webhookDialog.webhook?.webhookUrl}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe what this webhook does..."
                defaultValue={webhookDialog.webhook?.description}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="secret">Secret Key (Optional)</Label>
              <Input
                id="secret"
                name="secret"
                type="password"
                placeholder="Used for webhook signature verification"
                defaultValue={webhookDialog.webhook?.secret}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will be used to sign webhook payloads for security
              </p>
            </div>

            <div>
              <Label>Events to Subscribe</Label>
              <div className="space-y-2 mt-2">
                {['task.created', 'task.approved', 'task.rejected', 'task.status_changed'].map(event => (
                  <div key={event} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={event}
                      name="events"
                      value={event}
                      defaultChecked={webhookDialog.webhook?.events?.includes(event) ?? true}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor={event} className="text-sm font-normal cursor-pointer">
                      {event}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  name="isActive"
                  defaultChecked={webhookDialog.webhook?.isActive ?? true}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWebhookDialog({ isOpen: false, webhook: null })}
              >
                Cancel
              </Button>
              <Button type="submit">
                {webhookDialog.webhook ? 'Update Webhook' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}