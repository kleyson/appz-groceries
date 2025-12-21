import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { clearAllData } from "@/lib/offline-db";
import { syncQueue } from "@/lib/sync-queue";
import type { User, AuthResponse } from "@/types";

// Type guards for error checking (works better with mocks than instanceof)
function isNetworkError(err: unknown): boolean {
  return err instanceof Error && err.name === "NetworkError";
}

function isAPIError(err: unknown): err is Error & {
  status: number;
  isUnauthorized: boolean;
  isServerError: boolean;
} {
  return err instanceof Error && err.name === "APIError" && "status" in err;
}

function isUnauthorizedError(err: unknown): boolean {
  if (isAPIError(err)) {
    return err.isUnauthorized;
  }
  return false;
}

function isServerError(err: unknown): boolean {
  if (isAPIError(err)) {
    return err.isServerError;
  }
  return false;
}

const AUTH_CACHE_KEY = "groceries_auth_cache";

function getCachedAuth(): AuthResponse | undefined {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Invalid cache, ignore
  }
  return undefined;
}

function setCachedAuth(auth: AuthResponse | null): void {
  if (auth) {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(auth));
  } else {
    localStorage.removeItem(AUTH_CACHE_KEY);
  }
}

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: authData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const result = await api.me();
        // Cache successful auth for offline use
        setCachedAuth(result);
        return result;
      } catch (err) {
        // If offline and we have cached auth, use it
        if (isNetworkError(err)) {
          const cached = getCachedAuth();
          if (cached) {
            return cached;
          }
        }
        throw err;
      }
    },
    // Only retry on network errors, not on 401 (which is expected when not logged in)
    retry: (failureCount, err) => {
      if (isUnauthorizedError(err)) return false;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Use cached data as placeholder while loading
    placeholderData: () => getCachedAuth(),
    // Don't refetch automatically when there's an error
    refetchOnWindowFocus: (query) => query.state.status !== "error",
  });

  const { data: canRegisterData, refetch: refetchCanRegister } = useQuery({
    queryKey: ["auth", "can-register"],
    queryFn: () => api.canRegister(),
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: (query) => query.state.status !== "error",
  });

  const loginMutation = useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      api.login(data),
    onSuccess: async (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      queryClient.invalidateQueries({ queryKey: ["auth", "can-register"] });
      // Clear any stale offline data and refetch from server
      await clearAllData();
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      // Process any pending sync actions
      syncQueue.processQueue();
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: { username: string; name: string; password: string }) =>
      api.register(data),
    onSuccess: async (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      queryClient.invalidateQueries({ queryKey: ["auth", "can-register"] });
      // Clear any stale offline data and refetch from server
      await clearAllData();
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: async () => {
      // Clear offline data and auth cache
      await clearAllData();
      setCachedAuth(null);
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.clear();
    },
  });

  const user: User | null = authData?.user ?? null;
  const isAuthenticated = !!user;
  const canRegister = canRegisterData?.canRegister ?? false;

  // Backend is unavailable only for network errors or server errors (5xx)
  // A 401 means the server is working fine, user just isn't logged in
  const isBackendUnavailable =
    !!error && !authData && (isNetworkError(error) || isServerError(error));

  const retryConnection = async () => {
    await refetch();
    await refetchCanRegister();
  };

  return {
    user,
    isAuthenticated,
    isLoading: isLoading || isRefetching,
    error,
    canRegister,
    isBackendUnavailable,
    retryConnection,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
}
