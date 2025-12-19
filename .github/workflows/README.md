# GitHub Workflows

This directory contains CI/CD workflows for the Groceries app.

## Workflows

### `backend-lint-format.yml`

Runs on pushes/PRs affecting `backend/`:

- **Lint**: Runs golangci-lint for Go code quality
- **Format**: Checks gofmt formatting
- **Build**: Verifies the backend compiles

### `frontend-lint-format.yml`

Runs on pushes/PRs affecting `frontend/`:

- **Lint**: Runs ESLint for code quality
- **Format**: Checks Prettier formatting
- **Type Check**: Runs TypeScript compiler

### `test.yml`

Runs on pushes/PRs to `main` affecting `backend/` or `frontend/`:

- Runs Go tests with coverage
- Builds frontend to verify it compiles

### `release.yml`

Manually triggered workflow for creating releases:

- Reads version from `VERSION` file
- Builds multi-arch Docker image (amd64, arm64)
- Pushes to GitHub Container Registry (ghcr.io)
- Creates Git tag and GitHub Release
- Optionally notifies Watchtower for auto-deployment

## Usage

### Creating a Release

1. Update the `VERSION` file with the new version number
2. Commit and push the change
3. Go to Actions → Create Release → Run workflow
4. Optionally add release notes and mark as pre-release
5. The workflow will build, push, tag, and create the release

### Required Secrets

- `GITHUB_TOKEN` - Automatically provided
- `WATCHTOWER_TOKEN` - (Optional) For auto-deployment notifications
