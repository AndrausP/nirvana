#!/bin/bash
# Nirvana Updater — macOS / Linux
# Run: curl -fsSL https://raw.githubusercontent.com/AndrausP/nirvana/main/update.sh | bash

set -e

NIRVANA_VERSION="2.1.0"
SKILLS_DIR="$HOME/.claude/skills"
TEMPLATES_DIR="$HOME/.claude/nirvana-templates"
VERSION_FILE="$TEMPLATES_DIR/.nirvana-version"
SKILLS=("light" "bigtask" "smalltask" "reflect" "law" "path" "karma")
TEMPLATE_FILES=(
    "BEHAVIOR.md" "state.json"
    "docs/architecture.md" "docs/modules.md" "docs/decisions.md"
    "docs/knowledge/errors-aprendidos.md" "docs/knowledge/patterns.md" "docs/knowledge/business-rules.md"
    "docs/sprints/sprint-template.md" "docs/tasks/task-template.md"
    "agents/product-owner.md" "agents/tech-lead.md" "agents/architect.md"
    "agents/dev-backend.md" "agents/dev-frontend.md" "agents/designer.md"
    "agents/qa.md" "agents/reader.md" "agents/writer.md"
    "hooks/nirvana-banner.ps1" "hooks/nirvana-banner.sh"
)
REPO_RAW="https://raw.githubusercontent.com/AndrausP/nirvana/main"

echo ""
echo "  Nirvana $NIRVANA_VERSION — Updater"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Nirvana is installed (skills + templates from a previous install)
if [ ! -f "$SKILLS_DIR/light/SKILL.md" ] || [ ! -d "$TEMPLATES_DIR" ]; then
    echo "  ERROR: Nirvana not installed on this machine."
    echo "  Install it first:"
    echo "  curl -fsSL $REPO_RAW/install.sh | bash"
    exit 1
fi

# Current installed version (marker written by install.sh >= 2.0.0)
installed_version="unknown"
if [ -f "$VERSION_FILE" ]; then
    # Keep only version characters: also drops the BOM that install.ps1 < 2.0.1 wrote
    installed_version="$(LC_ALL=C tr -cd '0-9A-Za-z.-' < "$VERSION_FILE")"
fi

if [ "$installed_version" = "$NIRVANA_VERSION" ]; then
    echo "  Installed version: $installed_version (latest) — refreshing files."
else
    echo "  Updating: $installed_version -> $NIRVANA_VERSION"
fi
echo ""

# Update each skill
for skill in "${SKILLS[@]}"; do
    skill_dir="$SKILLS_DIR/$skill"
    skill_file="$skill_dir/SKILL.md"

    mkdir -p "$skill_dir"
    echo -n "  Updating /$skill..."

    if curl -fsSL "$REPO_RAW/skills/$skill/SKILL.md" -o "$skill_file"; then
        echo " done"
    else
        echo " FAILED"
        exit 1
    fi
done

echo ""

# Update templates
for tpl in "${TEMPLATE_FILES[@]}"; do
    tpl_dir="$TEMPLATES_DIR/$(dirname "$tpl")"
    mkdir -p "$tpl_dir"
    echo -n "  Updating template $tpl..."
    if curl -fsSL "$REPO_RAW/templates/$tpl" -o "$TEMPLATES_DIR/$tpl"; then
        echo " done"
    else
        echo " FAILED"
        exit 1
    fi
done

# Record installed version
echo "$NIRVANA_VERSION" > "$VERSION_FILE"

echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$installed_version" = "$NIRVANA_VERSION" ]; then
    echo "  Nirvana refreshed ($NIRVANA_VERSION)."
else
    echo "  Nirvana updated: $installed_version -> $NIRVANA_VERSION"
fi
echo ""
echo "  Projects already configured keep working — to refresh a"
echo "  project's Nirvana block, open it in Claude Code and re-run /light."
echo ""
