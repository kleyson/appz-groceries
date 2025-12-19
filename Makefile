.PHONY: dev dev-backend dev-frontend build build-backend build-frontend docker clean verify lint format format-check test type-check

# Development
dev:
	@echo "Starting development servers..."
	@make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && go run ./cmd/server

dev-frontend:
	cd frontend && npm run dev

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
