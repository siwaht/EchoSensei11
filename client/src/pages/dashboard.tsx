import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/ui/stats-card";
import { Card } from "@/components/ui/card";
import { Phone, Clock, DollarSign, Bot, TrendingUp, Plus, Settings, History, CreditCard } from "lucide-react";

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

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-card-foreground" data-testid="text-actions-title">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-4 bg-primary/10 hover:bg-primary/20 rounded-xl text-primary font-medium transition-colors flex items-center justify-center space-x-2" data-testid="button-add-agent">
              <Plus className="w-5 h-5" />
              <span>Add Agent</span>
            </button>
            <button className="p-4 bg-green-500/10 hover:bg-green-500/20 rounded-xl text-green-500 font-medium transition-colors flex items-center justify-center space-x-2" data-testid="button-view-integrations">
              <Settings className="w-5 h-5" />
              <span>Integrations</span>
            </button>
            <button className="p-4 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl text-purple-500 font-medium transition-colors flex items-center justify-center space-x-2" data-testid="button-view-history">
              <History className="w-5 h-5" />
              <span>Call History</span>
            </button>
            <button className="p-4 bg-orange-500/10 hover:bg-orange-500/20 rounded-xl text-orange-500 font-medium transition-colors flex items-center justify-center space-x-2" data-testid="button-view-billing">
              <CreditCard className="w-5 h-5" />
              <span>Billing</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-card-foreground" data-testid="text-activity-title">Recent Activity</h3>
        <div className="space-y-3">
          <div className="text-center text-muted-foreground py-8">
            <p data-testid="text-activity-placeholder">Recent activity will be displayed here</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
