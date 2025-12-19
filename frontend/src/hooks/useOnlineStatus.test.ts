import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOnlineStatus } from "./useOnlineStatus";

// Mock the sync-queue and offline-db modules
vi.mock("@/lib/sync-queue", () => ({
  syncQueue: {
    subscribe: vi.fn(() => vi.fn()),
    processQueue: vi.fn(),
  },
}));

vi.mock("@/lib/offline-db", () => ({
  getPendingCount: vi.fn(() => Promise.resolve(0)),
}));

describe("useOnlineStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });
  });

  it("should return isOnline true when online", () => {
    Object.defineProperty(navigator, "onLine", { value: true });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(true);
  });

  it("should return isOnline false when offline", () => {
    Object.defineProperty(navigator, "onLine", { value: false });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(false);
  });

  it("should update when going offline", () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(true);

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it("should update when going online", () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(false);

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.isOnline).toBe(true);
  });

  it("should have triggerSync function", () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(typeof result.current.triggerSync).toBe("function");
  });

  it("should initialize with zero pending count", () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.pendingCount).toBe(0);
  });

  it("should initialize with isSyncing false", () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isSyncing).toBe(false);
  });
});
