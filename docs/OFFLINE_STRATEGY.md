# Offline Strategy for Groceries App

## Analysis of Koffan's Approach

Koffan implements offline-first functionality with:

### What They Do Well
1. **Dual-cache service worker** - Static assets cached permanently, dynamic content network-first with fallback
2. **IndexedDB for offline queue** - Actions stored with timestamps for ordered replay
3. **Optimistic UI updates** - DOM updated immediately, visual indicators show pending sync
4. **Last-write-wins conflict resolution** - Compares timestamps to skip stale offline actions
5. **WebSocket race condition prevention** - 1s window to ignore remote updates after local action
6. **Exponential backoff reconnection** - Graceful handling of transient failures

### Limitations We Can Improve
1. **No version vectors** - Simple timestamps can fail with clock skew
2. **No offline data viewing** - Only queues actions, doesn't cache readable data
3. **All-or-nothing queue** - Failed actions block subsequent ones
4. **No partial sync** - Full page reload on reconnect
5. **No background sync** - Relies on app being open

---

## Proposed Architecture for Groceries

### 1. Progressive Web App (PWA) Setup

```
frontend/
├── public/
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # Service worker
│   └── icons/             # App icons (192, 512)
├── src/
│   ├── lib/
│   │   ├── offline-db.ts  # IndexedDB wrapper
│   │   ├── sync-queue.ts  # Offline action queue
│   │   └── sync-engine.ts # Sync orchestration
│   └── hooks/
│       └── useOffline.ts  # Offline state hook
```

### 2. Service Worker Strategy

```typescript
// sw.js - Workbox-based service worker

// Cache strategies:
// 1. STATIC (CacheFirst): JS, CSS, fonts, icons - versioned cache
// 2. API_READ (NetworkFirst): GET /api/* - cache for offline viewing
// 3. API_WRITE (NetworkOnly): POST/PUT/PATCH/DELETE - queue if offline
// 4. IMAGES (StaleWhileRevalidate): Category icons, etc.

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `groceries-static-${CACHE_VERSION}`;
const API_CACHE = `groceries-api-${CACHE_VERSION}`;

// Precache app shell
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  // JS/CSS bundles added at build time
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key !== STATIC_CACHE && key !== API_CACHE)
        .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: route to appropriate strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API writes: let through (app handles queueing)
  if (url.pathname.startsWith('/api/') && event.request.method !== 'GET') {
    return;
  }

  // API reads: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(event.request, API_CACHE));
    return;
  }

  // Static assets: cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // HTML: network-first, fall back to cached index.html (SPA)
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match('/index.html'))
  );
});
```

### 3. IndexedDB Schema

```typescript
// lib/offline-db.ts

interface OfflineDB {
  // Cached data for offline viewing
  lists: ListWithCounts[];
  items: Record<string, Item[]>;  // keyed by listId
  categories: Category[];

  // Sync queue
  pendingActions: PendingAction[];

  // Sync metadata
  syncMeta: {
    lastSyncAt: number;
    deviceId: string;
    serverVersion: number;
  };
}

interface PendingAction {
  id: string;           // ULID for ordering
  type: ActionType;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: unknown;
  createdAt: number;    // Timestamp
  retryCount: number;
  lastError?: string;
}

type ActionType =
  | 'list.create' | 'list.update' | 'list.delete'
  | 'item.create' | 'item.update' | 'item.delete' | 'item.toggle' | 'item.reorder';
```

### 4. Sync Queue Implementation

```typescript
// lib/sync-queue.ts

class SyncQueue {
  private db: IDBDatabase;
  private isProcessing = false;

  async enqueue(action: Omit<PendingAction, 'id' | 'createdAt' | 'retryCount'>) {
    const pendingAction: PendingAction = {
      ...action,
      id: ulid(),
      createdAt: Date.now(),
      retryCount: 0,
    };

    await this.db.add('pendingActions', pendingAction);

    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const actions = await this.getAllPending();

      for (const action of actions) {
        try {
          const response = await this.executeAction(action);

          if (response.ok) {
            await this.removeAction(action.id);
          } else if (response.status === 409) {
            // Conflict: fetch latest and merge
            await this.handleConflict(action, response);
          } else if (response.status >= 400 && response.status < 500) {
            // Client error: remove (won't succeed on retry)
            await this.removeAction(action.id);
          } else {
            // Server error: increment retry, keep in queue
            await this.incrementRetry(action.id);
          }
        } catch (error) {
          // Network error: stop processing, will retry later
          break;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async handleConflict(action: PendingAction, response: Response) {
    // For now: last-write-wins (server version)
    // Future: show conflict UI for user resolution
    const serverData = await response.json();

    // Update local cache with server version
    await this.updateLocalCache(action.type, serverData);

    // Remove failed action
    await this.removeAction(action.id);
  }
}
```

### 5. TanStack Query Integration

```typescript
// hooks/useOfflineLists.ts

export function useOfflineLists() {
  const queryClient = useQueryClient();
  const { isOnline } = useOnlineStatus();

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: async () => {
      if (!isOnline) {
        // Return cached data from IndexedDB
        return offlineDB.getLists();
      }

      const lists = await api.getLists();
      // Cache for offline use
      await offlineDB.setLists(lists);
      return lists;
    },
    staleTime: isOnline ? 60_000 : Infinity, // Never stale when offline
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const optimisticList = createOptimisticList(name);

      if (!isOnline) {
        // Queue for later sync
        await syncQueue.enqueue({
          type: 'list.create',
          endpoint: '/api/lists',
          method: 'POST',
          payload: { name },
        });

        // Store optimistic version
        await offlineDB.addList(optimisticList);
        return optimisticList;
      }

      return api.createList(name);
    },
    onMutate: async (name) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['lists'] });

      // Snapshot previous value
      const previousLists = queryClient.getQueryData(['lists']);

      // Optimistically update
      const optimisticList = createOptimisticList(name);
      queryClient.setQueryData(['lists'], (old: ListWithCounts[]) =>
        [optimisticList, ...old]
      );

      return { previousLists };
    },
    onError: (err, name, context) => {
      // Rollback on error
      queryClient.setQueryData(['lists'], context?.previousLists);
    },
    onSettled: () => {
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: ['lists'] });
      }
    },
  });

  return { lists, isLoading, createList: createMutation.mutate };
}
```

### 6. Online/Offline Status Hook

```typescript
// hooks/useOnlineStatus.ts

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync
      syncQueue.processQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll pending count
    const interval = setInterval(async () => {
      const count = await syncQueue.getPendingCount();
      setPendingCount(count);
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, pendingCount };
}
```

### 7. UI Indicators

```tsx
// components/OfflineIndicator.tsx

export function OfflineIndicator() {
  const { isOnline, pendingCount } = useOnlineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full",
      "text-sm font-medium shadow-lg animate-slide-up",
      isOnline
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-800 text-white"
    )}>
      {isOnline ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Syncing {pendingCount} changes...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          You're offline
        </span>
      )}
    </div>
  );
}
```

### 8. PWA Manifest

```json
// public/manifest.json
{
  "name": "Groceries",
  "short_name": "Groceries",
  "description": "Manage your grocery lists",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0d9488",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Basic PWA
1. Add manifest.json and icons
2. Create service worker with static caching
3. Add install prompt UI

### Phase 2: Offline Data Viewing
1. Set up IndexedDB with idb library
2. Cache API responses for offline viewing
3. Add useOnlineStatus hook
4. Show offline indicator

### Phase 3: Offline Actions
1. Implement sync queue
2. Add optimistic updates to mutations
3. Queue actions when offline
4. Process queue on reconnection

### Phase 4: Conflict Resolution
1. Add version numbers to entities
2. Detect conflicts (409 responses)
3. Implement merge strategies
4. (Optional) Show conflict resolution UI

### Phase 5: Background Sync (Optional)
1. Use Background Sync API where available
2. Fall back to visibility change events
3. Periodic sync for fresh data

---

## Comparison: Koffan vs Our Approach

| Feature | Koffan | Our Approach |
|---------|--------|--------------|
| Caching | Dual-cache (static/dynamic) | Same, with Workbox |
| Offline Storage | IndexedDB | IndexedDB with idb wrapper |
| UI Updates | Vanilla JS DOM manipulation | TanStack Query optimistic updates |
| Conflict Resolution | Timestamp-based last-write-wins | Version numbers + optional UI |
| Sync Trigger | Online event + manual | Online event + Background Sync API |
| Queue Processing | Sequential, stops on failure | Sequential with retry limits |
| Real-time Sync | WebSocket | Not needed (single user) |
| Framework | HTMX + Alpine.js | React + TanStack |

---

## Key Improvements Over Koffan

1. **Better conflict handling** - Version numbers instead of timestamps avoid clock skew issues
2. **Smarter retry logic** - Exponential backoff with max retries, don't block queue on client errors
3. **Cleaner optimistic updates** - TanStack Query handles rollback automatically
4. **Typed everything** - TypeScript for all offline logic
5. **Background Sync API** - Sync even when app is closed (where supported)
6. **No page reload** - React Query invalidation instead of full reload

---

## Dependencies to Add

```bash
npm install idb                    # IndexedDB wrapper
npm install vite-plugin-pwa        # Workbox integration for Vite
```
