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
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  FileText, Upload, Link, Plus, Trash2, Search, 
  Brain, Database, Book, Globe, File, RefreshCw,
  CheckCircle, XCircle, Clock, AlertCircle, Download
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

  // Fetch agents
  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch knowledge base documents
  const { data: documentsData, isLoading, refetch } = useQuery({
    queryKey: ["/api/convai/knowledge-base"],
    queryFn: async () => {
      const response = await fetch("/api/convai/knowledge-base", {
        credentials: "include",
      });
      
      if (!response.ok) {
        if (response.status === 400) {
          const error = await response.json();
          if (error.message?.includes("API key not configured")) {
            return { documents: [], error: "Please configure your OpenAI API key for knowledge base embeddings" };
          }
        }
        throw new Error("Failed to fetch knowledge base");
      }
      
      return await response.json();
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const documents = documentsData?.documents || [];
  const apiError = documentsData?.error;

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/convai/knowledge-base", {
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
        description: "The document has been added to the local knowledge base and indexed.",
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
      const response = await fetch(`/api/convai/knowledge-base/${documentId}`, {
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
        description: "The document has been removed from the knowledge base.",
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
      const response = await fetch(`/api/convai/knowledge-base/${documentId}`, {
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

  if (apiError) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="p-8 max-w-md w-full">
          <div className="flex flex-col items-center text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-yellow-500" />
            <h3 className="text-lg font-semibold">Configuration Required</h3>
            <p className="text-muted-foreground">{apiError}</p>
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
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">
            Manage your local knowledge base documents for AI agents
          </p>
        </div>
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
                : "Your knowledge base is empty. Add documents to enhance your agents' capabilities."}
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

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Document to Knowledge Base</DialogTitle>
            <DialogDescription>
              Upload files or add URLs to your local knowledge base for semantic search
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
              View detailed information about this knowledge base document
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