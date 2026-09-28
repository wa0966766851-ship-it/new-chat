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
Copy-Item (Join-Path $root "packaging\stop-portable.cmd") (Join-Path $stage "stop-portable.cmd") -Force

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
  # iexpress 的 .sed 只吃 ASCII：中文路徑與中文檔名都會變成 ?? 導致靜默失敗。
  # 策略：複製到純英文暫存路徑，只打包純 ASCII 檔名；
  # 中文檔名的圖資不進 EXE，遊戲會自動從 SeerAPI 遠端補圖。ZIP 版不受影響。
  $asciiRoot = Join-Path $env:TEMP "seer_build"
  $asciiStage = Join-Path $asciiRoot "portable"
  if (Test-Path -LiteralPath $asciiRoot) { Remove-Item -LiteralPath $asciiRoot -Recurse -Force }
  New-Item -ItemType Directory -Path $asciiStage -Force | Out-Null
  $allFiles = Get-ChildItem -LiteralPath $stage -Recurse -File
  $asciiFiles = @($allFiles | Where-Object {
    $_.FullName.Substring($stage.Length + 1) -match '^[\x00-\x7F]+$'
  })
  $skipCount = $allFiles.Count - $asciiFiles.Count
  foreach ($f in $asciiFiles) {
    $rel = $f.FullName.Substring($stage.Length + 1)
    $dest = Join-Path $asciiStage $rel
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -LiteralPath $f.FullName -Destination $dest -Force
  }
  Write-Host "EXE staging: $($asciiFiles.Count) ASCII files, $skipCount non-ASCII skipped (load from remote)."
  $asciiExe = Join-Path $asciiRoot "seer-battle-simulator.exe"
  $sedEntries = @()
  for ($i = 0; $i -lt $asciiFiles.Count; $i++) {
    $rel = $asciiFiles[$i].FullName.Substring($stage.Length + 1)
    $sedEntries += "FILE$($i)=""$rel"""
  }
  $sedFileList = $sedEntries -join "`r`n"
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
TargetName=$asciiExe
FriendlyName=Seer Battle Simulator
AppLaunched=launch-portable.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=launch-portable.cmd
UserQuietInstCmd=launch-portable.cmd
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$asciiStage
[SourceFiles0]
$sedFileList
"@
  Set-Content -LiteralPath $iexpress -Value $sed -Encoding ASCII
  & iexpress.exe /N /Q $iexpress
  if (Test-Path -LiteralPath $asciiExe) {
    Copy-Item -LiteralPath $asciiExe (Join-Path $out "seer-battle-simulator.exe") -Force
    Write-Host "Created EXE: $(Join-Path $out 'seer-battle-simulator.exe')"
  } else {
    Write-Warning "IExpress 沒有產出 exe（檔案數過多時常見），請改用 ZIP 版發佈。"
  }
}

Write-Host "Created ZIP: $zip"
Write-Host "IExpress output (if available): $out\seer-battle-simulator.exe"
