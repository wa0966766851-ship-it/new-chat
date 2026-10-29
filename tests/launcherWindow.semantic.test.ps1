 # 後臺驗證：建立控制項但不Show，不開遊戲、不寫桌面捷徑。
$ErrorActionPreference = 'Stop'
$testRoot = Split-Path -Parent $PSScriptRoot
foreach ($testFile in @('launcher.ps1', 'startupWindow.ps1', 'create-shortcut.ps1')) {
  $testTokens = $null
  $testErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $testRoot "launcher\$testFile"), [ref]$testTokens, [ref]$testErrors) | Out-Null
  if ($testErrors.Count) { throw ($testErrors | Out-String) }
}
. (Join-Path $testRoot 'launcher\startupWindow.ps1')
$testWindow = New-StartupWindow '測試' (Join-Path $testRoot 'launcher\app.ico')
try {
  if ($testWindow.Form.TopMost) { throw '啟動視窗仍置頂' }
  if ($testWindow.Form.FormBorderStyle -ne 'FixedDialog' -or -not $testWindow.Form.ControlBox -or -not $testWindow.Form.MinimizeBox) { throw '啟動視窗不可關閉／最小化' }
  Update-StartupWindow $testWindow '建置中' 3
  if ($testWindow.Progress.Style -ne 'Marquee' -or $testWindow.Stage.Text -ne '階段 3 / 5') { throw '未知完成率應顯示活動進度與階段' }
  Update-StartupWindow $testWindow '建置完成' 3 $false
  if ($testWindow.Progress.Value -ne 60) { throw '已完成階段進度不符' }
  $testEvent = New-Object System.Windows.Forms.FormClosingEventArgs([System.Windows.Forms.CloseReason]::UserClosing, $false)
  $testClosing = $testWindow.Form.GetType().GetMethod('OnFormClosing', [System.Reflection.BindingFlags]'Instance,NonPublic')
  $testArgs = New-Object object[] 1
  $testArgs[0] = $testEvent.PSObject.BaseObject
  $testClosing.Invoke($testWindow.Form.PSObject.BaseObject, $testArgs) | Out-Null
  if (-not $testWindow.Cancelled) { throw '關閉未取消啟動' }
  $testCancelled = $false
  try { Update-StartupWindow $testWindow '不應繼續' 4 } catch [System.OperationCanceledException] { $testCancelled = $true }
  if (-not $testCancelled) { throw '取消後仍繼續啟動' }
  Write-Output 'Launcher syntax, window controls, stage progress and cancellation checks passed (no visible window).'
} finally { $testWindow.Form.Dispose() }
