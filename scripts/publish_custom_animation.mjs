/** 先檢查草稿，再明確 --publish；舊素材留在 build/custom-animation-backups。 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),get=(k)=>args[args.indexOf(k)+1];
const id=get('--id');if(!args.includes('--id')||!/^\w+$/.test(id))throw Error('請指定 --id <素材ID>');
const base=args.includes('--source')?path.resolve(root,get('--source')):path.join(root,'build/custom-animation');
const source=path.join(base,id),m=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
if(!['left','right','front'].includes(m.facing))throw Error('缺少已核對的素材方向');
const image=fs.readFileSync(path.join(source,'atlas.png')),png=PNG.sync.read(image),hash=crypto.createHash('sha256').update(image).digest('hex');
if(m.id!==id||m.sha256!==hash||m.size!==image.length||png.width!==m.atlas.width||png.height!==m.atlas.height)throw Error('草稿圖集與登記不符');
// 缺少技能類型時使用明確的既有片段，寫進 manifest 與登記表，避免播放不存在的序列。
const derive=(target,sourceName,{buff=false,frames=0}={})=>{
 if(m.sequences[target])return;const s=m.sequences[sourceName];if(!s)throw Error('缺少來源序列 '+sourceName);
 const n=frames||s.frames,quads=Array.from({length:n},(_,i)=>s.quads[Math.round(i*(s.frames-1)/Math.max(1,n-1))]);
 m.sequences[target]={frames:n,hits:buff?[]:s.hits.map(h=>Math.min(n-1,Math.round(h*(n-1)/Math.max(1,s.frames-1)))),loop:false,quads};
};
derive('attack',m.sequences.sa?'sa':'standby',{frames:56});
derive('sa','attack');derive('cp',m.sequences.extra?'extra':'standby',{buff:true});
for(const [name,s] of Object.entries(m.sequences)){
 if(s.frames!==s.quads.length||s.hits.some(h=>h<0||h>=s.frames))throw Error('影格或命中標記錯誤 '+name);
 for(const q of s.quads){const positions=q.g?q.g.flatMap(c=>c.p):q.c;
  if(!positions?.length||positions.some(n=>!Number.isFinite(n)))throw Error('無效角色網格 '+name);
 }
}
const registry=path.join(root,'src/battle/petAnimationAssets.ts'),original=fs.readFileSync(registry,'utf8');
const line=original.split('\n').find(l=>l.trimStart().startsWith(id+':'));if(!line)throw Error('找不到素材登記 '+id);
const sequences=Object.entries(m.sequences).map(([name,s])=>({name,frames:s.frames,hits:s.hits}));
let updated=line.replace(/atlas:\[[^\]]+\](?: as const)?/,'atlas:'+JSON.stringify([png.width,png.height])+' as const')
 .replace(/facing:'(?:left|right|front)'/,"facing:'"+m.facing+"'")
 .replace(/size:\d+/,'size:'+image.length).replace(/sha256:'[^']*'/,"sha256:'"+hash+"'")
 .replace(/sequences:\[.*\](?=\},?\s*$)/,'sequences:'+JSON.stringify(sequences));
if(m.sequences.ultimate&&!updated.includes('fullscreen:'))updated=updated.replace('sequences:',"fullscreen:{ultimate:'ultimate'},sequences:");
if(m.presentation)updated=updated.replace(/presentation:\{[^}]+\}/,'presentation:'+JSON.stringify(m.presentation));
if(m.physicalMotion){if(!['stationary','approach'].includes(m.physicalMotion))throw Error('無效物攻移動方式');updated=updated.replace(/physicalMotion:'(?:approach|stationary)'/,"physicalMotion:'"+m.physicalMotion+"'");}
if(updated===line&&args.includes('--publish'))console.log('登記值不變');
console.log(JSON.stringify({id,atlas:[png.width,png.height],downloadBytes:image.length,rgbaBytes:png.width*png.height*4,sequences,willPublish:args.includes('--publish')},null,2));
if(args.includes('--publish')){
 const stamp=Date.now()+'-'+id,stage=path.join(root,'build/custom-animation-staging',stamp),dest=path.join(root,'public/elf-anim',id),backup=path.join(root,'build/custom-animation-backups',stamp);
 for(const p of [stage,dest,backup])if(!p.startsWith(root+path.sep))throw Error('路徑越界');
 fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,'atlas.png'),image);fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify(m));
 fs.mkdirSync(path.dirname(backup),{recursive:true});const exists=fs.existsSync(dest);if(exists)fs.renameSync(dest,backup);
 try{fs.renameSync(stage,dest);}catch(e){if(exists)fs.renameSync(backup,dest);throw e;}
 try{fs.writeFileSync(registry,original.replace(line,updated));}catch(e){
  fs.renameSync(dest,stage);if(exists)fs.renameSync(backup,dest);throw e;
 }
 console.log('已發佈本機素材；舊素材保留於 '+backup);
}
