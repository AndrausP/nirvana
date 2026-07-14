# Nirvana Installer — Windows (PowerShell)
# Run: iwr -useb https://raw.githubusercontent.com/AndrausP/nirvana/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$NIRVANA_VERSION = "2.0.0"
$SKILLS_DIR = "$HOME\.claude\skills"
$TEMPLATES_DIR = "$HOME\.claude\nirvana-templates"
$SKILLS = @("light", "bigtask", "smalltask", "reflect", "law", "path", "karma")
$TEMPLATE_FILES = @(
    "BEHAVIOR.md", "state.json",
    "docs/architecture.md", "docs/modules.md", "docs/decisions.md",
    "docs/knowledge/errors-aprendidos.md", "docs/knowledge/patterns.md", "docs/knowledge/business-rules.md",
    "docs/sprints/sprint-template.md", "docs/tasks/task-template.md",
    "agents/product-owner.md", "agents/tech-lead.md", "agents/architect.md",
    "agents/dev-backend.md", "agents/dev-frontend.md", "agents/designer.md",
    "agents/qa.md", "agents/reader.md", "agents/writer.md",
    "hooks/nirvana-banner.ps1", "hooks/nirvana-banner.sh"
)
$REPO_RAW = "https://raw.githubusercontent.com/AndrausP/nirvana/main"

Write-Host ""
Write-Host "  Nirvana $NIRVANA_VERSION — Installer" -ForegroundColor Cyan
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Check Claude Code is installed
$claudeCmd = Get-Command "claude" -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
    Write-Host "  ERROR: Claude Code not found." -ForegroundColor Red
    Write-Host "  Install it first: https://claude.ai/code" -ForegroundColor Red
    exit 1
}

Write-Host "  Claude Code found." -ForegroundColor Green

# Create skills directory if it doesn't exist
if (-not (Test-Path $SKILLS_DIR)) {
    New-Item -ItemType Directory -Force -Path $SKILLS_DIR | Out-Null
    Write-Host "  Created $SKILLS_DIR" -ForegroundColor Yellow
}

# Install each skill
foreach ($skill in $SKILLS) {
    $skillDir = "$SKILLS_DIR\$skill"
    $skillFile = "$skillDir\SKILL.md"

    if (-not (Test-Path $skillDir)) {
        New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
    }

    Write-Host "  Installing /$skill..." -ForegroundColor Gray

    try {
        $content = Invoke-WebRequest -Uri "$REPO_RAW/skills/$skill/SKILL.md" -UseBasicParsing
        Set-Content -Path $skillFile -Value $content.Content -Encoding UTF8
        Write-Host "  /$skill installed" -ForegroundColor Green
    } catch {
        Write-Host "  /$skill FAILED: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Install templates (used by /light — must live outside the repo since /light
# runs inside arbitrary target projects, not inside the Nirvana repo)
if (-not (Test-Path $TEMPLATES_DIR)) {
    New-Item -ItemType Directory -Force -Path $TEMPLATES_DIR | Out-Null
}

foreach ($tpl in $TEMPLATE_FILES) {
    $tplPath = "$TEMPLATES_DIR\$($tpl -replace '/', '\')"
    $tplDir = Split-Path $tplPath -Parent
    if (-not (Test-Path $tplDir)) {
        New-Item -ItemType Directory -Force -Path $tplDir | Out-Null
    }

    Write-Host "  Installing template $tpl..." -ForegroundColor Gray

    try {
        $content = Invoke-WebRequest -Uri "$REPO_RAW/templates/$tpl" -UseBasicParsing
        Set-Content -Path $tplPath -Value $content.Content -Encoding UTF8
        Write-Host "  $tpl installed" -ForegroundColor Green
    } catch {
        Write-Host "  $tpl FAILED: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Nirvana installed." -ForegroundColor Green
Write-Host ""
Write-Host "  Next step:" -ForegroundColor White
Write-Host "  1. Open Claude Code in your project"
Write-Host "  2. Type: /light"
Write-Host ""
