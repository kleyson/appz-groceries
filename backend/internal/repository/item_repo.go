package repository

import (
	"errors"

	"gorm.io/gorm"

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
	return r.db.Create(item).Error
}

func (r *ItemRepository) GetByListID(listID string) ([]models.Item, error) {
	var items []models.Item
	err := r.db.Where("list_id = ?", listID).Order("sort_order ASC").Find(&items).Error
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *ItemRepository) GetByID(id string) (*models.Item, error) {
	var item models.Item
	err := r.db.First(&item, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrItemNotFound
		}
		return nil, err
	}
	return &item, nil
}

func (r *ItemRepository) Update(item *models.Item) error {
	result := r.db.Model(&models.Item{}).
		Where("id = ?", item.ID).
		Updates(map[string]interface{}{
			"name":        item.Name,
			"quantity":    item.Quantity,
			"unit":        item.Unit,
			"category_id": item.CategoryID,
			"price":       item.Price,
			"store":       item.Store,
			"version":     gorm.Expr("version + 1"),
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrItemNotFound
	}

	return nil
}

// UpdateWithVersion updates an item only if the version matches (optimistic locking)
func (r *ItemRepository) UpdateWithVersion(item *models.Item, expectedVersion int) error {
	result := r.db.Model(&models.Item{}).
		Where("id = ? AND version = ?", item.ID, expectedVersion).
		Updates(map[string]interface{}{
			"name":        item.Name,
			"quantity":    item.Quantity,
			"unit":        item.Unit,
			"category_id": item.CategoryID,
			"price":       item.Price,
			"store":       item.Store,
			"version":     gorm.Expr("version + 1"),
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		// Check if the item exists
		var count int64
		r.db.Model(&models.Item{}).Where("id = ?", item.ID).Count(&count)
		if count > 0 {
			return ErrItemVersionConflict
		}
		return ErrItemNotFound
	}

	return nil
}

func (r *ItemRepository) ToggleChecked(id string, userID string, userName string) (*models.Item, error) {
	// First get the current state
	item, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}

	newChecked := !item.Checked

	// Prepare updates
	updates := map[string]interface{}{
		"checked": newChecked,
		"version": gorm.Expr("version + 1"),
	}

	// If checking, set the user info; if unchecking, clear it
	if newChecked {
		updates["checked_by"] = userID
		updates["checked_by_name"] = userName
	} else {
		updates["checked_by"] = nil
		updates["checked_by_name"] = nil
	}

	result := r.db.Model(&models.Item{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, ErrItemNotFound
	}

	// Update the item struct and return it
	item.Checked = newChecked
	if newChecked {
		item.CheckedBy = &userID
		item.CheckedByName = &userName
	} else {
		item.CheckedBy = nil
		item.CheckedByName = nil
	}
	item.Version++

	return item, nil
}

func (r *ItemRepository) Delete(id string) error {
	result := r.db.Delete(&models.Item{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrItemNotFound
	}
	return nil
}

func (r *ItemRepository) GetMaxSortOrder(listID string) (int, error) {
	var maxOrder *int
	err := r.db.Model(&models.Item{}).
		Where("list_id = ?", listID).
		Select("MAX(sort_order)").
		Scan(&maxOrder).Error

	if err != nil {
		return 0, err
	}
	if maxOrder == nil {
		return -1, nil
	}
	return *maxOrder, nil
}

func (r *ItemRepository) Reorder(itemIDs []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for i, id := range itemIDs {
			if err := tx.Model(&models.Item{}).Where("id = ?", id).Update("sort_order", i).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
