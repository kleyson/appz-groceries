package repository

import (
	"testing"
	"time"

	"github.com/kleyson/groceries/backend/internal/models"
)

func TestListRepository_Create(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewListRepository(database)

	list := &models.List{
		ID:        "list-1",
		Name:      "Weekly Groceries",
		Version:   1,
		CreatedAt: time.Now().UnixMilli(),
		UpdatedAt: time.Now().UnixMilli(),
	}

	err := repo.Create(list)
	if err != nil {
		t.Fatalf("Failed to create list: %v", err)
	}

	// Verify created
	found, err := repo.GetByID("list-1")
	if err != nil {
		t.Fatalf("Failed to get created list: %v", err)
	}

	if found.Name != list.Name {
		t.Errorf("Expected name %s, got %s", list.Name, found.Name)
	}
}

func TestListRepository_GetByID(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewListRepository(database)

	list := &models.List{
		ID:        "list-1",
		Name:      "Weekly Groceries",
		Version:   1,
		CreatedAt: time.Now().UnixMilli(),
		UpdatedAt: time.Now().UnixMilli(),
	}

	if err := repo.Create(list); err != nil {
		t.Fatalf("Failed to create list: %v", err)
	}

	// Get existing list
	found, err := repo.GetByID("list-1")
	if err != nil {
		t.Fatalf("Failed to get list: %v", err)
	}

	if found.Name != list.Name {
		t.Errorf("Expected name %s, got %s", list.Name, found.Name)
	}

	// Get non-existing list
	_, err = repo.GetByID("non-existent")
	if err != ErrListNotFound {
		t.Errorf("Expected ErrListNotFound, got %v", err)
	}
}

func TestListRepository_GetAll(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewListRepository(database)

	// Initially empty
	lists, err := repo.GetAll()
	if err != nil {
		t.Fatalf("Failed to get lists: %v", err)
	}
	if len(lists) != 0 {
		t.Errorf("Expected 0 lists, got %d", len(lists))
	}

	// Add lists
	now := time.Now().UnixMilli()
	for i := 0; i < 3; i++ {
		list := &models.List{
			ID:        "list-" + string(rune('a'+i)),
			Name:      "List " + string(rune('A'+i)),
			Version:   1,
			CreatedAt: now + int64(i),
			UpdatedAt: now + int64(i),
		}
		if err := repo.Create(list); err != nil {
			t.Fatalf("Failed to create list: %v", err)
		}
	}

	lists, err = repo.GetAll()
	if err != nil {
		t.Fatalf("Failed to get lists: %v", err)
	}
	if len(lists) != 3 {
		t.Errorf("Expected 3 lists, got %d", len(lists))
	}
}

func TestListRepository_Update(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewListRepository(database)

	list := &models.List{
		ID:        "list-1",
		Name:      "Old Name",
		Version:   1,
		CreatedAt: time.Now().UnixMilli(),
		UpdatedAt: time.Now().UnixMilli(),
	}

	if err := repo.Create(list); err != nil {
		t.Fatalf("Failed to create list: %v", err)
	}

	// Update list
	err := repo.Update("list-1", "New Name", time.Now().UnixMilli())
	if err != nil {
		t.Fatalf("Failed to update list: %v", err)
	}

	// Verify update
	updated, err := repo.GetByID("list-1")
	if err != nil {
		t.Fatalf("Failed to get updated list: %v", err)
	}

	if updated.Name != "New Name" {
		t.Errorf("Expected name 'New Name', got %s", updated.Name)
	}

	if updated.Version != 2 {
		t.Errorf("Expected version 2, got %d", updated.Version)
	}

	// Update non-existing list
	err = repo.Update("non-existent", "Name", time.Now().UnixMilli())
	if err != ErrListNotFound {
		t.Errorf("Expected ErrListNotFound, got %v", err)
	}
}

func TestListRepository_Delete(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewListRepository(database)

	list := &models.List{
		ID:        "list-1",
		Name:      "To Delete",
		Version:   1,
		CreatedAt: time.Now().UnixMilli(),
		UpdatedAt: time.Now().UnixMilli(),
	}

	if err := repo.Create(list); err != nil {
		t.Fatalf("Failed to create list: %v", err)
	}

	// Delete list
	err := repo.Delete("list-1")
	if err != nil {
		t.Fatalf("Failed to delete list: %v", err)
	}

	// Verify deleted
	_, err = repo.GetByID("list-1")
	if err != ErrListNotFound {
		t.Errorf("Expected ErrListNotFound after delete, got %v", err)
	}

	// Delete non-existing list
	err = repo.Delete("non-existent")
	if err != ErrListNotFound {
		t.Errorf("Expected ErrListNotFound, got %v", err)
	}
}
