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
import { CheckCircle, XCircle, AlertCircle, Eye, EyeOff, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
    const webhookUrl = `${window.location.origin}/api/webhooks/elevenlabs`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  const getStatusBadge = () => {
    if (!integration) return null;
    
    switch (integration.status) {
      case "ACTIVE":
        return (
          <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" data-testid="badge-status-active">
            <CheckCircle className="w-4 h-4 mr-2" />
            Connected
          </Badge>
        );
      case "ERROR":
        return (
          <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" data-testid="badge-status-error">
            <XCircle className="w-4 h-4 mr-2" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200" data-testid="badge-status-inactive">
            <AlertCircle className="w-4 h-4 mr-2" />
            Not Connected
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-page-title">
          ElevenLabs Integration
        </h2>
        <p className="text-gray-600 dark:text-gray-400" data-testid="text-page-description">
          Connect your ElevenLabs account to start monitoring your voice agents
        </p>
      </div>

      {/* Integration Status */}
      <Card className="p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" data-testid="text-connection-status-title">Connection Status</h3>
          {getStatusBadge()}
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">API Key Status:</p>
            <p className="font-medium" data-testid="text-api-key-status">
              {integration?.status === "ACTIVE" ? "Active" : "Inactive"}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Last Tested:</p>
            <p className="font-medium" data-testid="text-last-tested">
              {integration?.lastTested 
                ? new Date(integration.lastTested).toLocaleString()
                : "Never"
              }
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Connected Since:</p>
            <p className="font-medium" data-testid="text-connected-since">
              {integration?.createdAt 
                ? new Date(integration.createdAt).toLocaleDateString()
                : "Not connected"
              }
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Webhook Status:</p>
            <p className="font-medium text-green-600" data-testid="text-webhook-status">
              {integration?.status === "ACTIVE" ? "Receiving data" : "Not configured"}
            </p>
          </div>
        </div>
      </Card>

      {/* API Key Form */}
      <Card className="p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4" data-testid="text-api-key-config-title">API Key Configuration</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ElevenLabs API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showApiKey ? "text" : "password"}
                        placeholder="Enter your ElevenLabs API key"
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
                    Your API key is encrypted and stored securely. We never share or expose your credentials.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex space-x-3">
              <Button 
                type="submit" 
                disabled={saveApiKeyMutation.isPending}
                data-testid="button-update-api-key"
              >
                {saveApiKeyMutation.isPending ? "Saving..." : "Update API Key"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending || !integration}
                data-testid="button-test-connection"
              >
                {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
              </Button>
            </div>
          </form>
        </Form>
      </Card>

      {/* Webhook Configuration */}
      <Card className="p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4" data-testid="text-webhook-config-title">Webhook Configuration</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Webhook URL
            </Label>
            <div className="flex">
              <Input
                value={`${window.location.origin}/api/webhooks/elevenlabs`}
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
              Add this webhook URL to your ElevenLabs account to receive real-time call data.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
