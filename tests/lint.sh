#!/usr/bin/env bash
# Static checks for the Nirvana repo. Run from anywhere: bash tests/lint.sh
# Each check prints "ok" or "FAIL"; the script exits 1 if any check failed.

cd "$(dirname "$0")/.." || exit 1
FAILED=0
ok()   { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; FAILED=1; }

# python3 on Windows can be a Store stub, so test that the interpreter actually runs
PY=""
for candidate in python3 python; do
  if "$candidate" -c "import json" >/dev/null 2>&1; then PY="$candidate"; break; fi
done

# --- JSON files parse ------------------------------------------------------
if [ -z "$PY" ]; then
  fail "python not found (needed to validate JSON)"
else
  for f in $(git ls-files '*.json'); do
    if "$PY" -c "import json,sys; json.load(open(sys.argv[1], encoding='utf-8'))" "$f" 2>/dev/null; then
      ok "valid JSON: $f"
    else
      fail "invalid JSON: $f"
    fi
  done
fi

# --- .ps1 files are ASCII-only (Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI) ---
NON_ASCII="$(printf '[\200-\377]')"
for f in $(git ls-files '*.ps1'); do
  if LC_ALL=C grep -n "$NON_ASCII" "$f" >/dev/null; then
    fail "non-ASCII character in $f:"
    LC_ALL=C grep -n "$NON_ASCII" "$f" | sed 's/^/       /'
  else
    ok "ASCII-only: $f"
  fi
done

# --- .sh files are stored with LF (CRLF breaks bash) ---------------------------
for f in $(git ls-files '*.sh'); do
  if git ls-files --eol -- "$f" | grep -q '^i/lf'; then ok "LF: $f"; else fail "not LF in the index: $f"; fi
done

# --- shellcheck ----------------------------------------------------------------
if command -v shellcheck >/dev/null 2>&1; then
  # shellcheck disable=SC2046
  if shellcheck -S warning $(git ls-files '*.sh'); then ok "shellcheck"; else fail "shellcheck"; fi
elif [ -n "$CI" ]; then
  fail "shellcheck not installed on the CI runner"
else
  echo "skip - shellcheck not installed"
fi

# --- dogfood hook copies match the templates ---------------------------------------
for h in nirvana-banner.ps1 nirvana-banner.sh; do
  if cmp -s "templates/hooks/$h" ".claude/hooks/$h"; then
    ok "dogfood copy matches template: $h"
  else
    fail ".claude/hooks/$h differs from templates/hooks/$h (copy the template over it)"
  fi
done

# --- the four installers agree on skills, templates and version ------------------------
# Print the quoted items of an array, from its opening line to the first line with ")"
# (the same line for one-line arrays like SKILLS)
array_items() { tr -d '\r' < "$2" | awk -v start="$1" 'index($0, start) == 1 { p = 1 } p { print } p && /\)/ { exit }' |
  grep -o '"[^"]*"' | tr -d '"' | sort; }
list_sh()  { array_items "$1=(" "$2"; }
list_ps1() { array_items "\$$1 = @(" "$2"; }

for var in SKILLS TEMPLATE_FILES; do
  ref="$(list_sh "$var" install.sh)"
  same=1
  [ "$(list_sh  "$var" update.sh)"   = "$ref" ] || { fail "$var in update.sh differs from install.sh"; same=0; }
  [ "$(list_ps1 "$var" install.ps1)" = "$ref" ] || { fail "$var in install.ps1 differs from install.sh"; same=0; }
  [ "$(list_ps1 "$var" update.ps1)"  = "$ref" ] || { fail "$var in update.ps1 differs from install.sh"; same=0; }
  [ $same = 1 ] && ok "$var identical in the 4 installers"
done

# every template in the repo is installed, and every installed template exists
expected_templates="$(git ls-files templates | sed 's|^templates/||' | sort)"
if [ "$(list_sh TEMPLATE_FILES install.sh)" = "$expected_templates" ]; then
  ok "TEMPLATE_FILES matches templates/"
else
  fail "TEMPLATE_FILES does not match templates/ (added or removed a template?)"
  diff <(list_sh TEMPLATE_FILES install.sh) <(echo "$expected_templates") | sed 's/^/       /'
fi
expected_skills="$(git ls-files 'skills/*/SKILL.md' | cut -d/ -f2 | sort)"
if [ "$(list_sh SKILLS install.sh)" = "$expected_skills" ]; then
  ok "SKILLS matches skills/"
else
  fail "SKILLS does not match skills/"
fi

versions="$(
  { grep -h '^NIRVANA_VERSION=' install.sh update.sh
    grep -h '^\$NIRVANA_VERSION = ' install.ps1 update.ps1
    grep -h '"nirvana":' templates/state.json
    grep -h '"version":' .claude-plugin/plugin.json
  } | tr -d '\r' | grep -o '[0-9][0-9.]*[0-9]' | sort -u
)"
if [ "$(echo "$versions" | wc -l | tr -d ' ')" = 1 ]; then
  ok "same version everywhere: $versions"
else
  fail "versions differ across installers/templates/plugin.json: $(echo "$versions" | tr '\n' ' ')"
fi

# --- plugin manifests ------------------------------------------------------------------
# plugin.json owns the version: a second one in marketplace.json would be silently ignored
if grep -q '"version"' .claude-plugin/marketplace.json; then
  fail "marketplace.json sets a version (keep it only in .claude-plugin/plugin.json)"
else
  ok "version only in plugin.json"
fi
if [ -n "$PY" ] && "$PY" - <<'EOF'
import json, sys
plugin = json.load(open(".claude-plugin/plugin.json", encoding="utf-8"))
market = json.load(open(".claude-plugin/marketplace.json", encoding="utf-8"))
entries = [p for p in market["plugins"] if p.get("source") in ("./", ".")]
sys.exit(0 if len(entries) == 1 and entries[0]["name"] == plugin["name"] else 1)
EOF
then
  ok "marketplace entry for ./ has the plugin.json name"
else
  fail "marketplace.json needs one entry with source \"./\" named like plugin.json"
fi

# --- /light documents the exact hook command the repo uses --------------------------
win_cmd="$(grep '"command": "if (Test-Path' .claude/settings.json | tr -d '\r' | sed 's/^ *//; s/,$//')"
if [ -n "$win_cmd" ] && grep -qF "$win_cmd" skills/light/SKILL.md; then
  ok "hook command in .claude/settings.json matches /light"
else
  fail "hook command in .claude/settings.json differs from skills/light/SKILL.md"
fi

echo
if [ $FAILED = 0 ]; then echo "lint: all checks passed"; else echo "lint: FAILED"; fi
exit $FAILED
