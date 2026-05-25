# install.ps1
# Installs ContexAi agent skills from agents/ into the personal Claude skills folder.
#
# Usage:
#   cd C:\Users\amirw\contexai-website\agents
#   .\install.ps1
#
# Each subfolder in agents/ that contains a SKILL.md is treated as a skill and copied
# into the personal skills folder. Existing copies are overwritten — this folder is
# the canonical source of truth.

$ErrorActionPreference = "Stop"

# ─── Configuration ───────────────────────────────────────────────────────────

$SkillsRoot = "$env:APPDATA\Claude\local-agent-mode-sessions\skills-plugin"
$SourceDir  = Split-Path -Parent $MyInvocation.MyCommand.Path

# ─── Locate the active personal skills folder ────────────────────────────────

if (-not (Test-Path $SkillsRoot)) {
    Write-Host "❌ Claude skills root not found at:" -ForegroundColor Red
    Write-Host "   $SkillsRoot" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure you have Claude Code or Cowork installed and have launched it at least once."
    exit 1
}

# The skills folder structure is: skills-plugin\<plugin-id>\<session-id>\skills\
# We want the most recently used one.
$candidates = @()
Get-ChildItem $SkillsRoot -Directory | ForEach-Object {
    $pluginId = $_.FullName
    Get-ChildItem $pluginId -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $skillsPath = Join-Path $_.FullName "skills"
        if (Test-Path $skillsPath) {
            $candidates += [pscustomobject]@{
                Path = $skillsPath
                LastWrite = (Get-Item $skillsPath).LastWriteTime
            }
        }
    }
}

if ($candidates.Count -eq 0) {
    Write-Host "❌ No skills folders found under $SkillsRoot" -ForegroundColor Red
    Write-Host "Try opening Claude Code or Cowork once to create the folder structure."
    exit 1
}

$target = ($candidates | Sort-Object LastWrite -Descending | Select-Object -First 1).Path
Write-Host "Target skills folder:" -ForegroundColor Cyan
Write-Host "  $target"
Write-Host ""

# ─── Discover skills in the source folder ────────────────────────────────────

$skillsToInstall = Get-ChildItem $SourceDir -Directory | Where-Object {
    Test-Path (Join-Path $_.FullName "SKILL.md")
}

if ($skillsToInstall.Count -eq 0) {
    Write-Host "❌ No skill folders found in $SourceDir" -ForegroundColor Red
    Write-Host "Each skill folder must contain a SKILL.md file."
    exit 1
}

Write-Host "Found $($skillsToInstall.Count) skill(s) to install:" -ForegroundColor Cyan
foreach ($s in $skillsToInstall) {
    Write-Host "  - $($s.Name)"
}
Write-Host ""

# ─── Confirm before overwriting ──────────────────────────────────────────────

$confirm = Read-Host "Install / overwrite these skills? (y/N)"
if ($confirm -notmatch "^[yY]") {
    Write-Host "Cancelled."
    exit 0
}

# ─── Copy ────────────────────────────────────────────────────────────────────

foreach ($s in $skillsToInstall) {
    $dest = Join-Path $target $s.Name
    if (Test-Path $dest) {
        Remove-Item $dest -Recurse -Force
    }
    Copy-Item $s.FullName $dest -Recurse -Force
    Write-Host "  ✅ Installed: $($s.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Restart any open Claude Code / Cowork sessions for the skills to load." -ForegroundColor Green
Write-Host ""
Write-Host "Verify by asking in a fresh session:" -ForegroundColor Cyan
Write-Host '  "Group Chief, what practices do you orchestrate?"'
