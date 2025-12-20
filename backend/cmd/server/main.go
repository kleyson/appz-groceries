package main

import (
	"embed"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/kleyson/groceries/backend/internal/api"
	"github.com/kleyson/groceries/backend/internal/db"
	"github.com/kleyson/groceries/backend/internal/repository"
)

//go:embed static/*
var staticFS embed.FS

func main() {
	// Configuration from environment
	port := getEnv("PORT", "8080")
	dbPath := getEnv("DATABASE_PATH", "./data/groceries.db")
	secureCookie := getEnv("SECURE_COOKIE", "false") == "true"
	allowOrigins := strings.Split(getEnv("ALLOW_ORIGINS", "http://localhost:5173"), ",")

	// Initialize database
	database, err := db.New(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer func() { _ = database.Close() }()

	// Run migrations
	if err := database.Migrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Seed default data
	if err := database.Seed(); err != nil {
		log.Fatalf("Failed to seed database: %v", err)
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(database)
	sessionRepo := repository.NewSessionRepository(database)
	listRepo := repository.NewListRepository(database)
	itemRepo := repository.NewItemRepository(database)
	categoryRepo := repository.NewCategoryRepository(database)
	priceHistoryRepo := repository.NewPriceHistoryRepository(database)

	// Create router
	router := api.NewRouter(
		userRepo,
		sessionRepo,
		listRepo,
		itemRepo,
		categoryRepo,
		priceHistoryRepo,
		api.Config{
			SecureCookie: secureCookie,
			AllowOrigins: allowOrigins,
			StaticFS:     staticFS,
		},
	)

	// Start server
	addr := fmt.Sprintf(":%s", port)
	log.Printf("Starting server on %s", addr)
	log.Printf("Database: %s", dbPath)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
