# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Groceries is a web application for managing grocery lists with price tracking. Built with Go backend and React frontend, deployed as a single Docker container.

## Project Structure

```
groceries/
├── backend/                    # Go backend
│   ├── cmd/server/             # Entry point
│   ├── internal/
│   │   ├── api/                # HTTP handlers, router, middleware
│   │   ├── auth/               # Authentication (bcrypt, sessions)
│   │   ├── db/                 # SQLite, migrations, seeds
│   │   ├── models/             # Data models
│   │   └── repository/         # Database queries
│   └── static/                 # Built frontend (production)
├── frontend/                   # Vite + React + TypeScript
│   ├── src/
│   │   ├── routes/             # TanStack Router pages
│   │   ├── components/
│   │   │   ├── ui/             # Shared base components
│   │   │   └── *.tsx           # Feature components
│   │   ├── hooks/              # All business logic
│   │   ├── api/                # TanStack Query + API client
│   │   ├── lib/                # Utility functions
│   │   └── types/              # TypeScript types
├── docker/                     # Docker configuration
├── Makefile                    # Dev commands
└── CLAUDE.md
```

## Technology Stack

### Backend
- **Language**: Go 1.22+
- **Router**: chi
- **Database**: SQLite (modernc.org/sqlite - pure Go)
- **Auth**: bcrypt + session cookies

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Data Fetching**: TanStack Query
- **Routing**: TanStack Router (file-based)
- **Styling**: Tailwind CSS (appz.wtf design system)
- **Testing**: Vitest

## Commands

### Backend (from `backend/`)
```bash
go run ./cmd/server          # Run dev server
go build -o groceries ./cmd/server  # Build binary
go test ./...                # Run tests
```

### Frontend (from `frontend/`)
```bash
npm run dev                  # Start dev server (proxies to Go)
npm run build                # Build for production
npm test                     # Run tests
npm run lint                 # ESLint
npm run format               # Prettier
```

### Docker (from root)
```bash
docker compose -f docker/docker-compose.yml up --build    # Build and run
docker compose -f docker/docker-compose.yml up -d         # Run in background
```

### Makefile (from root)
```bash
make dev          # Run both backend and frontend
make build        # Build for production
make docker       # Build Docker image
```

## Development Guidelines

1. **Use ui-ux-pro-max skill** for all UI/UX design decisions
2. **Logic in hooks** - components must be presentational only, all business logic goes in `src/hooks/`
3. **Shared components** - reusable components in `src/components/ui/` with barrel exports
4. **All hooks must be tested** - every hook needs a corresponding test file
5. **Path alias** - use `@/` to import from `src/` (e.g., `import { useLists } from '@/hooks/useLists'`)
6. **Validation** - validate on both frontend (Zod) and backend
7. **API responses** - always use consistent JSON format with `data` or `error` wrapper

## Testing Guidelines

- **Frontend**: Only test hooks - no UI/component tests, logic lives in hooks
- **Backend**: Test handlers and repositories
- **Minimal mocking** - only mock what's strictly necessary
- **Test files location**:
  - Frontend: `frontend/src/**/*.test.ts`
  - Backend: `backend/**/*_test.go`

## Database

SQLite database with tables:
- `users` - Authentication (id, username, password_hash, created_at)
- `sessions` - Session management (id, user_id, expires_at, created_at)
- `categories` - Item categories (id, name, icon, color, sort_order, is_default)
- `lists` - Grocery lists (id, name, created_at, updated_at)
- `items` - List items (id, list_id, name, quantity, unit, category_id, checked, price, store, sort_order)
- `price_history` - Price tracking (id, item_name, price, store, recorded_at)

### Preset Categories
Produce, Dairy, Meat, Bakery, Frozen, Beverages, Snacks, Pantry, Household, Other

## API Endpoints

### Auth
- `GET /api/auth/can-register` - Check if registration is available
- `POST /api/auth/register` - Register (first user only)
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Lists
- `GET /api/lists` - Get all lists
- `POST /api/lists` - Create list
- `GET /api/lists/:id` - Get single list
- `PUT /api/lists/:id` - Update list
- `DELETE /api/lists/:id` - Delete list

### Items
- `GET /api/lists/:listId/items` - Get items
- `POST /api/lists/:listId/items` - Create item
- `PUT /api/lists/:listId/items/:id` - Update item
- `PATCH /api/lists/:listId/items/:id/toggle` - Toggle checked
- `PUT /api/lists/:listId/items/reorder` - Reorder items
- `DELETE /api/lists/:listId/items/:id` - Delete item

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

## UI/UX Standards

Based on the appz.wtf design system:

### Design System
- **Style**: Flat Design with glass effects - clean, minimal, accessible (WCAG AA+)
- **Fonts**: DM Sans (body), Outfit (display/headings)
- **Primary Color**: Teal (#0d9488)
- **Accent Color**: Amber (#f59e0b)
- **Dark Mode**: Class-based, OLED-optimized
- **Transitions**: 150-300ms for smooth animations

### Shared Components

All in `src/components/ui/`:
- `Button` - variants: primary, secondary, danger, ghost; sizes: sm, md, lg
- `Input` - with label, error state, left/right icons
- `Card` - variants: default, glass, ghost; with optional hover effect
- `Modal` - centered with backdrop blur
- `Checkbox` - animated checkmark
- `Badge` - for category tags and status

### UI Rules to Follow

1. **Icons**: Use Lucide React icons, not emoji as UI icons
2. **Touch Targets**: Minimum 44px for all interactive elements (accessibility)
3. **Color Contrast**: Minimum 4.5:1 ratio for text
4. **Hover/Active States**: Use opacity changes and subtle scale (0.98)
5. **Focus States**: Visible ring for keyboard navigation
6. **Error Messages**: Use role="alert" for screen readers
7. **Labels**: All form inputs must have labels or aria-label
8. **Mobile-First**: Design for mobile, enhance for desktop

### Pre-Delivery UI Checklist

- [ ] No emoji used as UI icons (Lucide icons instead)
- [ ] All clickable elements have minimum 44px touch target
- [ ] All interactive elements have proper ARIA attributes
- [ ] Error states use role="alert"
- [ ] Colors from Tailwind config, not hardcoded values
- [ ] Transitions are 150-300ms, not instant or too slow
- [ ] Test on mobile viewport sizes
