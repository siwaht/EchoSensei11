import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, DollarSign, Crown, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

export default function Billing() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/analytics/organization"],
  });

  // Define plan limits based on current plan
  const planLimits = {
    calls: 1000,
    minutes: 5000,
  };

  // Calculate usage percentages
  const callsUsagePercent = Math.min(((stats as any)?.totalCalls || 0) / planLimits.calls * 100, 100);
  const minutesUsagePercent = Math.min(((stats as any)?.totalMinutes || 0) / planLimits.minutes * 100, 100);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-page-title">
          Billing & Usage
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400" data-testid="text-page-description">
          Track your usage and manage billing information
        </p>
      </div>

      {/* Current Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" data-testid="text-current-month-title">Current Month</h3>
            <Calendar className="w-5 h-5 text-primary-600" />
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Total Calls</span>
                <span className="font-medium" data-testid="text-current-calls">
                  {(stats as any)?.totalCalls || 0} / {planLimits.calls}
                </span>
              </div>
              <Progress 
                value={callsUsagePercent} 
                className="h-2" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                {callsUsagePercent.toFixed(1)}% of monthly limit
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Minutes Used</span>
                <span className="font-medium" data-testid="text-current-minutes">
                  {Math.round((stats as any)?.totalMinutes || 0)} / {planLimits.minutes}
                </span>
              </div>
              <Progress 
                value={minutesUsagePercent} 
                className="h-2" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                {minutesUsagePercent.toFixed(1)}% of monthly limit
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" data-testid="text-estimated-cost-title">Estimated Cost</h3>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-estimated-cost-value">
            ${(stats as any)?.estimatedCost?.toFixed(2) || '0.00'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Based on actual API usage
          </div>
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Base Plan</span>
              <span>$49.00</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Usage Charges</span>
              <span>${((stats as any)?.estimatedCost || 0).toFixed(2)}</span>
            </div>
            <div className="border-t pt-1 flex justify-between text-sm font-medium">
              <span>Total</span>
              <span>${(49 + ((stats as any)?.estimatedCost || 0)).toFixed(2)}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" data-testid="text-plan-status-title">Plan Status</h3>
            <Crown className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="text-lg font-semibold mb-2" data-testid="text-plan-name">Pro Plan</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4" data-testid="text-plan-price">
            $49/month + usage
          </div>
          <Button 
            className="w-full" 
            data-testid="button-manage-plan"
            onClick={() => setLocation("/checkout")}
          >
            Manage Plan
          </Button>
        </Card>
      </div>

      {/* Usage History Chart */}
      <Card className="p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4" data-testid="text-usage-history-title">Usage History</h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-2" />
            <p data-testid="text-usage-chart-placeholder">Monthly usage chart will be rendered here</p>
            <p className="text-sm">Using Recharts library</p>
          </div>
        </div>
      </Card>

      {/* Billing History */}
      <Card className="border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold" data-testid="text-billing-history-title">Billing History</h3>
        </div>
        <div className="text-center py-12">
          <DollarSign className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2" data-testid="text-no-billing-title">
            No billing history yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400" data-testid="text-no-billing-description">
            Your billing history will appear here once you start using the service.
          </p>
        </div>
      </Card>
    </div>
  );
}
