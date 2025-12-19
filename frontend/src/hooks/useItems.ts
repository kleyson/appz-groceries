import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ulid } from "ulid";
import { api } from "@/api/client";
import { syncQueue } from "@/lib/sync-queue";
import * as offlineDB from "@/lib/offline-db";
import type {
  CreateItemRequest,
  UpdateItemRequest,
  Item,
  ListWithCounts,
} from "@/types";

const DEFAULT_CATEGORY_ID = "01PRODUCE000000000000000000"; // Fallback category

export function useItems(listId: string) {
  const queryClient = useQueryClient();
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["lists", listId, "items"],
    queryFn: async () => {
      if (!isOnline) {
        return offlineDB.getItems(listId);
      }

      try {
        const items = await api.getItems(listId);
        await offlineDB.setItems(listId, items);
        return items;
      } catch (err) {
        if (err instanceof TypeError && err.message.includes("fetch")) {
          return offlineDB.getItems(listId);
        }
        throw err;
      }
    },
    enabled: !!listId,
    staleTime: isOnline ? 60_000 : Infinity,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateItemRequest) => {
      const optimisticItem: Item = {
        id: ulid(),
        listId,
        name: data.name,
        quantity: data.quantity ?? 1,
        unit: data.unit ?? null,
        categoryId: data.categoryId ?? DEFAULT_CATEGORY_ID,
        checked: false,
        price: data.price ?? null,
        store: data.store ?? null,
        sortOrder: items.length,
        version: 1,
      };

      if (!navigator.onLine) {
        await syncQueue.enqueue(
          "item.create",
          `/api/lists/${listId}/items`,
          "POST",
          data,
        );
        await offlineDB.addItem(optimisticItem);
        await offlineDB.updateListCounts(listId);
        return optimisticItem;
      }

      return api.createItem(listId, data);
    },
    onMutate: async (data: CreateItemRequest) => {
      await queryClient.cancelQueries({ queryKey: ["lists", listId, "items"] });

      const previousItems = queryClient.getQueryData<Item[]>([
        "lists",
        listId,
        "items",
      ]);

      const optimisticItem: Item = {
        id: ulid(),
        listId,
        name: data.name,
        quantity: data.quantity ?? 1,
        unit: data.unit ?? null,
        categoryId: data.categoryId ?? DEFAULT_CATEGORY_ID,
        checked: false,
        price: data.price ?? null,
        store: data.store ?? null,
        sortOrder: (previousItems || []).length,
        version: 1,
      };

      queryClient.setQueryData<Item[]>(["lists", listId, "items"], (old) => [
        ...(old || []),
        optimisticItem,
      ]);

      // Also update list counts optimistically
      const lists = queryClient.getQueryData<ListWithCounts[]>(["lists"]);
      if (lists) {
        queryClient.setQueryData<ListWithCounts[]>(["lists"], (old) =>
          (old || []).map((list) =>
            list.id === listId
              ? {
                  ...list,
                  totalItems: list.totalItems + 1,
                  totalPrice:
                    list.totalPrice + (data.price || 0) * (data.quantity || 1),
                  updatedAt: Date.now(),
                }
              : list,
          ),
        );
      }

      return { previousItems, lists };
    },
    onError: (_err, _data, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(
          ["lists", listId, "items"],
          context.previousItems,
        );
      }
      if (context?.lists) {
        queryClient.setQueryData(["lists"], context.lists);
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["lists", listId, "items"] });
        queryClient.invalidateQueries({ queryKey: ["lists"] });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateItemRequest;
    }) => {
      if (!navigator.onLine) {
        await syncQueue.enqueue(
          "item.update",
          `/api/lists/${listId}/items/${id}`,
          "PUT",
          data,
        );
        await offlineDB.updateItem(id, data);
        await offlineDB.updateListCounts(listId);
        const updated = await offlineDB.getItem(id);
        return updated!;
      }
      return api.updateItem(listId, id, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["lists", listId, "items"] });

      const previousItems = queryClient.getQueryData<Item[]>([
        "lists",
        listId,
        "items",
      ]);

      queryClient.setQueryData<Item[]>(["lists", listId, "items"], (old) =>
        (old || []).map((item) =>
          item.id === id ? { ...item, ...data } : item,
        ),
      );

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(
          ["lists", listId, "items"],
          context.previousItems,
        );
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["lists", listId, "items"] });
        queryClient.invalidateQueries({ queryKey: ["lists"] });
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = items.find((i) => i.id === id);
      const newChecked = !item?.checked;

      if (!navigator.onLine) {
        await syncQueue.enqueue(
          "item.toggle",
          `/api/lists/${listId}/items/${id}/toggle`,
          "PATCH",
          null,
        );
        await offlineDB.updateItem(id, { checked: newChecked });
        await offlineDB.updateListCounts(listId);
        const updated = await offlineDB.getItem(id);
        return updated!;
      }
      return api.toggleItem(listId, id);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["lists", listId, "items"] });

      const previousItems = queryClient.getQueryData<Item[]>([
        "lists",
        listId,
        "items",
      ]);
      const item = previousItems?.find((i) => i.id === id);
      const newChecked = !item?.checked;

      queryClient.setQueryData<Item[]>(["lists", listId, "items"], (old) =>
        (old || []).map((item) =>
          item.id === id ? { ...item, checked: newChecked } : item,
        ),
      );

      // Update list checked count
      const lists = queryClient.getQueryData<ListWithCounts[]>(["lists"]);
      if (lists) {
        queryClient.setQueryData<ListWithCounts[]>(["lists"], (old) =>
          (old || []).map((list) =>
            list.id === listId
              ? {
                  ...list,
                  checkedItems: newChecked
                    ? list.checkedItems + 1
                    : list.checkedItems - 1,
                  updatedAt: Date.now(),
                }
              : list,
          ),
        );
      }

      return { previousItems, lists };
    },
    onError: (_err, _id, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(
          ["lists", listId, "items"],
          context.previousItems,
        );
      }
      if (context?.lists) {
        queryClient.setQueryData(["lists"], context.lists);
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["lists", listId, "items"] });
        queryClient.invalidateQueries({ queryKey: ["lists"] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!navigator.onLine) {
        await syncQueue.enqueue(
          "item.delete",
          `/api/lists/${listId}/items/${id}`,
          "DELETE",
          null,
        );
        await offlineDB.deleteItem(id);
        await offlineDB.updateListCounts(listId);
        return;
      }
      return api.deleteItem(listId, id);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["lists", listId, "items"] });

      const previousItems = queryClient.getQueryData<Item[]>([
        "lists",
        listId,
        "items",
      ]);
      const deletedItem = previousItems?.find((i) => i.id === id);

      queryClient.setQueryData<Item[]>(["lists", listId, "items"], (old) =>
        (old || []).filter((item) => item.id !== id),
      );

      // Update list counts
      const lists = queryClient.getQueryData<ListWithCounts[]>(["lists"]);
      if (lists && deletedItem) {
        queryClient.setQueryData<ListWithCounts[]>(["lists"], (old) =>
          (old || []).map((list) =>
            list.id === listId
              ? {
                  ...list,
                  totalItems: list.totalItems - 1,
                  checkedItems: deletedItem.checked
                    ? list.checkedItems - 1
                    : list.checkedItems,
                  totalPrice:
                    list.totalPrice -
                    (deletedItem.price || 0) * deletedItem.quantity,
                  updatedAt: Date.now(),
                }
              : list,
          ),
        );
      }

      return { previousItems, lists };
    },
    onError: (_err, _id, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(
          ["lists", listId, "items"],
          context.previousItems,
        );
      }
      if (context?.lists) {
        queryClient.setQueryData(["lists"], context.lists);
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["lists", listId, "items"] });
        queryClient.invalidateQueries({ queryKey: ["lists"] });
      }
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (!navigator.onLine) {
        await syncQueue.enqueue(
          "item.reorder",
          `/api/lists/${listId}/items/reorder`,
          "PUT",
          { itemIds },
        );
        // Update sort orders in offline DB
        for (const [i, id] of itemIds.entries()) {
          await offlineDB.updateItem(id, { sortOrder: i });
        }
        return;
      }
      return api.reorderItems(listId, itemIds);
    },
    onMutate: async (itemIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ["lists", listId, "items"] });

      const previousItems = queryClient.getQueryData<Item[]>([
        "lists",
        listId,
        "items",
      ]);

      // Reorder items according to new order
      const reordered = itemIds
        .map((id, index) => {
          const item = previousItems?.find((i) => i.id === id);
          return item ? { ...item, sortOrder: index } : null;
        })
        .filter((item): item is Item => item !== null);

      queryClient.setQueryData(["lists", listId, "items"], reordered);

      return { previousItems };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(
          ["lists", listId, "items"],
          context.previousItems,
        );
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["lists", listId, "items"] });
      }
    },
  });

  // Computed values
  const checkedCount = items.filter((item) => item.checked).length;
  const uncheckedCount = items.filter((item) => !item.checked).length;
  const totalPrice = items.reduce((sum, item) => {
    if (item.price) {
      return sum + item.price * item.quantity;
    }
    return sum;
  }, 0);

  return {
    items,
    isLoading,
    error,
    checkedCount,
    uncheckedCount,
    totalPrice,
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    toggleItem: toggleMutation.mutateAsync,
    deleteItem: deleteMutation.mutateAsync,
    reorderItems: reorderMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isToggling: toggleMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
