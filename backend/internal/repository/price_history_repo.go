package repository

import (
	"github.com/kleyson/groceries/backend/internal/db"
	"github.com/kleyson/groceries/backend/internal/models"
)

type PriceHistoryRepository struct {
	db *db.DB
}

func NewPriceHistoryRepository(database *db.DB) *PriceHistoryRepository {
	return &PriceHistoryRepository{db: database}
}

func (r *PriceHistoryRepository) Create(ph *models.PriceHistory) error {
	return r.db.Create(ph).Error
}

func (r *PriceHistoryRepository) GetByItemName(itemName string) ([]models.PriceHistory, error) {
	var history []models.PriceHistory
	err := r.db.Where("item_name = ?", itemName).
		Order("recorded_at DESC").
		Find(&history).Error

	if err != nil {
		return nil, err
	}

	if history == nil {
		history = []models.PriceHistory{}
	}

	return history, nil
}

func (r *PriceHistoryRepository) GetLatestByItemName(itemName string) (*models.PriceHistory, error) {
	var ph models.PriceHistory
	err := r.db.Where("item_name = ?", itemName).
		Order("recorded_at DESC").
		First(&ph).Error

	if err != nil {
		return nil, nil // No history found is not an error
	}

	return &ph, nil
}
