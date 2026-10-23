#!/usr/bin/env bash
# Nirvana — SessionStart banner (macOS/Linux)
# Wired by /light into .claude/settings.json as a SessionStart hook.
# Prints nothing (exit 0) if entryBanner is off or state.json is missing.

# Hooks run in Claude's current directory, which is not always the project root
# (subfolder launch, resume after `cd`). Anchor every relative path to the root.
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

STATE_FILE=".claude/state.json"
[ -f "$STATE_FILE" ] || exit 0

ENTRY_BANNER=$(grep -o '"entryBanner"[[:space:]]*:[[:space:]]*[a-z]*' "$STATE_FILE" | grep -o '[a-z]*$')
[ "$ENTRY_BANNER" = "false" ] && exit 0

CHAT=$(grep -o '"chainVisibility"[[:space:]]*:[[:space:]]*"[a-z]*"' "$STATE_FILE" | grep -o '"[a-z]*"$' | tr -d '"')
[ -z "$CHAT" ] && CHAT="hidden"

SPRINT_LABEL="nenhum ativo"
if [ -d docs/sprints ]; then
  # Latest sprint = highest number (name order would put sprint-10 before sprint-2)
  SPRINT_FILE=$(ls docs/sprints/sprint-*.md 2>/dev/null | grep -E '/sprint-[0-9]+\.md$' | sort -t- -k2 -n | tail -1)
  [ -n "$SPRINT_FILE" ] && SPRINT_LABEL=$(basename "$SPRINT_FILE" .md)
fi

PLANNED=0; INPROGRESS=0; DONE=0
if [ -d docs/tasks ]; then
  for f in docs/tasks/*.md; do
    [ -f "$f" ] || continue
    [ "$(basename "$f")" = "task-template.md" ] && continue
    if grep -q 'status:[[:space:]]*"\?in-progress"\?' "$f"; then
      INPROGRESS=$((INPROGRESS+1))
    elif grep -q 'status:[[:space:]]*"\?done"\?' "$f"; then
      DONE=$((DONE+1))
    else
      PLANNED=$((PLANNED+1))
    fi
  done
fi

echo "+----------------------------------------+"
echo "  N I R V A N A"
echo "+----------------------------------------+"
echo "  Sprint:  $SPRINT_LABEL"
echo "  Tasks:   $PLANNED planned / $INPROGRESS in-progress / $DONE done"
echo "  Cadeia:  PO -> Reader -> Writer -> Tech Lead -> Architect -> Tech Lead -> PO -> Devs -> QA -> Writer -> Broker"
echo "  Chat da cadeia: $CHAT  (ligar so nessa run: /chat)"
echo "+----------------------------------------+"
