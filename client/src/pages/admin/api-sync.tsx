import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { 
  RefreshCw, CheckCircle, XCircle, AlertCircle, Clock, 
  Activity, Database, Globe, Phone, Brain, FileText,
  Zap, ArrowRight, Info, ShieldCheck
} from "lucide-react";

interface ApiEndpoint {
  name: string;
  path: string;
  method: string;
  status: 'active' | 'deprecated' | 'updated' | 'unknown';
  lastChecked?: string;
  currentVersion?: string;
  latestVersion?: string;
  description?: string;
}

interface SyncStatus {
  lastSync?: string;
  apiVersion: string;
  endpointsTotal: number;
  endpointsActive: number;
  endpointsDeprecated: number;
  endpointsUpdated: number;
  syncInProgress: boolean;
}

interface SyncLog {
  id: string;
  timestamp: string;
  action: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export default function ApiSync() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const { toast } = useToast();

  // Fetch sync status
  const { data: syncStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<SyncStatus>({
    queryKey: ["/api/admin/sync/status"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch endpoints
  const { data: endpoints = [], isLoading: endpointsLoading, refetch: refetchEndpoints } = useQuery<ApiEndpoint[]>({
    queryKey: ["/api/admin/sync/endpoints"],
  });

  // Fetch sync logs
  const { data: syncLogs = [], refetch: refetchLogs } = useQuery<SyncLog[]>({
    queryKey: ["/api/admin/sync/logs"],
  });

  // Run full sync mutation
  const runSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/sync/run", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to run sync");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sync Started",
        description: "API synchronization has been initiated. This may take a few moments.",
      });
      refetchStatus();
      refetchEndpoints();
      refetchLogs();
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to start synchronization",
        variant: "destructive",
      });
    },
  });

  // Validate endpoint mutation
  const validateEndpointMutation = useMutation({
    mutationFn: async (endpoint: ApiEndpoint) => {
      const response = await fetch("/api/admin/sync/validate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(endpoint),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to validate");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Validation Complete",
        description: `Endpoint ${data.valid ? 'is valid' : 'needs updating'}`,
        variant: data.valid ? "default" : "destructive",
      });
      refetchEndpoints();
    },
    onError: (error: any) => {
      toast({
        title: "Validation Failed",
        description: error.message || "Failed to validate endpoint",
        variant: "destructive",
      });
    },
  });

  // Update endpoint mutation
  const updateEndpointMutation = useMutation({
    mutationFn: async (endpoint: ApiEndpoint) => {
      const response = await fetch("/api/admin/sync/update-endpoint", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(endpoint),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Endpoint Updated",
        description: "The endpoint has been updated successfully",
      });
      refetchEndpoints();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update endpoint",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'deprecated':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'updated':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLogIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getEndpointIcon = (name: string) => {
    if (name.includes('agent')) return <Brain className="h-4 w-4" />;
    if (name.includes('call')) return <Phone className="h-4 w-4" />;
    if (name.includes('knowledge')) return <FileText className="h-4 w-4" />;
    if (name.includes('webhook')) return <Zap className="h-4 w-4" />;
    if (name.includes('audio')) return <Activity className="h-4 w-4" />;
    return <Globe className="h-4 w-4" />;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupedEndpoints = endpoints.reduce((acc, endpoint) => {
    const category = endpoint.name.split('/')[0] || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(endpoint);
    return acc;
  }, {} as Record<string, ApiEndpoint[]>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Synchronization</h1>
          <p className="text-muted-foreground mt-1">
            Keep your integration synchronized with the latest ElevenLabs API
          </p>
        </div>
        <Button
          onClick={() => runSyncMutation.mutate()}
          disabled={syncStatus?.syncInProgress || runSyncMutation.isPending}
          size="lg"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncStatus?.syncInProgress ? 'animate-spin' : ''}`} />
          {syncStatus?.syncInProgress ? 'Syncing...' : 'Run Full Sync'}
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">API Version</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{syncStatus?.apiVersion || 'v1'}</p>
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current version
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Active Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-green-600">
                {syncStatus?.endpointsActive || 0}
              </p>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Working correctly
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Need Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-yellow-600">
                {syncStatus?.endpointsUpdated || 0}
              </p>
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Last Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {formatDate(syncStatus?.lastSync)}
              </p>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last checked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert for updates needed */}
      {syncStatus && (syncStatus.endpointsUpdated > 0 || syncStatus.endpointsDeprecated > 0) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>API Updates Available</AlertTitle>
          <AlertDescription>
            {syncStatus.endpointsUpdated > 0 && (
              <span>{syncStatus.endpointsUpdated} endpoints have updates available. </span>
            )}
            {syncStatus.endpointsDeprecated > 0 && (
              <span>{syncStatus.endpointsDeprecated} endpoints are deprecated. </span>
            )}
            Run a full sync to update your integration.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints">
            <Globe className="mr-2 h-4 w-4" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Activity className="mr-2 h-4 w-4" />
            Sync Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Endpoints</CardTitle>
              <CardDescription>
                Monitor and update individual API endpoints
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {Object.entries(groupedEndpoints).map(([category, categoryEndpoints]) => (
                    <div key={category} className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {categoryEndpoints.map((endpoint) => (
                          <div
                            key={endpoint.path}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedEndpoint(endpoint)}
                          >
                            <div className="flex items-center gap-3">
                              {getEndpointIcon(endpoint.name)}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{endpoint.name}</p>
                                  <Badge variant="outline" className="text-xs">
                                    {endpoint.method}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {endpoint.path}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {endpoint.status === 'updated' && (
                                <Badge variant="secondary" className="text-xs">
                                  Update Available
                                </Badge>
                              )}
                              <div className="flex items-center gap-2">
                                {getStatusIcon(endpoint.status)}
                                <span className="text-xs text-muted-foreground">
                                  {endpoint.status}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  validateEndpointMutation.mutate(endpoint);
                                }}
                              >
                                Validate
                              </Button>
                              {endpoint.status === 'updated' && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateEndpointMutation.mutate(endpoint);
                                  }}
                                >
                                  Update
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Synchronization History</CardTitle>
              <CardDescription>
                View recent sync operations and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {syncLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      {getLogIcon(log.status)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{log.action}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {log.message}
                        </p>
                        {log.details && (
                          <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Endpoint Details Modal */}
      {selectedEndpoint && (
        <Card className="fixed bottom-4 right-4 w-96 shadow-lg z-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Endpoint Details</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedEndpoint(null)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <p className="font-medium">{selectedEndpoint.name}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Path</label>
              <p className="font-mono text-sm">{selectedEndpoint.path}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Method</label>
              <Badge>{selectedEndpoint.method}</Badge>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedEndpoint.status)}
                <span className="text-sm capitalize">{selectedEndpoint.status}</span>
              </div>
            </div>
            {selectedEndpoint.currentVersion && (
              <div>
                <label className="text-xs text-muted-foreground">Current Version</label>
                <p className="text-sm">{selectedEndpoint.currentVersion}</p>
              </div>
            )}
            {selectedEndpoint.latestVersion && (
              <div>
                <label className="text-xs text-muted-foreground">Latest Version</label>
                <p className="text-sm">{selectedEndpoint.latestVersion}</p>
              </div>
            )}
            {selectedEndpoint.description && (
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <p className="text-sm">{selectedEndpoint.description}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => validateEndpointMutation.mutate(selectedEndpoint)}
                className="flex-1"
              >
                Validate
              </Button>
              {selectedEndpoint.status === 'updated' && (
                <Button
                  size="sm"
                  onClick={() => updateEndpointMutation.mutate(selectedEndpoint)}
                  className="flex-1"
                >
                  Update Now
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}