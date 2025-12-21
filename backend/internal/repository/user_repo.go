package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/kleyson/groceries/backend/internal/db"
	"github.com/kleyson/groceries/backend/internal/models"
)

var ErrUserNotFound = errors.New("user not found")
var ErrUsernameTaken = errors.New("username already taken")

type UserRepository struct {
	db *db.DB
}

func NewUserRepository(database *db.DB) *UserRepository {
	return &UserRepository{db: database}
}

func (r *UserRepository) Create(user *models.User) error {
	_, err := r.db.Exec(`
		INSERT INTO users (id, username, name, password_hash, is_admin, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, user.ID, user.Username, user.Name, user.PasswordHash, user.IsAdmin, user.CreatedAt)
	if err != nil {
		if isUniqueConstraintError(err) {
			return ErrUsernameTaken
		}
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

func (r *UserRepository) GetByID(id string) (*models.User, error) {
	user := &models.User{}
	err := r.db.QueryRow(`
		SELECT id, username, name, password_hash, is_admin, created_at
		FROM users WHERE id = ?
	`, id).Scan(&user.ID, &user.Username, &user.Name, &user.PasswordHash, &user.IsAdmin, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return user, nil
}

func (r *UserRepository) GetByUsername(username string) (*models.User, error) {
	user := &models.User{}
	err := r.db.QueryRow(`
		SELECT id, username, name, password_hash, is_admin, created_at
		FROM users WHERE username = ?
	`, username).Scan(&user.ID, &user.Username, &user.Name, &user.PasswordHash, &user.IsAdmin, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return user, nil
}

func (r *UserRepository) GetAll() ([]models.User, error) {
	rows, err := r.db.Query(`
		SELECT id, username, name, password_hash, is_admin, created_at
		FROM users ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var users []models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(&user.ID, &user.Username, &user.Name, &user.PasswordHash, &user.IsAdmin, &user.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}

	if users == nil {
		users = []models.User{}
	}

	return users, nil
}

func (r *UserRepository) Delete(id string) error {
	result, err := r.db.Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrUserNotFound
	}

	return nil
}

func (r *UserRepository) Count() (int, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count users: %w", err)
	}
	return count, nil
}

func isUniqueConstraintError(err error) bool {
	return err != nil && (contains(err.Error(), "UNIQUE constraint failed") ||
		contains(err.Error(), "unique constraint"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
