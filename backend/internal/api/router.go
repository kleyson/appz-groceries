package api

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/kleyson/groceries/backend/internal/repository"
)

type Config struct {
	SecureCookie bool
	AllowOrigins []string
	StaticFS     embed.FS
}

func NewRouter(
	userRepo *repository.UserRepository,
	sessionRepo *repository.SessionRepository,
	listRepo *repository.ListRepository,
	itemRepo *repository.ItemRepository,
	categoryRepo *repository.CategoryRepository,
	priceHistoryRepo *repository.PriceHistoryRepository,
	config Config,
) *chi.Mux {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(middleware.RequestID)

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   config.AllowOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Handlers
	authHandler := NewAuthHandler(userRepo, sessionRepo, config.SecureCookie)
	listHandler := NewListHandler(listRepo)
	itemHandler := NewItemHandler(itemRepo, listRepo)
	categoryHandler := NewCategoryHandler(categoryRepo)
	priceHistoryHandler := NewPriceHistoryHandler(priceHistoryRepo)

	// Auth middleware
	authMiddleware := AuthMiddleware(userRepo, sessionRepo)

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Health check
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			JSON(w, http.StatusOK, map[string]string{"status": "ok"})
		})

		// Auth routes (public)
		r.Route("/auth", func(r chi.Router) {
			r.Get("/can-register", authHandler.CanRegister)
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)

			// Protected auth routes
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware)
				r.Get("/me", authHandler.Me)
				r.Post("/logout", authHandler.Logout)
			})
		})

		// User management routes (admin only)
		r.Route("/users", func(r chi.Router) {
			r.Use(authMiddleware)
			r.Get("/", authHandler.ListUsers)
			r.Post("/", authHandler.CreateUser)
			r.Delete("/{id}", authHandler.DeleteUser)
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware)

			// Lists
			r.Route("/lists", func(r chi.Router) {
				r.Get("/", listHandler.GetAll)
				r.Post("/", listHandler.Create)
				r.Get("/{id}", listHandler.GetByID)
				r.Put("/{id}", listHandler.Update)
				r.Delete("/{id}", listHandler.Delete)

				// Items (nested under lists)
				r.Route("/{listId}/items", func(r chi.Router) {
					r.Get("/", itemHandler.GetByListID)
					r.Post("/", itemHandler.Create)
					r.Put("/reorder", itemHandler.Reorder)
					r.Put("/{id}", itemHandler.Update)
					r.Patch("/{id}/toggle", itemHandler.ToggleChecked)
					r.Delete("/{id}", itemHandler.Delete)
				})
			})

			// Categories
			r.Route("/categories", func(r chi.Router) {
				r.Get("/", categoryHandler.GetAll)
				r.Post("/", categoryHandler.Create)
				r.Put("/{id}", categoryHandler.Update)
				r.Delete("/{id}", categoryHandler.Delete)
			})

			// Price history
			r.Route("/price-history", func(r chi.Router) {
				r.Get("/", priceHistoryHandler.GetByItemName)
				r.Post("/", priceHistoryHandler.Create)
			})
		})
	})

	// Serve static files (SPA)
	staticFS, err := fs.Sub(config.StaticFS, "static")
	if err == nil {
		fileServer := http.FileServer(http.FS(staticFS))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			// Check if file exists
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}

			// Try to open the file
			if _, err := fs.Stat(staticFS, path); err != nil {
				// File doesn't exist, serve index.html for SPA routing
				r.URL.Path = "/"
			}

			fileServer.ServeHTTP(w, r)
		})
	}

	return r
}
