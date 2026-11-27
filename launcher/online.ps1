param([switch]$Rebuild)
$ErrorActionPreference = 'Stop'
$onlineRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $onlineRoot
. (Join-Path $PSScriptRoot 'startupWindow.ps1')
$onlineStartup = New-StartupWindow '雙人連線版' (Join-Path $PSScriptRoot 'app.ico')
$onlineServer = $null
try {
 $onlineNode = (Get-Command node -ErrorAction Stop).Source
 $onlineDist = Join-Path $onlineRoot 'dist-online'
 $onlineEntry = Join-Path $onlineDist 'signal.cjs'
 $onlineStamp = Join-Path $onlineDist 'build-complete.json'
 $onlineNeedsBuild = $Rebuild -or -not (Test-Path -LiteralPath $onlineStamp) -or -not (Test-Path -LiteralPath $onlineEntry)
 if (-not $onlineNeedsBuild) {
  $onlineBuiltAt = (Get-Item -LiteralPath $onlineStamp).LastWriteTimeUtc
  $onlineSources = @(Get-ChildItem -LiteralPath (Join-Path $onlineRoot 'src'),(Join-Path $onlineRoot 'server') -File -Recurse) + @(Get-Item -LiteralPath (Join-Path $onlineRoot 'package.json'),(Join-Path $onlineRoot 'vite.online.config.ts'),(Join-Path $onlineRoot 'vite.config.ts'),(Join-Path $onlineRoot 'online.html'))
  $onlineNeedsBuild = [bool]($onlineSources | Where-Object { $_.LastWriteTimeUtc -gt $onlineBuiltAt } | Select-Object -First 1)
 }
 if ($onlineNeedsBuild) {
  Update-StartupWindow $onlineStartup '正在更新雙人版本，首次啟動需要較多時間…' 1
  $onlineBuild = Start-Process -FilePath $onlineNode -ArgumentList @('scripts/with_tmp.mjs','npm','run','build:online:steps') -WorkingDirectory $onlineRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'online-build.log') -RedirectStandardError (Join-Path $PSScriptRoot 'online-build.error.log') -PassThru
  while (-not $onlineBuild.HasExited) { Start-Sleep -Milliseconds 200; Update-StartupWindow $onlineStartup '正在準備雙人版介面與連線服務…' 1 }
  if ($onlineBuild.ExitCode -ne 0) { throw '雙人版更新失敗，請查看 launcher/online-build.error.log。' }
 }
 $onlineExpectedBuild = (Get-Content -LiteralPath $onlineStamp -Raw | ConvertFrom-Json).builtAt
 $onlinePort = 3091
 $env:SEER_P2P_WEB_ROOT = $onlineDist
 $env:SEER_P2P_HOST = '127.0.0.1'
 $env:SEER_P2P_PORT = "$onlinePort"
 # 未設定 TURN 中繼時改用直連（雙方需勾選「允許直連」），否則房間無法建立；公開部署請在 server/p2p.env 設定 TURN。
 $onlineEnvFile = Join-Path $onlineRoot 'server/p2p.env'
 if (Test-Path -LiteralPath $onlineEnvFile) { Get-Content -LiteralPath $onlineEnvFile | Where-Object { $_ -match '^\s*SEER_P2P_[A-Z_]+=' } | ForEach-Object { $k,$v = $_ -split '=',2; [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), 'Process') } }
 if (-not $env:SEER_P2P_TURN_URLS -and -not $env:SEER_P2P_ALLOW_DIRECT) { $env:SEER_P2P_ALLOW_DIRECT = '1' }
 if ($env:SEER_P2P_ALLOW_DIRECT -eq '1' -and -not $env:SEER_P2P_STUN_URLS) { $env:SEER_P2P_STUN_URLS = 'stun:stun.l.google.com:19302' }
 $onlineBusy = Get-NetTCPConnection -LocalPort $onlinePort -State Listen -ErrorAction SilentlyContinue
 if ($onlineBusy) {
  $onlineIdentity = Invoke-RestMethod "http://127.0.0.1:$onlinePort/api/p2p/identity" -TimeoutSec 3
  if ($onlineIdentity.app -ne 'seer-online' -or [IO.Path]::GetFullPath($onlineIdentity.root) -ne $onlineDist) { throw '雙人版連接埠已被其他程式占用。' }
  if ($onlineIdentity.build -ne $onlineExpectedBuild) { throw '雙人版已更新，請先關閉舊雙人版視窗，再重新開啟。' }
 } else {
  Update-StartupWindow $onlineStartup '正在啟動雙人連線服務…' 2
  $onlineServer = Start-Process -FilePath $onlineNode -ArgumentList @("`"$onlineEntry`"") -WorkingDirectory $onlineRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'online.log') -RedirectStandardError (Join-Path $PSScriptRoot 'online.error.log') -PassThru
  $onlineReady = $false
  for ($onlineTry=0; $onlineTry -lt 100; $onlineTry++) {
   if ($onlineServer.HasExited) { break }
   try { $onlineIdentity = Invoke-RestMethod "http://127.0.0.1:$onlinePort/api/p2p/identity" -TimeoutSec 1; if ($onlineIdentity.pid -eq $onlineServer.Id -and $onlineIdentity.app -eq 'seer-online') { $onlineReady=$true; break } } catch {}
   Start-Sleep -Milliseconds 200; Update-StartupWindow $onlineStartup '正在等待服務就緒…' 2
  }
  if (-not $onlineReady) { throw '雙人連線服務無法啟動，請查看 launcher/online.error.log。' }
 }
 $onlineBrowser = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe","$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
 if (-not $onlineBrowser) { throw '需要 Microsoft Edge 開啟雙人連線版。' }
 $onlineProfile = Join-Path $env:LOCALAPPDATA 'SeerOnline/browser'
 $onlineWindow = Start-Process -FilePath $onlineBrowser -ArgumentList @("--app=http://127.0.0.1:$onlinePort","--user-data-dir=`"$onlineProfile`"",'--no-first-run','--edge-skip-compat-layer-relaunch') -PassThru
 Complete-StartupWindow $onlineStartup
 $onlineWindow.WaitForExit()
} catch {
 Complete-StartupWindow $onlineStartup
 if ($_.Exception -isnot [System.OperationCanceledException]) { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'雙人連線版','OK','Error') | Out-Null }
} finally {
 if ($onlineServer -and -not $onlineServer.HasExited) { Stop-Process -Id $onlineServer.Id -Force -ErrorAction SilentlyContinue }
}
