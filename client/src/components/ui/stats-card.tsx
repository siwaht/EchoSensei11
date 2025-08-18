import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  bgColor?: string;
  iconColor?: string;
  testId?: string;
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  changeType = "neutral", 
  icon: Icon, 
  bgColor = "from-blue-500 to-blue-600",
  iconColor = "text-white",
  testId
}: StatsCardProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden border-0 text-white shadow-lg",
      `bg-gradient-to-br ${bgColor}`
    )}>
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="relative p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-white/80 mb-1" data-testid={`${testId}-title`}>
              {title}
            </p>
            <p className="text-3xl font-bold text-white mb-2" data-testid={`${testId}-value`}>
              {value}
            </p>
            {change && (
              <p className={cn(
                "text-sm font-medium",
                changeType === "positive" && "text-green-200",
                changeType === "negative" && "text-red-200",
                changeType === "neutral" && "text-white/70"
              )} data-testid={`${testId}-change`}>
                {change}
              </p>
            )}
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
        </div>
      </div>
    </Card>
  );
}
