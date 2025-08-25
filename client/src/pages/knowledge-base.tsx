import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  document_id: string;
  name: string;
  type: 'file' | 'url' | 'text';
  source?: string;
  content_type?: string;
  size_bytes?: number;
  chunk_count?: number;
  created_at: string;
  updated_at?: string;
  status: 'processing' | 'ready' | 'failed';
  agents?: string[];
}

export default function KnowledgeBase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'url' | 'text'>('file');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
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
            return { documents: [], error: "Please configure your ElevenLabs API key in Integrations" };
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
        // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
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
        description: "The document has been added and will be automatically indexed.",
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
    },
    onSuccess: () => {
      toast({
        title: "Document Deleted",
        description: "The document has been removed from the knowledge base.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Note: RAG indexing happens automatically in ElevenLabs when documents are added
  // No manual index computation is needed

  // Fetch document details
  const fetchDocumentDetails = async (documentId: string) => {
    try {
      const response = await fetch(`/api/convai/knowledge-base/${documentId}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch document details");
      }
      
      const data = await response.json();
      setSelectedDocument(data);
      setShowDocumentDetails(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch document details",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      
      // Add name if provided
      if (uploadName) {
        formData.append('name', uploadName);
      }
      
      // Add agent_ids if selected (but not if it's "none")
      if (selectedAgentId && selectedAgentId !== 'none') {
        formData.append('agent_ids', JSON.stringify([selectedAgentId]));
      }

      if (uploadType === 'file' && uploadFile) {
        // Send the actual file
        formData.append('file', uploadFile);
        formData.append('type', 'file');
        console.log('Uploading file:', uploadFile.name, 'size:', uploadFile.size);
      } else if (uploadType === 'url' && uploadUrl) {
        formData.append('url', uploadUrl);
        formData.append('type', 'url');
        console.log('Uploading URL:', uploadUrl);
      } else if (uploadType === 'text' && uploadText) {
        // Convert text to a file for the API
        const textBlob = new Blob([uploadText], { type: 'text/plain' });
        // Check if the name already ends with .txt to avoid double extension
        const fileName = uploadName.endsWith('.txt') 
          ? uploadName.replace(/[^a-z0-9._-]/gi, '_')
          : `${uploadName.replace(/[^a-z0-9._-]/gi, '_')}.txt`;
        formData.append('file', textBlob, fileName);
        formData.append('type', 'file');
        console.log('Uploading text as file:', fileName);
      }
      
      await uploadMutation.mutateAsync(formData);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadUrl("");
    setUploadText("");
    setUploadName("");
    setSelectedAgentId("");
    setUploadType('file');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <File className="h-4 w-4" />;
      case 'url':
        return <Globe className="h-4 w-4" />;
      case 'text':
        return <FileText className="h-4 w-4" />;
      default:
        return <Book className="h-4 w-4" />;
    }
  };

  const filteredDocuments = documents.filter((doc: KnowledgeDocument) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      doc.name.toLowerCase().includes(searchLower) ||
      doc.document_id.toLowerCase().includes(searchLower) ||
      doc.source?.toLowerCase().includes(searchLower)
    );
  });

  if (apiError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">Manage documents and information for your AI agents</p>
        </div>
        
        <Card className="p-6">
          <div className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">API Key Required</p>
            <p className="text-muted-foreground">{apiError}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">Manage documents and information for your AI agents</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowUpload(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1 p-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Documents</p>
            <p className="text-2xl font-bold">{documents.length}</p>
          </div>
        </Card>
        <Card className="md:col-span-1 p-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Chunks</p>
            <p className="text-2xl font-bold">
              {documents.reduce((acc: number, doc: KnowledgeDocument) => acc + (doc.chunk_count || 0), 0)}
            </p>
          </div>
        </Card>
        <Card className="md:col-span-1 p-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Storage Used</p>
            <p className="text-2xl font-bold">
              {formatFileSize(documents.reduce((acc: number, doc: KnowledgeDocument) => acc + (doc.size_bytes || 0), 0))}
            </p>
          </div>
        </Card>
        <Card className="md:col-span-1 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card className="p-6">
          <div className="text-center py-8">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Documents Found</p>
            <p className="text-muted-foreground">
              {searchTerm 
                ? "Try adjusting your search" 
                : "Add documents to enhance your agents' knowledge"}
            </p>
            <Button 
              onClick={() => setShowUpload(true)} 
              className="mt-4"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Document
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((document: KnowledgeDocument) => (
            <Card 
              key={document.document_id} 
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => fetchDocumentDetails(document.document_id)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(document.type)}
                    <p className="font-medium truncate flex-1">{document.name}</p>
                  </div>
                  {getStatusIcon(document.status)}
                </div>
                
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="truncate">ID: {document.document_id?.slice(-8) || 'N/A'}</p>
                  {document.chunk_count && (
                    <p>{document.chunk_count} chunks</p>
                  )}
                  {document.size_bytes && (
                    <p>{formatFileSize(document.size_bytes)}</p>
                  )}
                  <p>{formatDate(document.created_at)}</p>
                </div>
                
                {document.agents && document.agents.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {document.agents.map((agentId) => {
                      const agent = agents.find(a => a.elevenLabsAgentId === agentId);
                      return (
                        <Badge key={agentId} variant="secondary" className="text-xs">
                          {agent?.name || agentId?.slice(-6) || 'Unknown'}
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
                      deleteMutation.mutate(document.document_id);
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
              Upload files, add URLs, or paste text to enhance your agents' knowledge
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="file">
                <File className="h-4 w-4 mr-2" />
                File Upload
              </TabsTrigger>
              <TabsTrigger value="url">
                <Globe className="h-4 w-4 mr-2" />
                URL Import
              </TabsTrigger>
              <TabsTrigger value="text">
                <FileText className="h-4 w-4 mr-2" />
                Text Content
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="file" className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Select File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.txt,.docx,.html,.epub,.md"
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
                  Supported formats: PDF, TXT, DOCX, HTML, EPUB, Markdown
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
                  Enter a URL to import content from websites, documentation, or articles
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="text" className="space-y-4">
              <div>
                <Label htmlFor="text-input">Text Content</Label>
                <Textarea
                  id="text-input"
                  placeholder="Paste or type your content here..."
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  rows={8}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Directly input text content for the knowledge base
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
              <Label htmlFor="agent-select">Associate with Agent (Optional)</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger id="agent-select">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.elevenLabsAgentId}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                (uploadType === 'url' && !uploadUrl) ||
                (uploadType === 'text' && !uploadText)
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
                  <p className="font-mono text-sm">{selectedDocument.document_id}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Name</Label>
                  <p className="text-sm">{selectedDocument.name}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Type</Label>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(selectedDocument.type)}
                    <p className="text-sm capitalize">{selectedDocument.type}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedDocument.status)}
                    <p className="text-sm capitalize">{selectedDocument.status}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Chunks</Label>
                  <p className="text-sm">{selectedDocument.chunk_count || 0}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Size</Label>
                  <p className="text-sm">{formatFileSize(selectedDocument.size_bytes)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Created</Label>
                  <p className="text-sm">{formatDate(selectedDocument.created_at)}</p>
                </div>
                {selectedDocument.updated_at && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Updated</Label>
                    <p className="text-sm">{formatDate(selectedDocument.updated_at)}</p>
                  </div>
                )}
              </div>
              
              {selectedDocument.source && (
                <div>
                  <Label className="text-sm text-muted-foreground">Source</Label>
                  <p className="text-sm font-mono break-all">{selectedDocument.source}</p>
                </div>
              )}
              
              {selectedDocument.agents && selectedDocument.agents.length > 0 && (
                <div>
                  <Label className="text-sm text-muted-foreground">Associated Agents</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedDocument.agents.map((agentId) => {
                      const agent = agents.find(a => a.elevenLabsAgentId === agentId);
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