# 只複製原稿及排版確認圖；不改動圖標本身、不更換應用素材。
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$sourceDirectory = 'C:\Users\lazya\.codex\generated_images\01a0e1a3-449d-74c3-b964-19efb1be9202'
$promptSpecification = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'prompts.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceFiles = @(
  'exec-204d8407-680c-494a-921b-634ef9aabd8f.png',
  'exec-08748f4b-920b-4486-bf32-294cc5ff4510.png',
  'exec-26c8d2da-fad6-4302-9a3b-d1b8693c46bd.png',
  'exec-c636cda6-4fe4-4ea8-9ced-623e31b29255.png',
  'exec-3113f3b4-54af-4916-a2b6-3cbbb3a033f8.png',
  'exec-5c776497-cc61-4cc6-b347-203221ddc396.png',
  'exec-693b0ab9-2ad6-4f2f-ae94-3fb1594210f7.png',
  'exec-c648735a-89c5-4ede-82ee-6998aea93330.png'
)
$bitmap = New-Object System.Drawing.Bitmap 1040, 728
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(17, 26, 41))
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font = New-Object System.Drawing.Font 'Microsoft JhengHei', 17
$smallFont = New-Object System.Drawing.Font 'Microsoft JhengHei', 10
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(226, 235, 246))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(149, 174, 202))
try {
  for ($i = 0; $i -lt $sourceFiles.Count; $i++) {
    $name = $promptSpecification.specs[$i][0]
    $destination = Join-Path $PSScriptRoot "$name.png"
    if (Test-Path -LiteralPath $destination) { throw "Refusing to overwrite: $destination" }
    $sourceFile = Join-Path $sourceDirectory $sourceFiles[$i]
    $sourceHash = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash
    $matchingDraft = @(Get-ChildItem -LiteralPath $PSScriptRoot -File -Filter '*.png' | Where-Object { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash -eq $sourceHash })
    if ($matchingDraft.Count -eq 1) {
      Move-Item -LiteralPath $matchingDraft[0].FullName -Destination $destination
    } else {
      Copy-Item -LiteralPath $sourceFile -Destination $destination
    }
    $sourceImage = [System.Drawing.Bitmap]::FromFile($destination)
    try {
      $x = ($i % 4) * 260
      $y = [math]::Floor($i / 4) * 364
      $graphics.DrawImage($sourceImage, [int]($x + 16), [int]($y + 12), 228, 228)
      $graphics.DrawString($name, $font, $white, [single]($x + 98), [single]($y + 250))
      $graphics.DrawImage($sourceImage, [int]($x + 25), [int]($y + 302), 16, 16)
      $graphics.DrawString('16px', $smallFont, $muted, [single]($x + 46), [single]($y + 300))
      $graphics.DrawImage($sourceImage, [int]($x + 97), [int]($y + 298), 24, 24)
      $graphics.DrawString('24px', $smallFont, $muted, [single]($x + 125), [single]($y + 300))
      $graphics.DrawImage($sourceImage, [int]($x + 181), [int]($y + 294), 32, 32)
      $graphics.DrawString('32', $smallFont, $muted, [single]($x + 217), [single]($y + 300))
      $transparentSamples = 0
      for ($sy = 0.2; $sy -le 0.8; $sy += 0.05) {
        for ($sx = 0.2; $sx -le 0.8; $sx += 0.05) {
          if ($sourceImage.GetPixel([int]($sx * $sourceImage.Width), [int]($sy * $sourceImage.Height)).A -lt 200) { $transparentSamples++ }
        }
      }
      Write-Output "$name $($sourceImage.Width)x$($sourceImage.Height) interior-alpha-under-200=$transparentSamples"
    } finally { $sourceImage.Dispose() }
  }
  $previewFile = Join-Path $PSScriptRoot 'confirmation-sheet.png'
  if (Test-Path -LiteralPath $previewFile) { throw "Refusing to overwrite: $previewFile" }
  $bitmap.Save($previewFile, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose(); $bitmap.Dispose(); $font.Dispose(); $smallFont.Dispose(); $white.Dispose(); $muted.Dispose()
}
