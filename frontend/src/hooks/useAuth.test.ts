import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "./useAuth";
import { createWrapper } from "@/test/test-utils";

// Mock the API client
vi.mock("@/api/client", () => ({
  api: {
    me: vi.fn(),
    canRegister: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

import { api } from "@/api/client";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return isLoading true initially", () => {
    vi.mocked(api.me).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );
    vi.mocked(api.canRegister).mockResolvedValue({ canRegister: false });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should return user when authenticated", async () => {
    const mockUser = {
      id: "1",
      username: "testuser",
      name: "Test User",
      isAdmin: false,
      createdAt: Date.now(),
    };
    vi.mocked(api.me).mockResolvedValue({ user: mockUser });
    vi.mocked(api.canRegister).mockResolvedValue({ canRegister: false });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it("should return isAuthenticated false when not logged in", async () => {
    vi.mocked(api.me).mockRejectedValue(new Error("Not authenticated"));
    vi.mocked(api.canRegister).mockResolvedValue({ canRegister: true });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    // Longer timeout needed because useAuth has retry: 2 with exponential backoff
    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 10000 },
    );

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("should return canRegister true when no users exist", async () => {
    vi.mocked(api.me).mockRejectedValue(new Error("Not authenticated"));
    vi.mocked(api.canRegister).mockResolvedValue({ canRegister: true });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.canRegister).toBe(true);
      },
      { timeout: 10000 },
    );
  });

  it("should return canRegister false when users exist", async () => {
    vi.mocked(api.me).mockRejectedValue(new Error("Not authenticated"));
    vi.mocked(api.canRegister).mockResolvedValue({ canRegister: false });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.canRegister).toBe(false);
      },
      { timeout: 10000 },
    );
  });

  it("should identify admin users", async () => {
    const mockAdminUser = {
      id: "1",
      username: "admin",
      name: "Admin User",
      isAdmin: true,
      createdAt: Date.now(),
    };
    vi.mocked(api.me).mockResolvedValue({ user: mockAdminUser });
    vi.mocked(api.canRegister).mockResolvedValue({ canRegister: false });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user?.isAdmin).toBe(true);
  });
});
