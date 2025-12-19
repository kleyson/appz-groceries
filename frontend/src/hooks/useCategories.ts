import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import * as offlineDB from "@/lib/offline-db";
import type { Category } from "@/types";

export function useCategories() {
  const queryClient = useQueryClient();
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const {
    data: categories = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      if (!isOnline) {
        return offlineDB.getCategories();
      }

      try {
        const categories = await api.getCategories();
        // Cache for offline use
        await offlineDB.setCategories(categories);
        return categories;
      } catch (err) {
        // On network error, try offline cache
        if (err instanceof TypeError && err.message.includes("fetch")) {
          return offlineDB.getCategories();
        }
        throw err;
      }
    },
    staleTime: isOnline ? 5 * 60_000 : Infinity, // Categories don't change often
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; icon: string; color: string }) =>
      api.createCategory(data),
    onSuccess: async (newCategory) => {
      // Update offline cache
      const currentCategories = await offlineDB.getCategories();
      await offlineDB.setCategories([...currentCategories, newCategory]);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["categories"] });
      const previousCategories = queryClient.getQueryData<Category[]>([
        "categories",
      ]);

      queryClient.setQueryData<Category[]>(["categories"], (old) =>
        (old || []).filter((cat) => cat.id !== id),
      );

      return { previousCategories };
    },
    onError: (_err, _id, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories"], context.previousCategories);
      }
    },
    onSuccess: async () => {
      // Update offline cache with current state
      const current = queryClient.getQueryData<Category[]>(["categories"]);
      if (current) {
        await offlineDB.setCategories(current);
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["categories"] });
      }
    },
  });

  const getCategoryById = (id: string) => {
    return categories.find((cat) => cat.id === id);
  };

  return {
    categories,
    isLoading,
    error,
    getCategoryById,
    createCategory: createMutation.mutateAsync,
    deleteCategory: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
