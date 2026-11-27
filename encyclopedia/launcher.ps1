param([switch]$Rebuild,[switch]$Blank)
$ErrorActionPreference = 'Stop'
$atlasRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $atlasRoot
. (Join-Path $atlasRoot 'launcher/startupWindow.ps1')
$atlasStartup = New-StartupWindow '精靈圖鑑' (Join-Path $atlasRoot 'launcher/app.ico')
$atlasServer = $null
try {
 $atlasNode = (Get-Command node -ErrorAction Stop).Source
 if (-not $Blank) {
  Update-StartupWindow $atlasStartup '正在檢查精靈資料更新…' 1
  $atlasSync = Start-Process -FilePath $atlasNode -ArgumentList @('--import','tsx','encyclopedia/sync-catalog.ts','--if-stale') -WorkingDirectory $atlasRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'sync.log') -RedirectStandardError (Join-Path $PSScriptRoot 'sync.error.log') -PassThru
  while (-not $atlasSync.HasExited) { Start-Sleep -Milliseconds 200; Update-StartupWindow $atlasStartup '正在同步精靈介紹，保留自製內容…' 1 }
  if ($atlasSync.ExitCode -ne 0) { throw '圖鑑資料同步失敗，請查看 encyclopedia/sync.error.log。' }
 }
 $atlasActivePath = Join-Path $PSScriptRoot '.releases/active.json'
 if ($Rebuild -or -not (Test-Path -LiteralPath $atlasActivePath)) {
  Update-StartupWindow $atlasStartup '正在同步目前專案資料並更新圖鑑…' 2
  $atlasLog = Join-Path $PSScriptRoot 'build.log'
  $atlasBuild = Start-Process -FilePath $atlasNode -ArgumentList @('encyclopedia/build.mjs') -WorkingDirectory $atlasRoot -WindowStyle Hidden -RedirectStandardOutput $atlasLog -RedirectStandardError (Join-Path $PSScriptRoot 'build.error.log') -PassThru
  while (-not $atlasBuild.HasExited) { Start-Sleep -Milliseconds 200; Update-StartupWindow $atlasStartup '正在檢查與打包圖鑑，請稍候…' 2 }
  if ($atlasBuild.ExitCode -ne 0) { throw "圖鑑更新失敗，原版本已保留。請查看 $atlasLog" }
 }
 $atlasActive = Get-Content -LiteralPath $atlasActivePath -Raw | ConvertFrom-Json
 if ($atlasActive.id -notmatch '^\d+$') { throw '圖鑑版本資料無效' }
 $atlasDist = Join-Path $PSScriptRoot ".releases/$($atlasActive.id)"
 if (-not (Test-Path -LiteralPath (Join-Path $atlasDist 'completion.json'))) { throw '圖鑑版本尚未完成，請先更新圖鑑。' }
 $atlasPort = if ($Blank) { 3179 } else { 3177 }
 $env:ATLAS_BLANK = if ($Blank) { '1' } else { '0' }
 $env:ATLAS_CATALOG_DIR = Join-Path $PSScriptRoot 'catalog'
 $env:ATLAS_DATA_DIR = Join-Path $env:LOCALAPPDATA $(if ($Blank) { 'SeerEncyclopediaBlank' } else { 'SeerEncyclopedia' })
 $atlasBusy = Get-NetTCPConnection -LocalPort $atlasPort -State Listen -ErrorAction SilentlyContinue
 if ($atlasBusy) {
  $atlasIdentity = Invoke-RestMethod -Uri "http://127.0.0.1:$atlasPort/api/atlas/identity" -TimeoutSec 3
  if ($atlasIdentity.app -ne 'seer-encyclopedia' -or [IO.Path]::GetFullPath($atlasIdentity.root) -ne $atlasRoot) { throw '圖鑑使用的$atlasPort 連接埠被其他程式占用，請稍後重試。' }
  if ($atlasIdentity.build -ne $atlasActive.id) { throw '新版圖鑑已就緒，請先關閉舊圖鑑視窗，再重新開啟。' }
 } else {
  Update-StartupWindow $atlasStartup '啟動圖鑑資料服務…' 3
  $env:ATLAS_ROOT = $atlasRoot
  $env:ATLAS_DIST = $atlasDist
  $env:ATLAS_BUILD_ID = $atlasActive.id
  $env:ATLAS_PORT = "$atlasPort"
  $atlasServer = Start-Process -FilePath $atlasNode -ArgumentList @("`"$(Join-Path $atlasDist 'server.mjs')`"") -WorkingDirectory $atlasRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'server.error.log') -PassThru
  $atlasReady = $false
  for ($atlasTry = 0; $atlasTry -lt 150; $atlasTry++) {
   if ($atlasServer.HasExited) { break }
   try { $atlasIdentity = Invoke-RestMethod -Uri "http://127.0.0.1:$atlasPort/api/atlas/identity" -TimeoutSec 1; if ($atlasIdentity.pid -eq $atlasServer.Id -and $atlasIdentity.build -eq $atlasActive.id) { $atlasReady = $true; break } } catch {}
   Start-Sleep -Milliseconds 200; Update-StartupWindow $atlasStartup '等待圖鑑啟動完成…' 3
  }
  if (-not $atlasReady) { throw '圖鑑啟動失敗，請查看 encyclopedia/server.error.log。' }
 }
 $atlasBrowser = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
 if (-not $atlasBrowser) { throw '需要Microsoft Edge或Google Chrome來開啟圖鑑。' }
 $atlasProfile = Join-Path $env:LOCALAPPDATA $(if ($Blank) { 'SeerEncyclopediaBlank/browser' } else { 'SeerEncyclopedia/browser' })
 $atlasWindow = Start-Process -FilePath $atlasBrowser -ArgumentList @("--app=http://127.0.0.1:$atlasPort", "--user-data-dir=`"$atlasProfile`"", '--no-first-run', '--edge-skip-compat-layer-relaunch') -PassThru
 Complete-StartupWindow $atlasStartup
 $atlasWindow.WaitForExit()
} catch {
 Complete-StartupWindow $atlasStartup
 if ($_.Exception -isnot [System.OperationCanceledException]) { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'精靈圖鑑','OK','Error') | Out-Null }
} finally {
 if ($atlasServer -and -not $atlasServer.HasExited) { Stop-Process -Id $atlasServer.Id -Force -ErrorAction SilentlyContinue }
}
