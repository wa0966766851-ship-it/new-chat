# Only runtime asset categories consumed by server.ts; never whole diagnostic browser profiles.
function Copy-PortableAssetCache {
  param([string]$SourceRoot, [string]$DestinationRoot)
  $sourceCache = [IO.Path]::GetFullPath((Join-Path $SourceRoot '.seer-cache'))
  $targetCache = [IO.Path]::GetFullPath((Join-Path $DestinationRoot '.seer-cache'))
  if ($targetCache.Equals($sourceCache, [StringComparison]::OrdinalIgnoreCase) -or $targetCache.StartsWith($sourceCache + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Cache output cannot overlap source.' }
  foreach ($boundary in @($sourceCache, $targetCache)) {
    for ($current = $boundary; $current; $current = Split-Path -Parent $current) {
      if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Cache paths cannot use directory links.' }
    }
  }
  foreach ($category in @('head', 'body', 'type', 'abnormal', 'buff', 'signbuff', 'card', 'release-assets')) {
    $source = Join-Path $sourceCache $category
    if (-not (Test-Path -LiteralPath $source -PathType Container)) { continue }
    if ((Get-Item -LiteralPath $source -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Asset category cannot be a link.' }
    $linked = Get-ChildItem -LiteralPath $source -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | Select-Object -First 1
    if ($linked) { throw 'Asset contents cannot contain links.' }
    New-Item -ItemType Directory -Path $targetCache -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $targetCache $category) -Recurse -Force
  }
}
