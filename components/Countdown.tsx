"use client";

import { useEffect, useState } from "react";

interface Props {
  target: Date | string;
}

/**
 * Live countdown that ticks once a minute.
 */
export function Countdown({ target }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const targetMs =
      typeof target === "string"
        ? new Date(target).getTime()
        : target.getTime();
    const tick = () => setRemaining(targetMs - Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining === null) {
    return <span className="font-mono text-ink">…</span>;
  }
  if (remaining <= 0) {
    return <span className="font-mono">closed</span>;
  }

  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const display =
    days > 0
      ? `${days}d ${hours}h`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;

  return <span className="font-mono text-ink">{display}</span>;
}
