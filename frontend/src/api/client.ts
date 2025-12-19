import type {
  APIResponse,
  AuthResponse,
  Category,
  CreateItemRequest,
  CreateUserRequest,
  Item,
  ListWithCounts,
  LoginRequest,
  PriceHistory,
  RegisterRequest,
  UpdateItemRequest,
  User,
  UsersResponse,
} from "@/types";

class APIClient {
  private baseUrl = "/api";

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
    });

    const data = (await response.json()) as APIResponse<T>;

    if (!response.ok || data.error) {
      const error = data.error ?? {
        code: "UNKNOWN",
        message: "An error occurred",
      };
      throw new Error(error.message);
    }

    return data.data as T;
  }

  // Auth
  async canRegister(): Promise<{ canRegister: boolean }> {
    return this.request("/auth/can-register");
  }

  async register(req: RegisterRequest): Promise<AuthResponse> {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async logout(): Promise<{ success: boolean }> {
    return this.request("/auth/logout", { method: "POST" });
  }

  async me(): Promise<AuthResponse> {
    return this.request("/auth/me");
  }

  // User Management (admin only)
  async getUsers(): Promise<UsersResponse> {
    return this.request("/users");
  }

  async createUser(req: CreateUserRequest): Promise<User> {
    return this.request("/users", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async deleteUser(id: string): Promise<{ success: boolean }> {
    return this.request(`/users/${id}`, { method: "DELETE" });
  }

  // Lists
  async getLists(): Promise<ListWithCounts[]> {
    return this.request("/lists");
  }

  async getList(id: string): Promise<ListWithCounts> {
    return this.request(`/lists/${id}`);
  }

  async createList(name: string): Promise<ListWithCounts> {
    return this.request("/lists", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async updateList(id: string, name: string): Promise<ListWithCounts> {
    return this.request(`/lists/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
  }

  async deleteList(id: string): Promise<{ success: boolean }> {
    return this.request(`/lists/${id}`, { method: "DELETE" });
  }

  // Items
  async getItems(listId: string): Promise<Item[]> {
    return this.request(`/lists/${listId}/items`);
  }

  async createItem(listId: string, req: CreateItemRequest): Promise<Item> {
    return this.request(`/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async updateItem(
    listId: string,
    id: string,
    req: UpdateItemRequest,
  ): Promise<Item> {
    return this.request(`/lists/${listId}/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(req),
    });
  }

  async toggleItem(listId: string, id: string): Promise<Item> {
    return this.request(`/lists/${listId}/items/${id}/toggle`, {
      method: "PATCH",
    });
  }

  async deleteItem(listId: string, id: string): Promise<{ success: boolean }> {
    return this.request(`/lists/${listId}/items/${id}`, { method: "DELETE" });
  }

  async reorderItems(
    listId: string,
    itemIds: string[],
  ): Promise<{ success: boolean }> {
    return this.request(`/lists/${listId}/items/reorder`, {
      method: "PUT",
      body: JSON.stringify({ itemIds }),
    });
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return this.request("/categories");
  }

  async createCategory(data: {
    name: string;
    icon: string;
    color: string;
  }): Promise<Category> {
    return this.request("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<{ success: boolean }> {
    return this.request(`/categories/${id}`, { method: "DELETE" });
  }

  // Price History
  async getPriceHistory(itemName: string): Promise<PriceHistory[]> {
    return this.request(
      `/price-history?itemName=${encodeURIComponent(itemName)}`,
    );
  }

  async recordPrice(data: {
    itemName: string;
    price: number;
    store?: string;
  }): Promise<PriceHistory> {
    return this.request("/price-history", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const api = new APIClient();
