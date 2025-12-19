import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { ListWithCounts, Item, Category } from "@/types";

// Pending action types for sync queue
export type ActionType =
  | "list.create"
  | "list.update"
  | "list.delete"
  | "item.create"
  | "item.update"
  | "item.delete"
  | "item.toggle"
  | "item.reorder";

export interface PendingAction {
  id: string;
  type: ActionType;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: unknown;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export interface SyncMeta {
  id: string;
  lastSyncAt: number;
  deviceId: string;
}

interface GroceriesDBSchema extends DBSchema {
  lists: {
    key: string;
    value: ListWithCounts;
    indexes: { "by-updated": number };
  };
  items: {
    key: string;
    value: Item;
    indexes: { "by-list": string; "by-sort": number };
  };
  categories: {
    key: string;
    value: Category;
    indexes: { "by-sort": number };
  };
  pendingActions: {
    key: string;
    value: PendingAction;
    indexes: { "by-created": number };
  };
  syncMeta: {
    key: string;
    value: SyncMeta;
  };
}

const DB_NAME = "groceries-offline";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<GroceriesDBSchema> | null = null;

export async function getDB(): Promise<IDBPDatabase<GroceriesDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<GroceriesDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Lists store
      if (!db.objectStoreNames.contains("lists")) {
        const listStore = db.createObjectStore("lists", { keyPath: "id" });
        listStore.createIndex("by-updated", "updatedAt");
      }

      // Items store
      if (!db.objectStoreNames.contains("items")) {
        const itemStore = db.createObjectStore("items", { keyPath: "id" });
        itemStore.createIndex("by-list", "listId");
        itemStore.createIndex("by-sort", "sortOrder");
      }

      // Categories store
      if (!db.objectStoreNames.contains("categories")) {
        const categoryStore = db.createObjectStore("categories", {
          keyPath: "id",
        });
        categoryStore.createIndex("by-sort", "sortOrder");
      }

      // Pending actions store for offline sync
      if (!db.objectStoreNames.contains("pendingActions")) {
        const actionStore = db.createObjectStore("pendingActions", {
          keyPath: "id",
        });
        actionStore.createIndex("by-created", "createdAt");
      }

      // Sync metadata store
      if (!db.objectStoreNames.contains("syncMeta")) {
        db.createObjectStore("syncMeta", { keyPath: "id" });
      }
    },
  });

  return dbInstance;
}

// Lists operations
export async function getLists(): Promise<ListWithCounts[]> {
  const db = await getDB();
  const lists = await db.getAllFromIndex("lists", "by-updated");
  return lists.reverse(); // Most recent first
}

export async function getList(id: string): Promise<ListWithCounts | undefined> {
  const db = await getDB();
  return db.get("lists", id);
}

export async function setLists(lists: ListWithCounts[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("lists", "readwrite");
  await tx.store.clear();
  for (const list of lists) {
    await tx.store.put(list);
  }
  await tx.done;
}

export async function addList(list: ListWithCounts): Promise<void> {
  const db = await getDB();
  await db.put("lists", list);
}

export async function updateList(
  id: string,
  updates: Partial<ListWithCounts>,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get("lists", id);
  if (existing) {
    await db.put("lists", { ...existing, ...updates });
  }
}

export async function deleteList(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("lists", id);
  // Also delete all items in this list
  const items = await db.getAllFromIndex("items", "by-list", id);
  const tx = db.transaction("items", "readwrite");
  for (const item of items) {
    await tx.store.delete(item.id);
  }
  await tx.done;
}

// Items operations
export async function getItems(listId: string): Promise<Item[]> {
  const db = await getDB();
  return db.getAllFromIndex("items", "by-list", listId);
}

export async function getItem(id: string): Promise<Item | undefined> {
  const db = await getDB();
  return db.get("items", id);
}

export async function setItems(listId: string, items: Item[]): Promise<void> {
  const db = await getDB();
  // Clear existing items for this list
  const existing = await db.getAllFromIndex("items", "by-list", listId);
  const tx = db.transaction("items", "readwrite");
  for (const item of existing) {
    await tx.store.delete(item.id);
  }
  // Add new items
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function addItem(item: Item): Promise<void> {
  const db = await getDB();
  await db.put("items", item);
}

export async function updateItem(
  id: string,
  updates: Partial<Item>,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get("items", id);
  if (existing) {
    await db.put("items", { ...existing, ...updates });
  }
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("items", id);
}

// Categories operations
export async function getCategories(): Promise<Category[]> {
  const db = await getDB();
  const categories = await db.getAllFromIndex("categories", "by-sort");
  return categories;
}

export async function setCategories(categories: Category[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("categories", "readwrite");
  await tx.store.clear();
  for (const category of categories) {
    await tx.store.put(category);
  }
  await tx.done;
}

// Pending actions operations
export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await getDB();
  return db.getAllFromIndex("pendingActions", "by-created");
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count("pendingActions");
}

export async function addPendingAction(action: PendingAction): Promise<void> {
  const db = await getDB();
  await db.put("pendingActions", action);
}

export async function removePendingAction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("pendingActions", id);
}

export async function updatePendingAction(
  id: string,
  updates: Partial<PendingAction>,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get("pendingActions", id);
  if (existing) {
    await db.put("pendingActions", { ...existing, ...updates });
  }
}

export async function clearPendingActions(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("pendingActions", "readwrite");
  await tx.store.clear();
  await tx.done;
}

// Sync metadata operations
export async function getSyncMeta(): Promise<SyncMeta | undefined> {
  const db = await getDB();
  return db.get("syncMeta", "default");
}

export async function setSyncMeta(meta: Omit<SyncMeta, "id">): Promise<void> {
  const db = await getDB();
  await db.put("syncMeta", { ...meta, id: "default" });
}

// Clear all offline data
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["lists", "items", "categories", "pendingActions", "syncMeta"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("lists").clear(),
    tx.objectStore("items").clear(),
    tx.objectStore("categories").clear(),
    tx.objectStore("pendingActions").clear(),
    tx.objectStore("syncMeta").clear(),
  ]);
  await tx.done;
}

// Update list counts locally after item changes
export async function updateListCounts(listId: string): Promise<void> {
  const db = await getDB();
  const items = await db.getAllFromIndex("items", "by-list", listId);
  const list = await db.get("lists", listId);

  if (list) {
    const totalItems = items.length;
    const checkedItems = items.filter((i) => i.checked).length;
    const totalPrice = items.reduce(
      (sum, i) => sum + (i.price || 0) * i.quantity,
      0,
    );

    await db.put("lists", {
      ...list,
      totalItems,
      checkedItems,
      totalPrice,
      updatedAt: Date.now(),
    });
  }
}
