# Nirvana Installer — Windows (PowerShell)
# Run: iwr -useb https://raw.githubusercontent.com/YOUR_USER/nirvana/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$NIRVANA_VERSION = "1.0.0"
$SKILLS_DIR = "$HOME\.claude\skills"
$SKILLS = @("light", "bigtask", "smalltask", "reflect", "law", "path", "karma")
$REPO_RAW = "https://raw.githubusercontent.com/YOUR_USER/nirvana/main"

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
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Nirvana installed." -ForegroundColor Green
Write-Host ""
Write-Host "  Next step:" -ForegroundColor White
Write-Host "  1. Open Claude Code in your project"
Write-Host "  2. Type: /light"
Write-Host ""
