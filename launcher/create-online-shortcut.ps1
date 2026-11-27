$ErrorActionPreference = 'Stop'
$onlineShortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) '賽爾對戰模擬器－雙人連線.lnk'
$onlineShell = New-Object -ComObject WScript.Shell
if (Test-Path -LiteralPath $onlineShortcutPath) { Write-Output '保留既有雙人連線捷徑'; exit 0 }
$onlineShortcut = $onlineShell.CreateShortcut($onlineShortcutPath)
$onlineShortcut.TargetPath = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$onlineShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $PSScriptRoot 'online.ps1')`""
$onlineShortcut.WorkingDirectory = Split-Path -Parent $PSScriptRoot
$onlineShortcut.IconLocation = Join-Path $PSScriptRoot 'app.ico'
$onlineShortcut.WindowStyle = 7
$onlineShortcut.Save()
if (-not (Test-Path -LiteralPath $onlineShortcutPath)) { throw '未確認雙人連線捷徑建立成功' }
Write-Output "已建立：$onlineShortcutPath"
