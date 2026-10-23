# Installs and updates Nirvana into a throwaway HOME, downloading from this checkout (served by
# a local HTTP server through NIRVANA_REPO_RAW). Never touches the real ~/.claude.
# Run: powershell -ExecutionPolicy Bypass -File tests\install.ps1
# Keep this file ASCII-only (Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI).

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$script:failed = 0
function Ok($name) { Write-Output "ok   - $name" }
function Fail($name) { Write-Output "FAIL - $name"; $script:failed = 1 }
function Has($name, $text, $needle) {
    if ($text.Contains($needle)) { Ok $name } else { Fail "$name (missing: $needle)"; $text -split "`n" | ForEach-Object { "       $_" } }
}
function Equals($name, $actual, $expected) { if ("$actual" -eq "$expected") { Ok $name } else { Fail "$name (expected '$expected', got '$actual')" } }
function Test-Bom($path) { $b = [IO.File]::ReadAllBytes($path); return ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) }

$work = Join-Path ([IO.Path]::GetTempPath()) ("nirvana-install-" + [guid]::NewGuid().ToString("N"))
$fakeHome = "$work\home"
New-Item -ItemType Directory -Force "$work\bin", $fakeHome | Out-Null

$port = if ($env:NIRVANA_TEST_PORT) { $env:NIRVANA_TEST_PORT } else { "8765" }
$server = Start-Process python -ArgumentList "`"$repo\tests\serve.py`"", $port, "`"$repo`"" -PassThru -WindowStyle Hidden
$base = "http://127.0.0.1:$port"
for ($i = 0; $i -lt 50; $i++) {
    try { $null = Invoke-WebRequest "$base/install.ps1" -UseBasicParsing; break } catch { Start-Sleep -Milliseconds 200 }
}

# Child PowerShell with an isolated $HOME. It refuses to run unless $HOME really is the fake one,
# so a broken override can never overwrite the real ~/.claude.
function Invoke-Child($scriptText) {
    $guarded = "if (`$HOME -ne '$fakeHome') { Write-Output 'ABORT: HOME is not isolated'; exit 99 }`n" + $scriptText
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($guarded))
    $saved = @{ USERPROFILE = $env:USERPROFILE; HOMEDRIVE = $env:HOMEDRIVE; HOMEPATH = $env:HOMEPATH; PATH = $env:PATH }
    try {
        $env:USERPROFILE = $fakeHome
        $env:HOMEDRIVE = Split-Path $fakeHome -Qualifier
        $env:HOMEPATH = $fakeHome.Substring(2)
        $env:PATH = "$work\bin;$env:PATH"
        $env:NIRVANA_REPO_RAW = $base
        # Write-Host in the child goes to its stdout (not a console), so stdout has everything
        $out = powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encoded
        return @{ Code = $LASTEXITCODE; Text = (($out | ForEach-Object { "$_" }) -join "`n") }
    } finally {
        foreach ($k in $saved.Keys) { Set-Item "Env:$k" $saved[$k] }
        Remove-Item Env:NIRVANA_REPO_RAW -ErrorAction SilentlyContinue
    }
}

try {
    # The installer requires the claude CLI; a stub is enough here
    Set-Content "$work\bin\claude.cmd" "@exit /b 0" -Encoding ASCII

    $version = ([regex]::Match((Get-Content "$repo\install.ps1" -Raw), '\$NIRVANA_VERSION = "([^"]+)"')).Groups[1].Value
    $skills = [regex]::Matches(([regex]::Match((Get-Content "$repo\install.ps1" -Raw), '\$SKILLS = @\(([^)]*)\)')).Groups[1].Value, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
    $templates = git -C $repo ls-files templates | ForEach-Object { $_.Substring("templates/".Length) }
    $tplDir = "$fakeHome\.claude\nirvana-templates"
    $marker = "$tplDir\.nirvana-version"

    $r = Invoke-Child "& '$repo\update.ps1'"
    Equals "update before install fails" $r.Code 1
    Has    "update before install explains why" $r.Text "Nirvana not installed"

    # Run as a file (not iex): catches encoding problems that only show up with -File
    $r = Invoke-Child "& '$repo\install.ps1'"
    Equals "install.ps1 run as a file exits 0" $r.Code 0
    Has    "install finishes" $r.Text "Nirvana installed."

    $bad = @()
    foreach ($s in $skills) {
        $f = "$fakeHome\.claude\skills\$s\SKILL.md"
        if (-not (Test-Path $f) -or (Test-Bom $f) -or ([IO.File]::ReadAllText($f) -ne [IO.File]::ReadAllText("$repo\skills\$s\SKILL.md"))) { $bad += $s }
    }
    if ($bad) { Fail "skills not installed as in the repo (or with BOM): $($bad -join ', ')" } else { Ok "all skills installed, no BOM" }

    $bad = @()
    foreach ($t in $templates) {
        $f = "$tplDir\$($t -replace '/', '\')"
        $wantBom = $t.EndsWith(".ps1")
        $same = (Test-Path $f) -and ([IO.File]::ReadAllText($f) -eq [IO.File]::ReadAllText("$repo\templates\$($t -replace '/', '\')"))
        if (-not $same -or (Test-Bom $f) -ne $wantBom) { $bad += $t }
    }
    if ($bad) { Fail "templates wrong (content or BOM): $($bad -join ', ')" } else { Ok "all templates installed, BOM only on .ps1" }

    Equals "version marker" ([IO.File]::ReadAllText($marker).Trim()) $version
    Equals "version marker has no BOM" (Test-Bom $marker) $false

    # The documented way: iwr | iex
    $r = Invoke-Child "Invoke-Expression (Get-Content '$repo\update.ps1' -Raw -Encoding UTF8)"
    Equals "update via iex exits 0" $r.Code 0
    Has    "update on latest refreshes" $r.Text "Installed version: $version (latest)"

    [IO.File]::WriteAllText($marker, "2.0.0`r`n", (New-Object System.Text.UTF8Encoding $true))
    $r = Invoke-Child "& '$repo\update.ps1'"
    Has    "update reads an old marker with BOM" $r.Text "Updating: 2.0.0 -> $version"
    Equals "update rewrites the marker without BOM" (Test-Bom $marker) $false
} finally {
    Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}

Write-Output ""
if ($script:failed -eq 0) { Write-Output "install.ps1: all checks passed" } else { Write-Output "install.ps1: FAILED" }
exit $script:failed
