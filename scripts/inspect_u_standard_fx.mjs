/** Read only U-client manifest inventory. Never changes the game installation. */
import fs from 'node:fs';
import path from 'node:path';
const pet=JSON.parse(fs.readFileSync('launcher/animation-source.local.json','utf8')).cacheRoot;
const root=path.join(pet,'../..','DefaultPackage');
const manifests=fs.readdirSync(path.join(root,'ManifestFiles')).filter(n=>n.endsWith('.bytes')).sort();
const file=path.join(root,'ManifestFiles',manifests.at(-1)),buf=fs.readFileSync(file);
let at=4;
const u16=()=>{const v=buf.readUInt16LE(at);at+=2;return v;};
const i32=()=>{const v=buf.readInt32LE(at);at+=4;return v;};
const str=()=>{const n=u16();if(n>4096||at+n>buf.length)throw Error('Invalid manifest string at '+at);const v=buf.toString('utf8',at,at+n);at+=n;return v;};
const version=str();
if(version!=='1.5.2')throw Error('Unsupported manifest '+version);
// This installed version stores seven package flag bytes before package name.
// Check the known first-asset boundary instead of silently guessing endianness.
at+=7;const packageName=str(),build=str(),count=i32(),assets=[];
if(packageName!=='DefaultPackage'||count<1||count>200000)throw Error('Unexpected header');
for(let i=0;i<count;i++){
 const asset=str(),bundle=i32(),n=u16();if(n>1000)throw Error('Invalid dependencies');
 const deps=Array.from({length:n},i32);if(!asset || /[\x00-\x1f]/.test(asset))throw Error('Invalid asset table at '+i+': '+JSON.stringify(asset));
 if(asset.includes('/Swf/skill/'))assets.push({asset,bundle,deps});
}
console.log(JSON.stringify({file,version,packageName,build,assetCount:count,skillAssets:assets.length,bundleTableOffset:at,
 first:assets.slice(0,8),tailHex:buf.subarray(at,at+180).toString('hex'),tailText:buf.subarray(at,at+180).toString('latin1').replace(/[^ -~]/g,'.')},null,2));
fs.mkdirSync('docs/custom-anim/review-20261106',{recursive:true});
fs.writeFileSync('docs/custom-anim/review-20261106/u-standard-skill-assets.json',JSON.stringify({source:file,build,assetCount:count,bundleTableOffset:at,assets},null,2)+'\n');


