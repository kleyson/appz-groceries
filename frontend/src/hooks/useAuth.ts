import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { clearAllData } from "@/lib/offline-db";
import { syncQueue } from "@/lib/sync-queue";
import type { User, AuthResponse } from "@/types";

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
        if (!navigator.onLine) {
          const cached = getCachedAuth();
          if (cached) {
            return cached;
          }
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Use cached data as placeholder while loading
    placeholderData: () => getCachedAuth(),
  });

  const { data: canRegisterData } = useQuery({
    queryKey: ["auth", "can-register"],
    queryFn: () => api.canRegister(),
    retry: false,
    staleTime: 60 * 1000, // 1 minute
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

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    canRegister,
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
