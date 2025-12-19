package models

// User represents a registered user
type User struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	Name         string `json:"name"`
	PasswordHash string `json:"-"` // Never expose in JSON
	IsAdmin      bool   `json:"isAdmin"`
	CreatedAt    int64  `json:"createdAt"`
}

// Session represents an active user session
type Session struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	ExpiresAt int64  `json:"expiresAt"`
	CreatedAt int64  `json:"createdAt"`
}

// Category represents a grocery item category
type Category struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Icon      string `json:"icon"`
	Color     string `json:"color"`
	SortOrder int    `json:"sortOrder"`
	IsDefault bool   `json:"isDefault"`
}

// List represents a grocery list
type List struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Version   int    `json:"version"` // For optimistic locking / conflict detection
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// ListWithCounts includes item statistics
type ListWithCounts struct {
	List
	TotalItems   int     `json:"totalItems"`
	CheckedItems int     `json:"checkedItems"`
	TotalPrice   float64 `json:"totalPrice"`
}

// Item represents a grocery item in a list
type Item struct {
	ID         string   `json:"id"`
	ListID     string   `json:"listId"`
	Name       string   `json:"name"`
	Quantity   int      `json:"quantity"`
	Unit       *string  `json:"unit"`
	CategoryID string   `json:"categoryId"`
	Checked    bool     `json:"checked"`
	Price      *float64 `json:"price"`
	Store      *string  `json:"store"`
	SortOrder  int      `json:"sortOrder"`
	Version    int      `json:"version"` // For optimistic locking / conflict detection
}

// PriceHistory tracks historical prices for items
type PriceHistory struct {
	ID         string  `json:"id"`
	ItemName   string  `json:"itemName"`
	Price      float64 `json:"price"`
	Store      *string `json:"store"`
	RecordedAt int64   `json:"recordedAt"`
}

// CreateListRequest is the request body for creating a list
type CreateListRequest struct {
	Name string `json:"name"`
}

// UpdateListRequest is the request body for updating a list
type UpdateListRequest struct {
	Name string `json:"name"`
}

// CreateItemRequest is the request body for creating an item
type CreateItemRequest struct {
	Name       string   `json:"name"`
	Quantity   int      `json:"quantity"`
	Unit       *string  `json:"unit"`
	CategoryID string   `json:"categoryId"`
	Price      *float64 `json:"price"`
	Store      *string  `json:"store"`
}

// UpdateItemRequest is the request body for updating an item
type UpdateItemRequest struct {
	Name       *string  `json:"name,omitempty"`
	Quantity   *int     `json:"quantity,omitempty"`
	Unit       *string  `json:"unit,omitempty"`
	CategoryID *string  `json:"categoryId,omitempty"`
	Price      *float64 `json:"price,omitempty"`
	Store      *string  `json:"store,omitempty"`
}

// ReorderItemsRequest is the request body for reordering items
type ReorderItemsRequest struct {
	ItemIDs []string `json:"itemIds"`
}

// CreateCategoryRequest is the request body for creating a category
type CreateCategoryRequest struct {
	Name      string `json:"name"`
	Icon      string `json:"icon"`
	Color     string `json:"color"`
	SortOrder *int   `json:"sortOrder,omitempty"`
}

// UpdateCategoryRequest is the request body for updating a category
type UpdateCategoryRequest struct {
	Name      *string `json:"name,omitempty"`
	Icon      *string `json:"icon,omitempty"`
	Color     *string `json:"color,omitempty"`
	SortOrder *int    `json:"sortOrder,omitempty"`
}

// CreatePriceHistoryRequest is the request body for recording a price
type CreatePriceHistoryRequest struct {
	ItemName string  `json:"itemName"`
	Price    float64 `json:"price"`
	Store    *string `json:"store,omitempty"`
}

// LoginRequest is the request body for login
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// RegisterRequest is the request body for first admin registration
type RegisterRequest struct {
	Username string `json:"username"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// CreateUserRequest is the request body for admin creating a new user
type CreateUserRequest struct {
	Username string `json:"username"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// AuthResponse is the response after successful auth
type AuthResponse struct {
	User *User `json:"user"`
}

// UsersResponse is the response for listing users
type UsersResponse struct {
	Users []User `json:"users"`
}

// APIResponse is a standard API response wrapper
type APIResponse struct {
	Data  interface{} `json:"data,omitempty"`
	Error *APIError   `json:"error,omitempty"`
}

// APIError represents an API error
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
