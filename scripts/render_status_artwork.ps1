# 只建立素材對照圖；不修改原素材。於 scripts/audit_status_artwork.ts --write 後使用。
param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = Split-Path $PSScriptRoot -Parent
$outputDirectory = Join-Path $repoRoot 'docs/status-artwork'
$manifest = Get-Content -LiteralPath (Join-Path $outputDirectory 'inventory.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$rows = @($manifest.rows | Where-Object { $_.coverage -eq 'mapped_existing' })
$cellWidth = 160
$cellHeight = 162
$columns = 7
$bitmap = New-Object System.Drawing.Bitmap ($cellWidth * $columns), ($cellHeight * [math]::Ceiling($rows.Count / $columns))
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(14, 21, 33))
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font = New-Object System.Drawing.Font 'Microsoft JhengHei', 10
$smallFont = New-Object System.Drawing.Font 'Microsoft JhengHei', 8
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225, 232, 240))
$mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 172, 195))
try {
  for ($index = 0; $index -lt $rows.Count; $index++) {
    $row = $rows[$index]
    $x = ($index % $columns) * $cellWidth
    $y = [math]::Floor($index / $columns) * $cellHeight
    $sourceImage = [System.Drawing.Image]::FromFile((Join-Path $repoRoot $row.asset))
    try {
      $graphics.DrawImage($sourceImage, [int]($x + 32), [int]($y + 8), 96, 96)
      $graphics.DrawImage($sourceImage, [int]($x + 128), [int]($y + 81), 24, 24)
    } finally { $sourceImage.Dispose() }
    $graphics.DrawString($row.name, $font, $brush, [single]($x + 8), [single]($y + 110))
    $dimensions = "$($row.image.width)x$($row.image.height)"
    $graphics.DrawString($dimensions, $smallFont, $mutedBrush, [single]($x + 8), [single]($y + 135))
  }
  $bitmap.Save((Join-Path $outputDirectory 'existing-contact-sheet.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose(); $bitmap.Dispose(); $font.Dispose(); $smallFont.Dispose(); $brush.Dispose(); $mutedBrush.Dispose()
}
Write-Output "Contact sheet generated for $($rows.Count) mapped statuses."
