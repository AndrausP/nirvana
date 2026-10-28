#!/usr/bin/env bash
# Validates the Claude Code plugin and marketplace, then installs the plugin into a throwaway
# config dir (never your real ~/.claude). Needs the claude CLI. Run: bash tests/plugin.sh

REPO="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0
ok()   { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; FAILED=1; }

if ! command -v claude >/dev/null 2>&1; then
  if [ -n "$CI" ]; then fail "claude CLI not installed on the CI runner"; exit 1; fi
  echo "skip - claude CLI not installed"; exit 0
fi

CFG="$(mktemp -d)"
trap 'rm -rf "$CFG"' EXIT
# claude is a native Windows program under Git Bash: hand it a Windows path, or a /tmp/...
# path would be read as C:\tmp\... and the test would write outside the throwaway dir
CLAUDE_CONFIG_DIR="$CFG"
if command -v cygpath >/dev/null 2>&1; then CLAUDE_CONFIG_DIR="$(cygpath -w "$CFG")"; fi
export CLAUDE_CONFIG_DIR
cd "$REPO" || exit 1

if out="$(claude plugin validate . 2>&1)"; then
  ok "claude plugin validate ."
else
  fail "claude plugin validate ."; printf '%s\n' "$out" | sed 's/^/       /'
fi

if out="$(claude plugin marketplace add ./ 2>&1)"; then
  ok "marketplace add"
else
  fail "marketplace add"; printf '%s\n' "$out" | sed 's/^/       /'
fi

if out="$(claude plugin install nirvana@nirvana 2>&1)"; then
  ok "install nirvana@nirvana"
else
  fail "install nirvana@nirvana"; printf '%s\n' "$out" | sed 's/^/       /'
fi

# every skill in skills/ is loaded by the plugin
expected="$(git ls-files 'skills/*/SKILL.md' | cut -d/ -f2 | sort | paste -sd, - | sed 's/,/, /g')"
details="$(claude plugin details nirvana 2>&1)"
case "$details" in
  *"$expected"*) ok "plugin loads every skill: $expected" ;;
  *) fail "plugin skills differ from skills/ (expected: $expected)"; printf '%s\n' "$details" | sed 's/^/       /' ;;
esac

# /light reads templates from ${CLAUDE_PLUGIN_ROOT}/templates in a plugin install
if [ -f templates/hooks/nirvana-banner.sh ] && grep -qF '${CLAUDE_PLUGIN_ROOT}/templates' skills/light/SKILL.md; then
  ok "/light resolves templates from the plugin root"
else
  fail "/light does not reference \${CLAUDE_PLUGIN_ROOT}/templates"
fi

echo
if [ $FAILED = 0 ]; then echo "plugin.sh: all checks passed"; else echo "plugin.sh: FAILED"; fi
exit $FAILED
