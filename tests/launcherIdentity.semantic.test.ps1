$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
. (Join-Path $repo 'launcher\serverIdentity.ps1')
$identity = [pscustomobject]@{ app='seer-battle-simulator';root=$repo;mode='production';sourceStamp=(Get-ServerSourceStamp $repo);buildId='' }
if (-not (Test-LauncherServerIdentity $identity $repo 'production')) { throw 'Launcher identity check failed' }
if (Test-LauncherServerIdentity $identity $repo 'development') { throw 'Launcher identity check failed' }
if (Test-LauncherServerIdentity $identity $env:TEMP 'production') { throw 'Launcher identity check failed' }
$identity.sourceStamp--
if (Test-LauncherServerIdentity $identity $repo 'production') { throw 'Launcher identity check failed' }
$identity.app='other-app'
if (Test-LauncherServerIdentity $identity $repo 'production') { throw 'Launcher identity check failed' }
$identity.app='seer-battle-simulator'
$identity.buildId='completed-build'
if (-not (Test-LauncherServerIdentity $identity $repo 'production' 'completed-build')) { throw 'Completed release must ignore unbuilt source edits' }
if (Test-LauncherServerIdentity $identity $repo 'production' 'different-build') { throw 'Wrong release accepted' }
Write-Output 'Launcher identity, root, mode and stale server rejection passed.'
