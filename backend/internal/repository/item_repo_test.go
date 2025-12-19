package repository

import (
	"testing"

	"github.com/kleyson/groceries/backend/internal/models"
)

func createTestList(t *testing.T, listRepo *ListRepository, id, name string) {
	list := &models.List{
		ID:        id,
		Name:      name,
		Version:   1,
		CreatedAt: 1000,
		UpdatedAt: 1000,
	}
	if err := listRepo.Create(list); err != nil {
		t.Fatalf("Failed to create test list: %v", err)
	}
}

func createTestCategory(t *testing.T, catRepo *CategoryRepository, id, name string) {
	category := &models.Category{
		ID:        id,
		Name:      name,
		Icon:      "test",
		Color:     "#000000",
		SortOrder: 0,
		IsDefault: false,
	}
	if err := catRepo.Create(category); err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}
}

func setupItemTestDB(t *testing.T) (*ItemRepository, *ListRepository, *CategoryRepository, func()) {
	database, cleanup := setupTestDB(t)
	listRepo := NewListRepository(database)
	catRepo := NewCategoryRepository(database)
	itemRepo := NewItemRepository(database)

	// Create test list and category that items require
	createTestList(t, listRepo, "list-1", "Test List")
	createTestCategory(t, catRepo, "test-cat", "Test Category")

	return itemRepo, listRepo, catRepo, cleanup
}

func TestItemRepository_Create(t *testing.T) {
	repo, _, _, cleanup := setupItemTestDB(t)
	defer cleanup()

	item := &models.Item{
		ID:         "item-1",
		ListID:     "list-1",
		Name:       "Milk",
		Quantity:   2,
		Unit:       strPtr("gallons"),
		CategoryID: "test-cat",
		Checked:    false,
		Price:      floatPtr(3.99),
		Store:      strPtr("Whole Foods"),
		SortOrder:  0,
	}

	err := repo.Create(item)
	if err != nil {
		t.Fatalf("Failed to create item: %v", err)
	}

	// Verify created
	found, err := repo.GetByID("item-1")
	if err != nil {
		t.Fatalf("Failed to get created item: %v", err)
	}

	if found.Name != item.Name {
		t.Errorf("Expected name %s, got %s", item.Name, found.Name)
	}

	if found.Version != 1 {
		t.Errorf("Expected version 1, got %d", found.Version)
	}
}

func TestItemRepository_GetByListID(t *testing.T) {
	repo, listRepo, _, cleanup := setupItemTestDB(t)
	defer cleanup()

	// Create additional list
	createTestList(t, listRepo, "list-2", "Other List")

	// Create items for list-1
	for i := 0; i < 3; i++ {
		item := &models.Item{
			ID:         "item-" + string(rune('a'+i)),
			ListID:     "list-1",
			Name:       "Item " + string(rune('A'+i)),
			Quantity:   1,
			CategoryID: "test-cat",
			SortOrder:  i,
		}
		if err := repo.Create(item); err != nil {
			t.Fatalf("Failed to create item: %v", err)
		}
	}

	// Create item for list-2
	item := &models.Item{
		ID:         "item-other",
		ListID:     "list-2",
		Name:       "Other Item",
		Quantity:   1,
		CategoryID: "test-cat",
		SortOrder:  0,
	}
	if err := repo.Create(item); err != nil {
		t.Fatalf("Failed to create item: %v", err)
	}

	// Get items for list-1
	items, err := repo.GetByListID("list-1")
	if err != nil {
		t.Fatalf("Failed to get items: %v", err)
	}

	if len(items) != 3 {
		t.Errorf("Expected 3 items, got %d", len(items))
	}

	// Verify sorted by sort_order
	for i, item := range items {
		if item.SortOrder != i {
			t.Errorf("Expected sort_order %d, got %d", i, item.SortOrder)
		}
	}

	// Empty list should return empty slice
	items, err = repo.GetByListID("non-existent")
	if err != nil {
		t.Fatalf("Failed to get items: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("Expected 0 items, got %d", len(items))
	}
}

func TestItemRepository_GetByID(t *testing.T) {
	repo, _, _, cleanup := setupItemTestDB(t)
	defer cleanup()

	item := &models.Item{
		ID:         "item-1",
		ListID:     "list-1",
		Name:       "Bread",
		Quantity:   1,
		Unit:       strPtr("loaf"),
		CategoryID: "test-cat",
		Checked:    false,
		SortOrder:  0,
	}

	if err := repo.Create(item); err != nil {
		t.Fatalf("Failed to create item: %v", err)
	}

	// Get existing item
	found, err := repo.GetByID("item-1")
	if err != nil {
		t.Fatalf("Failed to get item: %v", err)
	}

	if found.Name != item.Name {
		t.Errorf("Expected name %s, got %s", item.Name, found.Name)
	}

	// Get non-existing item
	_, err = repo.GetByID("non-existent")
	if err != ErrItemNotFound {
		t.Errorf("Expected ErrItemNotFound, got %v", err)
	}
}

func TestItemRepository_Update(t *testing.T) {
	repo, _, _, cleanup := setupItemTestDB(t)
	defer cleanup()

	item := &models.Item{
		ID:         "item-1",
		ListID:     "list-1",
		Name:       "Old Name",
		Quantity:   1,
		CategoryID: "test-cat",
		SortOrder:  0,
	}

	if err := repo.Create(item); err != nil {
		t.Fatalf("Failed to create item: %v", err)
	}

	// Update item
	item.Name = "New Name"
	item.Quantity = 5
	item.Price = floatPtr(9.99)

	err := repo.Update(item)
	if err != nil {
		t.Fatalf("Failed to update item: %v", err)
	}

	// Verify update
	updated, err := repo.GetByID("item-1")
	if err != nil {
		t.Fatalf("Failed to get updated item: %v", err)
	}

	if updated.Name != "New Name" {
		t.Errorf("Expected name 'New Name', got %s", updated.Name)
	}

	if updated.Quantity != 5 {
		t.Errorf("Expected quantity 5, got %d", updated.Quantity)
	}

	if updated.Version != 2 {
		t.Errorf("Expected version 2, got %d", updated.Version)
	}

	// Update non-existing item
	item.ID = "non-existent"
	err = repo.Update(item)
	if err != ErrItemNotFound {
		t.Errorf("Expected ErrItemNotFound, got %v", err)
	}
}

func TestItemRepository_ToggleChecked(t *testing.T) {
	repo, _, _, cleanup := setupItemTestDB(t)
	defer cleanup()

	item := &models.Item{
		ID:         "item-1",
		ListID:     "list-1",
		Name:       "Toggle Test",
		Quantity:   1,
		CategoryID: "test-cat",
		Checked:    false,
		SortOrder:  0,
	}

	if err := repo.Create(item); err != nil {
		t.Fatalf("Failed to create item: %v", err)
	}

	// Toggle to checked
	err := repo.ToggleChecked("item-1")
	if err != nil {
		t.Fatalf("Failed to toggle item: %v", err)
	}

	found, _ := repo.GetByID("item-1")
	if !found.Checked {
		t.Error("Expected item to be checked")
	}
	if found.Version != 2 {
		t.Errorf("Expected version 2, got %d", found.Version)
	}

	// Toggle back to unchecked
	err = repo.ToggleChecked("item-1")
	if err != nil {
		t.Fatalf("Failed to toggle item: %v", err)
	}

	found, _ = repo.GetByID("item-1")
	if found.Checked {
		t.Error("Expected item to be unchecked")
	}

	// Toggle non-existing item
	err = repo.ToggleChecked("non-existent")
	if err != ErrItemNotFound {
		t.Errorf("Expected ErrItemNotFound, got %v", err)
	}
}

func TestItemRepository_Delete(t *testing.T) {
	repo, _, _, cleanup := setupItemTestDB(t)
	defer cleanup()

	item := &models.Item{
		ID:         "item-1",
		ListID:     "list-1",
		Name:       "To Delete",
		Quantity:   1,
		CategoryID: "test-cat",
		SortOrder:  0,
	}

	if err := repo.Create(item); err != nil {
		t.Fatalf("Failed to create item: %v", err)
	}

	// Delete item
	err := repo.Delete("item-1")
	if err != nil {
		t.Fatalf("Failed to delete item: %v", err)
	}

	// Verify deleted
	_, err = repo.GetByID("item-1")
	if err != ErrItemNotFound {
		t.Errorf("Expected ErrItemNotFound after delete, got %v", err)
	}

	// Delete non-existing item
	err = repo.Delete("non-existent")
	if err != ErrItemNotFound {
		t.Errorf("Expected ErrItemNotFound, got %v", err)
	}
}

func TestItemRepository_GetMaxSortOrder(t *testing.T) {
	repo, _, _, cleanup := setupItemTestDB(t)
	defer cleanup()

	// Empty list should return -1
	maxOrder, err := repo.GetMaxSortOrder("list-1")
	if err != nil {
		t.Fatalf("Failed to get max sort order: %v", err)
	}
	if maxOrder != -1 {
		t.Errorf("Expected -1 for empty list, got %d", maxOrder)
	}

	// Add items with sort_order 0, 1, 2
	for i := 0; i < 3; i++ {
		item := &models.Item{
			ID:         "item-" + string(rune('a'+i)),
			ListID:     "list-1",
			Name:       "Item",
			Quantity:   1,
			CategoryID: "test-cat",
			SortOrder:  i,
		}
		if err := repo.Create(item); err != nil {
			t.Fatalf("Failed to create item: %v", err)
		}
	}

	maxOrder, err = repo.GetMaxSortOrder("list-1")
	if err != nil {
		t.Fatalf("Failed to get max sort order: %v", err)
	}
	if maxOrder != 2 {
		t.Errorf("Expected max sort order 2, got %d", maxOrder)
	}
}

func TestItemRepository_Reorder(t *testing.T) {
	repo, _, _, cleanup := setupItemTestDB(t)
	defer cleanup()

	// Create items with initial order
	for i := 0; i < 3; i++ {
		item := &models.Item{
			ID:         "item-" + string(rune('a'+i)),
			ListID:     "list-1",
			Name:       "Item " + string(rune('A'+i)),
			Quantity:   1,
			CategoryID: "test-cat",
			SortOrder:  i,
		}
		if err := repo.Create(item); err != nil {
			t.Fatalf("Failed to create item: %v", err)
		}
	}

	// Reorder: c, a, b
	err := repo.Reorder([]string{"item-c", "item-a", "item-b"})
	if err != nil {
		t.Fatalf("Failed to reorder: %v", err)
	}

	// Verify new order
	items, _ := repo.GetByListID("list-1")
	if items[0].ID != "item-c" {
		t.Errorf("Expected first item to be item-c, got %s", items[0].ID)
	}
	if items[1].ID != "item-a" {
		t.Errorf("Expected second item to be item-a, got %s", items[1].ID)
	}
	if items[2].ID != "item-b" {
		t.Errorf("Expected third item to be item-b, got %s", items[2].ID)
	}
}

// Helper functions
func strPtr(s string) *string {
	return &s
}

func floatPtr(f float64) *float64 {
	return &f
}
