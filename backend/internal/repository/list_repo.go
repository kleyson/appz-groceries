package repository

import (
	"errors"

	"gorm.io/gorm"

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
	return r.db.Create(list).Error
}

func (r *ListRepository) GetAll() ([]models.ListWithCounts, error) {
	var lists []models.ListWithCounts

	err := r.db.Table("lists l").
		Select(`
			l.id, l.name, l.version, l.created_at, l.updated_at,
			COUNT(i.id) as total_items,
			SUM(CASE WHEN i.checked = 1 THEN 1 ELSE 0 END) as checked_items,
			COALESCE(SUM(CASE WHEN i.price IS NOT NULL THEN i.price * i.quantity ELSE 0 END), 0) as total_price
		`).
		Joins("LEFT JOIN items i ON l.id = i.list_id").
		Group("l.id").
		Order("l.updated_at DESC").
		Scan(&lists).Error

	if err != nil {
		return nil, err
	}

	if lists == nil {
		lists = []models.ListWithCounts{}
	}

	return lists, nil
}

func (r *ListRepository) GetByID(id string) (*models.ListWithCounts, error) {
	var list models.ListWithCounts

	err := r.db.Table("lists l").
		Select(`
			l.id, l.name, l.version, l.created_at, l.updated_at,
			COUNT(i.id) as total_items,
			SUM(CASE WHEN i.checked = 1 THEN 1 ELSE 0 END) as checked_items,
			COALESCE(SUM(CASE WHEN i.price IS NOT NULL THEN i.price * i.quantity ELSE 0 END), 0) as total_price
		`).
		Joins("LEFT JOIN items i ON l.id = i.list_id").
		Where("l.id = ?", id).
		Group("l.id").
		Scan(&list).Error

	if err != nil {
		return nil, err
	}

	if list.ID == "" {
		return nil, ErrListNotFound
	}

	return &list, nil
}

func (r *ListRepository) Update(id string, name string, updatedAt int64) error {
	result := r.db.Model(&models.List{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"name":       name,
			"version":    gorm.Expr("version + 1"),
			"updated_at": updatedAt,
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrListNotFound
	}

	return nil
}

// UpdateWithVersion updates a list only if the version matches (optimistic locking)
func (r *ListRepository) UpdateWithVersion(id string, name string, expectedVersion int, updatedAt int64) error {
	result := r.db.Model(&models.List{}).
		Where("id = ? AND version = ?", id, expectedVersion).
		Updates(map[string]interface{}{
			"name":       name,
			"version":    gorm.Expr("version + 1"),
			"updated_at": updatedAt,
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		// Check if the list exists
		var count int64
		r.db.Model(&models.List{}).Where("id = ?", id).Count(&count)
		if count > 0 {
			return ErrVersionConflict
		}
		return ErrListNotFound
	}

	return nil
}

func (r *ListRepository) Delete(id string) error {
	result := r.db.Delete(&models.List{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrListNotFound
	}
	return nil
}

func (r *ListRepository) TouchUpdatedAt(id string, updatedAt int64) error {
	return r.db.Model(&models.List{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"version":    gorm.Expr("version + 1"),
			"updated_at": updatedAt,
		}).Error
}
