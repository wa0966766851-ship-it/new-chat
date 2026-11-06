/** Whole-drawing hit keys; no limb cutting or battle-rule changes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {chromaSprite} from './lib/chromaSprite.mjs';
import {alignPose} from './lib/alignPose.mjs';
const args=process.argv.slice(2);
if(args.length!==2)throw Error('Usage: node scripts/prepare_liuren_hit_v3.mjs <hit sheet> <idle sheet>');
const dir='docs/custom-anim/drafts/20261105-liuren-v3';fs.mkdirSync(dir,{recursive:true});
for(const [i,name] of ['hit-source.png','idle-source-CANDIDATE.png'].entries())fs.copyFileSync(args[i],path.join(dir,name));
const spec=JSON.parse(fs.readFileSync('docs/custom-anim/drafts/20261105-combat-v2/wuxu_liuren.json','utf8'));
const source=PNG.sync.read(fs.readFileSync(args[0]));
// Generation may leave a one-pixel outer border on an otherwise equal 2x2 grid.
const cw=Math.floor(source.width/2),ch=Math.floor(source.height/2);
for(let index=1;index<=3;index++){
 const crop=new PNG({width:cw,height:ch}),cx=index%2,cy=Math.floor(index/2);
 // Ignore the one-pixel generated panel separators, never character pixels.
 for(let y=3;y<ch-3;y++)for(let x=3;x<cw-3;x++){
  const s=((cy*ch+y)*source.width+cx*cw+x)*4;
  source.data.copy(crop.data,(y*cw+x)*4,s,s+4);
 }
 const bytes=alignPose(chromaSprite(PNG.sync.write(crop),{hardKey:true}),{
  canvas:spec.canvas,scale:1.425,offset:[51,176],
 });
 const name=['','impact','recoil','recover'][index],file=`${dir}/${name}.png`;
 fs.writeFileSync(file,bytes);
 spec.poses['hit_'+name]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  facing:'left',review:{accepted:true,note:'完整受擊關鍵姿勢；同一固定畫布與腳底基準，無肢體切割；整段動作仍須對戰實播驗收。'}};
}
spec.sequences.hited={drawings:[{pose:'hit_impact',hold:2},{pose:'hit_recoil',hold:2},{pose:'hit_recover',hold:2},{pose:'ready',hold:2}],hits:[]};
fs.writeFileSync(`${dir}/wuxu_liuren.json`,JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(`${dir}/README.md`,[
 '# 六刃第三輪：受擊關鍵畫面與待機候選',
 '',
 '內建 ImageGen 產製，原參考為 v2 的 wuxu_liuren-ready-left.png。',
 'hit-source.png：2×2，從左上依序為待機、中招、後仰、回復。去除純綠幕後整張對齊；沒有拆肢體。',
 '來源 exec-ae840b68-123b-48c8-9b29-4913f4da936a.png。提示要求朝左、同服裝、腳底固定、衣襬延遲、無特效。',
 'idle-source-CANDIDATE.png：3×2，吸氣、右向衣襬波浪、呼氣、回到起點。來源 exec-a871b80d-c08e-461b-bbb8-e330a20cf90b.png。',
 '本腳本輸出受擊中間 spec；完整待機另由 idle-clean-source.png、experiment_idle_flow.mjs 與 prepare_liuren_idle_v3.mjs 製作。不能直接把本中間 spec 當最終版本發佈。',
 '去霧綠幕來源 exec-da782700-c768-4a9b-8e2c-caff784e64a0.png。六張關鍵圖經離線補幀，最終採 47 個不同圖像格，加持有與回圈共 96 格。',
 '這批不代表官方品質。最新肉眼驗收、限制與正式檔案位置見 docs/audits/2026-11-05_自製待機與受擊_第三輪.md。',
 '',
].join('\n'));
console.log(`${dir}/wuxu_liuren.json`);
