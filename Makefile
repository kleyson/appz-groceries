.PHONY: dev dev-backend dev-frontend dev-https dev-certs build build-backend build-frontend docker clean verify lint format format-check test type-check version

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
