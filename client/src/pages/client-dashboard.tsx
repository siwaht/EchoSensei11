import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Phone, Activity, CreditCard, Clock, TrendingUp, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function ClientDashboard() {
  const { toast } = useToast();
  const [selectedCallLog, setSelectedCallLog] = useState<any>(null);

  // Fetch client info and subscription
  const { data: clientInfo } = useQuery({
    queryKey: ["/api/client/info"],
  });

  // Fetch usage statistics
  const { data: usage } = useQuery({
    queryKey: ["/api/client/usage"],
  });

  // Fetch recent call logs
  const { data: callLogs, isLoading: callLogsLoading } = useQuery({
    queryKey: ["/api/client/call-logs"],
  });

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: ["/api/client/agents"],
  });

  const usagePercentage = usage?.charactersUsed && usage?.characterQuota 
    ? Math.round((usage.charactersUsed / usage.characterQuota) * 100)
    : 0;

  const getCallStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {clientInfo?.businessName}</h1>
        <p className="text-gray-600 mt-2">Monitor your AI voice agent performance and usage</p>
      </div>

      {/* Usage Alert */}
      {usagePercentage > 80 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            You've used {usagePercentage}% of your monthly character quota. 
            Consider upgrading your plan to avoid service interruption.
          </AlertDescription>
        </Alert>
      )}

      {/* Client Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-stat-calls">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-calls-count">
                {usage?.totalCalls || 0}
              </span>
              <Phone className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {usage?.successRate || 0}% success rate
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-minutes">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Minutes Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-minutes">
                {Math.round(usage?.totalMinutes || 0)}
              </span>
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Avg {usage?.avgCallDuration || 0} min/call
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-agents">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" data-testid="text-agents-count">
                {agents?.length || 0}
              </span>
              <Activity className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              AI voice assistants
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-billing">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold" data-testid="text-plan-name">
                {clientInfo?.subscriptionPlan || 'Basic'}
              </span>
              <CreditCard className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ${clientInfo?.subscriptionPrice || 0}/mo
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Overview</CardTitle>
          <CardDescription>Your monthly resource consumption</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Character Usage</span>
              <span className="text-sm text-gray-500" data-testid="text-character-usage">
                {usage?.charactersUsed?.toLocaleString() || 0} / {usage?.characterQuota?.toLocaleString() || 0}
              </span>
            </div>
            <Progress value={usagePercentage} className="h-2" data-testid="progress-usage" />
            <div className="text-xs text-gray-500 mt-1">
              {100 - usagePercentage}% remaining
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-gray-500">Billing Period</p>
              <p className="font-medium" data-testid="text-billing-period">
                {clientInfo?.billingPeriodStart && clientInfo?.billingPeriodEnd
                  ? `${format(new Date(clientInfo.billingPeriodStart), 'MMM dd')} - ${format(new Date(clientInfo.billingPeriodEnd), 'MMM dd')}`
                  : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Next Renewal</p>
              <p className="font-medium" data-testid="text-next-renewal">
                {clientInfo?.nextBillingDate 
                  ? format(new Date(clientInfo.nextBillingDate), 'MMM dd, yyyy')
                  : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Payment Status</p>
              <Badge variant="default" className="mt-1" data-testid="badge-payment-status">
                {clientInfo?.paymentStatus || 'Active'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="calls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calls" data-testid="tab-calls">Call History</TabsTrigger>
          <TabsTrigger value="agents" data-testid="tab-agents">Voice Agents</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">Billing</TabsTrigger>
        </TabsList>

        {/* Call History Tab */}
        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>Recent Calls</CardTitle>
              <CardDescription>View and analyze your voice agent interactions</CardDescription>
            </CardHeader>
            <CardContent>
              {callLogsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callLogs?.map((call: any) => (
                      <TableRow key={call.id} data-testid={`row-call-${call.id}`}>
                        <TableCell data-testid={`text-call-date-${call.id}`}>
                          {format(new Date(call.startTime), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell data-testid={`text-call-agent-${call.id}`}>
                          {call.agentName}
                        </TableCell>
                        <TableCell data-testid={`text-call-contact-${call.id}`}>
                          {call.toPhoneNumber}
                        </TableCell>
                        <TableCell data-testid={`text-call-duration-${call.id}`}>
                          {Math.round(call.duration / 60)} min
                        </TableCell>
                        <TableCell>{getCallStatusBadge(call.status)}</TableCell>
                        <TableCell data-testid={`text-call-cost-${call.id}`}>
                          ${call.cost?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedCallLog(call)}
                            data-testid={`button-view-call-${call.id}`}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice Agents Tab */}
        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>Your Voice Agents</CardTitle>
              <CardDescription>AI assistants handling your customer interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents?.map((agent: any) => (
                  <Card key={agent.id} data-testid={`card-agent-${agent.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{agent.name}</CardTitle>
                          <CardDescription>{agent.description}</CardDescription>
                        </div>
                        <Badge 
                          variant={agent.status === 'active' ? 'default' : 'secondary'}
                          data-testid={`badge-agent-status-${agent.id}`}
                        >
                          {agent.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Calls Today</span>
                          <span className="font-medium" data-testid={`text-agent-calls-${agent.id}`}>
                            {agent.callsToday || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Success Rate</span>
                          <span className="font-medium" data-testid={`text-agent-success-${agent.id}`}>
                            {agent.successRate || 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Avg Duration</span>
                          <span className="font-medium" data-testid={`text-agent-duration-${agent.id}`}>
                            {agent.avgDuration || 0} min
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>Key metrics and trends for your voice agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Call Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-2xl font-bold" data-testid="text-success-rate">
                        {usage?.successRate || 0}%
                      </span>
                    </div>
                    <Progress value={usage?.successRate || 0} className="h-2 mt-3" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Average Call Duration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <span className="text-2xl font-bold" data-testid="text-avg-duration">
                        {usage?.avgCallDuration || 0} min
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Industry avg: 3.5 min</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Cost per Call</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-purple-500" />
                      <span className="text-2xl font-bold" data-testid="text-cost-per-call">
                        ${usage?.avgCostPerCall?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">30% less than traditional</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
              <CardDescription>Manage your subscription and payment details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-6 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-4">Current Subscription</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Plan</p>
                      <p className="font-medium" data-testid="text-current-plan">
                        {clientInfo?.subscriptionPlan || 'Basic'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Monthly Cost</p>
                      <p className="font-medium" data-testid="text-monthly-cost">
                        ${clientInfo?.subscriptionPrice || 0}/mo
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Character Quota</p>
                      <p className="font-medium" data-testid="text-quota">
                        {usage?.characterQuota?.toLocaleString() || 0} chars/mo
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Next Billing Date</p>
                      <p className="font-medium" data-testid="text-next-billing">
                        {clientInfo?.nextBillingDate 
                          ? format(new Date(clientInfo.nextBillingDate), 'MMM dd, yyyy')
                          : 'Not set'}
                      </p>
                    </div>
                  </div>
                </div>

                <Button className="w-full" data-testid="button-upgrade-plan">
                  Upgrade Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}