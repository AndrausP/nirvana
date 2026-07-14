#!/bin/bash
# Nirvana Installer — macOS / Linux
# Run: curl -fsSL https://raw.githubusercontent.com/AndrausP/nirvana/main/install.sh | bash

set -e

NIRVANA_VERSION="2.0.0"
SKILLS_DIR="$HOME/.claude/skills"
TEMPLATES_DIR="$HOME/.claude/nirvana-templates"
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
echo "  Nirvana $NIRVANA_VERSION — Installer"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Claude Code is installed
if ! command -v claude &> /dev/null; then
    echo "  ERROR: Claude Code not found."
    echo "  Install it first: https://claude.ai/code"
    exit 1
fi

echo "  Claude Code found."

# Create skills directory if needed
mkdir -p "$SKILLS_DIR"

# Install each skill
for skill in "${SKILLS[@]}"; do
    skill_dir="$SKILLS_DIR/$skill"
    skill_file="$skill_dir/SKILL.md"

    mkdir -p "$skill_dir"
    echo -n "  Installing /$skill..."

    if curl -fsSL "$REPO_RAW/skills/$skill/SKILL.md" -o "$skill_file"; then
        echo " done"
    else
        echo " FAILED"
        exit 1
    fi
done

echo ""

# Install templates (used by /light — must live outside the repo since /light
# runs inside arbitrary target projects, not inside the Nirvana repo)
mkdir -p "$TEMPLATES_DIR"
for tpl in "${TEMPLATE_FILES[@]}"; do
    tpl_dir="$TEMPLATES_DIR/$(dirname "$tpl")"
    mkdir -p "$tpl_dir"
    echo -n "  Installing template $tpl..."
    if curl -fsSL "$REPO_RAW/templates/$tpl" -o "$TEMPLATES_DIR/$tpl"; then
        echo " done"
    else
        echo " FAILED"
        exit 1
    fi
done

echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Nirvana installed."
echo ""
echo "  Next step:"
echo "  1. Open Claude Code in your project"
echo "  2. Type: /light"
echo ""
