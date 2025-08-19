import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Plus, Search, Upload, Trash2, Download, 
  MoreHorizontal, ExternalLink, Calendar, FileCode, 
  FileJson, File, Globe
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  url?: string;
  uploadedAt: Date;
  status: 'processing' | 'ready' | 'failed';
  chunks?: number;
}

export default function KnowledgeBase() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Mock data - in real app this would come from API
  const documents: Document[] = [
    {
      id: "1",
      name: "Product Documentation.pdf",
      type: "pdf",
      size: "2.4 MB",
      uploadedAt: new Date("2025-08-15"),
      status: "ready",
      chunks: 156
    },
    {
      id: "2",
      name: "API Reference.md",
      type: "markdown",
      size: "145 KB",
      uploadedAt: new Date("2025-08-14"),
      status: "ready",
      chunks: 42
    },
    {
      id: "3",
      name: "Company FAQs.json",
      type: "json",
      size: "89 KB",
      uploadedAt: new Date("2025-08-10"),
      status: "ready",
      chunks: 28
    },
    {
      id: "4",
      name: "Support Articles",
      type: "url",
      url: "https://support.example.com",
      size: "External",
      uploadedAt: new Date("2025-08-08"),
      status: "ready",
      chunks: 234
    }
  ];

  const filteredDocs = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      case 'markdown':
        return <FileCode className="h-4 w-4" />;
      case 'json':
        return <FileJson className="h-4 w-4" />;
      case 'url':
        return <Globe className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage documents and information sources for your agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" data-testid="button-import">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white" data-testid="button-add-document">
            <Plus className="h-4 w-4 mr-2" />
            Add document
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-documents"
          />
        </div>
        {selectedDocs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedDocs.length} selected
            </span>
            <Button variant="outline" size="sm" onClick={() => setSelectedDocs([])}>
              Clear
            </Button>
            <Button variant="outline" size="sm" className="text-destructive">
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="w-12 p-4">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedDocs.length === filteredDocs.length && filteredDocs.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDocs(filteredDocs.map(d => d.id));
                      } else {
                        setSelectedDocs([]);
                      }
                    }}
                  />
                </th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Name</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Type</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Size</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Chunks</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Status</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Uploaded</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedDocs.includes(doc.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDocs([...selectedDocs, doc.id]);
                        } else {
                          setSelectedDocs(selectedDocs.filter(id => id !== doc.id));
                        }
                      }}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {getFileIcon(doc.type)}
                      <span className="font-medium">{doc.name}</span>
                      {doc.url && (
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground capitalize">{doc.type}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">{doc.size}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">{doc.chunks || '-'}</span>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className={cn("text-xs", getStatusColor(doc.status))}>
                      {doc.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {format(doc.uploadedAt, 'MMM d, yyyy')}
                  </td>
                  <td className="p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${doc.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No documents found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? `No documents match "${searchQuery}"` : "Start by adding your first document"}
          </p>
          {!searchQuery && (
            <Button className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add your first document
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}