#!/usr/bin/env bash
# Nirvana — SessionStart hook (macOS/Linux)
# Wired by /light into .claude/settings.json as a SessionStart hook. On each session start it:
#   - counts new sessions for the automatic /reflect cycle (sync.every in state.json)
#   - prints the entry banner, unless preferences.entryBanner is false
#   - after a compaction, asks the Writer to persist what is still undocumented
# Its stdout becomes context Claude reads. Prints nothing (exit 0) if state.json is missing.

# Hooks run in Claude's current directory, which is not always the project root
# (subfolder launch, resume after `cd`). Anchor every relative path to the root.
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

STATE_FILE=".claude/state.json"
[ -f "$STATE_FILE" ] || exit 0

# Claude Code sends the hook input as JSON on stdin. Its "source" says why the session started:
# startup, resume, clear or compact. A manual run (stdin is a terminal) counts nothing.
SOURCE=""
if [ ! -t 0 ]; then
  SOURCE=$(cat | grep -o '"source"[[:space:]]*:[[:space:]]*"[a-z]*"' | grep -o '"[a-z]*"$' | tr -d '"')
fi

# Session counter for the automatic /reflect cycle. It lives in state.local.json (gitignored),
# not in state.json, so starting a session never leaves a tracked file modified.
LOCAL_FILE=".claude/state.local.json"
SESSION_COUNT=$(grep -o '"sessionCount"[[:space:]]*:[[:space:]]*[0-9]*' "$LOCAL_FILE" 2>/dev/null | grep -o '[0-9]*$')
[ -z "$SESSION_COUNT" ] && SESSION_COUNT=0
# startup and /clear open a new conversation; resume and compact continue the same one
if [ "$SOURCE" = "startup" ] || [ "$SOURCE" = "clear" ]; then
  SESSION_COUNT=$((SESSION_COUNT+1))
  printf '{\n  "sync": {\n    "sessionCount": %s\n  }\n}\n' "$SESSION_COUNT" > "$LOCAL_FILE"
fi
SYNC_EVERY=$(grep -o '"every"[[:space:]]*:[[:space:]]*[0-9]*' "$STATE_FILE" | grep -o '[0-9]*$')
[ -z "$SYNC_EVERY" ] && SYNC_EVERY=0

ENTRY_BANNER=$(grep -o '"entryBanner"[[:space:]]*:[[:space:]]*[a-z]*' "$STATE_FILE" | grep -o '[a-z]*$')

# The full banner is skipped after a compaction: the session is already running
if [ "$SOURCE" != "compact" ] && [ "$ENTRY_BANNER" != "false" ]; then
  CHAT=$(grep -o '"chainVisibility"[[:space:]]*:[[:space:]]*"[a-z]*"' "$STATE_FILE" | grep -o '"[a-z]*"$' | tr -d '"')
  [ -z "$CHAT" ] && CHAT="hidden"

  SPRINT_LABEL="nenhum ativo"
  if [ -d docs/sprints ]; then
    # Latest sprint = highest number (name order would put sprint-10 before sprint-2)
    LATEST=-1
    for f in docs/sprints/sprint-*.md; do
      n="${f##*/sprint-}"; n="${n%.md}"
      case "$n" in ''|*[!0-9]*) continue ;; esac  # skips sprint-template.md and an unmatched glob
      if [ "$n" -gt "$LATEST" ]; then LATEST=$n; SPRINT_LABEL="sprint-$n"; fi
    done
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
  [ "$SYNC_EVERY" -gt 0 ] && echo "  Sync:    $SESSION_COUNT/$SYNC_EVERY sessoes desde o ultimo /reflect"
  echo "  Cadeia:  PO -> Reader -> Writer -> Tech Lead -> Architect -> Tech Lead -> PO -> Devs -> QA -> Writer -> Broker"
  echo "  Chat da cadeia: $CHAT  (ligar so nessa run: /chat)"
  echo "+----------------------------------------+"
fi

# Instructions for Claude, printed even with the banner off
if [ "$SYNC_EVERY" -gt 0 ] && [ "$SESSION_COUNT" -ge "$SYNC_EVERY" ]; then
  echo "[nirvana] Sync automatico pendente ($SESSION_COUNT/$SYNC_EVERY sessoes): rode /reflect antes da primeira tarefa desta sessao."
fi
if [ "$SOURCE" = "compact" ]; then
  echo "[nirvana] Contexto compactado. Writer: registre em docs/knowledge/ o que esta sessao decidiu ou aprendeu e ainda nao esta documentado (o resumo da conversa tem o historico) e reindexe o graphify."
fi
exit 0
