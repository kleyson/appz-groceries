package db

import "fmt"

// DefaultCategories are the preset grocery categories
var DefaultCategories = []struct {
	ID        string
	Name      string
	Icon      string
	Color     string
	SortOrder int
}{
	{"produce", "Produce", "shopping-bag", "#22C55E", 0},
	{"dairy", "Dairy", "droplet", "#3B82F6", 1},
	{"meat", "Meat", "target", "#EF4444", 2},
	{"bakery", "Bakery", "sun", "#F59E0B", 3},
	{"frozen", "Frozen", "thermometer", "#06B6D4", 4},
	{"beverages", "Beverages", "coffee", "#8B5CF6", 5},
	{"snacks", "Snacks", "zap", "#EC4899", 6},
	{"pantry", "Pantry", "archive", "#78716C", 7},
	{"household", "Household", "home", "#6366F1", 8},
	{"other", "Other", "package", "#94A3B8", 9},
}

// Seed populates the database with default data
func (db *DB) Seed() error {
	// Check if categories already exist
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM categories WHERE is_default = 1").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check existing categories: %w", err)
	}

	// Skip seeding if default categories already exist
	if count > 0 {
		return nil
	}

	// Insert default categories
	stmt, err := db.Prepare(`
		INSERT INTO categories (id, name, icon, color, sort_order, is_default)
		VALUES (?, ?, ?, ?, ?, 1)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare insert statement: %w", err)
	}
	defer stmt.Close()

	for _, cat := range DefaultCategories {
		if _, err := stmt.Exec(cat.ID, cat.Name, cat.Icon, cat.Color, cat.SortOrder); err != nil {
			return fmt.Errorf("failed to insert category %s: %w", cat.ID, err)
		}
	}

	return nil
}
