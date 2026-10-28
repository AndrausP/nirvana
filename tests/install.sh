#!/usr/bin/env bash
# Installs and updates Nirvana into a throwaway HOME, downloading from this checkout (served by
# a local HTTP server through NIRVANA_REPO_RAW). Never touches the real ~/.claude.
# Run: bash tests/install.sh

REPO="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0
ok()   { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; FAILED=1; }
has()    { case "$2" in *"$3"*) ok "$1" ;; *) fail "$1 (missing: $3)"; printf '%s\n' "$2" | sed 's/^/       /' ;; esac; }
equals() { if [ "$2" = "$3" ]; then ok "$1"; else fail "$1 (expected '$3', got '$2')"; fi; }

PY=""
for candidate in python3 python; do
  if "$candidate" -c "import http.server" >/dev/null 2>&1; then PY="$candidate"; break; fi
done
[ -n "$PY" ] || { echo "FAIL - python not found (serves the checkout over HTTP)"; exit 1; }

WORK="$(mktemp -d)"
PORT="${NIRVANA_TEST_PORT:-8765}"
"$PY" "$REPO/tests/serve.py" "$PORT" "$REPO" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -rf "$WORK"' EXIT
for _ in $(seq 1 50); do curl -fs "http://127.0.0.1:$PORT/install.sh" >/dev/null && break; sleep 0.2; done

# Installers require the claude CLI; a stub is enough here
mkdir -p "$WORK/bin" "$WORK/home"
printf '#!/bin/sh\nexit 0\n' > "$WORK/bin/claude"
chmod +x "$WORK/bin/claude"
export PATH="$WORK/bin:$PATH"
export HOME="$WORK/home"
export NIRVANA_REPO_RAW="http://127.0.0.1:$PORT"

VERSION="$(grep '^NIRVANA_VERSION=' "$REPO/install.sh" | grep -o '[0-9][0-9.]*[0-9]')"
SKILLS="$(grep '^SKILLS=(' "$REPO/install.sh" | grep -o '"[^"]*"' | tr -d '"')"
TEMPLATES="$(cd "$REPO" && git ls-files templates | sed 's|^templates/||')"
MARKER="$HOME/.claude/nirvana-templates/.nirvana-version"

out="$(bash "$REPO/update.sh" 2>&1)"; code=$?
equals "update before install fails"         "$code" "1"
has    "update before install explains why"  "$out" "Nirvana not installed"

out="$(bash "$REPO/install.sh" 2>&1)"; code=$?
equals "install exits 0"                     "$code" "0"
has    "install finishes"                    "$out" "Nirvana installed."

missing=0
for s in $SKILLS; do
  cmp -s "$HOME/.claude/skills/$s/SKILL.md" "$REPO/skills/$s/SKILL.md" || { fail "skill /$s not installed as in the repo"; missing=1; }
done
[ $missing = 0 ] && ok "all skills installed byte for byte"
missing=0
for t in $TEMPLATES; do
  cmp -s "$HOME/.claude/nirvana-templates/$t" "$REPO/templates/$t" || { fail "template $t not installed as in the repo"; missing=1; }
done
[ $missing = 0 ] && ok "all templates installed byte for byte"
equals "version marker"                      "$(cat "$MARKER")" "$VERSION"

out="$(bash "$REPO/update.sh" 2>&1)"; code=$?
equals "update exits 0"                      "$code" "0"
has    "update on latest refreshes"          "$out" "Installed version: $VERSION (latest)"

# Marker written by an older install.ps1: BOM + CRLF
printf '\357\273\2772.0.0\r\n' > "$MARKER"
out="$(bash "$REPO/update.sh" 2>&1)"
has    "update reads an old marker with BOM" "$out" "Updating: 2.0.0 -> $VERSION"
equals "update rewrites the marker"          "$(cat "$MARKER")" "$VERSION"

echo
if [ $FAILED = 0 ]; then echo "install.sh: all checks passed"; else echo "install.sh: FAILED"; fi
exit $FAILED
