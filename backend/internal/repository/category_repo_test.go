package repository

import (
	"testing"

	"github.com/kleyson/groceries/backend/internal/models"
)

func TestCategoryRepository_Create(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewCategoryRepository(database)

	category := &models.Category{
		ID:        "cat-1",
		Name:      "Custom",
		Icon:      "star",
		Color:     "#FF5733",
		SortOrder: 100,
		IsDefault: false,
	}

	err := repo.Create(category)
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Verify created
	found, err := repo.GetByID("cat-1")
	if err != nil {
		t.Fatalf("Failed to get created category: %v", err)
	}

	if found.Name != category.Name {
		t.Errorf("Expected name %s, got %s", category.Name, found.Name)
	}

	if found.Icon != category.Icon {
		t.Errorf("Expected icon %s, got %s", category.Icon, found.Icon)
	}
}

func TestCategoryRepository_GetAll(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewCategoryRepository(database)

	// Add categories
	for i := 0; i < 3; i++ {
		category := &models.Category{
			ID:        "cat-" + string(rune('a'+i)),
			Name:      "Category " + string(rune('A'+i)),
			Icon:      "icon",
			Color:     "#000000",
			SortOrder: i,
			IsDefault: false,
		}
		if err := repo.Create(category); err != nil {
			t.Fatalf("Failed to create category: %v", err)
		}
	}

	categories, err := repo.GetAll()
	if err != nil {
		t.Fatalf("Failed to get categories: %v", err)
	}

	// Should include the 10 seeded defaults + 3 custom
	if len(categories) < 3 {
		t.Errorf("Expected at least 3 categories, got %d", len(categories))
	}

	// Verify sorted by sort_order
	for i := 1; i < len(categories); i++ {
		if categories[i].SortOrder < categories[i-1].SortOrder {
			t.Errorf("Categories not sorted by sort_order")
		}
	}
}

func TestCategoryRepository_GetByID(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewCategoryRepository(database)

	category := &models.Category{
		ID:        "cat-1",
		Name:      "Test Category",
		Icon:      "test",
		Color:     "#123456",
		SortOrder: 50,
		IsDefault: false,
	}

	if err := repo.Create(category); err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Get existing category
	found, err := repo.GetByID("cat-1")
	if err != nil {
		t.Fatalf("Failed to get category: %v", err)
	}

	if found.Name != category.Name {
		t.Errorf("Expected name %s, got %s", category.Name, found.Name)
	}

	if found.IsDefault != false {
		t.Errorf("Expected IsDefault false, got %v", found.IsDefault)
	}

	// Get non-existing category
	_, err = repo.GetByID("non-existent")
	if err != ErrCategoryNotFound {
		t.Errorf("Expected ErrCategoryNotFound, got %v", err)
	}
}

func TestCategoryRepository_Update(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewCategoryRepository(database)

	// Create non-default category
	category := &models.Category{
		ID:        "cat-1",
		Name:      "Old Name",
		Icon:      "old-icon",
		Color:     "#000000",
		SortOrder: 50,
		IsDefault: false,
	}

	if err := repo.Create(category); err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Update category
	newName := "New Name"
	newIcon := "new-icon"
	err := repo.Update("cat-1", &newName, &newIcon, nil, nil)
	if err != nil {
		t.Fatalf("Failed to update category: %v", err)
	}

	// Verify update
	updated, err := repo.GetByID("cat-1")
	if err != nil {
		t.Fatalf("Failed to get updated category: %v", err)
	}

	if updated.Name != "New Name" {
		t.Errorf("Expected name 'New Name', got %s", updated.Name)
	}

	if updated.Icon != "new-icon" {
		t.Errorf("Expected icon 'new-icon', got %s", updated.Icon)
	}

	// Update non-existing category
	err = repo.Update("non-existent", &newName, nil, nil, nil)
	if err != ErrCategoryNotFound {
		t.Errorf("Expected ErrCategoryNotFound, got %v", err)
	}
}

func TestCategoryRepository_Update_DefaultCategory(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewCategoryRepository(database)

	// Create default category
	category := &models.Category{
		ID:        "cat-default",
		Name:      "Default",
		Icon:      "default",
		Color:     "#FFFFFF",
		SortOrder: 0,
		IsDefault: true,
	}

	if err := repo.Create(category); err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Try to update default category
	newName := "Modified"
	err := repo.Update("cat-default", &newName, nil, nil, nil)
	if err != ErrCannotModifyDefault {
		t.Errorf("Expected ErrCannotModifyDefault, got %v", err)
	}
}

func TestCategoryRepository_Delete(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewCategoryRepository(database)

	category := &models.Category{
		ID:        "cat-1",
		Name:      "To Delete",
		Icon:      "delete",
		Color:     "#FF0000",
		SortOrder: 50,
		IsDefault: false,
	}

	if err := repo.Create(category); err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Delete category
	err := repo.Delete("cat-1")
	if err != nil {
		t.Fatalf("Failed to delete category: %v", err)
	}

	// Verify deleted
	_, err = repo.GetByID("cat-1")
	if err != ErrCategoryNotFound {
		t.Errorf("Expected ErrCategoryNotFound after delete, got %v", err)
	}

	// Delete non-existing category
	err = repo.Delete("non-existent")
	if err != ErrCategoryNotFound {
		t.Errorf("Expected ErrCategoryNotFound, got %v", err)
	}
}

func TestCategoryRepository_Delete_DefaultCategory(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewCategoryRepository(database)

	// Create default category
	category := &models.Category{
		ID:        "cat-default",
		Name:      "Default",
		Icon:      "default",
		Color:     "#FFFFFF",
		SortOrder: 0,
		IsDefault: true,
	}

	if err := repo.Create(category); err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Try to delete default category
	err := repo.Delete("cat-default")
	if err != ErrCannotDeleteDefault {
		t.Errorf("Expected ErrCannotDeleteDefault, got %v", err)
	}
}

func TestCategoryRepository_GetMaxSortOrder(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewCategoryRepository(database)

	// Get max sort order (includes seeded defaults)
	initialMax, err := repo.GetMaxSortOrder()
	if err != nil {
		t.Fatalf("Failed to get max sort order: %v", err)
	}

	// Add category with higher sort order
	category := &models.Category{
		ID:        "cat-1",
		Name:      "High Order",
		Icon:      "high",
		Color:     "#000000",
		SortOrder: initialMax + 10,
		IsDefault: false,
	}

	if err := repo.Create(category); err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	newMax, err := repo.GetMaxSortOrder()
	if err != nil {
		t.Fatalf("Failed to get max sort order: %v", err)
	}

	if newMax != initialMax+10 {
		t.Errorf("Expected max sort order %d, got %d", initialMax+10, newMax)
	}
}
