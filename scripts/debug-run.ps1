$ErrorActionPreference = "Stop"

$projectRoot = "D:\Workspaces_VSCode\HealthApp"
$emulatorExe = "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"
$avdName = "Pixel_7"
$logFile = Join-Path $projectRoot ("expo_logs_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".txt")

Set-Location $projectRoot

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
