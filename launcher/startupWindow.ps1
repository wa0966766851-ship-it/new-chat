 # 非置頂、可取消的啟動視窗。進度代表已完成階段，不冒充建置百分比。
function New-StartupWindow([string]$AppName, [string]$IconPath) {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $form = New-Object System.Windows.Forms.Form
  $form.Text = "$AppName — 啟動"
  $form.FormBorderStyle = 'FixedDialog'
  $form.StartPosition = 'CenterScreen'
  $form.ClientSize = New-Object System.Drawing.Size(480, 220)
  $form.MaximizeBox = $false
  $form.MinimizeBox = $true
  $form.TopMost = $false
  $form.ShowInTaskbar = $true
  $form.BackColor = [System.Drawing.Color]::FromArgb(10, 14, 22)
  $form.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
  $form.Font = New-Object System.Drawing.Font('Microsoft JhengHei UI', 10)
  if (Test-Path -LiteralPath $IconPath) { $form.Icon = New-Object System.Drawing.Icon($IconPath) }
  $stage = New-Object System.Windows.Forms.Label
  $stage.SetBounds(22, 18, 436, 24)
  $stage.Text = '準備啟動'
  $status = New-Object System.Windows.Forms.Label
  $status.SetBounds(22, 52, 436, 52)
  $status.Text = '正在檢查本機環境…'
  $progress = New-Object System.Windows.Forms.ProgressBar
  $progress.SetBounds(22, 112, 436, 18)
  $progress.Style = 'Marquee'
  $progress.MarqueeAnimationSpeed = 30
  $hint = New-Object System.Windows.Forms.Label
  $hint.SetBounds(22, 141, 310, 56)
  $hint.Text = '進度以檢查／安裝／建置／伺服器／開啟視窗分階段顯示。尚未偵測到完成時不顯示假百分比。'
  $hint.Font = New-Object System.Drawing.Font('Microsoft JhengHei UI', 9)
  $cancel = New-Object System.Windows.Forms.Button
  $cancel.SetBounds(348, 157, 110, 34)
  $cancel.Text = '停止啟動'
  $form.Controls.AddRange(@($stage, $status, $progress, $hint, $cancel))
  $window = [pscustomobject]@{ Form = $form; Stage = $stage; Status = $status; Progress = $progress; Cancelled = $false; Completed = $false }
  $cancel.Add_Click({ $window.Form.Close() }.GetNewClosure())
  $form.Add_FormClosing({ if (-not $window.Completed) { $window.Cancelled = $true } }.GetNewClosure())
  return $window
}

function Update-StartupWindow($Window, [string]$Message, [int]$Step = 1, [bool]$Busy = $true) {
  [System.Windows.Forms.Application]::DoEvents()
  if ($Window.Cancelled) { throw [System.OperationCanceledException]::new('使用者取消啟動') }
  $Window.Stage.Text = "階段 $Step / 5"
  $Window.Status.Text = $Message
  $Window.Progress.Style = if ($Busy) { 'Marquee' } else { 'Continuous' }
  if (-not $Busy) { $Window.Progress.Value = [Math]::Min(100, $Step * 20) }
  [System.Windows.Forms.Application]::DoEvents()
}

function Complete-StartupWindow($Window) {
  $Window.Completed = $true
  $Window.Form.Close()
}
