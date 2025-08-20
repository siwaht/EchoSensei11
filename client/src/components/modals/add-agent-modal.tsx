import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Upload } from "lucide-react";

const importAgentSchema = z.object({
  elevenLabsAgentId: z.string().min(1, "ElevenLabs Agent ID is required"),
  name: z.string().optional(),
});

const createAgentSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  firstMessage: z.string().min(1, "First message is required"),
  systemPrompt: z.string().min(1, "System prompt is required"),
  language: z.string().default("en"),
  voiceId: z.string().optional(),
});

type ImportAgentForm = z.infer<typeof importAgentSchema>;
type CreateAgentForm = z.infer<typeof createAgentSchema>;

interface AddAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAgentModal({ open, onOpenChange }: AddAgentModalProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validatedData, setValidatedData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("import");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importForm = useForm<ImportAgentForm>({
    resolver: zodResolver(importAgentSchema),
    defaultValues: {
      elevenLabsAgentId: "",
      name: "",
    },
  });

  const createForm = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      firstMessage: "Hello! How can I assist you today?",
      systemPrompt: "You are a helpful AI assistant.",
      language: "en",
      voiceId: "",
    },
  });

  const validateAgentMutation = useMutation({
    mutationFn: async (data: { elevenLabsAgentId: string }) => {
      setIsValidating(true);
      const response = await apiRequest("POST", "/api/agents/validate", data);
      return response.json();
    },
    onSuccess: (data) => {
      setValidatedData(data.agentData);
      importForm.setValue("name", data.agentData.name || "");
      toast({
        title: "Agent Validated",
        description: "Agent found and validated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Validation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsValidating(false);
    },
  });

  const importAgentMutation = useMutation({
    mutationFn: async (data: ImportAgentForm) => {
      await apiRequest("POST", "/api/agents", {
        elevenLabsAgentId: data.elevenLabsAgentId,
        name: data.name || validatedData?.name || "Unnamed Agent",
        description: validatedData?.description,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent imported successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: async (data: CreateAgentForm) => {
      const response = await apiRequest("POST", "/api/agents/create", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    importForm.reset();
    createForm.reset();
    setValidatedData(null);
    setActiveTab("import");
    onOpenChange(false);
  };

  const onValidate = () => {
    const elevenLabsAgentId = importForm.getValues("elevenLabsAgentId");
    if (!elevenLabsAgentId) {
      toast({
        title: "Error",
        description: "Please enter an ElevenLabs Agent ID",
        variant: "destructive",
      });
      return;
    }
    validateAgentMutation.mutate({ elevenLabsAgentId });
  };

  const onImportSubmit = (data: ImportAgentForm) => {
    if (!validatedData) {
      toast({
        title: "Error",
        description: "Please validate the agent first",
        variant: "destructive",
      });
      return;
    }
    importAgentMutation.mutate(data);
  };

  const onCreateSubmit = (data: CreateAgentForm) => {
    createAgentMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="text-modal-title">Add New Agent</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import Existing
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Create New
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="import" className="space-y-4">
            <Form {...importForm}>
              <form onSubmit={importForm.handleSubmit(onImportSubmit)} className="space-y-4">
                <FormField
                  control={importForm.control}
                  name="elevenLabsAgentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ElevenLabs Agent ID</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input
                            {...field}
                            placeholder="Enter ElevenLabs Agent ID"
                            disabled={isValidating || importAgentMutation.isPending}
                            data-testid="input-agent-id"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onValidate}
                            disabled={isValidating || !field.value}
                            data-testid="button-validate-agent"
                          >
                            {isValidating ? "Validating..." : "Validate"}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        You can find this in your ElevenLabs dashboard
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {validatedData && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200" data-testid="text-validation-success">
                      ✓ Agent validated successfully
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-300" data-testid="text-validated-agent-name">
                      Name: {validatedData.name}
                    </p>
                    {validatedData.description && (
                      <p className="text-sm text-green-600 dark:text-green-300" data-testid="text-validated-agent-description">
                        Description: {validatedData.description}
                      </p>
                    )}
                  </div>
                )}

                <FormField
                  control={importForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter a display name"
                          disabled={isValidating || importAgentMutation.isPending}
                          data-testid="input-display-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            
                <div className="flex space-x-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isValidating || importAgentMutation.isPending || !validatedData}
                    data-testid="button-import-agent"
                  >
                    {importAgentMutation.isPending ? "Importing..." : "Import Agent"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleClose}
                    disabled={isValidating || importAgentMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="create" className="space-y-4">
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter agent name"
                          disabled={createAgentMutation.isPending}
                          data-testid="input-create-name"
                        />
                      </FormControl>
                      <FormDescription>
                        Give your agent a descriptive name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="firstMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Message</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Hello! How can I assist you today?"
                          disabled={createAgentMutation.isPending}
                          data-testid="input-first-message"
                        />
                      </FormControl>
                      <FormDescription>
                        The greeting message your agent will use
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="systemPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Prompt</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="You are a helpful AI assistant..."
                          disabled={createAgentMutation.isPending}
                          data-testid="input-system-prompt"
                          rows={4}
                        />
                      </FormControl>
                      <FormDescription>
                        Define your agent's personality and behavior
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="it">Italian</SelectItem>
                          <SelectItem value="pt">Portuguese</SelectItem>
                          <SelectItem value="nl">Dutch</SelectItem>
                          <SelectItem value="pl">Polish</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                          <SelectItem value="ko">Korean</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Primary language for the agent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex space-x-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createAgentMutation.isPending}
                    data-testid="button-create-agent"
                  >
                    {createAgentMutation.isPending ? "Creating..." : "Create Agent"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleClose}
                    disabled={createAgentMutation.isPending}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
