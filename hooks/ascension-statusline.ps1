#!/usr/bin/env pwsh
# ascension-statusline.ps1 — THE ASCENSION PROTOCOL status line
# Output: single line shown in Claude Code status bar

$ESC    = [char]27
$purple = "$ESC[35m"
$red    = "$ESC[91m"
$bold   = "$ESC[1m"
$dim    = "$ESC[2m"
$reset  = "$ESC[0m"

$memDir = "$env:USERPROFILE\.claude\agents-memory"
$agentCount = 0
$lastDate   = ""

if (Test-Path $memDir) {
    $files = Get-ChildItem $memDir -Filter "*.md" -ErrorAction SilentlyContinue
    $agentCount = ($files | Measure-Object).Count

    # get most recent modification date
    $latest = $files | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) {
        $lastDate = $latest.LastWriteTime.ToString("MM/dd HH:mm")
    }
}

$agentStr = if ($agentCount -eq 1) { "1 agent" } else { "$agentCount agents" }
$dateStr  = if ($lastDate) { " $dim│$reset $dim$lastDate$reset" } else { "" }

Write-Host "${bold}${red}⚔${reset} ${purple}ASCENSION${reset} ${bold}${dim}│${reset} ${purple}$agentStr${reset}${dateStr}" -NoNewline
