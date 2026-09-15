#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export AURA_DIR="$ROOT"
export FORGE_DIR="${FORGE_DIR:-$ROOT/../forge}"
export SENTINEL_DIR="${SENTINEL_DIR:-$ROOT/../sentinel}"

exec node "$ROOT/start-all-safe.js"
