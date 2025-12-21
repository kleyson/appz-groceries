package repository

import (
	"fmt"

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
	_, err := r.db.Exec(`
		INSERT INTO price_history (id, item_name, price, store, recorded_at)
		VALUES (?, ?, ?, ?, ?)
	`, ph.ID, ph.ItemName, ph.Price, ph.Store, ph.RecordedAt)
	if err != nil {
		return fmt.Errorf("failed to create price history: %w", err)
	}
	return nil
}

func (r *PriceHistoryRepository) GetByItemName(itemName string) ([]models.PriceHistory, error) {
	rows, err := r.db.Query(`
		SELECT id, item_name, price, store, recorded_at
		FROM price_history
		WHERE item_name = ?
		ORDER BY recorded_at DESC
	`, itemName)
	if err != nil {
		return nil, fmt.Errorf("failed to get price history: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var history []models.PriceHistory
	for rows.Next() {
		var ph models.PriceHistory
		err := rows.Scan(&ph.ID, &ph.ItemName, &ph.Price, &ph.Store, &ph.RecordedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan price history: %w", err)
		}
		history = append(history, ph)
	}

	if history == nil {
		history = []models.PriceHistory{}
	}

	return history, nil
}

func (r *PriceHistoryRepository) GetLatestByItemName(itemName string) (*models.PriceHistory, error) {
	ph := &models.PriceHistory{}
	err := r.db.QueryRow(`
		SELECT id, item_name, price, store, recorded_at
		FROM price_history
		WHERE item_name = ?
		ORDER BY recorded_at DESC
		LIMIT 1
	`, itemName).Scan(&ph.ID, &ph.ItemName, &ph.Price, &ph.Store, &ph.RecordedAt)
	if err != nil {
		return nil, nil // No history found is not an error
	}
	return ph, nil
}
