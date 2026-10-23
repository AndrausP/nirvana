# Tests templates/hooks/nirvana-banner.ps1 in a throwaway project, through the exact hook
# command from .claude/settings.json. Run: powershell -ExecutionPolicy Bypass -File tests\hook.ps1
# Keep this file ASCII-only (Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI).

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$script:failed = 0
function Ok($name) { Write-Output "ok   - $name" }
function Fail($name) { Write-Output "FAIL - $name"; $script:failed = 1 }
function Has($name, $text, $needle) {
    if ($text.Contains($needle)) { Ok $name } else { Fail "$name (missing: $needle)"; $text -split "`n" | ForEach-Object { "       $_" } }
}
function HasNot($name, $text, $needle) { if ($text.Contains($needle)) { Fail "$name (unexpected: $needle)" } else { Ok $name } }
function Equals($name, $actual, $expected) { if ("$actual" -eq "$expected") { Ok $name } else { Fail "$name (expected '$expected', got '$actual')" } }

$proj = Join-Path ([IO.Path]::GetTempPath()) ("nirvana-hook-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force "$proj\.claude\hooks", "$proj\docs\sprints", "$proj\docs\tasks", "$proj\sub" | Out-Null
$noBom = New-Object System.Text.UTF8Encoding $false
$stateTemplate = [IO.File]::ReadAllText("$repo\templates\state.json") -replace '"every": \d+', '"every": 3'
[IO.File]::WriteAllText("$proj\.claude\state.json", $stateTemplate, $noBom)
Copy-Item "$repo\templates\hooks\nirvana-banner.ps1" "$proj\.claude\hooks\"
foreach ($s in "1", "2", "10", "template") { Set-Content "$proj\docs\sprints\sprint-$s.md" "x" }
Set-Content "$proj\docs\tasks\001-a.md" "status: done"
Set-Content "$proj\docs\tasks\002-b.md" "status: in-progress"
Set-Content "$proj\docs\tasks\003-c.md" "status: planned"
Set-Content "$proj\docs\tasks\task-template.md" "status: done"

# The hook command as /light wires it. -EncodedCommand avoids Windows PowerShell's broken
# quoting of embedded double quotes when passing a command line to a native program.
$settings = Get-Content "$repo\.claude\settings.json" -Raw | ConvertFrom-Json
$hookCommand = $settings.hooks.SessionStart[0].hooks[0].command
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($hookCommand))

function Invoke-Hook($source) {
    $env:CLAUDE_PROJECT_DIR = $proj
    Push-Location "$proj\sub"
    try {
        $json = '{"hook_event_name":"SessionStart","source":"' + $source + '"}'
        $out = $json | powershell -NoProfile -NonInteractive -EncodedCommand $encoded
    } finally { Pop-Location }
    return ($out -join "`n")
}
function Get-Count {
    $file = "$proj\.claude\state.local.json"
    if (Test-Path $file) { return (Get-Content $file -Raw | ConvertFrom-Json).sync.sessionCount }
    return ""
}

try {
    $out = Invoke-Hook "startup"
    Has    "banner on startup" $out "N I R V A N A"
    Has    "latest sprint by number" $out "Sprint:  sprint-10"
    Has    "task counts skip the template" $out "1 planned / 1 in-progress / 1 done"
    Has    "sync line" $out "Sync:    1/3"
    Equals "startup counts a session" (Get-Count) 1
    $bytes = [IO.File]::ReadAllBytes("$proj\.claude\state.local.json")
    Equals "state.local.json has no BOM" ($bytes[0] -eq 0xEF) $false

    $out = Invoke-Hook "clear"
    Equals "/clear counts a session" (Get-Count) 2
    HasNot "no sync notice before sync.every" $out "Sync automatico pendente"

    $out = Invoke-Hook "resume"
    Equals "resume does not count" (Get-Count) 2
    Has    "banner on resume" $out "N I R V A N A"

    $out = Invoke-Hook "startup"
    Equals "third session" (Get-Count) 3
    Has    "sync notice at sync.every" $out "[nirvana] Sync automatico pendente (3/3 sessoes)"

    $out = Invoke-Hook "compact"
    Equals "compact does not count" (Get-Count) 3
    HasNot "no banner after compact" $out "N I R V A N A"
    Has    "Writer reminder after compact" $out "[nirvana] Contexto compactado"

    $state = [IO.File]::ReadAllText("$proj\.claude\state.json") -replace '"entryBanner": true', '"entryBanner": false'
    [IO.File]::WriteAllText("$proj\.claude\state.json", $state, $noBom)
    $out = Invoke-Hook "startup"
    Equals "counts with the banner off" (Get-Count) 4
    HasNot "banner off hides the banner" $out "N I R V A N A"
    Has    "banner off keeps the sync notice" $out "Sync automatico pendente"

    # Manual run: no hook input on stdin, no CLAUDE_PROJECT_DIR, started from another folder
    Remove-Item Env:CLAUDE_PROJECT_DIR
    Push-Location $env:TEMP
    $out = ($null | powershell -NoProfile -ExecutionPolicy Bypass -File "$proj\.claude\hooks\nirvana-banner.ps1") -join "`n"
    Pop-Location
    Equals "manual run without input does not count" (Get-Count) 4
    Has    "finds the project from the script path" $out "Sync automatico pendente"

    Remove-Item "$proj\.claude\state.json"
    $out = Invoke-Hook "startup"
    Equals "no state.json: exit 0" $LASTEXITCODE 0
    Equals "no state.json: no output" $out ""

    Remove-Item "$proj\.claude\hooks\nirvana-banner.ps1"
    $out = Invoke-Hook "startup"
    Equals "missing script: exit 0 (guard in the hook command)" $LASTEXITCODE 0
    Equals "missing script: no output" $out ""
} finally {
    Remove-Item Env:CLAUDE_PROJECT_DIR -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $proj -ErrorAction SilentlyContinue
}

Write-Output ""
if ($script:failed -eq 0) { Write-Output "hook.ps1: all checks passed" } else { Write-Output "hook.ps1: FAILED" }
exit $script:failed
