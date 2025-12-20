package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/kleyson/groceries/backend/internal/db"
	"github.com/kleyson/groceries/backend/internal/models"
)

var ErrItemNotFound = errors.New("item not found")
var ErrItemVersionConflict = errors.New("item version conflict")

type ItemRepository struct {
	db *db.DB
}

func NewItemRepository(database *db.DB) *ItemRepository {
	return &ItemRepository{db: database}
}

func (r *ItemRepository) Create(item *models.Item) error {
	item.Version = 1 // Initial version
	_, err := r.db.Exec(`
		INSERT INTO items (id, list_id, name, quantity, unit, category_id, checked, price, store, sort_order, version)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, item.ID, item.ListID, item.Name, item.Quantity, item.Unit, item.CategoryID, item.Checked, item.Price, item.Store, item.SortOrder, item.Version)
	if err != nil {
		return fmt.Errorf("failed to create item: %w", err)
	}
	return nil
}

func (r *ItemRepository) GetByListID(listID string) ([]models.Item, error) {
	rows, err := r.db.Query(`
		SELECT id, list_id, name, quantity, unit, category_id, checked, price, store, sort_order, version
		FROM items
		WHERE list_id = ?
		ORDER BY sort_order ASC
	`, listID)
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var items []models.Item
	for rows.Next() {
		var item models.Item
		err := rows.Scan(
			&item.ID, &item.ListID, &item.Name, &item.Quantity, &item.Unit,
			&item.CategoryID, &item.Checked, &item.Price, &item.Store, &item.SortOrder, &item.Version,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan item: %w", err)
		}
		items = append(items, item)
	}

	if items == nil {
		items = []models.Item{}
	}

	return items, nil
}

func (r *ItemRepository) GetByID(id string) (*models.Item, error) {
	item := &models.Item{}
	err := r.db.QueryRow(`
		SELECT id, list_id, name, quantity, unit, category_id, checked, price, store, sort_order, version
		FROM items WHERE id = ?
	`, id).Scan(
		&item.ID, &item.ListID, &item.Name, &item.Quantity, &item.Unit,
		&item.CategoryID, &item.Checked, &item.Price, &item.Store, &item.SortOrder, &item.Version,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrItemNotFound
		}
		return nil, fmt.Errorf("failed to get item: %w", err)
	}
	return item, nil
}

func (r *ItemRepository) Update(item *models.Item) error {
	// Increment version on every update
	result, err := r.db.Exec(`
		UPDATE items
		SET name = ?, quantity = ?, unit = ?, category_id = ?, price = ?, store = ?, version = version + 1
		WHERE id = ?
	`, item.Name, item.Quantity, item.Unit, item.CategoryID, item.Price, item.Store, item.ID)
	if err != nil {
		return fmt.Errorf("failed to update item: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrItemNotFound
	}

	return nil
}

// UpdateWithVersion updates an item only if the version matches (optimistic locking)
func (r *ItemRepository) UpdateWithVersion(item *models.Item, expectedVersion int) error {
	result, err := r.db.Exec(`
		UPDATE items
		SET name = ?, quantity = ?, unit = ?, category_id = ?, price = ?, store = ?, version = version + 1
		WHERE id = ? AND version = ?
	`, item.Name, item.Quantity, item.Unit, item.CategoryID, item.Price, item.Store, item.ID, expectedVersion)
	if err != nil {
		return fmt.Errorf("failed to update item: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		// Check if the item exists
		var exists bool
		_ = r.db.QueryRow("SELECT 1 FROM items WHERE id = ?", item.ID).Scan(&exists)
		if exists {
			return ErrItemVersionConflict
		}
		return ErrItemNotFound
	}

	return nil
}

func (r *ItemRepository) ToggleChecked(id string) error {
	// Increment version on toggle
	result, err := r.db.Exec("UPDATE items SET checked = NOT checked, version = version + 1 WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to toggle item: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrItemNotFound
	}

	return nil
}

func (r *ItemRepository) Delete(id string) error {
	result, err := r.db.Exec("DELETE FROM items WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete item: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrItemNotFound
	}

	return nil
}

func (r *ItemRepository) GetMaxSortOrder(listID string) (int, error) {
	var maxOrder sql.NullInt64
	err := r.db.QueryRow("SELECT MAX(sort_order) FROM items WHERE list_id = ?", listID).Scan(&maxOrder)
	if err != nil {
		return 0, fmt.Errorf("failed to get max sort order: %w", err)
	}
	if !maxOrder.Valid {
		return -1, nil
	}
	return int(maxOrder.Int64), nil
}

func (r *ItemRepository) Reorder(itemIDs []string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Don't increment version for reorder - it's a UI preference, not a data change
	stmt, err := tx.Prepare("UPDATE items SET sort_order = ? WHERE id = ?")
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer func() { _ = stmt.Close() }()

	for i, id := range itemIDs {
		if _, err := stmt.Exec(i, id); err != nil {
			return fmt.Errorf("failed to update sort order for item %s: %w", id, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
