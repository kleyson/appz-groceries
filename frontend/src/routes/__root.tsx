import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { type QueryClient } from "@tanstack/react-query";
import { useAuth, useDarkMode } from "@/hooks";
import { useEffect, useState } from "react";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { InstallPrompt } from "@/components/InstallPrompt";
import { WifiOff, RefreshCw } from "lucide-react";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const { isAuthenticated, isLoading, isBackendUnavailable, retryConnection } =
    useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRetrying, setIsRetrying] = useState(false);

  // Initialize dark mode at root level so it persists across all pages
  useDarkMode();

  const isLoginPage = location.pathname === "/login";

  useEffect(() => {
    // Only redirect to login if not authenticated, not loading, backend is available, and not already on login page
    if (
      !isLoading &&
      !isAuthenticated &&
      !isBackendUnavailable &&
      !isLoginPage
    ) {
      navigate({ to: "/login" });
    }
  }, [isAuthenticated, isLoading, isBackendUnavailable, isLoginPage, navigate]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryConnection();
    } finally {
      setIsRetrying(false);
    }
  };

  // Show backend unavailable error state
  if (isBackendUnavailable && !isLoginPage) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Server Unavailable
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Unable to connect to the server. Please check your connection and
            try again.
          </p>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <RefreshCw
              className={`w-5 h-5 ${isRetrying ? "animate-spin" : ""}`}
            />
            {isRetrying ? "Retrying..." : "Retry Connection"}
          </button>
        </div>
      </div>
    );
  }

  // Show loading spinner only for protected routes (not login page)
  if (isLoading && !isLoginPage) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="animate-pulse text-primary-600">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Outlet />
      <OfflineIndicator />
      <InstallPrompt />
    </div>
  );
}
