package api

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/kleyson/groceries/backend/internal/auth"
	"github.com/kleyson/groceries/backend/internal/models"
	"github.com/kleyson/groceries/backend/internal/repository"
)

type ListHandler struct {
	listRepo *repository.ListRepository
}

func NewListHandler(listRepo *repository.ListRepository) *ListHandler {
	return &ListHandler{listRepo: listRepo}
}

// GetAll returns all lists
func (h *ListHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	lists, err := h.listRepo.GetAll()
	if err != nil {
		InternalError(w, "Failed to get lists")
		return
	}
	JSON(w, http.StatusOK, lists)
}

// GetByID returns a single list
func (h *ListHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	list, err := h.listRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrListNotFound) {
			NotFound(w, "List not found")
			return
		}
		InternalError(w, "Failed to get list")
		return
	}

	JSON(w, http.StatusOK, list)
}

// Create creates a new list
func (h *ListHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateListRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	// Validate
	if len(req.Name) == 0 {
		BadRequest(w, "Name is required")
		return
	}
	if len(req.Name) > 100 {
		BadRequest(w, "Name must be at most 100 characters")
		return
	}

	now := auth.GetCurrentTimestamp()
	list := &models.List{
		ID:        auth.GenerateID(),
		Name:      req.Name,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := h.listRepo.Create(list); err != nil {
		InternalError(w, "Failed to create list")
		return
	}

	// Return with counts (all zero for new list)
	result := models.ListWithCounts{
		List:         *list,
		TotalItems:   0,
		CheckedItems: 0,
		TotalPrice:   0,
	}

	JSON(w, http.StatusCreated, result)
}

// Update updates a list
func (h *ListHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req models.UpdateListRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	// Validate
	if len(req.Name) == 0 {
		BadRequest(w, "Name is required")
		return
	}
	if len(req.Name) > 100 {
		BadRequest(w, "Name must be at most 100 characters")
		return
	}

	if err := h.listRepo.Update(id, req.Name, auth.GetCurrentTimestamp()); err != nil {
		if errors.Is(err, repository.ErrListNotFound) {
			NotFound(w, "List not found")
			return
		}
		InternalError(w, "Failed to update list")
		return
	}

	// Return updated list
	list, err := h.listRepo.GetByID(id)
	if err != nil {
		InternalError(w, "Failed to get updated list")
		return
	}

	JSON(w, http.StatusOK, list)
}

// Delete deletes a list
func (h *ListHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.listRepo.Delete(id); err != nil {
		if errors.Is(err, repository.ErrListNotFound) {
			NotFound(w, "List not found")
			return
		}
		InternalError(w, "Failed to delete list")
		return
	}

	JSON(w, http.StatusOK, map[string]bool{"success": true})
}
