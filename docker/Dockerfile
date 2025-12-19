# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.25.5-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
# Copy built frontend into static/
RUN mkdir -p cmd/server/static
COPY --from=frontend-builder /app/frontend/dist/ ./cmd/server/static/
# Remove empty directories that Go embed cannot handle
RUN find ./cmd/server/static -type d -empty -delete
RUN CGO_ENABLED=0 GOOS=linux go build -o /groceries ./cmd/server

# Stage 3: Production image
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=backend-builder /groceries .

# Create data directory
RUN mkdir -p /data

ENV PORT=8080
ENV DATABASE_PATH=/data/groceries.db
ENV SECURE_COOKIE=true

EXPOSE 8080
VOLUME ["/data"]

CMD ["./groceries"]
