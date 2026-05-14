import { useState, useEffect } from 'react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface RealTimeClock {
  now: Date;
  dayName: string;   // e.g. "Monday"
  timeLabel: string; // e.g. "14:30"
}

export function useRealTime(interval: number = 30000) {
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdate(new Date());
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  return lastUpdate;
}

/** Ticks every 60 seconds, exposes day + HH:MM for occupancy checks. */
export function useRealTimeClock(): RealTimeClock {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Align to next full minute
    const ms = 60_000 - (Date.now() % 60_000);
    const initial = setTimeout(() => {
      setNow(new Date());
      const timer = setInterval(() => setNow(new Date()), 60_000);
      return () => clearInterval(timer);
    }, ms);
    return () => clearTimeout(initial);
  }, []);

  const dayName = DAY_NAMES[now.getDay()];
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const timeLabel = `${h}:${m}`;

  return { now, dayName, timeLabel };
}

export function useLiveStatus() {
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    // Simulate connection checks
    const checkConnection = () => {
      // In a real app, this would check WebSocket connection
      setIsLive(Math.random() > 0.1); // 90% uptime simulation
    };

    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  return isLive;
}
