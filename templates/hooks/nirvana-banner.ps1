# Nirvana - SessionStart banner (Windows/PowerShell)
# Wired by /light into .claude/settings.json as a SessionStart hook.
# Prints nothing (exit 0) if entryBanner is off or state.json is missing.
# Keep this file ASCII-only: Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI, so a
# character like an em dash breaks parsing when the script is run with -File.

$ErrorActionPreference = "SilentlyContinue"

# Hooks run in Claude's current directory, which is not always the project root
# (subfolder launch, resume after `cd`). Anchor every relative path to the root.
$projectRoot = $env:CLAUDE_PROJECT_DIR
if (-not $projectRoot) { $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent }
if ($projectRoot) { Set-Location -LiteralPath $projectRoot }

$stateFile = ".claude/state.json"
if (-not (Test-Path $stateFile)) { exit 0 }

$state = Get-Content $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
if ($state.preferences.entryBanner -eq $false) { exit 0 }

$chat = $state.preferences.chainVisibility
if (-not $chat) { $chat = "hidden" }

$sprintLabel = "nenhum ativo"
if (Test-Path "docs/sprints") {
    # Latest sprint = highest number (name order would put sprint-10 before sprint-2)
    $sprintFile = Get-ChildItem -Path "docs/sprints" -Filter "sprint-*.md" |
        Where-Object { $_.BaseName -match '^sprint-\d+$' } |
        Sort-Object { [int]($_.BaseName -replace '^sprint-', '') } -Descending |
        Select-Object -First 1
    if ($sprintFile) { $sprintLabel = $sprintFile.BaseName }
}

$planned = 0; $inProgress = 0; $done = 0
if (Test-Path "docs/tasks") {
    $taskFiles = Get-ChildItem -Path "docs/tasks" -Filter "*.md" |
        Where-Object { $_.Name -ne "task-template.md" }
    foreach ($f in $taskFiles) {
        $content = Get-Content $f.FullName -Raw
        if ($content -match 'status:\s*"?in-progress"?') { $inProgress++ }
        elseif ($content -match 'status:\s*"?done"?') { $done++ }
        else { $planned++ }
    }
}

Write-Output "+----------------------------------------+"
Write-Output "  N I R V A N A"
Write-Output "+----------------------------------------+"
Write-Output "  Sprint:  $sprintLabel"
Write-Output "  Tasks:   $planned planned / $inProgress in-progress / $done done"
Write-Output "  Cadeia:  PO -> Reader -> Writer -> Tech Lead -> Architect -> Tech Lead -> PO -> Devs -> QA -> Writer -> Broker"
Write-Output "  Chat da cadeia: $chat  (ligar so nessa run: /chat)"
Write-Output "+----------------------------------------+"
