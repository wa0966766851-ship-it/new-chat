 # 只由設定中的明確操作，或已啟用的啟動偏好呼叫。不覆寫既有捷徑。
$ErrorActionPreference = 'Stop'
$shortcutAppName = '賽爾對戰模擬器'
$shortcutRoot = Split-Path -Parent $PSScriptRoot
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) "$shortcutAppName.lnk"
if (Test-Path -LiteralPath $shortcutPath) { Write-Output 'already-exists'; exit 0 }
$shortcutShell = New-Object -ComObject WScript.Shell
$shortcut = $shortcutShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $PSScriptRoot 'launcher.ps1')`""
$shortcut.WorkingDirectory = $shortcutRoot
$shortcut.IconLocation = Join-Path $PSScriptRoot 'app.ico'
$shortcut.WindowStyle = 7
$shortcut.Save()
if (-not (Test-Path -LiteralPath $shortcutPath)) { throw '未確認捷徑建立成功' }
Write-Output 'created'
