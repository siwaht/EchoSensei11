import { useQuery, useMutation } from "@tanstack/react-query";
import { StatsCard } from "@/components/ui/stats-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Phone, Clock, DollarSign, Bot, TrendingUp, PhoneCall, MessageSquare, AlertCircle, BarChart3, Activity, RefreshCw } from "lucide-react";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Success Rate Chart Component
function SuccessRateChart() {
  const { data: callLogs } = useQuery({
    queryKey: ["/api/call-logs"],
  });

  // Process call logs for success rate over time
  const processSuccessRate = (logs: any[]) => {
    if (!logs || logs.length === 0) return [];

    const dailyStats: any = {};
    
    logs.forEach((call: any) => {
      const date = new Date(call.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dailyStats[date]) {
        dailyStats[date] = { total: 0, successful: 0 };
      }
      dailyStats[date].total++;
      if (call.status === 'completed') {
        dailyStats[date].successful++;
      }
    });

    // Convert to array and calculate success rate
    const data = Object.entries(dailyStats)
      .map(([date, stats]: [string, any]) => ({
        date,
        successRate: (stats.successful / stats.total) * 100,
        calls: stats.total
      }))
      .slice(-14); // Last 14 days

    return data;
  };

  const chartData = processSuccessRate(Array.isArray(callLogs) ? callLogs : []);

  return (
    <div className="h-64">
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              stroke="#666"
              fontSize={11}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#666" 
              fontSize={11}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '12px'
              }}
              formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Success Rate']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area 
              type="monotone" 
              dataKey="successRate" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#colorSuccess)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </div>
      )}
    </div>
  );
}

// Agent Performance Table Component
function AgentPerformanceTable() {
  const { data: callLogs } = useQuery({
    queryKey: ["/api/call-logs"],
  });

  const { data: agents } = useQuery({
    queryKey: ["/api/agents"],
  });

  // Calculate agent statistics
  const calculateAgentStats = () => {
    if (!callLogs || !agents || !Array.isArray(callLogs) || !Array.isArray(agents)) return [];

    const agentStats: any = {};

    (callLogs as any[]).forEach((call: any) => {
      const agentId = call.agentId;
      const agent = (agents as any[]).find((a: any) => a.id === agentId);
      const agentName = agent?.name || 'Unknown Agent';

      if (!agentStats[agentName]) {
        agentStats[agentName] = {
          name: agentName,
          calls: 0,
          duration: 0,
          llmCost: 0,
          credits: 0
        };
      }

      agentStats[agentName].calls++;
      agentStats[agentName].duration += (call.duration || 0);
      agentStats[agentName].llmCost += Number(call.cost || 0);
      agentStats[agentName].credits += Math.round((Number(call.cost || 0) * 10000)); // Approximate credits
    });

    return Object.values(agentStats)
      .sort((a: any, b: any) => b.calls - a.calls)
      .slice(0, 5); // Top 5 agents
  };

  const agentData = calculateAgentStats();

  return (
    <div className="space-y-2">
      {agentData.length > 0 ? (
        <>
          <div className="grid grid-cols-5 gap-3 text-xs text-gray-500 dark:text-gray-400 pb-2 border-b">
            <div className="col-span-1">Agent name</div>
            <div className="text-center">Number of calls</div>
            <div className="text-center">Call minutes</div>
            <div className="text-center">LLM cost</div>
            <div className="text-center">Credits spent</div>
          </div>
          {agentData.map((agent: any, index: number) => (
            <div key={index} className="grid grid-cols-5 gap-3 text-sm py-2">
              <div className="col-span-1 truncate">{agent.name}</div>
              <div className="text-center">{agent.calls}</div>
              <div className="text-center">{(agent.duration / 60).toFixed(3)}</div>
              <div className="text-center">${agent.llmCost.toFixed(4)}</div>
              <div className="text-center">{agent.credits.toLocaleString()}</div>
            </div>
          ))}
        </>
      ) : (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No agent activity yet
        </div>
      )}
    </div>
  );
}

// Language Stats Component
function LanguageStats() {
  const languages = [
    { name: 'English', percentage: 100 }
  ];

  return (
    <div className="space-y-3">
      {languages.map((lang, index) => (
        <div key={index}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">{lang.name}</span>
            <span className="text-sm font-semibold">{lang.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-black dark:bg-white h-2 rounded-full" 
              style={{ width: `${lang.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Recent Activity Component (keeping for reference)
function RecentActivity() {
  const { data: callLogs, isLoading: callLogsLoading } = useQuery({
    queryKey: ["/api/call-logs"],
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/agents"],
  });

  if (callLogsLoading || agentsLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="w-1/2 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Combine and sort activity data
  const activities: any[] = [];

  // Add call logs as activities
  if (callLogs) {
    (callLogs as any[]).forEach((call: any) => {
      activities.push({
        id: call.id,
        type: 'call',
        timestamp: call.createdAt,
        title: `Call with ${call.agent?.name || 'Unknown Agent'}`,
        description: `Duration: ${Math.floor((call.duration || 0) / 60)}:${String((call.duration || 0) % 60).padStart(2, '0')} • Cost: $${Number(call.cost || 0).toFixed(4)}`,
        status: call.status,
        icon: PhoneCall,
        color: call.status === 'completed' ? 'text-green-500' : call.status === 'failed' ? 'text-red-500' : 'text-yellow-500'
      });
    });
  }

  // Add agent sync activities
  if (agents) {
    (agents as any[]).forEach((agent: any) => {
      if (agent.lastSync) {
        activities.push({
          id: `sync-${agent.id}`,
          type: 'sync',
          timestamp: agent.lastSync,
          title: `Agent synchronized: ${agent.name}`,
          description: `ElevenLabs agent data updated`,
          status: 'completed',
          icon: MessageSquare,
          color: 'text-blue-500'
        });
      }
    });
  }

  // Sort by timestamp (most recent first)
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Show last 30 days if recent activity is sparse
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentActivities = activities.filter(activity => 
    new Date(activity.timestamp) >= thirtyDaysAgo
  ).slice(0, 10); // Show max 10 items

  if (recentActivities.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p data-testid="text-activity-placeholder">No activity in the last 30 days</p>
        <p className="text-sm mt-2">Activity will appear here once you start making calls</p>
      </div>
    );
  }

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return time.toLocaleDateString();
  };

  return (
    <div className="space-y-3" data-testid="container-recent-activity">
      {recentActivities.map((activity) => {
        const IconComponent = activity.icon;
        return (
          <div key={activity.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <div className={`p-2 rounded-full bg-gray-100 dark:bg-gray-700 ${activity.color}`}>
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {activity.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {activity.description}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {activity.status && (
                <Badge 
                  variant={activity.status === 'completed' ? 'default' : activity.status === 'failed' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {activity.status}
                </Badge>
              )}
              <span className="text-xs text-gray-400">
                {formatRelativeTime(activity.timestamp)}
              </span>
            </div>
          </div>
        );
      })}
      
      {activities.length > recentActivities.length && (
        <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">
            Showing recent activity from the last 30 days ({recentActivities.length} of {activities.length} total)
          </p>
        </div>
      )}
    </div>
  );
}

// Cost Analysis Chart Component
function CostAnalysisChart() {
  const [timeRange, setTimeRange] = useState('daily');
  
  const { data: callLogs } = useQuery({
    queryKey: ["/api/call-logs"],
  });

  // Process cost data based on selected time range
  const processCostData = (logs: any[], range: string) => {
    if (!logs || logs.length === 0) return [];

    const now = new Date();
    const data: any[] = [];
    let days = 7;
    let formatKey = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    switch (range) {
      case 'daily':
        days = 7;
        break;
      case 'weekly':
        days = 28;
        formatKey = (date: Date) => `W${Math.ceil(date.getDate() / 7)}`;
        break;
      case 'monthly':
        days = 90;
        formatKey = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' });
        break;
    }

    // Group by period
    const periodData: any = {};
    
    logs.forEach((call: any) => {
      const callDate = new Date(call.createdAt);
      const periodKey = formatKey(callDate);
      
      if (!periodData[periodKey]) {
        periodData[periodKey] = {
          period: periodKey,
          cost: 0,
          calls: 0,
          avgCost: 0
        };
      }
      
      periodData[periodKey].cost += Number(call.cost || 0);
      periodData[periodKey].calls++;
    });

    // Calculate averages and convert to array
    Object.values(periodData).forEach((item: any) => {
      item.avgCost = item.calls > 0 ? item.cost / item.calls : 0;
      item.cost = Number(item.cost.toFixed(4));
      item.avgCost = Number(item.avgCost.toFixed(4));
    });

    return Object.values(periodData).slice(-10);
  };

  const chartData = processCostData(Array.isArray(callLogs) ? callLogs : [], timeRange);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-card-foreground">
          Cost Analysis
        </h3>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32" data-testid="select-cost-time-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {chartData.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="period" 
                stroke="#666"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#666" 
                fontSize={12}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                formatter={(value: any, name: string) => [
                  `$${Number(value).toFixed(4)}`,
                  name === 'cost' ? 'Total Cost' : 'Avg Cost/Call'
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="cost" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                name="cost"
              />
              <Line 
                type="monotone" 
                dataKey="avgCost" 
                stroke="#f59e0b" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: '#f59e0b', strokeWidth: 2 }}
                name="avgCost"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-green-500"></div>
              <span className="text-gray-600 dark:text-gray-400">Total Cost</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-orange-500" style={{ borderTop: '2px dashed' }}></div>
              <span className="text-gray-600 dark:text-gray-400">Avg Cost per Call</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center bg-muted/20 rounded-lg">
          <div className="text-center text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-2" />
            <p data-testid="text-cost-placeholder">No cost data available</p>
            <p className="text-sm">Data will appear after calls are made</p>
          </div>
        </div>
      )}
    </Card>
  );
}

// Call Volume Chart Component
function CallVolumeChart() {
  const [timeRange, setTimeRange] = useState('daily');
  
  const { data: callLogs } = useQuery({
    queryKey: ["/api/call-logs"],
  });

  // Process call logs based on selected time range
  const processCallData = (logs: any[], range: string) => {
    if (!logs || logs.length === 0) return [];

    const now = new Date();
    const data: any[] = [];
    let days = 7; // Default for daily view
    let formatKey = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    switch (range) {
      case 'daily':
        days = 7;
        formatKey = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        break;
      case 'weekly':
        days = 28; // 4 weeks
        formatKey = (date: Date) => `Week ${Math.ceil(date.getDate() / 7)}, ${date.toLocaleDateString('en-US', { month: 'short' })}`;
        break;
      case 'monthly':
        days = 90; // 3 months
        formatKey = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        break;
      case 'quarterly':
        days = 365; // 1 year
        formatKey = (date: Date) => `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
        break;
    }

    // Generate date ranges
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      let periodKey: string;
      let periodStart: Date;
      let periodEnd: Date;

      if (range === 'daily') {
        periodKey = formatKey(date);
        periodStart = new Date(date);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(date);
        periodEnd.setHours(23, 59, 59, 999);
      } else if (range === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = formatKey(weekStart);
        periodStart = weekStart;
        periodEnd = new Date(weekStart);
        periodEnd.setDate(weekStart.getDate() + 6);
      } else if (range === 'monthly') {
        periodKey = formatKey(new Date(date.getFullYear(), date.getMonth(), 1));
        periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
        periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      } else { // quarterly
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        periodKey = `Q${quarter} ${date.getFullYear()}`;
        periodStart = new Date(date.getFullYear(), (quarter - 1) * 3, 1);
        periodEnd = new Date(date.getFullYear(), quarter * 3, 0);
      }

      // Count calls in this period
      const callsInPeriod = logs.filter((call: any) => {
        const callDate = new Date(call.createdAt);
        return callDate >= periodStart && callDate <= periodEnd;
      });

      const totalCost = callsInPeriod.reduce((sum: number, call: any) => sum + (Number(call.cost) || 0), 0);
      const totalDuration = callsInPeriod.reduce((sum: number, call: any) => sum + (call.duration || 0), 0);

      // Only add unique periods (avoid duplicates in weekly/monthly/quarterly views)
      if (!data.find(item => item.period === periodKey)) {
        data.push({
          period: periodKey,
          calls: callsInPeriod.length,
          cost: totalCost,
          duration: Math.round(totalDuration / 60), // Convert to minutes
        });
      }
    }

    return data.slice(-10); // Show last 10 periods
  };

  const chartData = processCallData(Array.isArray(callLogs) ? callLogs : [], timeRange);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-card-foreground" data-testid="text-chart-title-usage">
          Call Volume
        </h3>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32" data-testid="select-time-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {chartData.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="period" 
                stroke="#666"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                formatter={(value: any, name: string) => [
                  name === 'calls' ? `${value} calls` :
                  name === 'cost' ? `$${Number(value).toFixed(4)}` :
                  `${value} min`,
                  name === 'calls' ? 'Calls' :
                  name === 'cost' ? 'Cost' : 'Duration'
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="calls" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center bg-muted/20 rounded-lg">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-2" />
            <p data-testid="text-chart-placeholder">No call data available</p>
            <p className="text-sm">Data will appear after calls are made</p>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const { data: stats, isLoading, refetch: refetchStats } = useQuery({
    queryKey: ["/api/analytics/organization"],
  });
  
  const { data: callLogs, refetch: refetchCallLogs } = useQuery({
    queryKey: ["/api/call-logs"],
  });
  
  const { data: agents } = useQuery({
    queryKey: ["/api/agents"],
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sync-calls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to sync");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setLastSyncTime(new Date());
      toast({
        title: "Sync Successful",
        description: data.message || "Data has been synced with ElevenLabs",
      });
      // Refresh all data after sync
      refetchStats();
      refetchCallLogs();
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync with ElevenLabs",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate average duration
  const avgDuration = (stats as any)?.totalCalls > 0 
    ? Math.floor((stats as any)?.totalMinutes * 60 / (stats as any)?.totalCalls)
    : 0;
  const avgMinutes = Math.floor(avgDuration / 60);
  const avgSeconds = avgDuration % 60;

  // Calculate average cost per call
  const avgCostPerCall = (stats as any)?.totalCalls > 0
    ? ((stats as any)?.estimatedCost / (stats as any)?.totalCalls).toFixed(2)
    : '0.00';

  // Calculate credits (ElevenLabs uses a credit system where 1 credit ≈ $0.0001)
  const totalCredits = Math.round((stats as any)?.estimatedCost * 10000) || 0;

  return (
    <div className="space-y-8">
      {/* Sync Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-purple-400" />
            <span className="text-sm text-muted-foreground">
              {lastSyncTime || (stats as any)?.lastSync 
                ? `Last synced: ${(lastSyncTime || new Date((stats as any)?.lastSync)).toLocaleString()}` 
                : 'Click sync to update data from ElevenLabs'}
            </span>
          </div>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          size="sm"
          className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          data-testid="button-sync-data"
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing...' : 'Sync with ElevenLabs'}
        </Button>
      </div>
      
      {/* Data Accuracy Notice */}
      {!(stats as any)?.lastSync && !lastSyncTime && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                Data Not Yet Synced
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Click the "Sync with ElevenLabs" button above to fetch your latest call data and ensure all metrics are accurate.
              </p>
            </div>
          </div>
        </Card>
      )}
      
      {/* ElevenLabs-style Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Total calls */}
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 border-blue-500/20 dark:border-blue-400/30 backdrop-blur hover:from-blue-500/15 hover:to-blue-600/15 transition-all">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/20 dark:bg-blue-400/20">
                <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Calls</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{(stats as any)?.totalCalls || 0}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">All voice conversations</p>
          </div>
        </Card>

        {/* Total duration */}
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 dark:from-emerald-500/20 dark:to-emerald-600/20 border-emerald-500/20 dark:border-emerald-400/30 backdrop-blur hover:from-emerald-500/15 hover:to-emerald-600/15 transition-all">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 dark:bg-emerald-400/20">
                <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Duration</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{(stats as any)?.totalMinutes || 0} min</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total talk time</p>
          </div>
        </Card>

        {/* Total spending */}
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/10 dark:from-amber-500/20 dark:to-amber-600/20 border-amber-500/20 dark:border-amber-400/30 backdrop-blur hover:from-amber-500/15 hover:to-amber-600/15 transition-all">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 dark:bg-amber-400/20">
                <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Spending</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">${(stats as any)?.estimatedCost?.toFixed(2) || '0.00'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">All-time cost in USD</p>
          </div>
        </Card>

        {/* Average cost per call */}
        <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/10 dark:from-orange-500/20 dark:to-orange-600/20 border-orange-500/20 dark:border-orange-400/30 backdrop-blur hover:from-orange-500/15 hover:to-orange-600/15 transition-all">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/20 dark:bg-orange-400/20">
                <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Avg Cost per Call</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">${avgCostPerCall}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Average spending per call</p>
          </div>
        </Card>

        {/* Average duration */}
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 border-purple-500/20 dark:border-purple-400/30 backdrop-blur hover:from-purple-500/15 hover:to-purple-600/15 transition-all">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/20 dark:bg-purple-400/20">
                <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Avg Call Duration</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{avgMinutes}:{String(avgSeconds).padStart(2, '0')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Average talk time</p>
          </div>
        </Card>

        {/* Active agents */}
        <Card className="p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 dark:from-cyan-500/20 dark:to-cyan-600/20 border-cyan-500/20 dark:border-cyan-400/30 backdrop-blur hover:from-cyan-500/15 hover:to-cyan-600/15 transition-all">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 dark:bg-cyan-400/20">
                <Bot className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Active Agents</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{(stats as any)?.activeAgents || 0}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Connected voice agents</p>
          </div>
        </Card>

        {/* Credits used (if available) */}
        <Card className="p-4 bg-gradient-to-br from-pink-500/10 to-pink-600/10 dark:from-pink-500/20 dark:to-pink-600/20 border-pink-500/20 dark:border-pink-400/30 backdrop-blur hover:from-pink-500/15 hover:to-pink-600/15 transition-all">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-pink-500/20 dark:bg-pink-400/20">
                <BarChart3 className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Credits Used</p>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalCredits.toLocaleString()}</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">ElevenLabs credits consumed</p>
          </div>
        </Card>

        {/* Success rate */}
        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20 border-green-500/20 dark:border-green-400/30 backdrop-blur hover:from-green-500/15 hover:to-green-600/15 transition-all">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-green-500/20 dark:bg-green-400/20">
                <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Success Rate</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {(() => {
                const logs = Array.isArray(callLogs) ? callLogs : [];
                const completed = logs.filter((l: any) => l.status === 'completed').length;
                const rate = logs.length > 0 ? Math.round((completed / logs.length) * 100) : 0;
                return `${rate}%`;
              })()}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Completed calls</p>
          </div>
        </Card>
      </div>

      {/* Call Volume Line Chart */}
      <Card className="p-6 dark:bg-slate-800/50 dark:border-slate-700/50 backdrop-blur">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={(() => {
              const logs = Array.isArray(callLogs) ? callLogs : [];
              const dailyVolume: any = {};
              const now = new Date();
              for (let i = 29; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                dailyVolume[dateKey] = 0;
              }
              logs.forEach((call: any) => {
                const date = new Date(call.createdAt);
                const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (dailyVolume.hasOwnProperty(dateKey)) {
                  dailyVolume[dateKey]++;
                }
              });
              return Object.entries(dailyVolume).map(([date, count]) => ({ date, calls: count }));
            })()} margin={{ top: 5, right: 5, left: 5, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} angle={0} textAnchor="middle" interval={4} tick={{ fontSize: 10 }} />
              <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 'dataMax + 1']} ticks={[0, 1, 2, 3, 4]} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="calls" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', strokeWidth: 1, r: 3 }} activeDot={{ r: 5, fill: '#a78bfa', stroke: '#8b5cf6', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Overall Success Rate with Agent Table and Language */}
      <Card className="p-6 dark:bg-slate-800/50 dark:border-slate-700/50 backdrop-blur">
        <div className="space-y-6">
          {/* Success Rate Chart */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-card-foreground flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500"></div>
              Overall success rate
            </h3>
            <SuccessRateChart />
          </div>

          {/* Divider */}
          <div className="border-t"></div>

          {/* Most Called Agents and Language Side by Side */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-card-foreground">Most called agents</h3>
                <button 
                  onClick={() => setLocation('/agents')}
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  See all {Array.isArray(agents) ? agents.length : 0} agents
                </button>
              </div>
              <AgentPerformanceTable />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4 text-card-foreground">Language</h3>
              <LanguageStats />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
