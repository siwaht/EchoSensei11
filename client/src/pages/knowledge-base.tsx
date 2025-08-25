import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  FileText, Upload, Link, Plus, Trash2, Search, 
  Brain, Database, Book, Globe, File, RefreshCw,
  CheckCircle, XCircle, Clock, AlertCircle, Download,
  Save, Info
} from "lucide-react";

interface KnowledgeDocument {
  id: string;
  name: string;
  agentIds: string[];
  chunks: number;
  createdAt: string;
}

export default function KnowledgeBase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [showDocumentDetails, setShowDocumentDetails] = useState(false);
  const { toast } = useToast();

  // Custom RAG Tool state
  const [ragEnabled, setRagEnabled] = useState(true);
  const [ragToolName, setRagToolName] = useState("Custom RAG Tool");
  const [ragToolDescription, setRagToolDescription] = useState("search the RAG system for relevant information");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [topK, setTopK] = useState(5);
  const [maxResponseTokens, setMaxResponseTokens] = useState(2000);
  const [ragTemperature, setRagTemperature] = useState(0.7);
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [ragSystemPrompt, setRagSystemPrompt] = useState(
    "reference the most relevant entries when providing facts about a person's background, preferences, or company information. If the user inquires about a person's location, what they like to eat, or a company's services, cite the related RAG system entry in your answer. Respond concisely, truthfully, and in a helpful manner based on the provided information."
  );

  // Fetch agents
  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch RAG documents
  const { data: documentsData, isLoading, refetch } = useQuery({
    queryKey: ["/api/rag/documents"],
    queryFn: async () => {
      const response = await fetch("/api/rag/documents", {
        credentials: "include",
      });
      
      if (!response.ok) {
        if (response.status === 400) {
          const error = await response.json();
          if (error.message?.includes("API key not configured")) {
            return { documents: [], warning: "Please configure your OpenAI API key for RAG system embeddings" };
          }
        }
        throw new Error("Failed to fetch RAG documents");
      }
      
      const data = await response.json();
      return data;
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const documents = documentsData?.documents || [];
  const apiWarning = documentsData?.warning || documentsData?.error;

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/rag/documents", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document Uploaded",
        description: "The document has been added to the RAG system and indexed.",
      });
      setShowUpload(false);
      resetUploadForm();
      refetch();
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/rag/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete document");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document Deleted",
        description: "The document has been removed from the RAG system.",
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const fetchDocumentDetails = async (documentId: string) => {
    try {
      const response = await fetch(`/api/rag/documents/${documentId}`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedDocument(data);
        setShowDocumentDetails(true);
      }
    } catch (error) {
      console.error('Error fetching document details:', error);
    }
  };

  const handleUpload = async () => {
    if (!uploadName) {
      toast({
        title: "Name Required",
        description: "Please provide a name for the document.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('name', uploadName);
    formData.append('type', uploadType);
    formData.append('agent_ids', JSON.stringify(selectedAgentIds));

    if (uploadType === 'file' && uploadFile) {
      formData.append('file', uploadFile);
    } else if (uploadType === 'url' && uploadUrl) {
      formData.append('url', uploadUrl);
    } else {
      setIsUploading(false);
      toast({
        title: "Invalid Input",
        description: "Please provide a file or URL.",
        variant: "destructive",
      });
      return;
    }

    try {
      await uploadMutation.mutateAsync(formData);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadUrl("");
    setUploadName("");
    setSelectedAgentIds([]);
    setUploadType('file');
  };

  // Save RAG configuration
  const saveRagConfig = async () => {
    const config = {
      name: ragToolName,
      description: ragToolDescription,
      enabled: ragEnabled,
      type: 'rag',
      config: {
        vectorDatabase: 'lancedb',
        openaiApiKey: openaiApiKey,
        topK,
        maxResponseTokens,
        temperature: ragTemperature,
        chunkSize,
        chunkOverlap,
        systemPrompt: ragSystemPrompt,
        embedModel: openaiApiKey ? 'text-embedding-3-small' : 'local',
      },
    };

    try {
      const response = await fetch('/api/tools/rag-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast({
          title: "Configuration Saved",
          description: "RAG configuration has been saved successfully.",
        });
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save RAG configuration.",
        variant: "destructive",
      });
    }
  };

  const filteredDocuments = documents.filter((doc: KnowledgeDocument) =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (apiWarning) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="p-8 max-w-md w-full">
          <div className="flex flex-col items-center text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-yellow-500" />
            <h3 className="text-lg font-semibold">Configuration Required</h3>
            <p className="text-muted-foreground">{apiWarning}</p>
            <Button variant="outline" onClick={() => window.location.href = '/integrations'}>
              Go to Settings
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Custom RAG System</h1>
          <p className="text-muted-foreground mt-1">
            Manage documents and configure your custom Retrieval-Augmented Generation tool
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="configuration">RAG Configuration</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowUpload(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <Database className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Documents</p>
              <p className="text-2xl font-bold">{documents.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Chunks</p>
              <p className="text-2xl font-bold">
                {documents.reduce((sum: number, doc: KnowledgeDocument) => sum + (doc.chunks || 0), 0)}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Storage Type</p>
              <p className="text-xl font-bold">Local Vector DB</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <Book className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Active Agents</p>
              <p className="text-2xl font-bold">{agents.length}</p>
            </div>
          </div>
        </Card>
          </div>

          {/* Search Bar */}
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </Card>

          {/* Documents Grid */}
          {isLoading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <p className="text-muted-foreground">Loading documents...</p>
          </div>
        </Card>
      ) : filteredDocuments.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <Database className="h-16 w-16 text-muted-foreground" />
            <h3 className="text-xl font-semibold">No Documents Found</h3>
            <p className="text-muted-foreground max-w-md">
              {searchTerm 
                ? "No documents match your search criteria."
                : "Your RAG system is empty. Add documents to enhance your agents' capabilities."}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((document: KnowledgeDocument) => (
            <Card 
              key={document.id} 
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => fetchDocumentDetails(document.id)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <p className="font-medium truncate flex-1">{document.name}</p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="truncate">ID: {document.id.slice(-8)}</p>
                  <p>{document.chunks} chunks</p>
                  {document.createdAt && (
                    <p>{formatDate(document.createdAt)}</p>
                  )}
                </div>
                
                {document.agentIds && document.agentIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {document.agentIds.map((agentId) => {
                      const agent = agents.find((a: any) => a.elevenLabsAgentId === agentId);
                      return (
                        <Badge key={agentId} variant="secondary" className="text-xs">
                          {agent?.name || agentId.slice(-6)}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(document.id);
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
        </TabsContent>

        {/* RAG Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          <Card className="p-6">
            <div className="space-y-6">
              {/* RAG Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">RAG Configuration</h2>
                    <p className="text-sm text-muted-foreground">
                      Configure Retrieval-Augmented Generation settings
                    </p>
                  </div>
                </div>
                <Switch
                  checked={ragEnabled}
                  onCheckedChange={setRagEnabled}
                  className="scale-125"
                />
              </div>

              {/* Tool Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tool-name">Tool Name</Label>
                  <Input
                    id="tool-name"
                    value={ragToolName}
                    onChange={(e) => setRagToolName(e.target.value)}
                    placeholder="Custom RAG Tool"
                  />
                </div>
                <div>
                  <Label htmlFor="tool-desc">Description</Label>
                  <Input
                    id="tool-desc"
                    value={ragToolDescription}
                    onChange={(e) => setRagToolDescription(e.target.value)}
                    placeholder="check the RAG system for more information"
                  />
                </div>
              </div>

              {/* Vector Database Configuration */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  <h3 className="font-semibold">Vector Database Configuration</h3>
                </div>
                
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    <strong>Open Source LanceDB (Free)</strong>
                    <br />
                    No external services required - runs locally on your server
                  </AlertDescription>
                </Alert>

                <div>
                  <Label htmlFor="openai-key">
                    OpenAI API Key (Optional - for better embeddings)
                  </Label>
                  <Input
                    id="openai-key"
                    type="password"
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-... (Leave empty to use free local embeddings)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    If provided, OpenAI embeddings will be used for better search accuracy
                  </p>
                </div>
              </div>

              {/* Retrieval Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  <h3 className="font-semibold">Retrieval Settings</h3>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Top K Results</Label>
                      <span className="text-sm text-muted-foreground">{topK}</span>
                    </div>
                    <Slider
                      value={[topK]}
                      onValueChange={(v) => setTopK(v[0])}
                      min={1}
                      max={20}
                      step={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Max Response Tokens</Label>
                      <span className="text-sm text-muted-foreground">{maxResponseTokens}</span>
                    </div>
                    <Slider
                      value={[maxResponseTokens]}
                      onValueChange={(v) => setMaxResponseTokens(v[0])}
                      min={100}
                      max={4000}
                      step={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Temperature</Label>
                      <span className="text-sm text-muted-foreground">{ragTemperature.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[ragTemperature]}
                      onValueChange={(v) => setRagTemperature(v[0])}
                      min={0}
                      max={1}
                      step={0.01}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Chunk Size</Label>
                      <span className="text-sm text-muted-foreground">{chunkSize}</span>
                    </div>
                    <Slider
                      value={[chunkSize]}
                      onValueChange={(v) => setChunkSize(v[0])}
                      min={100}
                      max={2000}
                      step={50}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Chunk Overlap</Label>
                    <span className="text-sm text-muted-foreground">{chunkOverlap}</span>
                  </div>
                  <Slider
                    value={[chunkOverlap]}
                    onValueChange={(v) => setChunkOverlap(v[0])}
                    min={0}
                    max={500}
                    step={10}
                  />
                </div>
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt for RAG</Label>
                <Textarea
                  id="system-prompt"
                  value={ragSystemPrompt}
                  onChange={(e) => setRagSystemPrompt(e.target.value)}
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Instructions for how the agent should use retrieved knowledge
                </p>
              </div>

              {/* Quick Start Guide */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Quick Start Guide</strong>
                  <ol className="mt-2 ml-2 space-y-1 text-sm">
                    <li>1. Upload your documents in the Documents tab</li>
                    <li>2. Documents are automatically processed and indexed</li>
                    <li>3. Optionally add an OpenAI API key for better search accuracy</li>
                    <li>4. Configure retrieval settings for optimal performance</li>
                    <li>5. Your agent can now answer questions using the RAG system</li>
                  </ol>
                </AlertDescription>
              </Alert>

              {/* Save Button for RAG Config */}
              <div className="flex justify-end">
                <Button onClick={saveRagConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  Save RAG Configuration
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Document to RAG System</DialogTitle>
            <DialogDescription>
              Upload files or add URLs to your custom RAG system for semantic search
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">
                <File className="h-4 w-4 mr-2" />
                File Upload
              </TabsTrigger>
              <TabsTrigger value="url">
                <Globe className="h-4 w-4 mr-2" />
                URL Import
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="file" className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Select File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadFile(file);
                      if (!uploadName) {
                        setUploadName(file.name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supported formats: PDF, TXT, DOCX
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="url" className="space-y-4">
              <div>
                <Label htmlFor="url-input">Website URL</Label>
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://example.com/documentation"
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Note: URL content extraction is not yet implemented. Please upload files for now.
                </p>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="doc-name">Document Name</Label>
              <Input
                id="doc-name"
                placeholder="Enter a descriptive name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
              />
            </div>
            
            <div>
              <Label>Associate with Agents (Optional)</Label>
              <div className="space-y-2 mt-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">No agents available</p>
                ) : (
                  agents.map((agent: any) => (
                    <label key={agent.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-muted rounded">
                      <input
                        type="checkbox"
                        checked={selectedAgentIds.includes(agent.elevenLabsAgentId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAgentIds([...selectedAgentIds, agent.elevenLabsAgentId]);
                          } else {
                            setSelectedAgentIds(selectedAgentIds.filter(id => id !== agent.elevenLabsAgentId));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{agent.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUpload(false);
              resetUploadForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={
                isUploading || 
                !uploadName ||
                (uploadType === 'file' && !uploadFile) ||
                (uploadType === 'url' && !uploadUrl)
              }
            >
              {isUploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Add Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Details Dialog */}
      <Dialog open={showDocumentDetails} onOpenChange={setShowDocumentDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
            <DialogDescription>
              View detailed information about this RAG document
            </DialogDescription>
          </DialogHeader>
          
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Document ID</Label>
                  <p className="font-mono text-sm">{selectedDocument.id}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Name</Label>
                  <p className="text-sm">{selectedDocument.name}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Chunks</Label>
                  <p className="text-sm">{selectedDocument.chunks}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Created</Label>
                  <p className="text-sm">{formatDate(selectedDocument.createdAt)}</p>
                </div>
              </div>
              
              {selectedDocument.agentIds && selectedDocument.agentIds.length > 0 && (
                <div>
                  <Label className="text-sm text-muted-foreground">Associated Agents</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedDocument.agentIds.map((agentId) => {
                      const agent = agents.find((a: any) => a.elevenLabsAgentId === agentId);
                      return (
                        <Badge key={agentId} variant="secondary">
                          {agent?.name || agentId}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}