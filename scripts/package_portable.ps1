param(
  [string]$OutputDir = "release",
  [switch]$SkipExe
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$out = Join-Path $root $OutputDir
$stage = Join-Path $out "portable"

if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

Push-Location $root
try {
  npm run build
  npx esbuild server.ts --bundle --platform=node --format=cjs --packages=bundle --sourcemap --outfile=dist/server.single.cjs
} finally { Pop-Location }

Copy-Item (Join-Path $root "dist") $stage -Recurse -Force
Copy-Item (Join-Path $root "images") $stage -Recurse -Force
Copy-Item (Join-Path $root "public") $stage -Recurse -Force
foreach ($optional in @(([char]0x7CFB), "pet", ".seer-cache")) {
  $source = Join-Path $root $optional
  if (Test-Path -LiteralPath $source) { Copy-Item $source $stage -Recurse -Force }
}
$node = (Get-Command node.exe).Source
Copy-Item $node (Join-Path $stage "node.exe") -Force
Copy-Item (Join-Path $root "packaging\launch-portable.cmd") (Join-Path $stage "launch-portable.cmd") -Force

$zip = Join-Path $out "seer-battle-simulator-portable.zip"
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal

$iexpress = Join-Path $out "seer-battle-simulator-portable.sed"
$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=1
TargetName=$out\seer-battle-simulator.exe
FriendlyName=Seer Battle Simulator
AppLaunched=launch-portable.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=launch-portable.cmd
UserQuietInstCmd=launch-portable.cmd
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$stage
[SourceFiles0]
"@
if (-not $SkipExe) {
  Set-Content -LiteralPath $iexpress -Value $sed -Encoding ASCII
  & iexpress.exe /N /Q $iexpress
}

Write-Host "Created ZIP: $zip"
Write-Host "IExpress output (if available): $out\seer-battle-simulator.exe"
