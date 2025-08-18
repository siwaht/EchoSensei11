import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/ui/stats-card";
import { Card } from "@/components/ui/card";
import { Phone, Clock, DollarSign, Bot, TrendingUp } from "lucide-react";

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
          testId="stats-total-calls"
        />
        
        <StatsCard
          title="Total Minutes"
          value={stats?.totalMinutes || 0}
          change="+8% from last month"
          changeType="positive"
          icon={Clock}
          iconColor="text-purple-600"
          testId="stats-total-minutes"
        />
        
        <StatsCard
          title="Estimated Cost"
          value={`$${stats?.estimatedCost?.toFixed(2) || '0.00'}`}
          change="+15% from last month"
          changeType="negative"
          icon={DollarSign}
          iconColor="text-green-600"
          testId="stats-estimated-cost"
        />
        
        <StatsCard
          title="Active Agents"
          value={stats?.activeAgents || 0}
          change="2 new this month"
          changeType="positive"
          icon={Bot}
          iconColor="text-orange-600"
          testId="stats-active-agents"
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Usage Chart */}
        <Card className="p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4" data-testid="text-chart-title-usage">Daily Call Volume</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <TrendingUp className="w-12 h-12 mx-auto mb-2" />
              <p data-testid="text-chart-placeholder">Interactive chart will be rendered here</p>
              <p className="text-sm">Using Recharts library</p>
            </div>
          </div>
        </Card>

        {/* Agent Performance */}
        <Card className="p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4" data-testid="text-agents-title">Top Performing Agents</h3>
          <div className="space-y-4">
            {/* This would be populated from real agent data */}
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <p data-testid="text-agents-placeholder">Agent performance data will be displayed here</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4" data-testid="text-activity-title">Recent Activity</h3>
        <div className="space-y-3">
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p data-testid="text-activity-placeholder">Recent activity will be displayed here</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
