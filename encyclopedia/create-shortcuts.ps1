$ErrorActionPreference = 'Stop'
$atlasDesktop = [Environment]::GetFolderPath('Desktop')
$atlasShell = New-Object -ComObject WScript.Shell
foreach ($atlasItem in @(@{Name='精靈圖鑑';Args=''},@{Name='更新精靈圖鑑';Args=' -Rebuild'},@{Name='空白自製精靈圖鑑';Args=' -Blank'})) {
 $atlasShortcutPath = Join-Path $atlasDesktop "$($atlasItem.Name).lnk"
 if (Test-Path -LiteralPath $atlasShortcutPath) { Write-Output "保留既有捷徑：$atlasShortcutPath"; continue }
 $atlasShortcut = $atlasShell.CreateShortcut($atlasShortcutPath)
 $atlasShortcut.TargetPath = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
 $atlasShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $PSScriptRoot 'launcher.ps1')`"$($atlasItem.Args)"
 $atlasShortcut.WorkingDirectory = Split-Path -Parent $PSScriptRoot
 $atlasShortcut.IconLocation = Join-Path (Split-Path -Parent $PSScriptRoot) 'launcher/app.ico'
 $atlasShortcut.WindowStyle = 7
 $atlasShortcut.Save()
 if (-not (Test-Path -LiteralPath $atlasShortcutPath)) { throw '未確認圖鑑捷徑建立成功' }
 Write-Output "已建立：$atlasShortcutPath"
}
