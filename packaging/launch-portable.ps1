$ErrorActionPreference = 'Stop'

Write-Host '==============================================='
Write-Host ' Seer Battle Simulator - Portable Launcher (ps1)'
Write-Host '==============================================='
Write-Host ''

# 0. Resolve roots: launcher may sit in portable root, dist/, or repo packaging/
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
function Find-AppRoot([string]$start) {
  $cur = $start
  for ($i = 0; $i -lt 4; $i++) {
    if ($cur -and (Test-Path -LiteralPath (Join-Path $cur 'dist\index.html'))) { return $cur }
    if ($cur -and (Test-Path -LiteralPath (Join-Path $cur 'server.single.cjs'))) { return $cur }
    $parent = Split-Path -Parent $cur
    if (-not $parent -or $parent -eq $cur) { break }
    $cur = $parent
  }
  # fallback: if we started inside dist/, its parent is the root
  if ((Split-Path -Leaf $start) -eq 'dist') { return (Split-Path -Parent $start) }
  if ((Split-Path -Leaf $start) -eq 'packaging') { return (Split-Path -Parent $start) }
  return $start
}
$appRoot = Find-AppRoot $scriptDir

# node.exe: portable root first, then system PATH
$nodeLocal = Join-Path $appRoot 'node.exe'
$nodeHere = Join-Path $scriptDir 'node.exe'
$nodeExe = $null
if (Test-Path -LiteralPath $nodeLocal) { $nodeExe = $nodeLocal }
elseif (Test-Path -LiteralPath $nodeHere) { $nodeExe = $nodeHere }
else {
  try { $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source } catch { $nodeExe = $null }
}

# server bundle: root then dist, in both appRoot and scriptDir
$serverCands = @(
  (Join-Path $appRoot 'server.single.cjs'),
  (Join-Path $appRoot 'dist\server.single.cjs'),
  (Join-Path $scriptDir 'server.single.cjs'),
  (Join-Path $scriptDir 'dist\server.single.cjs'),
  (Join-Path $appRoot 'dist\server.cjs')
)
$serverCjs = $null
foreach ($c in $serverCands) { if ($c -and (Test-Path -LiteralPath $c)) { $serverCjs = $c; break } }

$indexCands = @(
  (Join-Path $appRoot 'dist\index.html'),
  (Join-Path $scriptDir 'dist\index.html')
)
$indexHtml = $null
foreach ($c in $indexCands) { if ($c -and (Test-Path -LiteralPath $c)) { $indexHtml = $c; break } }

Write-Host ('Launcher dir: ' + $scriptDir)
Write-Host ('App root:     ' + $appRoot)
if ($serverCjs) { Write-Host ('Server file:  ' + $serverCjs) }
if ($nodeExe) { Write-Host ('Node:         ' + $nodeExe) }
Write-Host ''

if (-not $nodeExe) {
  Write-Host '[ERROR] node.exe not found. Put launcher next to node.exe or install Node.js.'
  Read-Host 'Press Enter to exit'
  exit 1
}
if (-not $serverCjs) {
  Write-Host '[ERROR] server.single.cjs not found in root or dist\. Unzip the WHOLE zip.'
  Read-Host 'Press Enter to exit'
  exit 1
}
if (-not $indexHtml) {
  Write-Host '[ERROR] dist\index.html not found. Incomplete unzip.'
  Read-Host 'Press Enter to exit'
  exit 1
}

# 1. Find free port
function Test-PortFree([int]$p) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $r = $c.BeginConnect('127.0.0.1', $p, $null, $null)
    $ok = $r.AsyncWaitHandle.WaitOne(300)
    $c.Close()
    if (-not $ok) { return $true }
    return $false
  } catch {
    return $true
  }
}

$want = 3000
if ($env:PORT -match '^\d+$') { $want = [int]$env:PORT }
$free = $null
for ($p = $want; $p -le ($want + 100); $p++) {
  if (Test-PortFree $p) { $free = $p; break }
}
if (-not $free) {
  Write-Host "[ERROR] No free port near $want."
  Read-Host 'Press Enter to exit'
  exit 1
}
if ($free -ne $want) { Write-Host "[INFO] Port $want busy, using $free." }
else { Write-Host "[INFO] Using port $free." }
$env:PORT = "$free"
$env:NODE_ENV = 'production'

# 2. Start server
$logFile = Join-Path $appRoot 'server.log'
Write-Host "Starting server on http://127.0.0.1:$free ..."
Write-Host "Log: $logFile"
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $nodeExe
$psi.Arguments = '"' + $serverCjs + '"'
$psi.WorkingDirectory = $appRoot
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$psi.EnvironmentVariables['PORT'] = "$free"
$psi.EnvironmentVariables['NODE_ENV'] = 'production'
$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
[void]$proc.Start()

# log pump in background job
Start-Job -ScriptBlock {
  param($procId, $logPath)
  try {
    $pr = Get-Process -Id $procId -ErrorAction Stop
  } catch { return }
  Add-Content -LiteralPath $logPath -Value ("--- start " + (Get-Date).ToString('s') + " ---")
} -ArgumentList $proc.Id, $logFile | Out-Null

# 3. Wait for ready
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:$free/api/ai-status") -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  Write-Host '[ERROR] Server did not start in 40s.'
  try { Stop-Process -Id $proc.Id -Force } catch {}
  if (Test-Path -LiteralPath $logFile) {
    Write-Host '--- last log ---'
    Get-Content -LiteralPath $logFile -Tail 20
  }
  Read-Host 'Press Enter to exit'
  exit 1
}

Write-Host '[OK] Server is up. Opening browser ...'
Start-Process ("http://127.0.0.1:" + $free)
Write-Host ''
Write-Host ('Game URL: http://127.0.0.1:' + $free)
Write-Host ('Server PID: ' + $proc.Id + '  (close this window keeps server running)')
Write-Host 'To stop: run stop-portable.cmd'
Read-Host 'Press Enter to exit launcher (server keeps running)'
