package api

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/kleyson/groceries/backend/internal/auth"
	"github.com/kleyson/groceries/backend/internal/models"
	"github.com/kleyson/groceries/backend/internal/repository"
)

type ItemHandler struct {
	itemRepo *repository.ItemRepository
	listRepo *repository.ListRepository
}

func NewItemHandler(itemRepo *repository.ItemRepository, listRepo *repository.ListRepository) *ItemHandler {
	return &ItemHandler{
		itemRepo: itemRepo,
		listRepo: listRepo,
	}
}

// GetByListID returns all items for a list
func (h *ItemHandler) GetByListID(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")

	items, err := h.itemRepo.GetByListID(listID)
	if err != nil {
		InternalError(w, "Failed to get items")
		return
	}

	JSON(w, http.StatusOK, items)
}

// Create creates a new item
func (h *ItemHandler) Create(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")

	var req models.CreateItemRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	// Validate
	if len(req.Name) == 0 {
		BadRequest(w, "Name is required")
		return
	}
	if len(req.Name) > 200 {
		BadRequest(w, "Name must be at most 200 characters")
		return
	}
	if req.Quantity < 1 {
		req.Quantity = 1
	}
	if req.CategoryID == "" {
		req.CategoryID = "other"
	}
	if req.Price != nil && *req.Price < 0 {
		BadRequest(w, "Price must be non-negative")
		return
	}

	// Get next sort order
	maxOrder, err := h.itemRepo.GetMaxSortOrder(listID)
	if err != nil {
		InternalError(w, "Failed to get sort order")
		return
	}

	item := &models.Item{
		ID:         auth.GenerateID(),
		ListID:     listID,
		Name:       req.Name,
		Quantity:   req.Quantity,
		Unit:       req.Unit,
		CategoryID: req.CategoryID,
		Checked:    false,
		Price:      req.Price,
		Store:      req.Store,
		SortOrder:  maxOrder + 1,
	}

	if err := h.itemRepo.Create(item); err != nil {
		InternalError(w, "Failed to create item")
		return
	}

	// Update list's updatedAt
	_ = h.listRepo.TouchUpdatedAt(listID, auth.GetCurrentTimestamp())

	JSON(w, http.StatusCreated, item)
}

// Update updates an item
func (h *ItemHandler) Update(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")
	id := chi.URLParam(r, "id")

	// Get existing item
	item, err := h.itemRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrItemNotFound) {
			NotFound(w, "Item not found")
			return
		}
		InternalError(w, "Failed to get item")
		return
	}

	// Verify item belongs to list
	if item.ListID != listID {
		NotFound(w, "Item not found in this list")
		return
	}

	var req models.UpdateItemRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	// Apply updates
	if req.Name != nil {
		if len(*req.Name) == 0 {
			BadRequest(w, "Name cannot be empty")
			return
		}
		if len(*req.Name) > 200 {
			BadRequest(w, "Name must be at most 200 characters")
			return
		}
		item.Name = *req.Name
	}
	if req.Quantity != nil {
		if *req.Quantity < 1 {
			BadRequest(w, "Quantity must be positive")
			return
		}
		item.Quantity = *req.Quantity
	}
	if req.Unit != nil {
		item.Unit = req.Unit
	}
	if req.CategoryID != nil {
		item.CategoryID = *req.CategoryID
	}
	if req.Price != nil {
		if *req.Price < 0 {
			BadRequest(w, "Price must be non-negative")
			return
		}
		item.Price = req.Price
	}
	if req.Store != nil {
		item.Store = req.Store
	}

	if err := h.itemRepo.Update(item); err != nil {
		InternalError(w, "Failed to update item")
		return
	}

	// Update list's updatedAt
	_ = h.listRepo.TouchUpdatedAt(listID, auth.GetCurrentTimestamp())

	JSON(w, http.StatusOK, item)
}

// ToggleChecked toggles an item's checked state
func (h *ItemHandler) ToggleChecked(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")
	id := chi.URLParam(r, "id")

	// Verify item exists and belongs to list
	item, err := h.itemRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrItemNotFound) {
			NotFound(w, "Item not found")
			return
		}
		InternalError(w, "Failed to get item")
		return
	}

	if item.ListID != listID {
		NotFound(w, "Item not found in this list")
		return
	}

	if err := h.itemRepo.ToggleChecked(id); err != nil {
		InternalError(w, "Failed to toggle item")
		return
	}

	// Return updated item
	item.Checked = !item.Checked
	JSON(w, http.StatusOK, item)
}

// Delete deletes an item
func (h *ItemHandler) Delete(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")
	id := chi.URLParam(r, "id")

	// Verify item exists and belongs to list
	item, err := h.itemRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrItemNotFound) {
			NotFound(w, "Item not found")
			return
		}
		InternalError(w, "Failed to get item")
		return
	}

	if item.ListID != listID {
		NotFound(w, "Item not found in this list")
		return
	}

	if err := h.itemRepo.Delete(id); err != nil {
		InternalError(w, "Failed to delete item")
		return
	}

	// Update list's updatedAt
	_ = h.listRepo.TouchUpdatedAt(listID, auth.GetCurrentTimestamp())

	JSON(w, http.StatusOK, map[string]bool{"success": true})
}

// Reorder reorders items in a list
func (h *ItemHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")

	var req models.ReorderItemsRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	if len(req.ItemIDs) == 0 {
		BadRequest(w, "Item IDs are required")
		return
	}

	if err := h.itemRepo.Reorder(req.ItemIDs); err != nil {
		InternalError(w, "Failed to reorder items")
		return
	}

	// Update list's updatedAt
	_ = h.listRepo.TouchUpdatedAt(listID, auth.GetCurrentTimestamp())

	JSON(w, http.StatusOK, map[string]bool{"success": true})
}
