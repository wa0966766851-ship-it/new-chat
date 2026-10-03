$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourcePath = Join-Path $projectRoot 'public/seer/head/5000.png'
$iconPath = Join-Path $projectRoot 'electron/assets/holy-puni.ico'
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($iconPath)) | Out-Null
$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$frames = [System.Collections.Generic.List[byte[]]]::new()
try {
    foreach ($size in $sizes) {
        $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $pngStream = [System.IO.MemoryStream]::new()
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
            $bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
            $frames.Add($pngStream.ToArray())
        } finally {
            $pngStream.Dispose()
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
} finally { $sourceImage.Dispose() }
# Windows ICO directory followed by losslessly encoded PNG frames.
$outputStream = [System.IO.MemoryStream]::new()
$writer = [System.IO.BinaryWriter]::new($outputStream)
try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $dimension = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
        $writer.Write([byte]$dimension)
        $writer.Write([byte]$dimension)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]32)
        $writer.Write([uint32]$frames[$i].Length)
        $writer.Write([uint32]$offset)
        $offset += $frames[$i].Length
    }
    foreach ($frame in $frames) { $writer.Write($frame) }
    $writer.Flush()
    [System.IO.File]::WriteAllBytes($iconPath, $outputStream.ToArray())
} finally {
    $writer.Dispose()
    $outputStream.Dispose()
}
Write-Output '聖靈譜尼 EXE 圖標已由現有頭像轉換：16/24/32/48/64/128/256 px。'
