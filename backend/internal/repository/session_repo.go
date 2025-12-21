package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"

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
	return r.db.Create(session).Error
}

func (r *SessionRepository) GetByID(id string) (*models.Session, error) {
	var session models.Session
	err := r.db.First(&session, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}

	// Check if expired
	if session.ExpiresAt < time.Now().UnixMilli() {
		// Delete expired session
		_ = r.Delete(id)
		return nil, ErrSessionExpired
	}

	return &session, nil
}

func (r *SessionRepository) Delete(id string) error {
	return r.db.Delete(&models.Session{}, "id = ?", id).Error
}

func (r *SessionRepository) DeleteByUserID(userID string) error {
	return r.db.Delete(&models.Session{}, "user_id = ?", userID).Error
}

func (r *SessionRepository) CleanupExpired() error {
	now := time.Now().UnixMilli()
	return r.db.Delete(&models.Session{}, "expires_at < ?", now).Error
}
