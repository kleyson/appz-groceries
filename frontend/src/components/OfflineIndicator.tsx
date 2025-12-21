import { WifiOff, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import { useLocation } from "@tanstack/react-router";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const location = useLocation();
  const { isOnline, pendingCount, isSyncing, lastSyncError, triggerSync } =
    useOnlineStatus();

  const isLoginPage = location.pathname === "/login";

  // Don't show offline banner on login page (it has its own)
  // Don't show anything if online with no pending items
  if (isOnline && pendingCount === 0 && !isSyncing && !lastSyncError) {
    return null;
  }

  // Offline state - show prominent top banner (except on login page)
  if (!isOnline && !isLoginPage) {
    return (
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-50",
          "bg-slate-900 dark:bg-slate-800 text-white",
          "animate-slide-down",
          "motion-reduce:animate-none",
        )}
        role="status"
        aria-live="polite"
      >
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium text-sm">You're offline</p>
                <p className="text-xs text-slate-300">
                  {pendingCount > 0
                    ? `${pendingCount} ${pendingCount === 1 ? "change" : "changes"} waiting to sync`
                    : "Changes will sync when you reconnect"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't show sync status on login page
  if (isLoginPage) {
    return null;
  }

  // Online with sync status - floating pill
  return (
    <div
      className={cn(
        "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
        "px-4 py-2 rounded-full shadow-lg",
        "text-sm font-medium",
        "animate-slide-up motion-reduce:animate-none",
        "transition-colors duration-200",
        lastSyncError
          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
          : isSyncing
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
            : pendingCount === 0
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
      )}
      role="status"
      aria-live="polite"
    >
      {lastSyncError ? (
        <button
          onClick={triggerSync}
          className="flex items-center gap-2 cursor-pointer min-h-[44px] -my-2"
          aria-label="Retry sync"
        >
          <AlertCircle className="w-4 h-4" />
          <span>Sync failed</span>
          <RefreshCw className="w-3.5 h-3.5 ml-1" />
        </button>
      ) : isSyncing ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Syncing {pendingCount} {pendingCount === 1 ? "change" : "changes"}...
        </span>
      ) : pendingCount === 0 ? (
        <span className="flex items-center gap-2">
          <Check className="w-4 h-4" />
          All synced
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {pendingCount} pending {pendingCount === 1 ? "change" : "changes"}
        </span>
      )}
    </div>
  );
}
