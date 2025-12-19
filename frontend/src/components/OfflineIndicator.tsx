import { WifiOff, Loader2, Check, AlertCircle } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, lastSyncError } =
    useOnlineStatus();

  // Don't show anything if online with no pending items
  if (isOnline && pendingCount === 0 && !isSyncing && !lastSyncError) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full",
        "text-sm font-medium shadow-lg animate-slide-up z-50",
        "transition-colors duration-200",
        lastSyncError
          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
          : isSyncing
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
            : isOnline && pendingCount === 0
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
              : !isOnline
                ? "bg-slate-800 text-white dark:bg-slate-700"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
      )}
      role="status"
      aria-live="polite"
    >
      {lastSyncError ? (
        <span className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Sync failed
        </span>
      ) : isSyncing ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Syncing {pendingCount} {pendingCount === 1 ? "change" : "changes"}...
        </span>
      ) : isOnline && pendingCount === 0 ? (
        <span className="flex items-center gap-2">
          <Check className="w-4 h-4" />
          All synced
        </span>
      ) : isOnline && pendingCount > 0 ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {pendingCount} pending {pendingCount === 1 ? "change" : "changes"}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          You're offline
        </span>
      )}
    </div>
  );
}
