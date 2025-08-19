import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  PhoneOutgoing, Plus, Upload, Play, Pause, Download,
  Calendar, Clock, Users, Target, TrendingUp, AlertCircle,
  FileText, Settings, MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
  agent: string;
  totalContacts: number;
  contacted: number;
  answered: number;
  voicemails: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  successRate: number;
  script?: string;
}

export default function Outbound() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'campaigns' | 'new'>('campaigns');
  const [searchQuery, setSearchQuery] = useState("");
  
  // New campaign form
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    agent: "",
    contacts: "",
    schedule: "immediate",
    script: "",
    maxConcurrent: 5,
    voicemailDetection: true,
    leaveVoicemail: false,
    callWindow: {
      start: "09:00",
      end: "17:00",
      timezone: "America/New_York"
    }
  });

  // Mock campaigns
  const campaigns: Campaign[] = [
    {
      id: "1",
      name: "Customer Satisfaction Survey",
      status: "running",
      agent: "Survey Agent",
      totalContacts: 500,
      contacted: 234,
      answered: 189,
      voicemails: 45,
      startedAt: new Date("2025-08-19T10:00:00"),
      successRate: 81
    },
    {
      id: "2",
      name: "Product Launch Announcement",
      status: "scheduled",
      agent: "Sales Agent",
      totalContacts: 1000,
      contacted: 0,
      answered: 0,
      voicemails: 0,
      scheduledAt: new Date("2025-08-20T09:00:00"),
      successRate: 0
    },
    {
      id: "3",
      name: "Appointment Reminders",
      status: "completed",
      agent: "Reminder Agent",
      totalContacts: 250,
      contacted: 250,
      answered: 198,
      voicemails: 52,
      startedAt: new Date("2025-08-18T08:00:00"),
      completedAt: new Date("2025-08-18T12:30:00"),
      successRate: 79
    }
  ];

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    campaign.agent.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'draft':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleCreateCampaign = () => {
    toast({
      title: "Campaign created",
      description: "Your outbound campaign has been created and scheduled."
    });
    setActiveTab('campaigns');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Outbound Campaigns</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage automated outbound calling campaigns
          </p>
        </div>
        <Button 
          className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white"
          onClick={() => setActiveTab('new')}
          data-testid="button-new-campaign"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {activeTab === 'campaigns' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Campaigns</p>
                  <p className="text-2xl font-semibold">
                    {campaigns.filter(c => c.status === 'running').length}
                  </p>
                </div>
                <PhoneOutgoing className="h-8 w-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls Today</p>
                  <p className="text-2xl font-semibold">423</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Success Rate</p>
                  <p className="text-2xl font-semibold">76%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-semibold">
                    {campaigns.filter(c => c.status === 'scheduled').length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-purple-500" />
              </div>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-campaigns"
            />
          </div>

          {/* Campaigns List */}
          <div className="bg-white dark:bg-gray-950 rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="text-left p-4 font-medium text-sm text-muted-foreground">Campaign</th>
                    <th className="text-left p-4 font-medium text-sm text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-sm text-muted-foreground">Agent</th>
                    <th className="text-left p-4 font-medium text-sm text-muted-foreground">Progress</th>
                    <th className="text-left p-4 font-medium text-sm text-muted-foreground">Success Rate</th>
                    <th className="text-left p-4 font-medium text-sm text-muted-foreground">Schedule</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {campaign.totalContacts} contacts
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={cn("text-xs", getStatusColor(campaign.status))}>
                          {campaign.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">{campaign.agent}</td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                              <div 
                                className="bg-black dark:bg-white h-2 rounded-full transition-all"
                                style={{ width: `${(campaign.contacted / campaign.totalContacts) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round((campaign.contacted / campaign.totalContacts) * 100)}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {campaign.contacted}/{campaign.totalContacts} contacted
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{campaign.successRate}%</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {campaign.scheduledAt && format(campaign.scheduledAt, 'MMM d, h:mm a')}
                        {campaign.startedAt && !campaign.completedAt && 'Running'}
                        {campaign.completedAt && format(campaign.completedAt, 'MMM d, h:mm a')}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-menu-${campaign.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {campaign.status === 'running' && (
                              <DropdownMenuItem>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </DropdownMenuItem>
                            )}
                            {campaign.status === 'paused' && (
                              <DropdownMenuItem>
                                <Play className="h-4 w-4 mr-2" />
                                Resume
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <FileText className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Export Results
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
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
        </>
      ) : (
        /* New Campaign Form */
        <Card className="p-6 max-w-2xl">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Create New Campaign</h3>
            </div>

            <div>
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                placeholder="e.g., Customer Satisfaction Survey"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="agent">Select Agent</Label>
              <Select value={newCampaign.agent} onValueChange={(value) => setNewCampaign({ ...newCampaign, agent: value })}>
                <SelectTrigger id="agent" className="mt-1">
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="survey">Survey Agent</SelectItem>
                  <SelectItem value="sales">Sales Agent</SelectItem>
                  <SelectItem value="support">Support Agent</SelectItem>
                  <SelectItem value="reminder">Reminder Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contacts">Contact List</Label>
              <div className="mt-1 space-y-2">
                <Textarea
                  id="contacts"
                  value={newCampaign.contacts}
                  onChange={(e) => setNewCampaign({ ...newCampaign, contacts: e.target.value })}
                  placeholder="Enter phone numbers (one per line) or upload a CSV file"
                  rows={4}
                />
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="schedule">Schedule</Label>
              <Select value={newCampaign.schedule} onValueChange={(value) => setNewCampaign({ ...newCampaign, schedule: value })}>
                <SelectTrigger id="schedule" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Start Immediately</SelectItem>
                  <SelectItem value="scheduled">Schedule for Later</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Call Window</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Input
                  type="time"
                  value={newCampaign.callWindow.start}
                  onChange={(e) => setNewCampaign({
                    ...newCampaign,
                    callWindow: { ...newCampaign.callWindow, start: e.target.value }
                  })}
                />
                <Input
                  type="time"
                  value={newCampaign.callWindow.end}
                  onChange={(e) => setNewCampaign({
                    ...newCampaign,
                    callWindow: { ...newCampaign.callWindow, end: e.target.value }
                  })}
                />
                <Select 
                  value={newCampaign.callWindow.timezone}
                  onValueChange={(value) => setNewCampaign({
                    ...newCampaign,
                    callWindow: { ...newCampaign.callWindow, timezone: value }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern</SelectItem>
                    <SelectItem value="America/Chicago">Central</SelectItem>
                    <SelectItem value="America/Denver">Mountain</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setActiveTab('campaigns')}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateCampaign}
                className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white"
              >
                Create Campaign
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}