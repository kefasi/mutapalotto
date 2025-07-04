import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Clock, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DrawInfo {
  id: number;
  type: 'daily' | 'weekly';
  drawDate: string;
  jackpotAmount: string;
  totalTickets: number;
  isComplete: boolean;
}

interface UpcomingDraws {
  daily?: DrawInfo;
  weekly?: DrawInfo;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function NextDrawCountdown() {
  const [upcomingDraws, setUpcomingDraws] = useState<UpcomingDraws | null>(null);
  const [nextDraw, setNextDraw] = useState<DrawInfo | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Calculate time remaining until a given date
  const calculateTimeRemaining = (targetDate: string): TimeRemaining => {
    const now = new Date().getTime();
    const target = new Date(targetDate).getTime();
    const difference = target - now;

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  };

  // Determine which draw is next (closest to current time)
  const getNextDraw = (draws: UpcomingDraws): DrawInfo | null => {
    const now = new Date().getTime();
    const dailyTime = draws.daily ? new Date(draws.daily.drawDate).getTime() : Infinity;
    const weeklyTime = draws.weekly ? new Date(draws.weekly.drawDate).getTime() : Infinity;

    // Return the draw that's closest to now and in the future
    if (dailyTime > now && (dailyTime < weeklyTime || weeklyTime <= now)) {
      return draws.daily!;
    } else if (weeklyTime > now) {
      return draws.weekly!;
    }
    return null;
  };

  useEffect(() => {
    const fetchUpcomingDraws = async () => {
      try {
        const response = await fetch('/api/draws/upcoming');
        if (response.ok) {
          const data = await response.json();
          setUpcomingDraws(data);
          const next = getNextDraw(data);
          setNextDraw(next);
        }
      } catch (error) {
        console.error('Failed to fetch upcoming draws:', error);
      }
    };

    fetchUpcomingDraws();
    const interval = setInterval(fetchUpcomingDraws, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!nextDraw) return;

    const updateCountdown = () => {
      const remaining = calculateTimeRemaining(nextDraw.drawDate);
      setTimeRemaining(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextDraw]);

  // Format time remaining for display
  const formatTimeRemaining = (time: TimeRemaining): string => {
    const parts = [];
    
    if (time.days > 0) {
      parts.push(`${time.days}d`);
    }
    if (time.hours > 0) {
      parts.push(`${time.hours}h`);
    }
    if (time.minutes > 0) {
      parts.push(`${time.minutes}m`);
    }
    if (time.days === 0 && time.hours === 0) {
      parts.push(`${time.seconds}s`);
    }

    return parts.join(' ') || 'Starting soon...';
  };

  if (!nextDraw) {
    return (
      <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
        <CardContent className="p-4">
          <div className="text-center text-gray-600">
            <Clock className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
            <p>Loading next draw...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isDaily = nextDraw.type === 'daily';
  const gradientClass = isDaily 
    ? 'from-blue-50 to-indigo-50 border-blue-200' 
    : 'from-purple-50 to-pink-50 border-purple-200';
  const badgeClass = isDaily ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  const iconColor = isDaily ? 'text-blue-600' : 'text-purple-600';

  return (
    <Card className={`bg-gradient-to-br ${gradientClass}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">
            Next Draw
          </CardTitle>
          <Badge className={badgeClass}>
            {isDaily ? 'Daily' : 'Weekly'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center space-x-2">
          <CalendarDays className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-medium">
            {new Date(nextDraw.drawDate).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Clock className={`h-4 w-4 ${iconColor}`} />
          <span className="text-lg font-bold text-gray-900">
            {formatTimeRemaining(timeRemaining)}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <DollarSign className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm">
            Jackpot: <span className="font-bold text-green-600">${parseFloat(nextDraw.jackpotAmount).toLocaleString()}</span>
          </span>
        </div>
        
        <div className="text-xs text-gray-600 pt-2 border-t border-gray-200">
          {isDaily 
            ? 'Daily draws: Monday-Friday at 6:00 PM (Zimbabwe time)' 
            : 'Weekly draws: Sunday at 8:00 PM (Zimbabwe time)'
          }
        </div>
      </CardContent>
    </Card>
  );
}