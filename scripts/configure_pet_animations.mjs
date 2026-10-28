import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=path.join(project,'launcher/animation-source.local.json');
const args=process.argv.slice(2),index=args.indexOf('--cache-root');
if(args.includes('--help')){console.log('node scripts/configure_pet_animations.mjs --cache-root "U端的 PetAnimPackage/CacheBundleFiles 資料夾"\nnode scripts/configure_pet_animations.mjs --check');process.exit(0);}
const existing=()=>{try{return JSON.parse(fs.readFileSync(config,'utf8')).cacheRoot;}catch{return undefined;}};
const root=index>=0?args[index+1]:process.env.SEER_PET_CACHE_ROOT||existing();
if(!root||root.startsWith('--'))throw Error('請用 --cache-root 指定已下載的 CacheBundleFiles 資料夾。');
const bundles=[['455c66ff461d4188dd53cbd9fff4944e',579315,'cddca15a2ce15026ed685d64796ad5585890c81b4046ad88bf7ce2ab08e77d40'],['b9a969aa82208674095ee2bad6e7bd0f',3627,'1df8c3bba2fdecf9da717143c4507faa206c23c641df4d9ce7eaa28bb79fcd74']];
for(const [hash,size,sha] of bundles){const file=path.join(path.resolve(root),hash.slice(0,2),hash,'__data');if(!fs.existsSync(file))throw Error(`素材未下載或版本不符：${hash}`);const data=fs.readFileSync(file);if(data.length!==size||crypto.createHash('sha256').update(data).digest('hex')!==sha)throw Error(`素材版本或完整性不符：${hash}；請勿用其他版本冒充。`);}
if(index>=0&&!args.includes('--check')){if(fs.existsSync(config))fs.copyFileSync(config,config+'.bak');fs.writeFileSync(config,JSON.stringify({cacheRoot:path.resolve(root)},null,2)+'\n');}
console.log('雷伊動作與共用材質驗證通過（共 582942 bytes）。素材僅讀取，未搬動或打包。');
