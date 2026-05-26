# migrate-to-contexai-agents.ps1
# One-time migration from G:\My Drive\Banking_Agents\ to G:\My Drive\ContexAi_Agents\
# with per-practice subfolders.
#
# Usage from the contexai-website folder:
#   powershell.exe -ExecutionPolicy Bypass -File ".\agents\migrate-to-contexai-agents.ps1"
#
# Safe to re-run. Uses Move-Item (not Copy) to relocate teams. The old
# Banking_Agents folder is left in place once it is empty so you can confirm
# the migration was clean before deleting it manually.

$ErrorActionPreference = "Stop"

# Source and destination roots
$OldRoot = "G:\My Drive\Banking_Agents"
$NewRoot = "G:\My Drive\ContexAi_Agents"
$RepoTeamsDir   = Join-Path $PSScriptRoot "teams"
$RepoMainCC     = Join-Path $PSScriptRoot "ContexAi_Control_Center.html"

Write-Host "Source (old): $OldRoot"
Write-Host "Target (new): $NewRoot"
Write-Host ""

if (-not (Test-Path $OldRoot)) {
    Write-Host "ERROR: Source folder not found: $OldRoot" -ForegroundColor Red
    Write-Host "       If you renamed it already, edit OldRoot at the top of this script." -ForegroundColor Yellow
    exit 1
}

# Create new parent and per-practice subfolders
$practices = @("Banking", "Real_Estate", "Energy", "Accreditation")
foreach ($p in $practices) {
    $path = Join-Path $NewRoot $p
    New-Item -ItemType Directory -Force -Path $path | Out-Null
    Write-Host "  [OK] Practice folder: $path" -ForegroundColor Green
}
Write-Host ""

# Migrations: each row = old subfolder name, new practice, new subfolder name
$moves = @(
    @{ Old = "SMFB Agents Team";       Practice = "Banking";     New = "SMFB Agents Team" },
    @{ Old = "TSH Agents Team";        Practice = "Real_Estate"; New = "TSH Agents Team" },
    @{ Old = "Cnergyico Agents Team";  Practice = "Energy";      New = "Cnergyico Agents Team" }
)

foreach ($m in $moves) {
    $src = Join-Path $OldRoot $m.Old
    $dst = Join-Path (Join-Path $NewRoot $m.Practice) $m.New

    Write-Host "--- $($m.Old) ---" -ForegroundColor Cyan

    if (-not (Test-Path $src)) {
        Write-Host "  [SKIP] Source missing: $src" -ForegroundColor Yellow
        continue
    }

    if (Test-Path $dst) {
        Write-Host "  [SKIP] Target already exists: $dst" -ForegroundColor Yellow
        Write-Host "         If you want to overwrite, remove the target first." -ForegroundColor Yellow
        continue
    }

    Move-Item -Path $src -Destination $dst -Force
    Write-Host "  [OK] Moved to: $dst" -ForegroundColor Green
}

Write-Host ""

# Create the Accreditation placeholder folder (no team yet, just the practice container)
$cipDir = Join-Path (Join-Path $NewRoot "Accreditation") "CIP Agents Team"
New-Item -ItemType Directory -Force -Path $cipDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $cipDir "docs")        | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $cipDir "engagements") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $cipDir "exports")     | Out-Null
Write-Host "  [OK] CIP Agents Team placeholder: $cipDir" -ForegroundColor Green
Write-Host ""

# Copy the main Control Center to the new top-level
if (Test-Path $RepoMainCC) {
    $dstMainCC = Join-Path $NewRoot "ContexAi_Control_Center.html"
    Copy-Item -Path $RepoMainCC -Destination $dstMainCC -Force
    Write-Host "  [OK] Copied main Control Center: $dstMainCC" -ForegroundColor Green
}

# Copy team Control Centers into their new homes (in case they weren't moved with the team folder)
$teamCCs = @(
    @{ Src = (Join-Path $RepoTeamsDir "TSH_Control_Center.html");       Dst = (Join-Path $NewRoot "Real_Estate\TSH Agents Team\TSH_Control_Center.html") },
    @{ Src = (Join-Path $RepoTeamsDir "Cnergyico_Control_Center.html"); Dst = (Join-Path $NewRoot "Energy\Cnergyico Agents Team\Cnergyico_Control_Center.html") }
)
foreach ($cc in $teamCCs) {
    if (Test-Path $cc.Src) {
        $dstDir = Split-Path -Parent $cc.Dst
        if (Test-Path $dstDir) {
            Copy-Item -Path $cc.Src -Destination $cc.Dst -Force
            Write-Host "  [OK] Refreshed team CC: $($cc.Dst)" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "Migration complete." -ForegroundColor Green
Write-Host ""
Write-Host "New structure:" -ForegroundColor Cyan
Write-Host "  $NewRoot\"
Write-Host "    Banking\SMFB Agents Team\"
Write-Host "    Real_Estate\TSH Agents Team\"
Write-Host "    Energy\Cnergyico Agents Team\"
Write-Host "    Accreditation\CIP Agents Team\  (placeholder)"
Write-Host "    ContexAi_Control_Center.html"
Write-Host ""
Write-Host "Old folder status: $OldRoot" -ForegroundColor Yellow
Write-Host "  Leftover items (verify these are safe to delete before removing the folder):" -ForegroundColor Yellow
Get-ChildItem $OldRoot -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "    - $($_.Name)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Open File Explorer on the new structure..." -ForegroundColor Cyan
Start-Process explorer.exe -ArgumentList $NewRoot
