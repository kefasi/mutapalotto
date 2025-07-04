import { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

interface CountdownProps {
  targetDate: string;
  type: 'daily' | 'weekly';
  jackpot: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function DynamicCountdown({ targetDate, type, jackpot }: CountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeRemaining({ days, hours, minutes, seconds });
        setIsExpired(false);
      } else {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsExpired(true);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  const formatTimeUnit = (value: number, unit: string) => {
    return (
      <div className="text-center">
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[60px]">
          <div className="text-2xl font-bold text-green-800">
            {value.toString().padStart(2, '0')}
          </div>
          <div className="text-xs text-gray-600 uppercase font-medium">
            {unit}
          </div>
        </div>
      </div>
    );
  };

  if (isExpired) {
    return (
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-xl text-center">
        <Clock className="w-8 h-8 mx-auto mb-2" />
        <h3 className="text-lg font-bold">Draw in Progress</h3>
        <p className="text-sm opacity-90">Ticket sales closed</p>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-xl ${type === 'daily' ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-purple-500 to-purple-600'} text-white`}>
      <div className="text-center mb-4">
        <div className="flex items-center justify-center mb-2">
          <Calendar className="w-5 h-5 mr-2" />
          <h3 className="text-lg font-bold">
            Next {type === 'daily' ? 'Daily' : 'Weekly'} Draw
          </h3>
        </div>
        <p className="text-sm opacity-90">
          Jackpot: ${parseFloat(jackpot).toLocaleString()}
        </p>
        <p className="text-xs opacity-75">
          {new Date(targetDate).toLocaleDateString('en-ZW', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
      
      <div className="flex justify-center space-x-4">
        {timeRemaining.days > 0 && formatTimeUnit(timeRemaining.days, 'Days')}
        {formatTimeUnit(timeRemaining.hours, 'Hours')}
        {formatTimeUnit(timeRemaining.minutes, 'Mins')}
        {formatTimeUnit(timeRemaining.seconds, 'Secs')}
      </div>
    </div>
  );
}