function Get-ServerSourceStamp([string]$Root) {
  $files = @((Join-Path $Root 'server.ts'))
  $serverDir = Join-Path $Root 'server'
  if (Test-Path -LiteralPath $serverDir) {
    $files += @(Get-ChildItem -LiteralPath $serverDir -File -Recurse | Where-Object { $_.Extension -in @('.ts','.mjs','.cjs') } | ForEach-Object { $_.FullName })
  }
  $stamp = 0L
  foreach ($file in $files) {
    if (Test-Path -LiteralPath $file) {
      $time = ([DateTimeOffset](Get-Item -LiteralPath $file).LastWriteTimeUtc).ToUnixTimeMilliseconds()
      if ($time -gt $stamp) { $stamp = $time }
    }
  }
  return $stamp
}
function Test-LauncherServerIdentity($Identity, [string]$Root, [string]$Mode, [string]$BuildId = '') {
  return $Identity -and $Identity.app -eq 'seer-battle-simulator' -and
    [string]::Equals($Identity.root, [IO.Path]::GetFullPath($Root), [StringComparison]::OrdinalIgnoreCase) -and
    $Identity.mode -eq $Mode -and $(if ($BuildId) { $Identity.buildId -eq $BuildId } else { $Identity.sourceStamp -eq (Get-ServerSourceStamp $Root) })
}
