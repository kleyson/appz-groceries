import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
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
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      queryClient.invalidateQueries({ queryKey: ["auth", "can-register"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: { username: string; name: string; password: string }) =>
      api.register(data),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      queryClient.invalidateQueries({ queryKey: ["auth", "can-register"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
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
