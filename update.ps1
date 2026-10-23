# Nirvana Updater - Windows (PowerShell)
# Run: iwr -useb https://raw.githubusercontent.com/AndrausP/nirvana/main/update.ps1 | iex
# Keep this file ASCII-only: Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI, so a
# character like an em dash breaks parsing when the script is run with -File.

$ErrorActionPreference = "Stop"

$NIRVANA_VERSION = "2.0.1"
$SKILLS_DIR = "$HOME\.claude\skills"
$TEMPLATES_DIR = "$HOME\.claude\nirvana-templates"
$VERSION_FILE = "$TEMPLATES_DIR\.nirvana-version"
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

# Windows PowerShell's "Set-Content -Encoding UTF8" writes a BOM, which breaks the
# shebang of .sh files and the frontmatter of .md files. Only .ps1 keeps the BOM:
# Windows PowerShell needs it to read non-ASCII characters as UTF-8.
function Write-Utf8File([string]$Path, [string]$Text) {
    $withBom = [IO.Path]::GetExtension($Path) -eq ".ps1"
    [IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding $withBom))
}

Write-Host ""
Write-Host "  Nirvana $NIRVANA_VERSION - Updater" -ForegroundColor Cyan
Write-Host "  ===================================" -ForegroundColor Cyan
Write-Host ""

# Check Nirvana is installed (skills + templates from a previous install)
if (-not (Test-Path "$SKILLS_DIR\light\SKILL.md") -or -not (Test-Path $TEMPLATES_DIR)) {
    Write-Host "  ERROR: Nirvana not installed on this machine." -ForegroundColor Red
    Write-Host "  Install it first:" -ForegroundColor Red
    Write-Host "  iwr -useb $REPO_RAW/install.ps1 | iex" -ForegroundColor Yellow
    exit 1
}

# Current installed version (marker written by install.ps1 >= 2.0.0)
$installedVersion = "unknown"
if (Test-Path $VERSION_FILE) {
    $installedVersion = (Get-Content $VERSION_FILE -Raw).Trim()
}

if ($installedVersion -eq $NIRVANA_VERSION) {
    Write-Host "  Installed version: $installedVersion (latest) - refreshing files." -ForegroundColor Gray
} else {
    Write-Host "  Updating: $installedVersion -> $NIRVANA_VERSION" -ForegroundColor Yellow
}
Write-Host ""

# Update each skill
foreach ($skill in $SKILLS) {
    $skillDir = "$SKILLS_DIR\$skill"
    $skillFile = "$skillDir\SKILL.md"

    if (-not (Test-Path $skillDir)) {
        New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
    }

    Write-Host "  Updating /$skill..." -ForegroundColor Gray

    try {
        $content = Invoke-WebRequest -Uri "$REPO_RAW/skills/$skill/SKILL.md" -UseBasicParsing
        Write-Utf8File $skillFile $content.Content
        Write-Host "  /$skill updated" -ForegroundColor Green
    } catch {
        Write-Host "  /$skill FAILED: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Update templates
foreach ($tpl in $TEMPLATE_FILES) {
    $tplPath = "$TEMPLATES_DIR\$($tpl -replace '/', '\')"
    $tplDir = Split-Path $tplPath -Parent
    if (-not (Test-Path $tplDir)) {
        New-Item -ItemType Directory -Force -Path $tplDir | Out-Null
    }

    Write-Host "  Updating template $tpl..." -ForegroundColor Gray

    try {
        $content = Invoke-WebRequest -Uri "$REPO_RAW/templates/$tpl" -UseBasicParsing
        Write-Utf8File $tplPath $content.Content
        Write-Host "  $tpl updated" -ForegroundColor Green
    } catch {
        Write-Host "  $tpl FAILED: $_" -ForegroundColor Red
        exit 1
    }
}

# Record installed version
Write-Utf8File $VERSION_FILE $NIRVANA_VERSION

Write-Host ""
Write-Host "  ===================================" -ForegroundColor Cyan
if ($installedVersion -eq $NIRVANA_VERSION) {
    Write-Host "  Nirvana refreshed ($NIRVANA_VERSION)." -ForegroundColor Green
} else {
    Write-Host "  Nirvana updated: $installedVersion -> $NIRVANA_VERSION" -ForegroundColor Green
}
Write-Host ""
Write-Host "  Projects already configured keep working - to refresh a" -ForegroundColor White
Write-Host "  project's Nirvana block, open it in Claude Code and re-run /light."
Write-Host ""
