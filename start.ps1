# CloudSentinel AI — Full Application Launcher
Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
Write-Host '  CloudSentinel AI — Starting Up...' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backendDir = Join-Path $root 'backend'
$desktopDir = Join-Path $root 'desktop'
$frontendDist = Join-Path $root 'frontend\dist\index.html'

# 1. Check built frontend exists
if (-not (Test-Path $frontendDist)) {
    Write-Host '[!] Frontend not built. Building now...' -ForegroundColor Yellow
    Push-Location (Join-Path $root 'frontend')
    npm run build
    Pop-Location
}

# 2. Check desktop compiled
if (-not (Test-Path (Join-Path $desktopDir 'dist\main\main.js'))) {
    Write-Host '[!] Desktop shell not compiled. Building now...' -ForegroundColor Yellow
    Push-Location $desktopDir
    npm run build:ts
    Pop-Location
}

# 3. Clear any parent editor or host environment variables
$env:ELECTRON_RUN_AS_NODE = $null
[Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $null, 'Process')

# 4. Ensure shared API token exists so backend and desktop IPC agree
if (-not $env:CLOUDSENTINEL_TOKEN) {
    if (Test-Path (Join-Path $root '.env')) {
        $envLine = Get-Content (Join-Path $root '.env') | Where-Object { $_ -match '^CLOUDSENTINEL_TOKEN=(.+)$' }
        if ($envLine) {
            $env:CLOUDSENTINEL_TOKEN = $matches[1].Trim()
        }
    }
    if (-not $env:CLOUDSENTINEL_TOKEN) {
        $env:CLOUDSENTINEL_TOKEN = 'cloudsentinel_session_vault_token_489274912739'
    }
}

# 5. Free port 8765 if previously occupied
try {
    $staleConns = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue
    if ($staleConns) {
        $stalePids = $staleConns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($p in $stalePids) {
            if ($p -and $p -ne 0 -and $p -ne $PID) {
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
catch {}

# 6. Locate Python binary
$pythonExe = 'python'
if (Test-Path (Join-Path $root 'backend\.venv\Scripts\python.exe')) {
    $pythonExe = Join-Path $root 'backend\.venv\Scripts\python.exe'
} elseif (Test-Path (Join-Path $root '.venv\Scripts\python.exe')) {
    $pythonExe = Join-Path $root '.venv\Scripts\python.exe'
} elseif (-not (Get-Command 'python' -ErrorAction SilentlyContinue) -and (Get-Command 'py' -ErrorAction SilentlyContinue)) {
    $pythonExe = 'py'
}

Write-Host '[1] Starting Python backend on 127.0.0.1:8765...' -ForegroundColor Green
$backendProc = Start-Process $pythonExe -ArgumentList 'backend/app/main.py' `
    -WorkingDirectory $root `
    -PassThru -NoNewWindow

if ($backendProc) {
    $bPid = $backendProc.Id
    Write-Host "    Backend started with PID: $bPid" -ForegroundColor DarkGreen
}

Write-Host '[2] Waiting for backend to become healthy...' -ForegroundColor Green
$ready = $false
$env:NO_PROXY = '127.0.0.1,localhost'

for ($i = 1; $i -le 60; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/api/v1/health' -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($resp -and $resp.status -eq 'healthy') {
            Write-Host "    Backend is healthy! ($i seconds)" -ForegroundColor DarkGreen
            $ready = $true
            break
        }
    }
    catch {}
    Write-Host "    Waiting... ${i}s" -ForegroundColor DarkGray
}

if (-not $ready) {
    Write-Host '[!] Backend did not respond within 60s. Proceeding anyway.' -ForegroundColor Yellow
}

Write-Host '[3] Launching Electron desktop window...' -ForegroundColor Green
$electronExe = Join-Path $desktopDir 'node_modules\electron\dist\electron.exe'
$env:CLOUDSENTINEL_BACKEND_PRESTARTED = '1'

if (Test-Path $electronExe) {
    Start-Process $electronExe -ArgumentList '.' -WorkingDirectory $desktopDir -Wait
} else {
    Push-Location $desktopDir
    npm run start
    Pop-Location
}

Write-Host ''
Write-Host '[*] Application closed. Stopping backend...' -ForegroundColor Cyan
if ($backendProc -and -not $backendProc.HasExited) {
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    Write-Host '    Backend stopped.' -ForegroundColor DarkGreen
}

# Final cleanup of port 8765
try {
    $remainingConns = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue
    if ($remainingConns) {
        $pidsToKill = $remainingConns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($p in $pidsToKill) {
            if ($p -and $p -ne 0 -and $p -ne $PID) {
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
            }
        }
    }
} catch {}

Write-Host 'Done.' -ForegroundColor Cyan
