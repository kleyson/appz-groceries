package repository

import (
	"os"
	"testing"
	"time"

	"github.com/kleyson/groceries/backend/internal/db"
	"github.com/kleyson/groceries/backend/internal/models"
)

func setupTestDB(t *testing.T) (*db.DB, func()) {
	// Create a temporary database file
	tmpFile, err := os.CreateTemp("", "test-*.db")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	tmpFile.Close()

	database, err := db.New(tmpFile.Name())
	if err != nil {
		os.Remove(tmpFile.Name())
		t.Fatalf("Failed to create database: %v", err)
	}

	if err := database.Migrate(); err != nil {
		database.Close()
		os.Remove(tmpFile.Name())
		t.Fatalf("Failed to migrate database: %v", err)
	}

	cleanup := func() {
		database.Close()
		os.Remove(tmpFile.Name())
	}

	return database, cleanup
}

func TestUserRepository_Create(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewUserRepository(database)

	user := &models.User{
		ID:           "test-id-1",
		Username:     "testuser",
		Name:         "Test User",
		PasswordHash: "hashedpassword",
		IsAdmin:      true,
		CreatedAt:    time.Now().UnixMilli(),
	}

	err := repo.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Try to create duplicate username
	duplicateUser := &models.User{
		ID:           "test-id-2",
		Username:     "testuser",
		Name:         "Another User",
		PasswordHash: "hashedpassword",
		IsAdmin:      false,
		CreatedAt:    time.Now().UnixMilli(),
	}

	err = repo.Create(duplicateUser)
	if err != ErrUsernameTaken {
		t.Errorf("Expected ErrUsernameTaken, got %v", err)
	}
}

func TestUserRepository_GetByID(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewUserRepository(database)

	user := &models.User{
		ID:           "test-id-1",
		Username:     "testuser",
		Name:         "Test User",
		PasswordHash: "hashedpassword",
		IsAdmin:      true,
		CreatedAt:    time.Now().UnixMilli(),
	}

	if err := repo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Get existing user
	found, err := repo.GetByID("test-id-1")
	if err != nil {
		t.Fatalf("Failed to get user: %v", err)
	}

	if found.Username != user.Username {
		t.Errorf("Expected username %s, got %s", user.Username, found.Username)
	}

	if found.Name != user.Name {
		t.Errorf("Expected name %s, got %s", user.Name, found.Name)
	}

	if found.IsAdmin != user.IsAdmin {
		t.Errorf("Expected isAdmin %v, got %v", user.IsAdmin, found.IsAdmin)
	}

	// Get non-existing user
	_, err = repo.GetByID("non-existent")
	if err != ErrUserNotFound {
		t.Errorf("Expected ErrUserNotFound, got %v", err)
	}
}

func TestUserRepository_GetByUsername(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewUserRepository(database)

	user := &models.User{
		ID:           "test-id-1",
		Username:     "testuser",
		Name:         "Test User",
		PasswordHash: "hashedpassword",
		IsAdmin:      false,
		CreatedAt:    time.Now().UnixMilli(),
	}

	if err := repo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Get existing user
	found, err := repo.GetByUsername("testuser")
	if err != nil {
		t.Fatalf("Failed to get user: %v", err)
	}

	if found.ID != user.ID {
		t.Errorf("Expected ID %s, got %s", user.ID, found.ID)
	}

	// Get non-existing user
	_, err = repo.GetByUsername("nonexistent")
	if err != ErrUserNotFound {
		t.Errorf("Expected ErrUserNotFound, got %v", err)
	}
}

func TestUserRepository_GetAll(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewUserRepository(database)

	// Initially empty
	users, err := repo.GetAll()
	if err != nil {
		t.Fatalf("Failed to get users: %v", err)
	}
	if len(users) != 0 {
		t.Errorf("Expected 0 users, got %d", len(users))
	}

	// Add users
	for i := 0; i < 3; i++ {
		user := &models.User{
			ID:           "test-id-" + string(rune('a'+i)),
			Username:     "user" + string(rune('a'+i)),
			Name:         "User " + string(rune('A'+i)),
			PasswordHash: "hash",
			IsAdmin:      i == 0,
			CreatedAt:    time.Now().UnixMilli() + int64(i),
		}
		if err := repo.Create(user); err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}
	}

	users, err = repo.GetAll()
	if err != nil {
		t.Fatalf("Failed to get users: %v", err)
	}
	if len(users) != 3 {
		t.Errorf("Expected 3 users, got %d", len(users))
	}
}

func TestUserRepository_Delete(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewUserRepository(database)

	user := &models.User{
		ID:           "test-id-1",
		Username:     "testuser",
		Name:         "Test User",
		PasswordHash: "hashedpassword",
		IsAdmin:      false,
		CreatedAt:    time.Now().UnixMilli(),
	}

	if err := repo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Delete existing user
	err := repo.Delete("test-id-1")
	if err != nil {
		t.Fatalf("Failed to delete user: %v", err)
	}

	// Verify deleted
	_, err = repo.GetByID("test-id-1")
	if err != ErrUserNotFound {
		t.Errorf("Expected ErrUserNotFound after delete, got %v", err)
	}

	// Delete non-existing user
	err = repo.Delete("non-existent")
	if err != ErrUserNotFound {
		t.Errorf("Expected ErrUserNotFound, got %v", err)
	}
}

func TestUserRepository_Count(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewUserRepository(database)

	// Initially zero
	count, err := repo.Count()
	if err != nil {
		t.Fatalf("Failed to count users: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected count 0, got %d", count)
	}

	// Add user
	user := &models.User{
		ID:           "test-id-1",
		Username:     "testuser",
		Name:         "Test User",
		PasswordHash: "hash",
		IsAdmin:      true,
		CreatedAt:    time.Now().UnixMilli(),
	}

	if err := repo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	count, err = repo.Count()
	if err != nil {
		t.Fatalf("Failed to count users: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected count 1, got %d", count)
	}
}
