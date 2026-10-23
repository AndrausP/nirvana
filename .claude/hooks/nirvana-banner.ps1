# Nirvana - SessionStart hook (Windows/PowerShell)
# Wired by /light into .claude/settings.json as a SessionStart hook. On each session start it:
#   - counts new sessions for the automatic /reflect cycle (sync.every in state.json)
#   - prints the entry banner, unless preferences.entryBanner is false
#   - after a compaction, asks the Writer to persist what is still undocumented
# Its stdout becomes context Claude reads. Prints nothing (exit 0) if state.json is missing.
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

# Claude Code sends the hook input as JSON on stdin. Its "source" says why the session started:
# startup, resume, clear or compact. A manual run has no input and counts nothing.
$source = ""
if ([Console]::IsInputRedirected) {
    try { $source = ([Console]::In.ReadToEnd() | ConvertFrom-Json).source } catch { }
}

# Session counter for the automatic /reflect cycle. It lives in state.local.json (gitignored),
# not in state.json, so starting a session never leaves a tracked file modified.
$localFile = Join-Path (Get-Location) ".claude/state.local.json"
$sessionCount = 0
if (Test-Path $localFile) {
    try { $sessionCount = [int](Get-Content $localFile -Raw -Encoding UTF8 | ConvertFrom-Json).sync.sessionCount } catch { }
}
# startup and /clear open a new conversation; resume and compact continue the same one
if ($source -eq "startup" -or $source -eq "clear") {
    $sessionCount++
    $json = "{`n  `"sync`": {`n    `"sessionCount`": $sessionCount`n  }`n}`n"
    [IO.File]::WriteAllText($localFile, $json, (New-Object System.Text.UTF8Encoding $false))
}
$syncEvery = [int]$state.sync.every
$syncDue = ($syncEvery -gt 0) -and ($sessionCount -ge $syncEvery)

# The full banner is skipped after a compaction: the session is already running
if ($source -ne "compact" -and $state.preferences.entryBanner -ne $false) {
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
    if ($syncEvery -gt 0) { Write-Output "  Sync:    $sessionCount/$syncEvery sessoes desde o ultimo /reflect" }
    Write-Output "  Cadeia:  PO -> Reader -> Writer -> Tech Lead -> Architect -> Tech Lead -> PO -> Devs -> QA -> Writer -> Broker"
    Write-Output "  Chat da cadeia: $chat  (ligar so nessa run: /chat)"
    Write-Output "+----------------------------------------+"
}

# Instructions for Claude, printed even with the banner off
if ($syncDue) {
    Write-Output "[nirvana] Sync automatico pendente ($sessionCount/$syncEvery sessoes): rode /reflect antes da primeira tarefa desta sessao."
}
if ($source -eq "compact") {
    Write-Output "[nirvana] Contexto compactado. Writer: registre em docs/knowledge/ o que esta sessao decidiu ou aprendeu e ainda nao esta documentado (o resumo da conversa tem o historico) e reindexe o graphify."
}
