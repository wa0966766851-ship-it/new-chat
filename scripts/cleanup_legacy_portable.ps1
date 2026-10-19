param([switch]$Apply)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$stage = Join-Path $project 'release\portable'
$archive = Join-Path $project 'release\seer-battle-simulator-portable.zip'
if (-not (Test-Path -LiteralPath $stage)) { Write-Host 'No legacy portable stage.'; exit 0 }
if ((Resolve-Path -LiteralPath $stage).Path -ne $stage) { throw 'Unexpected stage path' }
for ($candidate = $stage; $candidate; $candidate = Split-Path -Parent $candidate) {
  if ((Get-Item -LiteralPath $candidate -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked ancestor refused' }
}
if (@(Get-ChildItem -LiteralPath $stage -Recurse -Force -Attributes ReparsePoint).Count) { throw 'Linked stage contents refused' }
$receipt = Join-Path $project 'docs\audits\build-cleanup-20261019.json'
if ($Apply) { $report = Get-Content -LiteralPath $receipt -Raw -Encoding UTF8 | ConvertFrom-Json }
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
$index = @{}
foreach ($entry in $zip.Entries) { $index[$entry.FullName.Replace('\','/')] = $entry }
$verified = 0; $bytes = 0L; $different = 0
try {
  foreach ($file in (Get-ChildItem -LiteralPath $stage -Recurse -File)) {
    if (-not $file.FullName.StartsWith($stage + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'File outside stage' }
    $relative = $file.FullName.Substring($stage.Length + 1).Replace('\','/')
    $entry = $index[$relative]
    if (-not $entry -or $entry.Length -ne $file.Length) { $different++; continue }
    $source = [IO.File]::OpenRead($file.FullName)
    $stored = $entry.Open()
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { $same = [Convert]::ToBase64String($hasher.ComputeHash($source)) -eq [Convert]::ToBase64String($hasher.ComputeHash($stored)) }
    finally { $source.Dispose(); $stored.Dispose(); $hasher.Dispose() }
    if (-not $same) { $different++; continue }
    if ($Apply) {
      $current = Get-Item -LiteralPath $file.FullName -Force
      if ($current.Length -ne $file.Length -or $current.LastWriteTimeUtc -ne $file.LastWriteTimeUtc) { throw 'File changed after verification' }
      # 不遞迴刪目錄，只移除剛與保留ZIP核對SHA256相同的單一檔案。
      Remove-Item -LiteralPath $file.FullName -Force
    }
    $verified++; $bytes += $file.Length
  }
} finally { $zip.Dispose() }
$result = @{ path=$stage; retainedArchive=$archive; verifiedFiles=$verified; bytes=$bytes; differentFiles=$different; applied=[bool]$Apply }
if ($Apply -and $verified -gt 0) {
  $report.candidates += [pscustomobject]@{path=$stage;reason='逐檔與保留ZIP核對SHA256，只刪相同內容檔案，不遞迴刪除目錄';retainedArchive=$archive;verifiedFiles=$verified;bytes=$bytes;removed=$true}
  $report.removedBytes += $bytes
  $report | Add-Member -NotePropertyName totalRemovedBytes -NotePropertyValue $report.removedBytes -Force
  [IO.File]::WriteAllText($receipt, ($report | ConvertTo-Json -Depth 15), [Text.UTF8Encoding]::new($false))
}
$result | ConvertTo-Json
