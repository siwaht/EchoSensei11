import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/ui/stats-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock, DollarSign, Bot, TrendingUp, PhoneCall, MessageSquare, AlertCircle } from "lucide-react";

// Recent Activity Component
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
          value={stats?.totalCalls || 0}
          change="+12% from last month"
          changeType="positive"
          icon={Phone}
          bgColor="from-blue-500 to-blue-600"
          testId="stats-total-calls"
        />
        
        <StatsCard
          title="Total Minutes"
          value={stats?.totalMinutes || 0}
          change="+8% from last month"
          changeType="positive"
          icon={Clock}
          bgColor="from-purple-500 to-purple-600"
          testId="stats-total-minutes"
        />
        
        <StatsCard
          title="Estimated Cost"
          value={`$${stats?.estimatedCost?.toFixed(2) || '0.00'}`}
          change="+15% from last month"
          changeType="negative"
          icon={DollarSign}
          bgColor="from-green-500 to-green-600"
          testId="stats-estimated-cost"
        />
        
        <StatsCard
          title="Active Agents"
          value={stats?.activeAgents || 0}
          change="2 new this month"
          changeType="positive"
          icon={Bot}
          bgColor="from-orange-500 to-orange-600"
          testId="stats-active-agents"
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Usage Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-card-foreground" data-testid="text-chart-title-usage">Daily Call Volume</h3>
          <div className="h-64 flex items-center justify-center bg-muted/20 rounded-lg">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-2" />
              <p data-testid="text-chart-placeholder">Interactive chart will be rendered here</p>
              <p className="text-sm">Using Recharts library</p>
            </div>
          </div>
        </Card>


      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-card-foreground" data-testid="text-activity-title">Recent Activity</h3>
        <RecentActivity />
      </Card>
    </div>
  );
}
