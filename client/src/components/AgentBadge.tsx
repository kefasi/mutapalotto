import { Badge } from "@/components/ui/badge";
import { Shield, Star } from "lucide-react";
import { User } from "@shared/schema";

interface AgentBadgeProps {
  user: User;
  size?: "sm" | "md" | "lg";
}

export function AgentBadge({ user, size = "md" }: AgentBadgeProps) {
  if (!user.isAgent) return null;

  const badgeSize = {
    sm: "h-6 px-2 text-xs",
    md: "h-7 px-3 text-sm", 
    lg: "h-8 px-4 text-base"
  }[size];

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16
  }[size];

  return (
    <Badge 
      variant="outline" 
      className={`${badgeSize} bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300 text-amber-800 font-medium flex items-center gap-1.5`}
    >
      <Shield size={iconSize} className="text-amber-600" />
      <span>Verified Agent</span>
      <div className="flex">
        {[1, 2, 3].map((star) => (
          <Star key={star} size={iconSize - 2} className="text-amber-500 fill-amber-400" />
        ))}
      </div>
    </Badge>
  );
}

export function AgentCodeDisplay({ user, className = "" }: { user: User; className?: string }) {
  if (!user.isAgent || !user.agentCode) return null;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="text-sm text-gray-600">Agent Code:</span>
      <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-800">
        {user.agentCode}
      </code>
    </div>
  );
}