package repository

import (
	"errors"

	"gorm.io/gorm"

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
	return r.db.Create(category).Error
}

func (r *CategoryRepository) GetAll() ([]models.Category, error) {
	var categories []models.Category
	err := r.db.Order("sort_order ASC").Find(&categories).Error
	if err != nil {
		return nil, err
	}
	return categories, nil
}

func (r *CategoryRepository) GetByID(id string) (*models.Category, error) {
	var category models.Category
	err := r.db.First(&category, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCategoryNotFound
		}
		return nil, err
	}
	return &category, nil
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

	// Build updates map
	updates := make(map[string]interface{})
	if name != nil {
		updates["name"] = *name
	}
	if icon != nil {
		updates["icon"] = *icon
	}
	if color != nil {
		updates["color"] = *color
	}
	if sortOrder != nil {
		updates["sort_order"] = *sortOrder
	}

	if len(updates) == 0 {
		return nil // Nothing to update
	}

	result := r.db.Model(&models.Category{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
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

	result := r.db.Delete(&models.Category{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrCategoryNotFound
	}

	return nil
}

func (r *CategoryRepository) GetMaxSortOrder() (int, error) {
	var maxOrder *int
	err := r.db.Model(&models.Category{}).Select("MAX(sort_order)").Scan(&maxOrder).Error
	if err != nil {
		return 0, err
	}
	if maxOrder == nil {
		return -1, nil
	}
	return *maxOrder, nil
}
