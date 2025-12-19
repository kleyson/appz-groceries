import { useState, useEffect, useCallback } from "react";
import { syncQueue } from "@/lib/sync-queue";
import { getPendingCount } from "@/lib/offline-db";

interface OnlineStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncError: string | null;
  triggerSync: () => void;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const triggerSync = useCallback(() => {
    if (isOnline) {
      syncQueue.processQueue();
    }
  }, [isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastSyncError(null);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    // Subscribe to sync events
    const unsubscribe = syncQueue.subscribe((event) => {
      switch (event.type) {
        case "sync-start":
          setIsSyncing(true);
          setLastSyncError(null);
          break;
        case "sync-complete":
          setIsSyncing(false);
          if (event.pendingCount !== undefined) {
            setPendingCount(event.pendingCount);
          }
          break;
        case "sync-error":
          setIsSyncing(false);
          setLastSyncError(event.error || "Sync failed");
          break;
        case "action-complete":
        case "action-error":
          // Update pending count after each action
          getPendingCount().then(setPendingCount);
          break;
      }
    });

    // Initial pending count
    getPendingCount().then(setPendingCount);

    // Poll pending count periodically (for actions queued elsewhere)
    const interval = setInterval(async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncError,
    triggerSync,
  };
}
