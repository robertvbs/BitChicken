#!/usr/bin/env bash
# Stdio launcher for the PrimeNG MCP server with a pinned, working dependency tree.
#
# Why this exists: `npx -y @primeng/mcp` re-resolves @modelcontextprotocol/sdk to its
# latest 1.x (1.29.0), which breaks @primeuix/mcp's tool registration and makes the
# server crash on startup ("get_migration_guide expected a Zod schema or ToolAnnotations"),
# surfacing in Claude Code as `Failed to reconnect to primeng: -32000`.
#
# package.json here pins the SDK to 1.25.2 via npm "overrides". This script installs that
# tree once (next to itself) and then runs the server. node_modules is gitignored.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="$DIR/node_modules/@primeng/mcp/dist/index.js"

if [ ! -f "$SERVER" ]; then
  npm install --prefix "$DIR" --silent --no-audit --no-fund >/dev/null 2>&1
fi

exec node "$SERVER"
