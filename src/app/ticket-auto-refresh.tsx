"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

type TicketAutoRefreshProps = {
  enabled: boolean;
  intervalMs?: number;
};

export function TicketAutoRefresh({ enabled, intervalMs = 2500 }: TicketAutoRefreshProps) {
  const router = useRouter();
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setRefreshCount(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
      setRefreshCount((count) => count + 1);
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs, router]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="polling-banner" aria-live="polite">
      <LoaderCircle className="spin" size={16} />
      <span>Watching worker progress. Auto-refreshing every {Math.round(intervalMs / 1000)}s.</span>
      <strong>{refreshCount} refreshes</strong>
    </div>
  );
}
