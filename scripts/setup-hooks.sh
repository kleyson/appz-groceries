#!/bin/sh

# Setup script to install git hooks
# This copies hooks from .githooks/ to .git/hooks/

HOOKS_DIR=".githooks"
GIT_HOOKS_DIR=".git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "Error: $HOOKS_DIR directory not found"
  exit 1
fi

if [ ! -d "$GIT_HOOKS_DIR" ]; then
  echo "Error: $GIT_HOOKS_DIR directory not found. Are you in a git repository?"
  exit 1
fi

# Copy all hooks from .githooks/ to .git/hooks/
for hook in "$HOOKS_DIR"/*; do
  if [ -f "$hook" ]; then
    hook_name=$(basename "$hook")
    cp "$hook" "$GIT_HOOKS_DIR/$hook_name"
    chmod +x "$GIT_HOOKS_DIR/$hook_name"
    echo "Installed hook: $hook_name"
  fi
done

echo "Git hooks installed successfully!"

