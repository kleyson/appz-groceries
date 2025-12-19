package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/kleyson/groceries/backend/internal/db"
	"github.com/kleyson/groceries/backend/internal/models"
)

var ErrListNotFound = errors.New("list not found")
var ErrVersionConflict = errors.New("version conflict")

type ListRepository struct {
	db *db.DB
}

func NewListRepository(database *db.DB) *ListRepository {
	return &ListRepository{db: database}
}

func (r *ListRepository) Create(list *models.List) error {
	list.Version = 1 // Initial version
	_, err := r.db.Exec(`
		INSERT INTO lists (id, name, version, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`, list.ID, list.Name, list.Version, list.CreatedAt, list.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create list: %w", err)
	}
	return nil
}

func (r *ListRepository) GetAll() ([]models.ListWithCounts, error) {
	rows, err := r.db.Query(`
		SELECT
			l.id, l.name, l.version, l.created_at, l.updated_at,
			COUNT(i.id) as total_items,
			SUM(CASE WHEN i.checked = 1 THEN 1 ELSE 0 END) as checked_items,
			COALESCE(SUM(CASE WHEN i.price IS NOT NULL THEN i.price * i.quantity ELSE 0 END), 0) as total_price
		FROM lists l
		LEFT JOIN items i ON l.id = i.list_id
		GROUP BY l.id
		ORDER BY l.updated_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get lists: %w", err)
	}
	defer rows.Close()

	var lists []models.ListWithCounts
	for rows.Next() {
		var list models.ListWithCounts
		err := rows.Scan(
			&list.ID, &list.Name, &list.Version, &list.CreatedAt, &list.UpdatedAt,
			&list.TotalItems, &list.CheckedItems, &list.TotalPrice,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan list: %w", err)
		}
		lists = append(lists, list)
	}

	if lists == nil {
		lists = []models.ListWithCounts{}
	}

	return lists, nil
}

func (r *ListRepository) GetByID(id string) (*models.ListWithCounts, error) {
	list := &models.ListWithCounts{}
	err := r.db.QueryRow(`
		SELECT
			l.id, l.name, l.version, l.created_at, l.updated_at,
			COUNT(i.id) as total_items,
			SUM(CASE WHEN i.checked = 1 THEN 1 ELSE 0 END) as checked_items,
			COALESCE(SUM(CASE WHEN i.price IS NOT NULL THEN i.price * i.quantity ELSE 0 END), 0) as total_price
		FROM lists l
		LEFT JOIN items i ON l.id = i.list_id
		WHERE l.id = ?
		GROUP BY l.id
	`, id).Scan(
		&list.ID, &list.Name, &list.Version, &list.CreatedAt, &list.UpdatedAt,
		&list.TotalItems, &list.CheckedItems, &list.TotalPrice,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrListNotFound
		}
		return nil, fmt.Errorf("failed to get list: %w", err)
	}
	return list, nil
}

func (r *ListRepository) Update(id string, name string, updatedAt int64) error {
	// Increment version on every update
	result, err := r.db.Exec(`
		UPDATE lists SET name = ?, version = version + 1, updated_at = ? WHERE id = ?
	`, name, updatedAt, id)
	if err != nil {
		return fmt.Errorf("failed to update list: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrListNotFound
	}

	return nil
}

// UpdateWithVersion updates a list only if the version matches (optimistic locking)
func (r *ListRepository) UpdateWithVersion(id string, name string, expectedVersion int, updatedAt int64) error {
	result, err := r.db.Exec(`
		UPDATE lists SET name = ?, version = version + 1, updated_at = ?
		WHERE id = ? AND version = ?
	`, name, updatedAt, id, expectedVersion)
	if err != nil {
		return fmt.Errorf("failed to update list: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		// Check if the list exists
		var exists bool
		r.db.QueryRow("SELECT 1 FROM lists WHERE id = ?", id).Scan(&exists)
		if exists {
			return ErrVersionConflict
		}
		return ErrListNotFound
	}

	return nil
}

func (r *ListRepository) Delete(id string) error {
	result, err := r.db.Exec("DELETE FROM lists WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete list: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrListNotFound
	}

	return nil
}

func (r *ListRepository) TouchUpdatedAt(id string, updatedAt int64) error {
	_, err := r.db.Exec("UPDATE lists SET version = version + 1, updated_at = ? WHERE id = ?", updatedAt, id)
	if err != nil {
		return fmt.Errorf("failed to update list timestamp: %w", err)
	}
	return nil
}
