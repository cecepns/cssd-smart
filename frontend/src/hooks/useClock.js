import { useEffect, useState } from 'react';
import { formatClock } from '@/utils/format';

export default function useClock(intervalMs = 30000) {
  const [now, setNow] = useState(() => formatClock());

  useEffect(() => {
    const timer = setInterval(() => setNow(formatClock()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
