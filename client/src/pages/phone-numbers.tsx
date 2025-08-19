import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Phone, Plus, Search, Globe, MapPin, Settings, 
  MoreHorizontal, Trash2, Copy, ExternalLink
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface PhoneNumber {
  id: string;
  number: string;
  country: string;
  countryCode: string;
  type: 'local' | 'toll-free' | 'mobile';
  status: 'active' | 'inactive' | 'pending';
  assignedAgent?: string;
  monthlyPrice: number;
  capabilities: string[];
  createdAt: Date;
  lastUsed?: Date;
}

export default function PhoneNumbers() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Mock data
  const phoneNumbers: PhoneNumber[] = [
    {
      id: "1",
      number: "+1 (555) 123-4567",
      country: "United States",
      countryCode: "US",
      type: "local",
      status: "active",
      assignedAgent: "Customer Support Agent",
      monthlyPrice: 1.00,
      capabilities: ["voice", "sms"],
      createdAt: new Date("2025-08-01"),
      lastUsed: new Date("2025-08-19")
    },
    {
      id: "2",
      number: "+1 (800) 555-0100",
      country: "United States",
      countryCode: "US",
      type: "toll-free",
      status: "active",
      assignedAgent: "Sales Agent",
      monthlyPrice: 2.00,
      capabilities: ["voice"],
      createdAt: new Date("2025-07-15"),
      lastUsed: new Date("2025-08-18")
    },
    {
      id: "3",
      number: "+44 20 7123 4567",
      country: "United Kingdom",
      countryCode: "GB",
      type: "local",
      status: "inactive",
      monthlyPrice: 1.50,
      capabilities: ["voice", "sms"],
      createdAt: new Date("2025-06-20")
    }
  ];

  const filteredNumbers = phoneNumbers.filter(num => {
    const matchesSearch = num.number.includes(searchQuery) ||
                         num.assignedAgent?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCountry = filterCountry === "all" || num.countryCode === filterCountry;
    const matchesStatus = filterStatus === "all" || num.status === filterStatus;
    return matchesSearch && matchesCountry && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'toll-free':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'mobile':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const copyNumber = (number: string) => {
    navigator.clipboard.writeText(number.replace(/\D/g, ''));
    toast({
      title: "Number copied",
      description: "Phone number copied to clipboard"
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Phone Numbers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage phone numbers for your voice agents
          </p>
        </div>
        <Button className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white" data-testid="button-buy-number">
          <Plus className="h-4 w-4 mr-2" />
          Buy Number
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by number or agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-numbers"
          />
        </div>
        <Select value={filterCountry} onValueChange={setFilterCountry}>
          <SelectTrigger className="w-[180px]">
            <Globe className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            <SelectItem value="US">United States</SelectItem>
            <SelectItem value="GB">United Kingdom</SelectItem>
            <SelectItem value="CA">Canada</SelectItem>
            <SelectItem value="AU">Australia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Numbers</p>
              <p className="text-2xl font-semibold">{phoneNumbers.length}</p>
            </div>
            <Phone className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Numbers</p>
              <p className="text-2xl font-semibold">
                {phoneNumbers.filter(n => n.status === 'active').length}
              </p>
            </div>
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Countries</p>
              <p className="text-2xl font-semibold">
                {new Set(phoneNumbers.map(n => n.countryCode)).size}
              </p>
            </div>
            <Globe className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Monthly Cost</p>
              <p className="text-2xl font-semibold">
                ${phoneNumbers.reduce((sum, n) => sum + n.monthlyPrice, 0).toFixed(2)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">USD</span>
          </div>
        </Card>
      </div>

      {/* Phone Numbers List */}
      <div className="bg-white dark:bg-gray-950 rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Number</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Country</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Type</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Status</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Assigned To</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Monthly Price</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Last Used</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredNumbers.map((number) => (
                <tr key={number.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono font-medium">{number.number}</span>
                      <button
                        onClick={() => copyNumber(number.number)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-3 inline-block bg-gray-200 dark:bg-gray-800 rounded" />
                      <span className="text-sm">{number.country}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className={cn("text-xs", getTypeColor(number.type))}>
                      {number.type}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className={cn("text-xs", getStatusColor(number.status))}>
                      {number.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{number.assignedAgent || '-'}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium">${number.monthlyPrice.toFixed(2)}</span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {number.lastUsed ? format(number.lastUsed, 'MMM d, yyyy') : 'Never'}
                  </td>
                  <td className="p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${number.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View in provider
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Release number
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

      {filteredNumbers.length === 0 && (
        <div className="text-center py-12">
          <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No phone numbers</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? `No numbers match "${searchQuery}"` : "Get started by purchasing your first phone number"}
          </p>
          <Button className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white">
            <Plus className="h-4 w-4 mr-2" />
            Buy Your First Number
          </Button>
        </div>
      )}
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}