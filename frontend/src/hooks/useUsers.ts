import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { User } from "@/types";

export function useUsers() {
  const queryClient = useQueryClient();

  const {
    data: usersData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(),
    retry: false,
  });

  const createUserMutation = useMutation({
    mutationFn: (data: { username: string; name: string; password: string }) =>
      api.createUser(data),
    onSuccess: (newUser) => {
      queryClient.setQueryData(
        ["users"],
        (old: { users: User[] } | undefined) => {
          if (!old) return { users: [newUser] };
          return { users: [...old.users, newUser] };
        },
      );
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(
        ["users"],
        (old: { users: User[] } | undefined) => {
          if (!old) return { users: [] };
          return { users: old.users.filter((u) => u.id !== deletedId) };
        },
      );
    },
  });

  const users: User[] = usersData?.users ?? [];

  return {
    users,
    isLoading,
    error,
    createUser: createUserMutation.mutateAsync,
    deleteUser: deleteUserMutation.mutateAsync,
    isCreating: createUserMutation.isPending,
    isDeleting: deleteUserMutation.isPending,
    createError: createUserMutation.error,
    deleteError: deleteUserMutation.error,
  };
}
