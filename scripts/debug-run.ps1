$ErrorActionPreference = "Stop"

$projectRoot = "D:\Workspaces_VSCode\HealthApp"
$emulatorExe = "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"
$avdName = "Pixel_7"
$logDir = Join-Path $projectRoot "logs\expo"
$logFile = Join-Path $logDir ("expo_logs_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".txt")

Set-Location $projectRoot

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

Write-Host "==> Starte ADB..."
adb start-server | Out-Null

# Emulator prüfen
$devicesOutput = adb devices
$emulatorRunning = $devicesOutput -match "emulator-\d+\s+device"

if (-not $emulatorRunning) {
    Write-Host "==> Starte Emulator..."
    Start-Process $emulatorExe -ArgumentList "-avd $avdName"
}

Write-Host "==> Warte auf Emulator..."
$ready = $false
for ($i=0; $i -lt 90; $i++) {
    Start-Sleep 2

    $devicesOutput = adb devices
    $devicePresent = $devicesOutput -match "emulator-\d+\s+device"

    if ($devicePresent) {
        try {
            $boot = (adb shell getprop sys.boot_completed).Trim()
            if ($boot -eq "1") {
                $ready = $true
                break
            }
        } catch {
            # ignore transient adb/emulator startup errors
        }
    }
}

if (-not $ready) {
    throw "Emulator nicht vollständig gebootet."
}

Write-Host "==> Starte Logging in $logFile ..."
Start-Transcript -Path $logFile -Force

Write-Host "==> Starte Expo..."
npx expo start --android

Stop-Transcript
