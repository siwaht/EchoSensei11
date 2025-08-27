import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckCircle, XCircle, AlertCircle, Eye, EyeOff, Copy, ExternalLink, HelpCircle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const apiKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

type ApiKeyForm = z.infer<typeof apiKeySchema>;

export default function Integrations() {
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: integration, isLoading } = useQuery({
    queryKey: ["/api/integrations"],
  });

  const form = useForm<ApiKeyForm>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      apiKey: "",
    },
  });

  const saveApiKeyMutation = useMutation({
    mutationFn: async (data: ApiKeyForm) => {
      await apiRequest("POST", "/api/integrations", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "API key saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/integrations/test");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Connection test successful",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
  });

  const onSubmit = (data: ApiKeyForm) => {
    saveApiKeyMutation.mutate(data);
  };

  const copyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/webhooks/voiceai`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  const getStatusBadge = () => {
    if (!integration) return null;
    
    switch ((integration as any)?.status) {
      case "ACTIVE":
        return (
          <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" data-testid="badge-status-active">
            <CheckCircle className="w-4 h-4 mr-2" />
            Connected
          </Badge>
        );
      case "ERROR":
        return (
          <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" data-testid="badge-status-disconnected">
            <XCircle className="w-4 h-4 mr-2" />
            Disconnected
          </Badge>
        );
      case "PENDING_APPROVAL":
        return (
          <Badge className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200" data-testid="badge-status-pending">
            <AlertCircle className="w-4 h-4 mr-2" />
            Pending Approval
          </Badge>
        );
      case "INACTIVE":
        return (
          <Badge className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200" data-testid="badge-status-inactive">
            <AlertCircle className="w-4 h-4 mr-2" />
            Not Connected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200" data-testid="badge-status-not-configured">
            <AlertCircle className="w-4 h-4 mr-2" />
            Not Configured
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-page-title">
          API Configuration
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400" data-testid="text-page-description">
          Connect your ElevenLabs account to manage voice agents
        </p>
      </div>
      
      {/* Pending Approval Alert */}
      {(integration as any)?.status === "PENDING_APPROVAL" && (
        <Card className="p-4 sm:p-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Integration Pending Approval
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Your ElevenLabs integration has been submitted and is waiting for administrator approval.
          </p>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Once approved by the administrator, you will be able to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Create and manage voice AI agents</li>
              <li>Access voice call recordings and transcripts</li>
              <li>Configure webhook tools and integrations</li>
              <li>Monitor agent performance and analytics</li>
            </ul>
            <p className="text-xs italic mt-3">
              You will be notified once the administrator has reviewed your integration request.
            </p>
          </div>
        </Card>
      )}

      {/* Disconnection Alert - Show when connection is lost */}
      {(integration as any)?.status === "ERROR" && (
        <Card className="p-4 sm:p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            Connection Lost - Reconnection Required
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Your connection to ElevenLabs has been lost. This could be due to:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-4">
            <li>Invalid or expired API key</li>
            <li>API key permissions changed</li>
            <li>Network connectivity issues</li>
            <li>ElevenLabs service interruption</li>
          </ul>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending}
              data-testid="button-reconnect"
            >
              {testConnectionMutation.isPending ? "Reconnecting..." : "Reconnect Now"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => form.setFocus("apiKey")}
              data-testid="button-update-key"
            >
              Update API Key
            </Button>
          </div>
        </Card>
      )}

      {/* Step-by-step Guide - Show guide when not configured or inactive */}
      {(!(integration as any)?.status || ((integration as any)?.status !== "ACTIVE" && (integration as any)?.status !== "ERROR" && (integration as any)?.status !== "PENDING_APPROVAL")) ? (
        <Card className="p-4 sm:p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Quick Setup Guide
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">1</div>
              <div className="flex-1">
                <p className="text-sm font-medium">Get your ElevenLabs API Key</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sign up at ElevenLabs and find your API key in Profile Settings
                </p>
                <a 
                  href="https://elevenlabs.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 mt-1"
                >
                  Go to ElevenLabs <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">2</div>
              <div className="flex-1">
                <p className="text-sm font-medium">Enter your API key below</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paste your API key in the form and click "Update API Key"
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">3</div>
              <div className="flex-1">
                <p className="text-sm font-medium">Test the connection</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click "Test Connection" to verify your API key works
                </p>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Integration Status */}
      <Card className="p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-base sm:text-lg font-semibold" data-testid="text-connection-status-title">Connection Status</h3>
          {getStatusBadge()}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">API Key Status:</p>
            <p className="font-medium" data-testid="text-api-key-status">
              {(integration as any)?.status === "ACTIVE" ? "Active" : 
               (integration as any)?.status === "ERROR" ? "Disconnected - Reconnect Required" : 
               (integration as any)?.status === "PENDING_APPROVAL" ? "Awaiting Admin Approval" :
               (integration as any)?.status === "INACTIVE" ? "Inactive" : "Not Configured"}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Last Tested:</p>
            <p className="font-medium" data-testid="text-last-tested">
              {(integration as any)?.lastTested 
                ? new Date((integration as any).lastTested).toLocaleString()
                : "Never"
              }
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Connected Since:</p>
            <p className="font-medium" data-testid="text-connected-since">
              {(integration as any)?.status === "ACTIVE" && (integration as any)?.createdAt 
                ? new Date((integration as any).createdAt).toLocaleDateString()
                : (integration as any)?.status === "ERROR" ? "Disconnected" 
                : (integration as any)?.status === "PENDING_APPROVAL" ? "Pending Approval"
                : "Not connected"
              }
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Webhook Status:</p>
            <p className={`font-medium ${(integration as any)?.status === "ACTIVE" ? "text-green-600" : (integration as any)?.status === "ERROR" ? "text-red-600" : (integration as any)?.status === "PENDING_APPROVAL" ? "text-amber-600" : "text-gray-600"}`} data-testid="text-webhook-status">
              {(integration as any)?.status === "ACTIVE" ? "Receiving data" : 
               (integration as any)?.status === "ERROR" ? "Connection lost" : 
               (integration as any)?.status === "PENDING_APPROVAL" ? "Awaiting Approval" : "Not configured"}
            </p>
          </div>
        </div>
      </Card>

      {/* API Key Form */}
      <Card className="p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-base sm:text-lg font-semibold mb-4" data-testid="text-api-key-config-title">API Key Configuration</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    ElevenLabs API Key
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Your API key from ElevenLabs Profile → API Keys</p>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showApiKey ? "text" : "password"}
                        placeholder="xi_abc123..." 
                        data-testid="input-api-key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowApiKey(!showApiKey)}
                        data-testid="button-toggle-api-key-visibility"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Your API key is encrypted with AES-256 and stored securely. We never share or expose your credentials.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                type="submit" 
                disabled={saveApiKeyMutation.isPending}
                className="w-full sm:w-auto"
                data-testid="button-update-api-key"
              >
                {saveApiKeyMutation.isPending ? "Saving..." : "Update API Key"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending || !integration}
                className="w-full sm:w-auto"
                data-testid="button-test-connection"
              >
                {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
              </Button>
            </div>
          </form>
        </Form>
      </Card>

      {/* Webhook Configuration */}
      <Card className="p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-base sm:text-lg font-semibold mb-4" data-testid="text-webhook-config-title">Webhook Configuration</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Webhook URL
            </Label>
            <div className="flex">
              <Input
                value={`${window.location.origin}/api/webhooks/voiceai`}
                readOnly
                className="flex-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                data-testid="input-webhook-url"
              />
              <Button
                variant="outline"
                onClick={copyWebhookUrl}
                className="ml-2"
                data-testid="button-copy-webhook-url"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Add this webhook URL to your voice agent configuration to receive real-time call data.
            </p>
          </div>
        </div>
      </Card>
    </div>
    </TooltipProvider>
  );
}
