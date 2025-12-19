package api

import (
	"net/http"

	"github.com/kleyson/groceries/backend/internal/auth"
	"github.com/kleyson/groceries/backend/internal/models"
	"github.com/kleyson/groceries/backend/internal/repository"
)

type PriceHistoryHandler struct {
	priceHistoryRepo *repository.PriceHistoryRepository
}

func NewPriceHistoryHandler(priceHistoryRepo *repository.PriceHistoryRepository) *PriceHistoryHandler {
	return &PriceHistoryHandler{priceHistoryRepo: priceHistoryRepo}
}

// GetByItemName returns price history for an item
func (h *PriceHistoryHandler) GetByItemName(w http.ResponseWriter, r *http.Request) {
	itemName := r.URL.Query().Get("itemName")
	if itemName == "" {
		BadRequest(w, "itemName query parameter is required")
		return
	}

	history, err := h.priceHistoryRepo.GetByItemName(itemName)
	if err != nil {
		InternalError(w, "Failed to get price history")
		return
	}

	JSON(w, http.StatusOK, history)
}

// Create records a new price
func (h *PriceHistoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreatePriceHistoryRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	// Validate
	if len(req.ItemName) == 0 {
		BadRequest(w, "Item name is required")
		return
	}
	if req.Price < 0 {
		BadRequest(w, "Price must be non-negative")
		return
	}

	priceHistory := &models.PriceHistory{
		ID:         auth.GenerateID(),
		ItemName:   req.ItemName,
		Price:      req.Price,
		Store:      req.Store,
		RecordedAt: auth.GetCurrentTimestamp(),
	}

	if err := h.priceHistoryRepo.Create(priceHistory); err != nil {
		InternalError(w, "Failed to create price history")
		return
	}

	JSON(w, http.StatusCreated, priceHistory)
}
