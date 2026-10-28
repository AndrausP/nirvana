#!/usr/bin/env bash
# Tests templates/hooks/nirvana-banner.sh in a throwaway project. Run: bash tests/hook.sh

REPO="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0
ok()   { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; FAILED=1; }
has()     { case "$2" in *"$3"*) ok "$1" ;; *) fail "$1 (missing: $3)"; printf '%s\n' "$2" | sed 's/^/       /' ;; esac; }
has_not() { case "$2" in *"$3"*) fail "$1 (unexpected: $3)" ;; *) ok "$1" ;; esac; }
equals()  { if [ "$2" = "$3" ]; then ok "$1"; else fail "$1 (expected '$3', got '$2')"; fi; }

PROJ="$(mktemp -d)"
trap 'rm -rf "$PROJ"' EXIT
mkdir -p "$PROJ/.claude/hooks" "$PROJ/docs/sprints" "$PROJ/docs/tasks" "$PROJ/sub"
sed 's/"every": [0-9]*/"every": 3/' "$REPO/templates/state.json" > "$PROJ/.claude/state.json"
cp "$REPO/templates/hooks/nirvana-banner.sh" "$PROJ/.claude/hooks/"
for s in 1 2 10 template; do echo "x" > "$PROJ/docs/sprints/sprint-$s.md"; done
printf 'status: done\n'        > "$PROJ/docs/tasks/001-a.md"
printf 'status: in-progress\n' > "$PROJ/docs/tasks/002-b.md"
printf 'status: planned\n'     > "$PROJ/docs/tasks/003-c.md"
printf 'status: done\n'        > "$PROJ/docs/tasks/task-template.md"

# Run the hook the way Claude Code does: JSON on stdin, from a subfolder, CLAUDE_PROJECT_DIR set
run() {
  printf '{"hook_event_name":"SessionStart","source":"%s"}' "$1" |
    (cd "$PROJ/sub" && CLAUDE_PROJECT_DIR="$PROJ" bash "$PROJ/.claude/hooks/nirvana-banner.sh")
}
count() { grep -o '"sessionCount": [0-9]*' "$PROJ/.claude/state.local.json" 2>/dev/null | grep -o '[0-9]*$'; }

out="$(run startup)"
has     "banner on startup"                  "$out" "N I R V A N A"
has     "latest sprint by number"            "$out" "Sprint:  sprint-10"
has     "task counts skip the template"      "$out" "1 planned / 1 in-progress / 1 done"
has     "sync line"                          "$out" "Sync:    1/3"
equals  "startup counts a session"           "$(count)" "1"

out="$(run clear)"
equals  "/clear counts a session"            "$(count)" "2"
has_not "no sync notice before sync.every"   "$out" "Sync automatico pendente"

out="$(run resume)"
equals  "resume does not count"              "$(count)" "2"
has     "banner on resume"                   "$out" "N I R V A N A"

out="$(run startup)"
equals  "third session"                      "$(count)" "3"
has     "sync notice at sync.every"          "$out" "[nirvana] Sync automatico pendente (3/3 sessoes)"

out="$(run compact)"
equals  "compact does not count"             "$(count)" "3"
has_not "no banner after compact"            "$out" "N I R V A N A"
has     "Writer reminder after compact"      "$out" "[nirvana] Contexto compactado"

sed -i.bak 's/"entryBanner": true/"entryBanner": false/' "$PROJ/.claude/state.json"
out="$(run startup)"
equals  "counts with the banner off"         "$(count)" "4"
has_not "banner off hides the banner"        "$out" "N I R V A N A"
has     "banner off keeps the sync notice"   "$out" "Sync automatico pendente"

out="$(cd "$PROJ" && bash .claude/hooks/nirvana-banner.sh < /dev/null)"
equals  "manual run without input does not count" "$(count)" "4"

out="$(cd / && env -u CLAUDE_PROJECT_DIR bash "$PROJ/.claude/hooks/nirvana-banner.sh" < /dev/null)"
has     "finds the project from the script path" "$out" "Sync automatico pendente"

rm "$PROJ/.claude/state.json"
out="$(run startup)"; code=$?
equals  "no state.json: exit 0"              "$code" "0"
equals  "no state.json: no output"           "$out" ""

echo
if [ $FAILED = 0 ]; then echo "hook.sh: all checks passed"; else echo "hook.sh: FAILED"; fi
exit $FAILED
