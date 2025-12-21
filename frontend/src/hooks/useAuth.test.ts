import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "./useAuth";
import { createWrapper } from "@/test/test-utils";

// Helper class for simulating 401 errors in tests
class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "APIError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

// Mock the API client
vi.mock("@/api/client", () => ({
  api: {
    me: vi.fn(),
    canRegister: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
  APIError: class extends Error {
    constructor(
      message: string,
      public status: number,
      public code: string,
    ) {
      super(message);
      this.name = "APIError";
    }
    get isUnauthorized(): boolean {
      return this.status === 401;
    }
    get isServerError(): boolean {
      return this.status >= 500;
    }
  },
  NetworkError: class extends Error {
    constructor(message: string = "Network request failed") {
      super(message);
      this.name = "NetworkError";
    }
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
    // Use APIError with 401 to simulate actual unauthorized response (no retries)
    vi.mocked(api.me).mockRejectedValue(
      new APIError("Not authenticated", 401, "UNAUTHORIZED"),
    );
    vi.mocked(api.canRegister).mockResolvedValue({ canRegister: true });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("should return canRegister true when no users exist", async () => {
    vi.mocked(api.me).mockRejectedValue(
      new APIError("Not authenticated", 401, "UNAUTHORIZED"),
    );
    vi.mocked(api.canRegister).mockResolvedValue({ canRegister: true });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.canRegister).toBe(true);
    });
  });

  it("should return canRegister false when users exist", async () => {
    vi.mocked(api.me).mockRejectedValue(
      new APIError("Not authenticated", 401, "UNAUTHORIZED"),
    );
    vi.mocked(api.canRegister).mockResolvedValue({ canRegister: false });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.canRegister).toBe(false);
    });
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
