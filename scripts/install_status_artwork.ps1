# Deterministically extract the user-approved sheet; never redraw the approved artwork.
param([switch]$PreviewOnly)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = Split-Path $PSScriptRoot -Parent
$artDirectory = Join-Path $repoRoot 'docs/status-artwork/drafts-20261003-v4'
$sheetPath = Join-Path $artDirectory 'confirmation-approved.png'
$assetDirectory = Join-Path $repoRoot 'public/status-icons'
$tiles = @(
  @{ Name = -join ([char[]]@(0x7729, 0x6688)); X = 31; Y = 82 },
  @{ Name = -join ([char[]]@(0x795e, 0x6094)); X = 397; Y = 82 },
  @{ Name = -join ([char[]]@(0x8150, 0x673d)); X = 764; Y = 82 },
  @{ Name = -join ([char[]]@(0x5931, 0x6eab)); X = 1131; Y = 82 },
  @{ Name = -join ([char[]]@(0x9072, 0x920d)); X = 31; Y = 526 },
  @{ Name = -join ([char[]]@(0x7a92, 0x606f)); X = 397; Y = 526 },
  @{ Name = -join ([char[]]@(0x5e73, 0x975c)); X = 764; Y = 526 },
  @{ Name = -join ([char[]]@(0x5165, 0x9b54)); X = 1131; Y = 526 }
)
# Validate all targets before writing any asset. Existing artwork is never overwritten.
if (-not $PreviewOnly) {
foreach ($tile in $tiles) {
  $target = Join-Path $assetDirectory ($tile.Name + '.png')
  if (Test-Path -LiteralPath $target) { throw "Artwork already exists: $target" }
}
$sheet = [System.Drawing.Image]::FromFile($sheetPath)
try {
  if ($sheet.Width -ne 1500 -or $sheet.Height -ne 1049) { throw 'Unexpected approval-sheet dimensions; recheck crop coordinates.' }
  foreach ($tile in $tiles) {
    $bitmap = New-Object System.Drawing.Bitmap 256, 256, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      # Remove only the presentation sheet outside the rounded frame, not the icon's colored background.
      $radius = 21
      $diameter = $radius * 2
      $clip.AddArc(0, 0, $diameter, $diameter, 180, 90)
      $clip.AddArc(256 - $diameter, 0, $diameter, $diameter, 270, 90)
      $clip.AddArc(256 - $diameter, 256 - $diameter, $diameter, $diameter, 0, 90)
      $clip.AddArc(0, 256 - $diameter, $diameter, $diameter, 90, 90)
      $clip.CloseFigure()
      $graphics.SetClip($clip)
      $destination = New-Object System.Drawing.Rectangle 0, 0, 256, 256
      $source = New-Object System.Drawing.Rectangle $tile.X, $tile.Y, 338, 340
      $graphics.DrawImage($sheet, $destination, $source, [System.Drawing.GraphicsUnit]::Pixel)
      $bitmap.Save((Join-Path $assetDirectory ($tile.Name + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $clip.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
  }
} finally { $sheet.Dispose() }
}

# Native pixel-size QA, not generated thumbnails bearing approximate labels.
$preview = New-Object System.Drawing.Bitmap 480, 704
$graphics = [System.Drawing.Graphics]::FromImage($preview)
$font = New-Object System.Drawing.Font 'Microsoft JhengHei', 11
$smallFont = New-Object System.Drawing.Font 'Microsoft JhengHei', 9
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$sizes = @(64, 32, 24, 20, 14)
$columns = @(90, 190, 260, 330, 400)
try {
  $graphics.Clear([System.Drawing.Color]::FromArgb(15, 23, 42))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  for ($column = 0; $column -lt $sizes.Count; $column++) {
    $graphics.DrawString("$($sizes[$column])px", $smallFont, $brush, [single]$columns[$column], [single]8)
  }
  for ($index = 0; $index -lt $tiles.Count; $index++) {
    $top = 40 + ($index * 82)
    $graphics.DrawString($tiles[$index].Name, $font, $brush, [single]8, [single]($top + 20))
    $icon = [System.Drawing.Image]::FromFile((Join-Path $assetDirectory ($tiles[$index].Name + '.png')))
    try {
      for ($column = 0; $column -lt $sizes.Count; $column++) {
        $size = $sizes[$column]
        $graphics.DrawImage($icon, [int]$columns[$column], [int]($top + (64 - $size) / 2), $size, $size)
      }
    } finally { $icon.Dispose() }
  }
  $preview.Save((Join-Path $artDirectory 'actual-size-preview.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $preview.Dispose(); $font.Dispose(); $smallFont.Dispose(); $brush.Dispose() }
if ($PreviewOnly) { Write-Output 'Regenerated native-size QA preview; existing artwork unchanged.' }
else { Write-Output 'Installed 8 approved 256x256 RGBA icons and generated native-size QA preview.' }
