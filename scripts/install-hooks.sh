#!/bin/sh
# Installs git hooks for the project
# Skips gracefully in Docker/CI environments where there's no git repo

SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR" 2>/dev/null)"

# Skip if we can't determine paths (e.g., running in Docker)
if [ -z "$SCRIPT_DIR" ] || [ -z "$REPO_ROOT" ]; then
  exit 0
fi

# Skip if not a git repository
if [ ! -d "$REPO_ROOT/.git" ]; then
  exit 0
fi

# Skip if pre-commit hook doesn't exist
if [ ! -f "$SCRIPT_DIR/pre-commit" ]; then
  exit 0
fi

HOOKS_DIR="$REPO_ROOT/.git/hooks"

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Install pre-commit hook
cp "$SCRIPT_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

echo "Git hooks installed successfully"
