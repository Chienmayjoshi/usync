import { useEffect, useState } from 'react';

/** The time, refreshed every few minutes: enough for nudges counted in days. */
export function useNow(everyMs = 5 * 60_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
