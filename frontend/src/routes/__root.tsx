import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { type QueryClient } from "@tanstack/react-query";
import { useAuth, useDarkMode } from "@/hooks";
import { useEffect } from "react";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { InstallPrompt } from "@/components/InstallPrompt";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize dark mode at root level so it persists across all pages
  useDarkMode();

  const isLoginPage = location.pathname === "/login";

  useEffect(() => {
    // Only redirect to login if not authenticated and not already on login page
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      navigate({ to: "/login" });
    }
  }, [isAuthenticated, isLoading, isLoginPage, navigate]);

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
