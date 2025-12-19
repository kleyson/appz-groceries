package repository

import (
	"testing"
	"time"

	"github.com/kleyson/groceries/backend/internal/models"
)

func TestSessionRepository_Create(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	// Create user first (foreign key)
	userRepo := NewUserRepository(database)
	user := &models.User{
		ID:           "user-1",
		Username:     "testuser",
		Name:         "Test User",
		PasswordHash: "hash",
		IsAdmin:      true,
		CreatedAt:    time.Now().UnixMilli(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	repo := NewSessionRepository(database)

	session := &models.Session{
		ID:        "session-1",
		UserID:    "user-1",
		ExpiresAt: time.Now().Add(24 * time.Hour).UnixMilli(),
		CreatedAt: time.Now().UnixMilli(),
	}

	err := repo.Create(session)
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}
}

func TestSessionRepository_GetByID(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	userRepo := NewUserRepository(database)
	user := &models.User{
		ID:           "user-1",
		Username:     "testuser",
		Name:         "Test User",
		PasswordHash: "hash",
		IsAdmin:      true,
		CreatedAt:    time.Now().UnixMilli(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	repo := NewSessionRepository(database)

	session := &models.Session{
		ID:        "session-1",
		UserID:    "user-1",
		ExpiresAt: time.Now().Add(24 * time.Hour).UnixMilli(),
		CreatedAt: time.Now().UnixMilli(),
	}

	if err := repo.Create(session); err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Get existing session
	found, err := repo.GetByID("session-1")
	if err != nil {
		t.Fatalf("Failed to get session: %v", err)
	}

	if found.UserID != session.UserID {
		t.Errorf("Expected UserID %s, got %s", session.UserID, found.UserID)
	}

	// Get non-existing session
	_, err = repo.GetByID("non-existent")
	if err != ErrSessionNotFound {
		t.Errorf("Expected ErrSessionNotFound, got %v", err)
	}
}

func TestSessionRepository_GetByID_Expired(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	userRepo := NewUserRepository(database)
	user := &models.User{
		ID:           "user-1",
		Username:     "testuser",
		Name:         "Test User",
		PasswordHash: "hash",
		IsAdmin:      true,
		CreatedAt:    time.Now().UnixMilli(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	repo := NewSessionRepository(database)

	// Create expired session
	session := &models.Session{
		ID:        "session-1",
		UserID:    "user-1",
		ExpiresAt: time.Now().Add(-1 * time.Hour).UnixMilli(), // Expired 1 hour ago
		CreatedAt: time.Now().UnixMilli(),
	}

	if err := repo.Create(session); err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Get expired session should return error
	_, err := repo.GetByID("session-1")
	if err != ErrSessionExpired {
		t.Errorf("Expected ErrSessionExpired, got %v", err)
	}
}

func TestSessionRepository_Delete(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	userRepo := NewUserRepository(database)
	user := &models.User{
		ID:           "user-1",
		Username:     "testuser",
		Name:         "Test User",
		PasswordHash: "hash",
		IsAdmin:      true,
		CreatedAt:    time.Now().UnixMilli(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	repo := NewSessionRepository(database)

	session := &models.Session{
		ID:        "session-1",
		UserID:    "user-1",
		ExpiresAt: time.Now().Add(24 * time.Hour).UnixMilli(),
		CreatedAt: time.Now().UnixMilli(),
	}

	if err := repo.Create(session); err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Delete session
	err := repo.Delete("session-1")
	if err != nil {
		t.Fatalf("Failed to delete session: %v", err)
	}

	// Verify deleted
	_, err = repo.GetByID("session-1")
	if err != ErrSessionNotFound {
		t.Errorf("Expected ErrSessionNotFound after delete, got %v", err)
	}
}

func TestSessionRepository_DeleteByUserID(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	userRepo := NewUserRepository(database)
	user := &models.User{
		ID:           "user-1",
		Username:     "testuser",
		Name:         "Test User",
		PasswordHash: "hash",
		IsAdmin:      true,
		CreatedAt:    time.Now().UnixMilli(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	repo := NewSessionRepository(database)

	// Create multiple sessions for same user
	for i := 0; i < 3; i++ {
		session := &models.Session{
			ID:        "session-" + string(rune('a'+i)),
			UserID:    "user-1",
			ExpiresAt: time.Now().Add(24 * time.Hour).UnixMilli(),
			CreatedAt: time.Now().UnixMilli(),
		}
		if err := repo.Create(session); err != nil {
			t.Fatalf("Failed to create session: %v", err)
		}
	}

	// Delete all sessions for user
	err := repo.DeleteByUserID("user-1")
	if err != nil {
		t.Fatalf("Failed to delete sessions: %v", err)
	}

	// Verify all deleted
	for i := 0; i < 3; i++ {
		_, err := repo.GetByID("session-" + string(rune('a'+i)))
		if err != ErrSessionNotFound {
			t.Errorf("Expected ErrSessionNotFound for session-%c, got %v", rune('a'+i), err)
		}
	}
}
