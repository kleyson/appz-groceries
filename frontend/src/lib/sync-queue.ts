import { ulid } from "ulid";
import {
  getPendingActions,
  addPendingAction,
  removePendingAction,
  updatePendingAction,
  getPendingCount,
  type PendingAction,
  type ActionType,
} from "./offline-db";

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff

type SyncEventType =
  | "sync-start"
  | "sync-complete"
  | "sync-error"
  | "action-complete"
  | "action-error";

interface SyncEvent {
  type: SyncEventType;
  actionId?: string;
  error?: string;
  pendingCount?: number;
}

type SyncEventListener = (event: SyncEvent) => void;

class SyncQueue {
  private isProcessing = false;
  private listeners: Set<SyncEventListener> = new Set();

  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SyncEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  async enqueue(
    type: ActionType,
    endpoint: string,
    method: "POST" | "PUT" | "PATCH" | "DELETE",
    payload: unknown,
  ): Promise<string> {
    const action: PendingAction = {
      id: ulid(),
      type,
      endpoint,
      method,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
    };

    await addPendingAction(action);

    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }

    return action.id;
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!navigator.onLine) return;

    this.isProcessing = true;
    this.emit({ type: "sync-start" });

    try {
      const actions = await getPendingActions();

      for (const action of actions) {
        if (!navigator.onLine) break;

        try {
          const response = await this.executeAction(action);

          if (response.ok) {
            await removePendingAction(action.id);
            this.emit({ type: "action-complete", actionId: action.id });
          } else if (response.status === 409) {
            // Conflict: server version wins, remove action
            await removePendingAction(action.id);
            this.emit({
              type: "action-error",
              actionId: action.id,
              error: "Conflict - server version used",
            });
          } else if (response.status >= 400 && response.status < 500) {
            // Client error: remove action (won't succeed on retry)
            await removePendingAction(action.id);
            this.emit({
              type: "action-error",
              actionId: action.id,
              error: `Client error: ${response.status}`,
            });
          } else {
            // Server error: increment retry, keep in queue
            await this.handleRetry(action, `Server error: ${response.status}`);
          }
        } catch (error) {
          // Network error: stop processing, will retry later
          if (error instanceof TypeError && error.message.includes("fetch")) {
            break;
          }
          await this.handleRetry(
            action,
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      }

      const pendingCount = await getPendingCount();
      this.emit({ type: "sync-complete", pendingCount });
    } catch (error) {
      this.emit({
        type: "sync-error",
        error: error instanceof Error ? error.message : "Unknown sync error",
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeAction(action: PendingAction): Promise<Response> {
    const options: RequestInit = {
      method: action.method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    };

    if (action.method !== "DELETE" && action.payload) {
      options.body = JSON.stringify(action.payload);
    }

    return fetch(action.endpoint, options);
  }

  private async handleRetry(
    action: PendingAction,
    error: string,
  ): Promise<void> {
    if (action.retryCount >= MAX_RETRIES) {
      // Max retries exceeded, remove action
      await removePendingAction(action.id);
      this.emit({
        type: "action-error",
        actionId: action.id,
        error: `Max retries exceeded: ${error}`,
      });
      return;
    }

    await updatePendingAction(action.id, {
      retryCount: action.retryCount + 1,
      lastError: error,
    });

    // Schedule retry with exponential backoff
    const delay =
      RETRY_DELAYS[action.retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
    setTimeout(() => this.processQueue(), delay);
  }

  async getPendingCount(): Promise<number> {
    return getPendingCount();
  }

  isOnline(): boolean {
    return navigator.onLine;
  }
}

// Singleton instance
export const syncQueue = new SyncQueue();

// Auto-process queue when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncQueue.processQueue();
  });

  // Try to use Background Sync API if available
  if (
    "serviceWorker" in navigator &&
    "sync" in window.ServiceWorkerRegistration.prototype
  ) {
    navigator.serviceWorker.ready.then((registration) => {
      // Register for background sync
      (
        registration as unknown as {
          sync: { register: (tag: string) => Promise<void> };
        }
      ).sync
        .register("groceries-sync")
        .catch(() => {
          // Background sync not available, fall back to online events
        });
    });
  }
}
