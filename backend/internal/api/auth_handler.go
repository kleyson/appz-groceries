package api

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/kleyson/groceries/backend/internal/auth"
	"github.com/kleyson/groceries/backend/internal/models"
	"github.com/kleyson/groceries/backend/internal/repository"
)

type AuthHandler struct {
	userRepo     *repository.UserRepository
	sessionRepo  *repository.SessionRepository
	secureCookie bool
}

func NewAuthHandler(userRepo *repository.UserRepository, sessionRepo *repository.SessionRepository, secureCookie bool) *AuthHandler {
	return &AuthHandler{
		userRepo:     userRepo,
		sessionRepo:  sessionRepo,
		secureCookie: secureCookie,
	}
}

// Register handles user registration (only if no users exist - first user becomes admin)
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	// Validate input
	if len(req.Username) < 3 {
		BadRequest(w, "Username must be at least 3 characters")
		return
	}
	if len(req.Name) < 1 {
		BadRequest(w, "Name is required")
		return
	}
	if len(req.Password) < 6 {
		BadRequest(w, "Password must be at least 6 characters")
		return
	}

	// Check if users already exist
	count, err := h.userRepo.Count()
	if err != nil {
		InternalError(w, "Failed to check users")
		return
	}
	if count > 0 {
		Forbidden(w, "Registration is closed")
		return
	}

	// Hash password
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		InternalError(w, "Failed to hash password")
		return
	}

	// Create user (first user is always admin)
	user := &models.User{
		ID:           auth.GenerateID(),
		Username:     req.Username,
		Name:         req.Name,
		PasswordHash: hash,
		IsAdmin:      true,
		CreatedAt:    auth.GetCurrentTimestamp(),
	}

	if err := h.userRepo.Create(user); err != nil {
		if errors.Is(err, repository.ErrUsernameTaken) {
			BadRequest(w, "Username already taken")
			return
		}
		InternalError(w, "Failed to create user")
		return
	}

	// Create session
	session := &models.Session{
		ID:        auth.GenerateID(),
		UserID:    user.ID,
		ExpiresAt: auth.GetSessionExpiry(),
		CreatedAt: auth.GetCurrentTimestamp(),
	}

	if err := h.sessionRepo.Create(session); err != nil {
		InternalError(w, "Failed to create session")
		return
	}

	SetSessionCookie(w, session.ID, h.secureCookie)
	JSON(w, http.StatusCreated, models.AuthResponse{User: user})
}

// Login handles user login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	// Find user
	user, err := h.userRepo.GetByUsername(req.Username)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			Unauthorized(w, "Invalid username or password")
			return
		}
		InternalError(w, "Failed to find user")
		return
	}

	// Check password
	if !auth.CheckPassword(req.Password, user.PasswordHash) {
		Unauthorized(w, "Invalid username or password")
		return
	}

	// Create session
	session := &models.Session{
		ID:        auth.GenerateID(),
		UserID:    user.ID,
		ExpiresAt: auth.GetSessionExpiry(),
		CreatedAt: auth.GetCurrentTimestamp(),
	}

	if err := h.sessionRepo.Create(session); err != nil {
		InternalError(w, "Failed to create session")
		return
	}

	SetSessionCookie(w, session.ID, h.secureCookie)
	JSON(w, http.StatusOK, models.AuthResponse{User: user})
}

// Logout handles user logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	session := GetSessionFromContext(r)
	if session != nil {
		h.sessionRepo.Delete(session.ID)
	}
	ClearSessionCookie(w)
	JSON(w, http.StatusOK, map[string]bool{"success": true})
}

// Me returns the current user
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r)
	if user == nil {
		Unauthorized(w, "Not authenticated")
		return
	}
	JSON(w, http.StatusOK, models.AuthResponse{User: user})
}

// CanRegister checks if registration is available
func (h *AuthHandler) CanRegister(w http.ResponseWriter, r *http.Request) {
	count, err := h.userRepo.Count()
	if err != nil {
		InternalError(w, "Failed to check users")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"canRegister": count == 0})
}

// CreateUser allows admin to create a new non-admin user
func (h *AuthHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	currentUser := GetUserFromContext(r)
	if currentUser == nil || !currentUser.IsAdmin {
		Forbidden(w, "Admin access required")
		return
	}

	var req models.CreateUserRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	// Validate input
	if len(req.Username) < 3 {
		BadRequest(w, "Username must be at least 3 characters")
		return
	}
	if len(req.Name) < 1 {
		BadRequest(w, "Name is required")
		return
	}
	if len(req.Password) < 6 {
		BadRequest(w, "Password must be at least 6 characters")
		return
	}

	// Hash password
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		InternalError(w, "Failed to hash password")
		return
	}

	// Create user (admin-created users are NOT admins)
	user := &models.User{
		ID:           auth.GenerateID(),
		Username:     req.Username,
		Name:         req.Name,
		PasswordHash: hash,
		IsAdmin:      false,
		CreatedAt:    auth.GetCurrentTimestamp(),
	}

	if err := h.userRepo.Create(user); err != nil {
		if errors.Is(err, repository.ErrUsernameTaken) {
			BadRequest(w, "Username already taken")
			return
		}
		InternalError(w, "Failed to create user")
		return
	}

	JSON(w, http.StatusCreated, user)
}

// ListUsers returns all users (admin only)
func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	currentUser := GetUserFromContext(r)
	if currentUser == nil || !currentUser.IsAdmin {
		Forbidden(w, "Admin access required")
		return
	}

	users, err := h.userRepo.GetAll()
	if err != nil {
		InternalError(w, "Failed to get users")
		return
	}

	JSON(w, http.StatusOK, models.UsersResponse{Users: users})
}

// DeleteUser deletes a user (admin only, cannot delete self)
func (h *AuthHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	currentUser := GetUserFromContext(r)
	if currentUser == nil || !currentUser.IsAdmin {
		Forbidden(w, "Admin access required")
		return
	}

	userID := chi.URLParam(r, "id")
	if userID == "" {
		BadRequest(w, "User ID required")
		return
	}

	// Prevent self-deletion
	if userID == currentUser.ID {
		BadRequest(w, "Cannot delete your own account")
		return
	}

	if err := h.userRepo.Delete(userID); err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			NotFound(w, "User not found")
			return
		}
		InternalError(w, "Failed to delete user")
		return
	}

	// Delete all sessions for this user
	h.sessionRepo.DeleteByUserID(userID)

	JSON(w, http.StatusOK, map[string]bool{"success": true})
}
