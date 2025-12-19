package api

import (
	"context"
	"net/http"

	"github.com/kleyson/groceries/backend/internal/models"
	"github.com/kleyson/groceries/backend/internal/repository"
)

type contextKey string

const (
	UserContextKey    contextKey = "user"
	SessionContextKey contextKey = "session"
	SessionCookieName            = "session_id"
)

// AuthMiddleware creates authentication middleware
func AuthMiddleware(userRepo *repository.UserRepository, sessionRepo *repository.SessionRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil {
				Unauthorized(w, "No session cookie")
				return
			}

			session, err := sessionRepo.GetByID(cookie.Value)
			if err != nil {
				// Clear invalid cookie
				ClearSessionCookie(w)
				Unauthorized(w, "Invalid or expired session")
				return
			}

			user, err := userRepo.GetByID(session.UserID)
			if err != nil {
				ClearSessionCookie(w)
				Unauthorized(w, "User not found")
				return
			}

			// Add user and session to context
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			ctx = context.WithValue(ctx, SessionContextKey, session)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserFromContext retrieves the user from the request context
func GetUserFromContext(r *http.Request) *models.User {
	user, ok := r.Context().Value(UserContextKey).(*models.User)
	if !ok {
		return nil
	}
	return user
}

// GetSessionFromContext retrieves the session from the request context
func GetSessionFromContext(r *http.Request) *models.Session {
	session, ok := r.Context().Value(SessionContextKey).(*models.Session)
	if !ok {
		return nil
	}
	return session
}

// SetSessionCookie sets the session cookie
func SetSessionCookie(w http.ResponseWriter, sessionID string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    sessionID,
		Path:     "/",
		MaxAge:   30 * 24 * 60 * 60, // 30 days
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	})
}

// ClearSessionCookie clears the session cookie
func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
}
