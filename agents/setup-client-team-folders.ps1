# setup-client-team-folders.ps1
# Creates Google Drive folder structures for TSH and Cnergyico client teams,
# copies their Control Center HTML files in, and opens File Explorer.
#
# Usage from the contexai-website folder:
#   powershell.exe -ExecutionPolicy Bypass -File ".\agents\setup-client-team-folders.ps1"

$ErrorActionPreference = "Stop"

# Paths
$RepoTeamsDir = Join-Path $PSScriptRoot "teams"
$DriveBase    = "G:\My Drive\Banking_Agents"

Write-Host "Repo teams folder: $RepoTeamsDir"
Write-Host "Drive base folder: $DriveBase"
Write-Host ""

# Sanity checks
if (-not (Test-Path $DriveBase)) {
    Write-Host "ERROR: Google Drive parent folder not found at $DriveBase" -ForegroundColor Red
    Write-Host "       Start Google Drive for Desktop and wait until G: is mounted, then re-run." -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path $RepoTeamsDir)) {
    Write-Host "ERROR: Repo teams folder not found at $RepoTeamsDir" -ForegroundColor Red
    Write-Host "       Make sure you are running this from the contexai-website folder." -ForegroundColor Yellow
    exit 1
}

# Per-team setup (inline, no function, no fancy unicode)
$teams = @(
    @{ Name = "TSH Agents Team";       Html = "TSH_Control_Center.html" },
    @{ Name = "Cnergyico Agents Team"; Html = "Cnergyico_Control_Center.html" }
)
$subfolders = @("docs", "engagements", "exports")

foreach ($team in $teams) {
    $teamName = $team.Name
    $htmlFile = $team.Html

    Write-Host ""
    Write-Host "--- $teamName ---" -ForegroundColor Cyan

    $teamDir = Join-Path $DriveBase $teamName
    New-Item -ItemType Directory -Force -Path $teamDir | Out-Null
    Write-Host "  [OK] Created: $teamDir" -ForegroundColor Green

    foreach ($s in $subfolders) {
        $subPath = Join-Path $teamDir $s
        New-Item -ItemType Directory -Force -Path $subPath | Out-Null
        Write-Host "  [OK] Subfolder: $s" -ForegroundColor Green
    }

    $srcHtml = Join-Path $RepoTeamsDir $htmlFile
    $dstHtml = Join-Path $teamDir $htmlFile

    if (-not (Test-Path $srcHtml)) {
        Write-Host "  [SKIP] Source HTML missing: $srcHtml" -ForegroundColor Red
        continue
    }

    Copy-Item -Path $srcHtml -Destination $dstHtml -Force
    Write-Host "  [OK] Copied Control Center: $dstHtml" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. All client team folders are at:" -ForegroundColor Cyan
Write-Host "  $DriveBase" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: the canonical Control Center HTMLs live in the repo at" -ForegroundColor Cyan
Write-Host "  contexai-website\agents\teams\" -ForegroundColor Yellow
Write-Host "Re-run this script after editing them to push updates to Google Drive."
Write-Host ""

Start-Process explorer.exe -ArgumentList $DriveBase

Write-Host "TIP: As ContexAi grows beyond banking, you may want to rename" -ForegroundColor DarkYellow
Write-Host "     G:\My Drive\Banking_Agents  ->  G:\My Drive\ContexAi_Agents" -ForegroundColor DarkYellow
Write-Host "     Then update file:// links in agents\ContexAi_Control_Center.html." -ForegroundColor DarkYellow
