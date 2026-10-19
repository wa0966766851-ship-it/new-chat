import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

/** 在建置前同步三個正式版本來源；keep=true時仍檢查一致性。 */
export function prepareReleaseVersion(root, keep=false) {
  const pkgPath=path.join(root,'package.json'), lockPath=path.join(root,'package-lock.json'), versionPath=path.join(root,'version.ts');
  const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8')), lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));
  const text=fs.readFileSync(versionPath,'utf8'), match=text.match(/export const VERSION = "(\d+\.\d+\.\d+)"/);
  if(!match || pkg.version!==match[1] || lock.version!==pkg.version || lock.packages?.['']?.version!==pkg.version)throw Error('版本來源不一致，停止打包');
  if(keep)return pkg.version;
  const parts=pkg.version.split('.').map(Number);parts[2]++;
  if(!parts.every(Number.isSafeInteger))throw Error('版本號超過安全整數範圍');
  const version=parts.join('.');pkg.version=version;lock.version=version;lock.packages[''].version=version;
  fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n');
  fs.writeFileSync(versionPath,text.replace(match[0],`export const VERSION = "${version}"`));
  return version;
}

/** EXE已是壓縮封裝；仍以.NET串流再製作ZIP，避免把數百MB全讀進JS記憶體。 */
export function zipExecutables(root, files, version) {
  const output=path.join(root,'dist-electron');
  const allowed=new Set([path.resolve(output),path.resolve(output,'nsis-web')]);
  if(!files.length || files.some(file=>!allowed.has(path.dirname(path.resolve(file)))||!path.basename(file).endsWith('.exe')) || new Set(files.map(file=>path.basename(file))).size!==files.length)throw Error('ZIP只接受本次輸出目錄的不同名EXE');
  const destination=path.join(output,`seer-battle-simulator-${version}-exe.zip`), temporary=path.join(output,`.exe-zip-${randomUUID()}.zip`);
  const command=`$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[IO.Compression.ZipFile]::Open($env:SEER_ZIP_TEMP,[IO.Compression.ZipArchiveMode]::Create); try { foreach($file in (ConvertFrom-Json -InputObject $env:SEER_ZIP_FILES)) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file,[IO.Path]::GetFileName($file),[IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $zip.Dispose() }`;
  try {
    const result=spawnSync('powershell.exe',['-NoProfile','-Command',command],{windowsHide:true,stdio:'inherit',env:{...process.env,SEER_ZIP_TEMP:temporary,SEER_ZIP_FILES:JSON.stringify(files)}});
    if(result.error)throw result.error;if(result.status!==0)throw Error('EXE ZIP建立失敗：'+result.status);
    fs.renameSync(temporary,destination);return destination;
  }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
