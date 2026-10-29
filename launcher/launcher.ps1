# 賽爾對戰模擬器 啟動器：背景啟動伺服器 → 以獨立視窗開啟 → 關閉視窗即停止伺服器
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$url    = 'http://localhost:3000'
$probe  = 'http://127.0.0.1:3000'
$logDir = Join-Path $root 'launcher'
$log    = Join-Path $logDir 'server.log'
$appName = '賽爾對戰模擬器'
$ownedProcesses = New-Object System.Collections.Generic.List[System.Diagnostics.Process]
Set-Location $root
. (Join-Path $PSScriptRoot 'startupWindow.ps1')
. (Join-Path $PSScriptRoot 'serverIdentity.ps1')

function Stop-OwnedProcesses {
  foreach ($process in $ownedProcesses) {
    if (-not $process.HasExited) { & taskkill /PID $process.Id /T /F 2>$null | Out-Null }
  }
}

function Show-Error($msg) {
  [System.Windows.Forms.MessageBox]::Show($msg, $appName, 'OK', 'Error') | Out-Null
}

trap {
  Stop-OwnedProcesses
  try { if ($startup) { Complete-StartupWindow $startup } } catch {}
  if ($_.Exception -is [System.OperationCanceledException]) { exit 0 }
  Show-Error ("啟動器發生錯誤：`n" + $_.Exception.Message)
  exit 1
}

function Test-Server {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $probe -TimeoutSec 2
    if ($r.StatusCode -ne 200) { return $false }
    $identity = Invoke-RestMethod -Uri "$probe/api/launcher/identity" -TimeoutSec 2
    $mode = if ($useDev) { 'development' } else { 'production' }
    $expectedBuild = if ($useDev) { '' } else { $activeRelease.buildId }
    if (-not (Test-LauncherServerIdentity $identity $root $mode $expectedBuild)) { throw '伺服器身分或版本不符' }
    return $true
  } catch { return $false }
}

$icoPath = Join-Path $logDir 'app.ico'
# ── 可關閉且不置頂的啟動視窗
$startup = New-StartupWindow $appName $icoPath
$startup.Form.Show()
[System.Windows.Forms.Application]::DoEvents()
function Set-Splash($text, [int]$step = 1) { Update-StartupWindow $startup $text $step }
function Wait-StartupProcess($process, [string]$message, [int]$step) {
  $ownedProcesses.Add($process)
  while (-not $process.HasExited) {
    Set-Splash $message $step
    Start-Sleep -Milliseconds 100
    $process.Refresh()
  }
  $process.WaitForExit()
  Update-StartupWindow $startup $message $step $false
  return $process.ExitCode
}

# ── 桌面捷徑預設不建立；僅讀取設定中明確啟用的偏好。
try {
  $settingsFile = Join-Path $logDir 'settings.json'
  if (Test-Path -LiteralPath $settingsFile) {
    $settings = Get-Content -LiteralPath $settingsFile -Raw | ConvertFrom-Json
    if ($settings.autoDesktopShortcut -is [bool] -and $settings.autoDesktopShortcut) {
      & (Join-Path $PSScriptRoot 'create-shortcut.ps1')
    }
  }
} catch {}

# ── Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Complete-StartupWindow $startup
  Show-Error "找不到 Node.js。`n請到 https://nodejs.org 安裝 LTS 版本後再開啟。"
  exit 1
}

# ── 第一次：安裝套件（顯示視窗）
if (-not (Test-Path (Join-Path $root 'node_modules\tsx'))) {
  Set-Splash '第一次啟動：安裝套件中，可最小化或停止。' 2
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "npm install > `"$logDir\install.log`" 2>&1" -WorkingDirectory $root -WindowStyle Hidden -PassThru
  if ((Wait-StartupProcess $p '套件安裝中；完成後會自動進入建置。' 2) -ne 0) {
    Complete-StartupWindow $startup
    Show-Error '套件安裝失敗，請確認網路後重試。'
    exit 1
  }
}

# 固定載入最後一次完整驗收成功的版本。來源編輯不會自動發布。
$useDev = $env:SEER_DEV -eq '1'
$releaseRoot = Join-Path $root '.desktop-releases'
$activeFile = Join-Path $releaseRoot 'active.json'
if (-not $useDev) {
  if (-not (Test-Path -LiteralPath $activeFile)) { throw '尚無桌面完成版本。請在專案執行 npm run desktop:update。' }
  $activeRelease = Get-Content -LiteralPath $activeFile -Raw | ConvertFrom-Json
  if ($activeRelease.id -notmatch '^\d+$') { throw '桌面版本識別錯誤' }
  $releaseDir = Join-Path $releaseRoot $activeRelease.id
  foreach ($file in @('index.html','server.cjs','version.json','completion.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $releaseDir $file))) { throw '桌面版本不完整，請重新執行 desktop:update' }
  }
  $version = Get-Content -LiteralPath (Join-Path $releaseDir 'version.json') -Raw | ConvertFrom-Json
  $completion = Get-Content -LiteralPath (Join-Path $releaseDir 'completion.json') -Raw | ConvertFrom-Json
  if (-not $activeRelease.buildId -or $version.buildId -ne $activeRelease.buildId -or $completion.version.buildId -ne $activeRelease.buildId) { throw '桌面完成紀錄與版本不一致' }
  $env:SEER_DIST_DIR = $releaseDir
  $env:SEER_RELEASE_ID = $activeRelease.buildId
} else {
  Remove-Item Env:SEER_DIST_DIR,Env:SEER_RELEASE_ID -ErrorAction SilentlyContinue
}

# ── 伺服器
$server = $null
if (-not (Test-Server)) {
  # 不佔用其他服務的埠，也不把來源不明／舊模式的HTTP 200當成可用版本。
  $busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($busy) { throw '3000埠已有其他模式或舊版服務。請先關閉舊模擬器服務再開啟；啟動器未終止該服務。' }
  Set-Splash '啟動伺服器，等待實際連線成功…' 4
  $env:SEER_LAUNCHER = '1'
  $env:SEER_HOST = '127.0.0.1'
  $cmd = if ($useDev) { "npm run dev > `"$log`" 2>&1" } else { "set NODE_ENV=production&& node `"$releaseDir\server.cjs`" > `"$log`" 2>&1" }
  $server = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -WorkingDirectory $root -WindowStyle Hidden -PassThru
  $ownedProcesses.Add($server)
  $ok = $false
  for ($i = 0; $i -lt 180; $i++) {
    if (Test-Server) { $ok = $true; break }
    if ($server.HasExited) { break }
    for ($k = 0; $k -lt 5; $k++) { Start-Sleep -Milliseconds 100; Set-Splash "等待伺服器就緒（第 $($i + 1) 次探測）…" 4 }
  }
  if (-not $ok) {
    Complete-StartupWindow $startup
    if ($server -and -not $server.HasExited) { & taskkill /PID $server.Id /T /F | Out-Null }
    Show-Error "伺服器啟動失敗。`n錯誤紀錄：$log"
    exit 1
  }
}

# ── 瀏覽器（應用程式模式、獨立設定檔 → 獨立視窗與工作列圖示）
function Find-Browser {
  $cands = @()
  foreach ($exe in 'msedge.exe', 'chrome.exe') {
    foreach ($hive in 'HKLM:', 'HKCU:') {
      try {
        $v = (Get-ItemProperty "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$exe" -ErrorAction Stop).'(default)'
        if ($v) { $cands += $v }
      } catch {}
    }
  }
  $cands += @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  foreach ($c in $cands) { if ($c -and (Test-Path $c)) { return $c } }
  return $null
}

$browser = Find-Browser
$profileDir = Join-Path $env:LOCALAPPDATA 'SeerBattleSim\browser'
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
Set-Splash '伺服器已就緒，正在開啟遊戲視窗。' 5

if ($browser) {
  $bargs = @(
    "--app=$url",
    "--user-data-dir=`"$profileDir`"",
    '--start-maximized',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
    '--disable-background-mode'
  )
  Start-Process -FilePath $browser -ArgumentList $bargs | Out-Null
  Complete-StartupWindow $startup
  # 同一設定檔可能交由既有行程開窗：等到該設定檔已沒有任何可見視窗為止
  $seen = $false
  $waited = 0
  while ($true) {
    $ids = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -and $_.CommandLine -like '*SeerBattleSim*' } | ForEach-Object { $_.ProcessId })
    $alive = @($ids | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue } | Where-Object { $_.MainWindowHandle -ne 0 })
    if ($alive.Count -gt 0) { $seen = $true }
    elseif ($seen -or $waited -ge 30) { break }
    Start-Sleep -Seconds 1
    $waited++
  }
} else {
  Start-Process $url
  Complete-StartupWindow $startup
  [System.Windows.Forms.MessageBox]::Show('找不到 Edge／Chrome，已用預設瀏覽器開啟。關閉此訊息會停止伺服器。', $appName) | Out-Null
}

# ── 關閉視窗 → 停止由本啟動器開的伺服器
if ($server -and -not $server.HasExited) { & taskkill /PID $server.Id /T /F | Out-Null }
exit 0
