package models

// User represents a registered user
type User struct {
	ID           string `json:"id" gorm:"primaryKey;size:26"`
	Username     string `json:"username" gorm:"uniqueIndex;size:100;not null"`
	Name         string `json:"name" gorm:"size:200;not null"`
	PasswordHash string `json:"-" gorm:"column:password_hash;not null"`
	IsAdmin      bool   `json:"isAdmin" gorm:"column:is_admin;default:false;not null"`
	CreatedAt    int64  `json:"createdAt" gorm:"column:created_at;not null"`
}

// Session represents an active user session
type Session struct {
	ID        string `json:"id" gorm:"primaryKey;size:26"`
	UserID    string `json:"userId" gorm:"column:user_id;index;size:26;not null"`
	User      *User  `json:"-" gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
	ExpiresAt int64  `json:"expiresAt" gorm:"column:expires_at;index;not null"`
	CreatedAt int64  `json:"createdAt" gorm:"column:created_at;not null"`
}

// Category represents a grocery item category
type Category struct {
	ID        string `json:"id" gorm:"primaryKey;size:26"`
	Name      string `json:"name" gorm:"size:100;not null"`
	Icon      string `json:"icon" gorm:"size:50;not null"`
	Color     string `json:"color" gorm:"size:20;not null"`
	SortOrder int    `json:"sortOrder" gorm:"column:sort_order;default:0;not null"`
	IsDefault bool   `json:"isDefault" gorm:"column:is_default;default:false;not null"`
}

// List represents a grocery list
type List struct {
	ID        string `json:"id" gorm:"primaryKey;size:26"`
	Name      string `json:"name" gorm:"size:200;not null"`
	Version   int    `json:"version" gorm:"default:1;not null"`
	CreatedAt int64  `json:"createdAt" gorm:"column:created_at;not null"`
	UpdatedAt int64  `json:"updatedAt" gorm:"column:updated_at;not null"`
	Items     []Item `json:"-" gorm:"foreignKey:ListID;constraint:OnDelete:CASCADE"`
}

// ListWithCounts includes item statistics (not a GORM model, used for queries)
type ListWithCounts struct {
	List
	TotalItems   int     `json:"totalItems"`
	CheckedItems int     `json:"checkedItems"`
	TotalPrice   float64 `json:"totalPrice"`
}

// Item represents a grocery item in a list
type Item struct {
	ID            string    `json:"id" gorm:"primaryKey;size:26"`
	ListID        string    `json:"listId" gorm:"column:list_id;index;size:26;not null"`
	List          *List     `json:"-" gorm:"foreignKey:ListID"`
	Name          string    `json:"name" gorm:"size:200;not null"`
	Quantity      int       `json:"quantity" gorm:"default:1;not null"`
	Unit          *string   `json:"unit" gorm:"size:50"`
	CategoryID    string    `json:"categoryId" gorm:"column:category_id;index;size:26;not null;default:'10OTHER00000000000000000000'"`
	Category      *Category `json:"-" gorm:"foreignKey:CategoryID"`
	Checked       bool      `json:"checked" gorm:"default:false;not null"`
	CheckedBy     *string   `json:"checkedBy" gorm:"column:checked_by;size:26"`
	CheckedByUser *User     `json:"-" gorm:"foreignKey:CheckedBy"`
	CheckedByName *string   `json:"checkedByName" gorm:"column:checked_by_name;size:200"`
	Price         *float64  `json:"price"`
	Store         *string   `json:"store" gorm:"size:200"`
	SortOrder     int       `json:"sortOrder" gorm:"column:sort_order;default:0;not null"`
	Version       int       `json:"version" gorm:"default:1;not null"`
}

// PriceHistory tracks historical prices for items
type PriceHistory struct {
	ID         string  `json:"id" gorm:"primaryKey;size:26"`
	ItemName   string  `json:"itemName" gorm:"column:item_name;index;size:200;not null"`
	Price      float64 `json:"price" gorm:"not null"`
	Store      *string `json:"store" gorm:"size:200"`
	RecordedAt int64   `json:"recordedAt" gorm:"column:recorded_at;not null"`
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
