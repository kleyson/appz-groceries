# Appz Groceries 🛒

A modern, offline-first grocery list application with price tracking. Built with Go backend and React frontend, deployed as a single Docker container.

## ✨ Features

### Core Functionality

- 📝 **Multiple Lists** - Create and manage multiple grocery lists
- ✅ **Item Management** - Add, edit, check off, and reorder items with drag-and-drop
- 🏷️ **Categories** - Organize items by category (Produce, Dairy, Meat, Bakery, etc.)
- 💰 **Price Tracking** - Track prices and stores for items
- 📊 **Price History** - View historical prices to find the best deals
- 📱 **Barcode Scanner** - Scan product barcodes for quick item lookup

### Offline-First PWA

- 📴 **Works Offline** - Full functionality even without internet connection
- 🔄 **Auto Sync** - Changes sync automatically when back online
- 📲 **Installable** - Install as a native app on mobile and desktop
- 💾 **Local Storage** - Data cached locally using IndexedDB

### Authentication & Security

- 🔐 **User Authentication** - Secure session-based login
- 👥 **Multi-User Support** - Multiple users with admin management
- 🛡️ **First User Admin** - First registered user becomes admin

### User Experience

- 🌙 **Dark Mode** - Built-in dark theme with OLED optimization
- 📱 **Mobile-First** - Responsive design optimized for mobile
- ♿ **Accessible** - WCAG AA+ compliant with proper ARIA labels
- ✨ **Smooth Animations** - Polished UI with subtle transitions

## Quick Start with Docker

The easiest way to run Appz Groceries is using Docker Compose.

### Prerequisites

- Docker and Docker Compose installed
- At least 256MB of available RAM

### Installation

1. **Download the docker-compose.yml file:**

   ```bash
   wget https://raw.githubusercontent.com/kleyson/groceries/main/docker/docker-compose.yml
   ```

2. **Start the application:**

   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - Open your browser to `http://localhost:8080`
   - Register the first user (becomes admin automatically)

### Data Persistence

The application uses Docker volumes to persist data:

- Database is stored in the `groceries-data` volume
- Data persists across container restarts

### Updating

To update to the latest version:

```bash
docker-compose pull
docker-compose up -d
```

### Stopping the Application

```bash
docker-compose down
```

To also remove the data volume (⚠️ this will delete all your data):

```bash
docker-compose down -v
```

## Development Setup

### Prerequisites

- Go 1.22+
- Node.js 18+
- Make

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/kleyson/groceries.git
   cd groceries
   ```

2. **Install dependencies:**

   ```bash
   make install
   ```

3. **Start development servers:**

   ```bash
   make dev
   ```

4. **Access the application:**
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:8080`

### Available Commands

```bash
make dev              # Run both backend and frontend in development mode
make build            # Build for production
make docker           # Build Docker image
make verify           # Run all checks (lint, format, type-check, tests)
make format           # Format all code
make test             # Run all tests
make clean            # Clean build artifacts
```

## Tech Stack

### Backend

- **Language**: Go 1.22+
- **Router**: chi
- **Database**: SQLite (pure Go driver, no CGO required)
- **Auth**: bcrypt + session cookies

### Frontend

- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Data Fetching**: TanStack Query
- **Routing**: TanStack Router (file-based)
- **Styling**: Tailwind CSS
- **Testing**: Vitest

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
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom hooks (business logic)
│   │   ├── api/                # API client
│   │   ├── lib/                # Utilities
│   │   └── types/              # TypeScript types
├── docker/                     # Docker configuration
├── scripts/                    # Build and setup scripts
└── Makefile                    # Development commands
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you find this project useful, consider supporting its development:

<a href="https://www.buymeacoffee.com/kleyson" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>
