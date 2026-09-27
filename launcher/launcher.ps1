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
Set-Location $root

function Show-Error($msg) {
  [System.Windows.Forms.MessageBox]::Show($msg, $appName, 'OK', 'Error') | Out-Null
}

trap {
  try { if ($splash) { $splash.Close() } } catch {}
  Show-Error ("啟動器發生錯誤：`n" + $_.Exception.Message)
  exit 1
}

function Test-Server {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $probe -TimeoutSec 2
    return $r.StatusCode -eq 200
  } catch { return $false }
}

# ── 小型啟動畫面
$splash = New-Object System.Windows.Forms.Form
$splash.FormBorderStyle = 'None'
$splash.StartPosition = 'CenterScreen'
$splash.Size = New-Object System.Drawing.Size(360, 110)
$splash.BackColor = [System.Drawing.Color]::FromArgb(10, 14, 22)
$splash.TopMost = $true
$splash.ShowInTaskbar = $true
$splash.Text = $appName
$lbl = New-Object System.Windows.Forms.Label
$lbl.ForeColor = [System.Drawing.Color]::FromArgb(103, 232, 249)
$lbl.Font = New-Object System.Drawing.Font('Microsoft JhengHei UI', 12, [System.Drawing.FontStyle]::Bold)
$lbl.Dock = 'Fill'
$lbl.TextAlign = 'MiddleCenter'
$lbl.Text = "$appName`n啟動中…"
$splash.Controls.Add($lbl)
$icoPath = Join-Path $logDir 'app.ico'
if (Test-Path $icoPath) { $splash.Icon = New-Object System.Drawing.Icon($icoPath) }
$splash.Show()
[System.Windows.Forms.Application]::DoEvents()
function Set-Splash($text) { $lbl.Text = "$appName`n$text"; [System.Windows.Forms.Application]::DoEvents() }

# ── 桌面捷徑（第一次執行時建立）
try {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $lnk = Join-Path $desktop "$appName.lnk"
  if (-not (Test-Path $lnk)) {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($lnk)
    $sc.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`""
    $sc.WorkingDirectory = $root
    if (Test-Path $icoPath) { $sc.IconLocation = $icoPath }
    $sc.WindowStyle = 7
    $sc.Save()
  }
} catch {}

# ── Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  $splash.Close()
  Show-Error "找不到 Node.js。`n請到 https://nodejs.org 安裝 LTS 版本後再開啟。"
  exit 1
}

# ── 第一次：安裝套件（顯示視窗）
if (-not (Test-Path (Join-Path $root 'node_modules\tsx'))) {
  Set-Splash '第一次啟動：安裝套件中（約 1~3 分鐘）…'
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm install' -WorkingDirectory $root -PassThru -Wait
  if ($p.ExitCode -ne 0) {
    $splash.Close()
    Show-Error '套件安裝失敗，請確認網路後重試。'
    exit 1
  }
}

# ── 正式版建置（比開發模式快數倍）：dist 不存在或原始碼有更新時重新建置
function Test-NeedBuild {
  $index = Join-Path $root 'dist\index.html'
  if (-not (Test-Path $index)) { return $true }
  $built = (Get-Item $index).LastWriteTime
  foreach ($d in @('src', 'public')) {
    $dir = Join-Path $root $d
    if (Test-Path $dir) {
      $newer = Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt $built } | Select-Object -First 1
      if ($newer) { return $true }
    }
  }
  foreach ($f in @('index.html', 'vite.config.ts', 'package.json')) {
    $fp = Join-Path $root $f
    if ((Test-Path $fp) -and ((Get-Item $fp).LastWriteTime -gt $built)) { return $true }
  }
  return $false
}

$useDev = $env:SEER_DEV -eq '1'
if (-not $useDev -and -not (Test-Server) -and (Test-NeedBuild)) {
  Set-Splash '建置正式版中（約 15~40 秒，只在更新後執行）…'
  $b = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "npx vite build > `"$logDir\build.log`" 2>&1" -WorkingDirectory $root -WindowStyle Hidden -PassThru
  while (-not $b.HasExited) { Start-Sleep -Milliseconds 100; [System.Windows.Forms.Application]::DoEvents() }
  if ($b.ExitCode -ne 0) { $useDev = $true }  # 建置失敗 → 改用開發模式啟動
}

# ── 伺服器
$server = $null
if (-not (Test-Server)) {
  Set-Splash '啟動伺服器中…'
  $cmd = if ($useDev) { "npm run dev > `"$log`" 2>&1" } else { "set NODE_ENV=production&& npx tsx server.ts > `"$log`" 2>&1" }
  $server = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -WorkingDirectory $root -WindowStyle Hidden -PassThru
  $ok = $false
  for ($i = 0; $i -lt 180; $i++) {
    if (Test-Server) { $ok = $true; break }
    if ($server.HasExited) { break }
    for ($k = 0; $k -lt 5; $k++) { Start-Sleep -Milliseconds 100; [System.Windows.Forms.Application]::DoEvents() }
  }
  if (-not $ok) {
    $splash.Close()
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
$splash.Close()

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
  [System.Windows.Forms.MessageBox]::Show('找不到 Edge／Chrome，已用預設瀏覽器開啟。關閉此訊息會停止伺服器。', $appName) | Out-Null
}

# ── 關閉視窗 → 停止由本啟動器開的伺服器
if ($server -and -not $server.HasExited) { & taskkill /PID $server.Id /T /F | Out-Null }
exit 0
