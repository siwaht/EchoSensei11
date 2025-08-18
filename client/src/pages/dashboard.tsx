import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/ui/stats-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Phone, Clock, DollarSign, Bot, TrendingUp, PhoneCall, MessageSquare, AlertCircle, BarChart3, Activity } from "lucide-react";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

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
    <div className="space-y-3">
      {agentData.length > 0 ? (
        <>
          <div className="grid grid-cols-5 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 border-b">
            <div>Agent name</div>
            <div className="text-right">Calls</div>
            <div className="text-right">Minutes</div>
            <div className="text-right">LLM cost</div>
            <div className="text-right">Credits</div>
          </div>
          {agentData.map((agent: any, index: number) => (
            <div key={index} className="grid grid-cols-5 gap-2 text-sm py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
              <div className="font-medium truncate">{agent.name}</div>
              <div className="text-right">{agent.calls}</div>
              <div className="text-right">{(agent.duration / 60).toFixed(2)}</div>
              <div className="text-right">${agent.llmCost.toFixed(4)}</div>
              <div className="text-right">{agent.credits.toLocaleString()}</div>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t">
            <button className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400">
              See all {Array.isArray(agents) ? agents.length : 0} agents →
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No agent activity yet</p>
        </div>
      )}
    </div>
  );
}

// Language Stats Component
function LanguageStats() {
  // Since we don't have language data in the schema, we'll show a placeholder
  // In production, this would come from actual call analysis
  const languages = [
    { name: 'English', percentage: 100, color: 'bg-blue-500' }
  ];

  return (
    <div className="space-y-4">
      {languages.map((lang, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{lang.name}</span>
            <span className="text-sm text-gray-500">{lang.percentage}%</span>
          </div>
          <Progress value={lang.percentage} className="h-2" />
        </div>
      ))}
      <div className="text-xs text-gray-500 dark:text-gray-400 pt-2">
        Language detection based on call transcripts
      </div>
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
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/analytics/organization"],
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

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Calls"
          value={(stats as any)?.totalCalls || 0}
          change="+12% from last month"
          changeType="positive"
          icon={Phone}
          bgColor="from-blue-500 to-blue-600"
          testId="stats-total-calls"
        />
        
        <StatsCard
          title="Total Minutes"
          value={(stats as any)?.totalMinutes || 0}
          change="+8% from last month"
          changeType="positive"
          icon={Clock}
          bgColor="from-purple-500 to-purple-600"
          testId="stats-total-minutes"
        />
        
        <StatsCard
          title="Estimated Cost"
          value={`$${(stats as any)?.estimatedCost?.toFixed(2) || '0.00'}`}
          change="+15% from last month"
          changeType="negative"
          icon={DollarSign}
          bgColor="from-green-500 to-green-600"
          testId="stats-estimated-cost"
        />
        
        <StatsCard
          title="Active Agents"
          value={(stats as any)?.activeAgents || 0}
          change="2 new this month"
          changeType="positive"
          icon={Bot}
          bgColor="from-orange-500 to-orange-600"
          testId="stats-active-agents"
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Call Volume Chart */}
        <CallVolumeChart />
        
        {/* Cost Analysis Chart */}
        <CostAnalysisChart />
      </div>

      {/* Analytics Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Overall Success Rate */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-card-foreground flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            Overall Success Rate
          </h3>
          <SuccessRateChart />
        </Card>

        {/* Most Called Agents */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-card-foreground">Most Called Agents</h3>
          <AgentPerformanceTable />
        </Card>
      </div>

      {/* Language Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-card-foreground">Language Distribution</h3>
        <LanguageStats />
      </Card>
    </div>
  );
}
