package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/kleyson/groceries/backend/internal/db"
	"github.com/kleyson/groceries/backend/internal/models"
)

var ErrSessionNotFound = errors.New("session not found")
var ErrSessionExpired = errors.New("session expired")

type SessionRepository struct {
	db *db.DB
}

func NewSessionRepository(database *db.DB) *SessionRepository {
	return &SessionRepository{db: database}
}

func (r *SessionRepository) Create(session *models.Session) error {
	_, err := r.db.Exec(`
		INSERT INTO sessions (id, user_id, expires_at, created_at)
		VALUES (?, ?, ?, ?)
	`, session.ID, session.UserID, session.ExpiresAt, session.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}
	return nil
}

func (r *SessionRepository) GetByID(id string) (*models.Session, error) {
	session := &models.Session{}
	err := r.db.QueryRow(`
		SELECT id, user_id, expires_at, created_at
		FROM sessions WHERE id = ?
	`, id).Scan(&session.ID, &session.UserID, &session.ExpiresAt, &session.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	// Check if expired
	if session.ExpiresAt < time.Now().UnixMilli() {
		// Delete expired session
		r.Delete(id)
		return nil, ErrSessionExpired
	}

	return session, nil
}

func (r *SessionRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM sessions WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}
	return nil
}

func (r *SessionRepository) DeleteByUserID(userID string) error {
	_, err := r.db.Exec("DELETE FROM sessions WHERE user_id = ?", userID)
	if err != nil {
		return fmt.Errorf("failed to delete user sessions: %w", err)
	}
	return nil
}

func (r *SessionRepository) CleanupExpired() error {
	now := time.Now().UnixMilli()
	_, err := r.db.Exec("DELETE FROM sessions WHERE expires_at < ?", now)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired sessions: %w", err)
	}
	return nil
}
