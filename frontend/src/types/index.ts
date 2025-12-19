// User & Auth
export interface User {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  createdAt: number;
}

export interface AuthResponse {
  user: User;
}

export interface UsersResponse {
  users: User[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  name: string;
  password: string;
}

export interface CreateUserRequest {
  username: string;
  name: string;
  password: string;
}

// Category
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
}

// List
export interface List {
  id: string;
  name: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface ListWithCounts extends List {
  totalItems: number;
  checkedItems: number;
  totalPrice: number;
}

// Item
export interface Item {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  unit: string | null;
  categoryId: string;
  checked: boolean;
  price: number | null;
  store: string | null;
  sortOrder: number;
  version: number;
}

export interface CreateItemRequest {
  name: string;
  quantity?: number;
  unit?: string;
  categoryId?: string;
  price?: number;
  store?: string;
}

export interface UpdateItemRequest {
  name?: string;
  quantity?: number;
  unit?: string;
  categoryId?: string;
  price?: number;
  store?: string;
}

// Price History
export interface PriceHistory {
  id: string;
  itemName: string;
  price: number;
  store: string | null;
  recordedAt: number;
}

// API Response
export interface APIResponse<T> {
  data?: T;
  error?: APIError;
}

export interface APIError {
  code: string;
  message: string;
}
