$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\packaging\copy-asset-cache.ps1')
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('seer-portable-cache-' + [Guid]::NewGuid().ToString('N'))
$sourceRoot = Join-Path $fixtureRoot 'source'
$outputRoot = Join-Path $fixtureRoot 'output'
try {
  foreach ($name in @('body', 'head', 'card', 'release-assets', 'diag-browser', 'anim-inspect')) {
    $folder = Join-Path $sourceRoot ('.seer-cache\' + $name)
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $folder 'fixture.txt') -Value $name
  }
  Copy-PortableAssetCache -SourceRoot $sourceRoot -DestinationRoot $outputRoot
  foreach ($name in @('body', 'head', 'card', 'release-assets')) {
    if (-not (Test-Path -LiteralPath (Join-Path $outputRoot ('.seer-cache\' + $name + '\fixture.txt')))) { throw "Missing runtime asset: $name" }
  }
  foreach ($name in @('diag-browser', 'anim-inspect')) {
    if (Test-Path -LiteralPath (Join-Path $outputRoot ('.seer-cache\' + $name))) { throw "Diagnostic data leaked: $name" }
  }
  $rejected = $false
  try { Copy-PortableAssetCache -SourceRoot $sourceRoot -DestinationRoot $sourceRoot } catch { $rejected = $true }
  if (-not $rejected) { throw 'Overlapping cache copy accepted.' }
  'PASS: runtime cache retained, browser/inspection data excluded, overlapping output refused'
} finally {
  $resolvedFixture = [IO.Path]::GetFullPath($fixtureRoot)
  $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
  if (-not $resolvedFixture.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName($resolvedFixture)).StartsWith('seer-portable-cache-')) { throw 'Fixture cleanup path escaped temporary directory.' }
  if (Test-Path -LiteralPath $resolvedFixture) { Remove-Item -LiteralPath $resolvedFixture -Recurse -Force }
}
