import { useCountdown } from '@/hooks/useCountdown';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  deadline: string | null;
  className?: string;
}

export function CountdownTimer({ deadline, className = '' }: CountdownTimerProps) {
  const { days, hours, minutes, isExpired } = useCountdown(deadline);

  if (!deadline || isExpired) {
    return null;
  }

  const formatTime = (value: number, unit: string) => {
    if (value === 0) return null;
    return `${value}${unit}`;
  };

  const timeParts = [
    formatTime(days, 'd'),
    formatTime(hours, 'h'),
    formatTime(minutes, 'm')
  ].filter(Boolean);

  if (timeParts.length === 0) {
    return (
      <div className={`flex items-center text-xs text-gray-500 ${className}`}>
        <Clock className="w-3 h-3 mr-1" />
        <span>Less than 1m left</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center text-xs text-gray-500 ${className}`}>
      <Clock className="w-3 h-3 mr-1" />
      <span>{timeParts.join(' ')} left</span>
    </div>
  );
}