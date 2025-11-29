import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Target, Flame, BarChart3, Award } from "lucide-react";

interface LeaderboardBadgeProps {
  badgeType: string;
  className?: string;
}

export default function LeaderboardBadge({ badgeType, className = "" }: LeaderboardBadgeProps) {
  const getBadgeIcon = (type: string) => {
    if (type.startsWith('1st_place') || type.startsWith('2nd_place') || type.startsWith('3rd_place') || type.startsWith('4th_place')) {
      return <Trophy className="h-3 w-3" />;
    }
    
    switch (type) {
      case 'starter':
        return <Star className="h-3 w-3" />;
      case 'streak_3':
      case 'streak_5':
      case 'streak_10':
        return <Flame className="h-3 w-3" />;
      case 'accuracy_70':
      case 'accuracy_80':
      case 'accuracy_90':
        return <Target className="h-3 w-3" />;
      case 'volume_10':
      case 'volume_25':
      case 'volume_50':
      case 'volume_100':
        return <BarChart3 className="h-3 w-3" />;
      default:
        return <Award className="h-3 w-3" />;
    }
  };

  const getBadgeColor = (type: string) => {
    if (type.startsWith('1st_place')) return 'text-yellow-500';
    if (type.startsWith('2nd_place')) return 'text-gray-400';
    if (type.startsWith('3rd_place')) return 'text-amber-600';
    if (type.startsWith('4th_place')) return 'text-orange-500';
    
    switch (type) {
      case 'starter':
        return 'text-blue-500';
      case 'streak_3':
      case 'streak_5':
      case 'streak_10':
        return 'text-orange-500';
      case 'accuracy_70':
      case 'accuracy_80':
      case 'accuracy_90':
        return 'text-green-500';
      case 'volume_10':
      case 'volume_25':
      case 'volume_50':
      case 'volume_100':
        return 'text-purple-500';
      default:
        return 'text-gray-500';
    }
  };

  const getBadgeVariant = (type: string) => {
    if (type.startsWith('1st_place')) return 'default';
    if (type.startsWith('2nd_place')) return 'secondary';
    if (type.startsWith('3rd_place')) return 'outline';
    if (type.startsWith('4th_place')) return 'outline';
    
    switch (type) {
      case 'starter':
        return 'default';
      case 'streak_3':
      case 'streak_5':
      case 'streak_10':
        return 'destructive';
      case 'accuracy_70':
      case 'accuracy_80':
      case 'accuracy_90':
        return 'default';
      case 'volume_10':
      case 'volume_25':
      case 'volume_50':
      case 'volume_100':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatBadgeName = (type: string) => {
    if (type.startsWith('1st_place')) return '1st Place';
    if (type.startsWith('2nd_place')) return '2nd Place';
    if (type.startsWith('3rd_place')) return '3rd Place';
    if (type.startsWith('4th_place')) return '4th Place';
    
    switch (type) {
      case 'starter':
        return 'Starter';
      case 'streak_3':
        return 'Streak 3';
      case 'streak_5':
        return 'Streak 5';
      case 'streak_10':
        return 'Streak 10';
      case 'accuracy_70':
        return 'Accuracy 70%';
      case 'accuracy_80':
        return 'Accuracy 80%';
      case 'accuracy_90':
        return 'Accuracy 90%';
      case 'volume_10':
        return 'Volume 10';
      case 'volume_25':
        return 'Volume 25';
      case 'volume_50':
        return 'Volume 50';
      case 'volume_100':
        return 'Volume 100';
      default:
        return type;
    }
  };

  return (
    <Badge 
      variant={getBadgeVariant(badgeType) as any}
      className={`flex items-center gap-1 text-xs ${getBadgeColor(badgeType)} ${className}`}
    >
      {getBadgeIcon(badgeType)}
      {formatBadgeName(badgeType)}
    </Badge>
  );
}
