import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const addAgentSchema = z.object({
  elevenLabsAgentId: z.string().min(1, "ElevenLabs Agent ID is required"),
  name: z.string().optional(),
});

type AddAgentForm = z.infer<typeof addAgentSchema>;

interface AddAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAgentModal({ open, onOpenChange }: AddAgentModalProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validatedData, setValidatedData] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddAgentForm>({
    resolver: zodResolver(addAgentSchema),
    defaultValues: {
      elevenLabsAgentId: "",
      name: "",
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
      form.setValue("name", data.agentData.name || "");
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

  const createAgentMutation = useMutation({
    mutationFn: async (data: AddAgentForm) => {
      await apiRequest("POST", "/api/agents", {
        elevenLabsAgentId: data.elevenLabsAgentId,
        name: data.name || validatedData?.name || "Unnamed Agent",
        description: validatedData?.description,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent added successfully",
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
    form.reset();
    setValidatedData(null);
    onOpenChange(false);
  };

  const onValidate = () => {
    const elevenLabsAgentId = form.getValues("elevenLabsAgentId");
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

  const onSubmit = (data: AddAgentForm) => {
    if (!validatedData) {
      toast({
        title: "Error",
        description: "Please validate the agent first",
        variant: "destructive",
      });
      return;
    }
    createAgentMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-modal-title">Add New Agent</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="elevenLabsAgentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ElevenLabs Agent ID</FormLabel>
                  <FormControl>
                    <div className="flex space-x-2">
                      <Input
                        {...field}
                        placeholder="Enter ElevenLabs Agent ID"
                        disabled={isValidating || createAgentMutation.isPending}
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
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter a display name"
                      disabled={isValidating || createAgentMutation.isPending}
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
                disabled={isValidating || createAgentMutation.isPending || !validatedData}
                data-testid="button-add-agent"
              >
                {createAgentMutation.isPending ? "Adding..." : "Add Agent"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isValidating || createAgentMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
