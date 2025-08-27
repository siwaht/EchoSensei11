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
  Building2, Calendar, FileText, Loader2
} from "lucide-react";
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

export default function ApprovalTasks() {
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<AdminTask | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ isOpen: boolean; task: AdminTask | null }>({
    isOpen: false,
    task: null
  });
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch pending tasks
  const { data: tasks = [], isLoading } = useQuery<AdminTask[]>({
    queryKey: ["/api/admin/tasks"],
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
    </div>
  );
}