package db

import (
	"fmt"

	"github.com/kleyson/groceries/backend/internal/models"
)

// DefaultCategories are the preset grocery categories
var DefaultCategories = []models.Category{
	{ID: "01PRODUCE000000000000000000", Name: "Produce", Icon: "shopping-bag", Color: "#22C55E", SortOrder: 0, IsDefault: true},
	{ID: "02DAIRY00000000000000000000", Name: "Dairy", Icon: "droplet", Color: "#3B82F6", SortOrder: 1, IsDefault: true},
	{ID: "03MEAT000000000000000000000", Name: "Meat", Icon: "target", Color: "#EF4444", SortOrder: 2, IsDefault: true},
	{ID: "04BAKERY0000000000000000000", Name: "Bakery", Icon: "sun", Color: "#F59E0B", SortOrder: 3, IsDefault: true},
	{ID: "05FROZEN0000000000000000000", Name: "Frozen", Icon: "thermometer", Color: "#06B6D4", SortOrder: 4, IsDefault: true},
	{ID: "06BEVERAGES00000000000000000", Name: "Beverages", Icon: "coffee", Color: "#8B5CF6", SortOrder: 5, IsDefault: true},
	{ID: "07SNACKS0000000000000000000", Name: "Snacks", Icon: "zap", Color: "#EC4899", SortOrder: 6, IsDefault: true},
	{ID: "08PANTRY0000000000000000000", Name: "Pantry", Icon: "archive", Color: "#78716C", SortOrder: 7, IsDefault: true},
	{ID: "09HOUSEHOLD00000000000000000", Name: "Household", Icon: "home", Color: "#6366F1", SortOrder: 8, IsDefault: true},
	{ID: "10OTHER00000000000000000000", Name: "Other", Icon: "package", Color: "#94A3B8", SortOrder: 9, IsDefault: true},
}

// Seed populates the database with default data
func (db *DB) Seed() error {
	// Check if categories already exist
	var count int64
	if err := db.Model(&models.Category{}).Where("is_default = ?", true).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check existing categories: %w", err)
	}

	// Skip seeding if default categories already exist
	if count > 0 {
		return nil
	}

	// Insert default categories
	if err := db.Create(&DefaultCategories).Error; err != nil {
		return fmt.Errorf("failed to insert categories: %w", err)
	}

	return nil
}
