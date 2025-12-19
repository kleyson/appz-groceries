package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/kleyson/groceries/backend/internal/db"
	"github.com/kleyson/groceries/backend/internal/models"
)

var ErrCategoryNotFound = errors.New("category not found")
var ErrCannotDeleteDefault = errors.New("cannot delete default category")
var ErrCannotModifyDefault = errors.New("cannot modify default category")

type CategoryRepository struct {
	db *db.DB
}

func NewCategoryRepository(database *db.DB) *CategoryRepository {
	return &CategoryRepository{db: database}
}

func (r *CategoryRepository) Create(category *models.Category) error {
	_, err := r.db.Exec(`
		INSERT INTO categories (id, name, icon, color, sort_order, is_default)
		VALUES (?, ?, ?, ?, ?, ?)
	`, category.ID, category.Name, category.Icon, category.Color, category.SortOrder, category.IsDefault)
	if err != nil {
		return fmt.Errorf("failed to create category: %w", err)
	}
	return nil
}

func (r *CategoryRepository) GetAll() ([]models.Category, error) {
	rows, err := r.db.Query(`
		SELECT id, name, icon, color, sort_order, is_default
		FROM categories
		ORDER BY sort_order ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get categories: %w", err)
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var cat models.Category
		var isDefault int
		err := rows.Scan(&cat.ID, &cat.Name, &cat.Icon, &cat.Color, &cat.SortOrder, &isDefault)
		if err != nil {
			return nil, fmt.Errorf("failed to scan category: %w", err)
		}
		cat.IsDefault = isDefault == 1
		categories = append(categories, cat)
	}

	if categories == nil {
		categories = []models.Category{}
	}

	return categories, nil
}

func (r *CategoryRepository) GetByID(id string) (*models.Category, error) {
	cat := &models.Category{}
	var isDefault int
	err := r.db.QueryRow(`
		SELECT id, name, icon, color, sort_order, is_default
		FROM categories WHERE id = ?
	`, id).Scan(&cat.ID, &cat.Name, &cat.Icon, &cat.Color, &cat.SortOrder, &isDefault)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCategoryNotFound
		}
		return nil, fmt.Errorf("failed to get category: %w", err)
	}
	cat.IsDefault = isDefault == 1
	return cat, nil
}

func (r *CategoryRepository) Update(id string, name, icon, color *string, sortOrder *int) error {
	// Check if it's a default category
	cat, err := r.GetByID(id)
	if err != nil {
		return err
	}
	if cat.IsDefault {
		return ErrCannotModifyDefault
	}

	// Build dynamic update query
	query := "UPDATE categories SET "
	args := []interface{}{}
	first := true

	if name != nil {
		if !first {
			query += ", "
		}
		query += "name = ?"
		args = append(args, *name)
		first = false
	}
	if icon != nil {
		if !first {
			query += ", "
		}
		query += "icon = ?"
		args = append(args, *icon)
		first = false
	}
	if color != nil {
		if !first {
			query += ", "
		}
		query += "color = ?"
		args = append(args, *color)
		first = false
	}
	if sortOrder != nil {
		if !first {
			query += ", "
		}
		query += "sort_order = ?"
		args = append(args, *sortOrder)
		first = false
	}

	if len(args) == 0 {
		return nil // Nothing to update
	}

	query += " WHERE id = ?"
	args = append(args, id)

	result, err := r.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to update category: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrCategoryNotFound
	}

	return nil
}

func (r *CategoryRepository) Delete(id string) error {
	// Check if it's a default category
	cat, err := r.GetByID(id)
	if err != nil {
		return err
	}
	if cat.IsDefault {
		return ErrCannotDeleteDefault
	}

	result, err := r.db.Exec("DELETE FROM categories WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete category: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrCategoryNotFound
	}

	return nil
}

func (r *CategoryRepository) GetMaxSortOrder() (int, error) {
	var maxOrder sql.NullInt64
	err := r.db.QueryRow("SELECT MAX(sort_order) FROM categories").Scan(&maxOrder)
	if err != nil {
		return 0, fmt.Errorf("failed to get max sort order: %w", err)
	}
	if !maxOrder.Valid {
		return -1, nil
	}
	return int(maxOrder.Int64), nil
}
