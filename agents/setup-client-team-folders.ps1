# setup-client-team-folders.ps1
# Creates Google Drive folder structures for TSH and Cnergyico client teams,
# copies their Control Center HTML files in, and opens File Explorer.
#
# Usage from the contexai-website folder:
#   powershell.exe -ExecutionPolicy Bypass -File ".\agents\setup-client-team-folders.ps1"
#
# Safe to re-run — folders that already exist are left alone; HTML files are overwritten
# (the canonical versions live in the repo at agents/teams/, not in Drive).

$ErrorActionPreference = "Stop"

# ─── Paths ───────────────────────────────────────────────────────────────────
$RepoTeamsDir = "$PSScriptRoot\teams"
$DriveBase    = "G:\My Drive\Banking_Agents"

if (-not (Test-Path $DriveBase)) {
    Write-Host "❌ Google Drive parent folder not found at:" -ForegroundColor Red
    Write-Host "   $DriveBase" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure Google Drive for Desktop is running and the Banking_Agents folder is synced." -ForegroundColor Yellow
    Write-Host "Then re-run this script."
    exit 1
}

if (-not (Test-Path $RepoTeamsDir)) {
    Write-Host "❌ Repo teams folder not found at: $RepoTeamsDir" -ForegroundColor Red
    Write-Host "Make sure you're running this from the contexai-website folder." -ForegroundColor Yellow
    exit 1
}

# ─── Helper: create team folder + copy Control Center ────────────────────────
function Setup-ClientTeam {
    param(
        [string]$TeamName,
        [string]$ControlCenterFile
    )

    Write-Host ""
    Write-Host "─── $TeamName ─────────────────────────────────" -ForegroundColor Cyan

    $teamDir = Join-Path $DriveBase $TeamName
    $subfolders = @("docs", "engagements", "exports")

    # Create the team folder + subfolders
    New-Item -ItemType Directory -Force -Path $teamDir | Out-Null
    Write-Host "  ✓ Created: $teamDir" -ForegroundColor Green

    foreach ($s in $subfolders) {
        $path = Join-Path $teamDir $s
        New-Item -ItemType Directory -Force -Path $path | Out-Null
        Write-Host "  ✓ Subfolder: $s" -ForegroundColor Green
    }

    # Copy the Control Center HTML
    $srcHtml = Join-Path $RepoTeamsDir $ControlCenterFile
    $dstHtml = Join-Path $teamDir $ControlCenterFile

    if (-not (Test-Path $srcHtml)) {
        Write-Host "  ❌ Source HTML missing: $srcHtml" -ForegroundColor Red
        return
    }

    Copy-Item -Path $srcHtml -Destination $dstHtml -Force
    Write-Host "  ✓ Copied Control Center: $dstHtml" -ForegroundColor Green
}

# ─── Run for each team ───────────────────────────────────────────────────────
Setup-ClientTeam -TeamName "TSH Agents Team"       -ControlCenterFile "TSH_Control_Center.html"
Setup-ClientTeam -TeamName "Cnergyico Agents Team" -ControlCenterFile "Cnergyico_Control_Center.html"

# ─── Open the parent folder ──────────────────────────────────────────────────
Write-Host ""
Write-Host "Done. All client team folders are at:" -ForegroundColor Cyan
Write-Host "  $DriveBase" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: the canonical Control Center HTMLs live in the repo at" -ForegroundColor Cyan
Write-Host "  contexai-website\agents\teams\" -ForegroundColor Yellow
Write-Host "Re-run this script after editing them to push updates to Google Drive."
Write-Host ""
Write-Host "Opening in File Explorer..." -ForegroundColor Cyan
Start-Process explorer.exe -ArgumentList $DriveBase

# ─── Optional: note about renaming parent folder ─────────────────────────────
Write-Host ""
Write-Host "TIP: As ContexAi grows beyond banking, consider renaming the parent folder from" -ForegroundColor DarkYellow
Write-Host "  G:\My Drive\Banking_Agents\" -ForegroundColor DarkYellow
Write-Host "to" -ForegroundColor DarkYellow
Write-Host "  G:\My Drive\ContexAi_Agents\" -ForegroundColor DarkYellow
Write-Host "Then update the file:// links in agents\ContexAi_Control_Center.html to match." -ForegroundColor DarkYellow
