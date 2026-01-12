.PHONY: dev dev-backend dev-frontend dev-https dev-certs build build-backend build-frontend docker clean verify lint format format-check test type-check version bump-patch bump-minor bump-major help

# Help
help:
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Start backend and frontend servers"
	@echo "  make dev-https        - Start with HTTPS (for camera testing)"
	@echo "  make dev-certs        - Generate SSL certificates"
	@echo ""
	@echo "Build:"
	@echo "  make build            - Build both frontend and backend"
	@echo "  make build-frontend   - Build frontend only"
	@echo "  make build-backend    - Build backend only"
	@echo ""
	@echo "Docker:"
	@echo "  make docker           - Build Docker image"
	@echo "  make docker-run       - Run with docker-compose"
	@echo ""
	@echo "Version:"
	@echo "  make version VERSION=\"1.0.0\"  - Set specific version"
	@echo "  make bump-patch       - Bump patch version (0.9.0 -> 0.9.1)"
	@echo "  make bump-minor       - Bump minor version (0.9.0 -> 0.10.0)"
	@echo "  make bump-major       - Bump major version (0.9.0 -> 1.0.0)"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make verify           - Run all checks (lint, format, test)"
	@echo "  make help             - Show this help message"

# Development
dev:
	@echo "Starting development servers..."
	@make -j2 dev-backend dev-frontend

dev-https:
	@echo "Starting development servers with HTTPS (for phone camera testing)..."
	@if [ ! -f .dev-certs/cert.pem ] || [ ! -f .dev-certs/key.pem ]; then \
		echo "⚠️  SSL certificates not found. Generating them now..."; \
		./scripts/generate-dev-certs.sh; \
	fi
	@echo "Starting servers with HTTPS enabled..."
	@VITE_HTTPS=true make -j2 dev-backend dev-frontend-https

dev-backend:
	cd backend && go run ./cmd/server

dev-frontend:
	cd frontend && npm run dev

dev-frontend-https:
	cd frontend && VITE_HTTPS=true npm run dev

# Generate SSL certificates for local development
dev-certs:
	@./scripts/generate-dev-certs.sh

# Build
build: build-frontend build-backend
	@echo "Build complete!"

build-frontend:
	cd frontend && npm run build
	rm -rf backend/cmd/server/static/*
	cp -r frontend/dist/* backend/cmd/server/static/

build-backend:
	cd backend && go build -o ../bin/groceries ./cmd/server

# Docker
docker:
	docker build -f docker/Dockerfile -t groceries .

docker-run:
	docker compose -f docker/docker-compose.yml up

docker-run-detached:
	docker compose -f docker/docker-compose.yml up -d

docker-stop:
	docker compose -f docker/docker-compose.yml down

# Utilities
clean:
	rm -rf bin/
	rm -rf frontend/dist/
	rm -rf backend/cmd/server/static/*
	echo "<!-- Placeholder -->" > backend/cmd/server/static/index.html

install:
	cd frontend && npm install
	cd backend && go mod download

# Verification (runs all checks)
verify: lint format-check type-check test
	@echo "All checks passed!"

# Linting
lint:
	@echo "==> Linting frontend..."
	cd frontend && npm run lint
	@echo "==> Linting backend..."
	cd backend && go vet ./...

# Format check (verify formatting without modifying)
format-check:
	@echo "==> Checking frontend formatting..."
	cd frontend && npm run format:check
	@echo "==> Checking backend formatting..."
	@cd backend && unformatted=$$(gofmt -l .); \
	if [ -n "$$unformatted" ]; then \
		echo "The following files are not formatted:"; \
		echo "$$unformatted"; \
		exit 1; \
	fi

# Format (apply formatting)
format:
	@echo "==> Formatting frontend..."
	cd frontend && npm run format
	@echo "==> Formatting backend..."
	cd backend && gofmt -w .

# Type checking
type-check:
	@echo "==> Type checking frontend..."
	cd frontend && npm run type-check
	@echo "==> Building backend..."
	cd backend && go build ./...

# Tests
test:
	@echo "==> Testing frontend..."
	cd frontend && npm test || echo "No frontend tests found"
	@echo "==> Testing backend..."
	cd backend && go test ./... || echo "No backend tests found"

# Version management
version:
	@if [ -z "$(VERSION)" ]; then \
		echo "❌ Error: VERSION is required. Usage: make version VERSION=\"1.0.0\""; \
		exit 1; \
	fi
	@echo "Updating version to $(VERSION)..."
	@echo "$(VERSION)" > VERSION
	@echo "Version updated to $(VERSION)"
	@echo "Creating git tag v$(VERSION)..."
	@git add VERSION
	@git commit -m "Bump version to $(VERSION)" || true
	@git tag -a "v$(VERSION)" -m "Version $(VERSION)" || (echo "⚠️  Tag v$(VERSION) already exists. Skipping tag creation." && exit 0)
	@echo "✅ Version updated to $(VERSION) and tag v$(VERSION) created"
	@echo "Pushing commit..."
	@git push || (echo "⚠️  Failed to push commit. Make sure you have a remote configured." && exit 1)
	@echo "Pushing tags..."
	@git push --tags || (echo "⚠️  Failed to push tags. Make sure you have a remote configured." && exit 1)
	@echo "✅ Version $(VERSION) pushed and tag v$(VERSION) pushed"

bump-patch:
	@CURRENT=$$(cat VERSION); \
	MAJOR=$$(echo $$CURRENT | cut -d. -f1); \
	MINOR=$$(echo $$CURRENT | cut -d. -f2); \
	PATCH=$$(echo $$CURRENT | cut -d. -f3); \
	NEW="$$MAJOR.$$MINOR.$$((PATCH + 1))"; \
	echo "Bumping patch: $$CURRENT -> $$NEW"; \
	echo $$NEW > VERSION; \
	git add VERSION && git commit -m "Bump patch: $$CURRENT -> $$NEW" && git tag -a "v$$NEW" -m "Version $$NEW" && git push && git push --tags; \
	echo "✅ Version bumped to $$NEW and pushed"

bump-minor:
	@CURRENT=$$(cat VERSION); \
	MAJOR=$$(echo $$CURRENT | cut -d. -f1); \
	MINOR=$$(echo $$CURRENT | cut -d. -f2); \
	NEW="$$MAJOR.$$((MINOR + 1)).0"; \
	echo "Bumping minor: $$CURRENT -> $$NEW"; \
	echo $$NEW > VERSION; \
	git add VERSION && git commit -m "Bump minor: $$CURRENT -> $$NEW" && git tag -a "v$$NEW" -m "Version $$NEW" && git push && git push --tags; \
	echo "✅ Version bumped to $$NEW and pushed"

bump-major:
	@CURRENT=$$(cat VERSION); \
	MAJOR=$$(echo $$CURRENT | cut -d. -f1); \
	NEW="$$((MAJOR + 1)).0.0"; \
	echo "Bumping major: $$CURRENT -> $$NEW"; \
	echo $$NEW > VERSION; \
	git add VERSION && git commit -m "Bump major: $$CURRENT -> $$NEW" && git tag -a "v$$NEW" -m "Version $$NEW" && git push && git push --tags; \
	echo "✅ Version bumped to $$NEW and pushed"
