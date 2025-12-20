import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { clearAllData } from "@/lib/offline-db";
import { syncQueue } from "@/lib/sync-queue";
import type { User } from "@/types";

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: authData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.me(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
      // Clear offline data first
      await clearAllData();
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
