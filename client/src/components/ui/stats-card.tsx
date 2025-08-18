import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  testId?: string;
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  changeType = "neutral", 
  icon: Icon, 
  iconColor = "text-primary-600",
  testId
}: StatsCardProps) {
  return (
    <Card className="p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400" data-testid={`${testId}-title`}>
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white" data-testid={`${testId}-value`}>
            {value}
          </p>
          {change && (
            <p className={cn(
              "text-sm",
              changeType === "positive" && "text-green-600 dark:text-green-400",
              changeType === "negative" && "text-red-600 dark:text-red-400",
              changeType === "neutral" && "text-gray-600 dark:text-gray-400"
            )} data-testid={`${testId}-change`}>
              {change}
            </p>
          )}
        </div>
        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
          <Icon className={cn("w-6 h-6", iconColor)} />
        </div>
      </div>
    </Card>
  );
}
