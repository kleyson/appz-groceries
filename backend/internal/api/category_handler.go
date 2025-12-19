package api

import (
	"errors"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
	"github.com/kleyson/groceries/backend/internal/auth"
	"github.com/kleyson/groceries/backend/internal/models"
	"github.com/kleyson/groceries/backend/internal/repository"
)

var hexColorRegex = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

type CategoryHandler struct {
	categoryRepo *repository.CategoryRepository
}

func NewCategoryHandler(categoryRepo *repository.CategoryRepository) *CategoryHandler {
	return &CategoryHandler{categoryRepo: categoryRepo}
}

// GetAll returns all categories
func (h *CategoryHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	categories, err := h.categoryRepo.GetAll()
	if err != nil {
		InternalError(w, "Failed to get categories")
		return
	}
	JSON(w, http.StatusOK, categories)
}

// Create creates a new category
func (h *CategoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateCategoryRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	// Validate
	if len(req.Name) == 0 {
		BadRequest(w, "Name is required")
		return
	}
	if len(req.Name) > 50 {
		BadRequest(w, "Name must be at most 50 characters")
		return
	}
	if len(req.Icon) == 0 {
		BadRequest(w, "Icon is required")
		return
	}
	if !hexColorRegex.MatchString(req.Color) {
		BadRequest(w, "Color must be a valid hex color (e.g., #FF5500)")
		return
	}

	// Get next sort order
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	} else {
		maxOrder, err := h.categoryRepo.GetMaxSortOrder()
		if err == nil {
			sortOrder = maxOrder + 1
		}
	}

	category := &models.Category{
		ID:        auth.GenerateID(),
		Name:      req.Name,
		Icon:      req.Icon,
		Color:     req.Color,
		SortOrder: sortOrder,
		IsDefault: false,
	}

	if err := h.categoryRepo.Create(category); err != nil {
		InternalError(w, "Failed to create category")
		return
	}

	JSON(w, http.StatusCreated, category)
}

// Update updates a category
func (h *CategoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req models.UpdateCategoryRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	// Validate
	if req.Name != nil && len(*req.Name) == 0 {
		BadRequest(w, "Name cannot be empty")
		return
	}
	if req.Name != nil && len(*req.Name) > 50 {
		BadRequest(w, "Name must be at most 50 characters")
		return
	}
	if req.Color != nil && !hexColorRegex.MatchString(*req.Color) {
		BadRequest(w, "Color must be a valid hex color (e.g., #FF5500)")
		return
	}

	if err := h.categoryRepo.Update(id, req.Name, req.Icon, req.Color, req.SortOrder); err != nil {
		if errors.Is(err, repository.ErrCategoryNotFound) {
			NotFound(w, "Category not found")
			return
		}
		if errors.Is(err, repository.ErrCannotModifyDefault) {
			Forbidden(w, "Cannot modify default category")
			return
		}
		InternalError(w, "Failed to update category")
		return
	}

	// Return updated category
	category, err := h.categoryRepo.GetByID(id)
	if err != nil {
		InternalError(w, "Failed to get updated category")
		return
	}

	JSON(w, http.StatusOK, category)
}

// Delete deletes a category
func (h *CategoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.categoryRepo.Delete(id); err != nil {
		if errors.Is(err, repository.ErrCategoryNotFound) {
			NotFound(w, "Category not found")
			return
		}
		if errors.Is(err, repository.ErrCannotDeleteDefault) {
			Forbidden(w, "Cannot delete default category")
			return
		}
		InternalError(w, "Failed to delete category")
		return
	}

	JSON(w, http.StatusOK, map[string]bool{"success": true})
}
