#!/bin/bash
# Nirvana Installer — macOS / Linux
# Run: curl -fsSL https://raw.githubusercontent.com/AndrausP/nirvana/main/install.sh | bash

set -e

NIRVANA_VERSION="1.0.0"
SKILLS_DIR="$HOME/.claude/skills"
SKILLS=("light" "bigtask" "smalltask" "reflect" "law" "path" "karma")
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
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Nirvana installed."
echo ""
echo "  Next step:"
echo "  1. Open Claude Code in your project"
echo "  2. Type: /light"
echo ""
