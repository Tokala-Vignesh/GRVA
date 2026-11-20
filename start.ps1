# CloudSentinel AI — Full Application Launcher
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CloudSentinel AI — Starting Up..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backendDir = Join-Path $root "backend"
$desktopDir = Join-Path $root "desktop"
$frontendDist = Join-Path $root "frontend\dist\index.html"

# Check built frontend exists
if (-not (Test-Path $frontendDist)) {
    Write-Host "[!] Frontend not built. Building now..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "frontend")
    npm run build
    Pop-Location
}

# Check desktop compiled
if (-not (Test-Path (Join-Path $desktopDir "dist\main\main.js"))) {
    Write-Host "[!] Desktop shell not compiled. Building now..." -ForegroundColor Yellow
    Push-Location $desktopDir
    npm run build:ts
    Pop-Location
}

Write-Host "[1] Starting Python backend (127.0.0.1:8765)..." -ForegroundColor Green
$backendProc = Start-Process python -ArgumentList "backend/app/main.py" `
    -WorkingDirectory $root `
    -PassThru -NoNewWindow

Write-Host "    Backend PID: $($backendProc.Id)" -ForegroundColor DarkGreen

Write-Host "[2] Waiting for backend to become healthy..." -ForegroundColor Green
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    try {
        # Bypass proxy for loopback check
        $env:NO_PROXY = "127.0.0.1,localhost"
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8765/api/v1/health" -TimeoutSec 2 -UseBasicParsing -Proxy $null 2>$null
        if ($resp.StatusCode -eq 200) {
            Write-Host "    Backend is healthy! ($i seconds)" -ForegroundColor DarkGreen
            $ready = $true
            break
        }
    } catch {}
    Write-Host "    Waiting... ($($i+1)s)" -ForegroundColor DarkGray
}

if (-not $ready) {
    Write-Host "[!] Backend did not respond in time. Proceeding anyway (Electron will retry)." -ForegroundColor Yellow
}

Write-Host "[3] Launching Electron desktop window..." -ForegroundColor Green
Push-Location $desktopDir
$env:CLOUDSENTINEL_BACKEND_PRESTARTED = "1"
npx electron dist/main/main.js
Pop-Location

Write-Host ""
Write-Host "[*] Application closed. Stopping backend..." -ForegroundColor Cyan
if (-not $backendProc.HasExited) {
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    Write-Host "    Backend stopped." -ForegroundColor DarkGreen
}
Write-Host "Done." -ForegroundColor Cyan
