import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ulid } from "ulid";
import { api } from "@/api/client";
import { syncQueue } from "@/lib/sync-queue";
import * as offlineDB from "@/lib/offline-db";
import type { ListWithCounts } from "@/types";

export function useLists() {
  const queryClient = useQueryClient();
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const {
    data: lists = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["lists"],
    queryFn: async () => {
      if (!isOnline) {
        // Return cached data when offline
        return offlineDB.getLists();
      }

      try {
        const lists = await api.getLists();
        // Cache for offline use
        await offlineDB.setLists(lists);
        return lists;
      } catch (err) {
        // On network error, try offline cache
        if (err instanceof TypeError && err.message.includes("fetch")) {
          return offlineDB.getLists();
        }
        throw err;
      }
    },
    staleTime: isOnline ? 60_000 : Infinity, // Never stale when offline
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const optimisticList: ListWithCounts = {
        id: ulid(),
        name,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalItems: 0,
        checkedItems: 0,
        totalPrice: 0,
      };

      if (!navigator.onLine) {
        // Queue for later sync
        await syncQueue.enqueue("list.create", "/api/lists", "POST", { name });
        // Store optimistic version
        await offlineDB.addList(optimisticList);
        return optimisticList;
      }

      return api.createList(name);
    },
    onMutate: async (name: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["lists"] });

      // Snapshot previous value
      const previousLists = queryClient.getQueryData<ListWithCounts[]>([
        "lists",
      ]);

      // Optimistically update
      const optimisticList: ListWithCounts = {
        id: ulid(),
        name,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalItems: 0,
        checkedItems: 0,
        totalPrice: 0,
      };

      queryClient.setQueryData<ListWithCounts[]>(["lists"], (old) => [
        optimisticList,
        ...(old || []),
      ]);

      return { previousLists, optimisticList };
    },
    onError: (_err, _name, context) => {
      // Rollback on error
      if (context?.previousLists) {
        queryClient.setQueryData(["lists"], context.previousLists);
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["lists"] });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!navigator.onLine) {
        await syncQueue.enqueue("list.update", `/api/lists/${id}`, "PUT", {
          name,
        });
        await offlineDB.updateList(id, { name, updatedAt: Date.now() });
        const updated = await offlineDB.getList(id);
        return updated!;
      }
      return api.updateList(id, name);
    },
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previousLists = queryClient.getQueryData<ListWithCounts[]>([
        "lists",
      ]);

      queryClient.setQueryData<ListWithCounts[]>(["lists"], (old) =>
        (old || []).map((list) =>
          list.id === id ? { ...list, name, updatedAt: Date.now() } : list,
        ),
      );

      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(["lists"], context.previousLists);
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["lists"] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!navigator.onLine) {
        await syncQueue.enqueue(
          "list.delete",
          `/api/lists/${id}`,
          "DELETE",
          null,
        );
        await offlineDB.deleteList(id);
        return;
      }
      return api.deleteList(id);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previousLists = queryClient.getQueryData<ListWithCounts[]>([
        "lists",
      ]);

      queryClient.setQueryData<ListWithCounts[]>(["lists"], (old) =>
        (old || []).filter((list) => list.id !== id),
      );

      return { previousLists };
    },
    onError: (_err, _id, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(["lists"], context.previousLists);
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["lists"] });
      }
    },
  });

  return {
    lists,
    isLoading,
    error,
    createList: createMutation.mutateAsync,
    updateList: updateMutation.mutateAsync,
    deleteList: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useList(id: string) {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const {
    data: list,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["lists", id],
    queryFn: async () => {
      if (!isOnline) {
        return offlineDB.getList(id);
      }

      try {
        const list = await api.getList(id);
        await offlineDB.addList(list);
        return list;
      } catch (err) {
        if (err instanceof TypeError && err.message.includes("fetch")) {
          return offlineDB.getList(id);
        }
        throw err;
      }
    },
    enabled: !!id,
    staleTime: isOnline ? 60_000 : Infinity,
  });

  return { list, isLoading, error };
}
