/** Props only; run after build_pose_animation. Never writes public production assets. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
import {PNG} from 'pngjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/wuxu_shiyan';
const source=fs.readFileSync(dir+'/curse-page-source.png');
const bytes=alignPose(source,{canvas:[216,288],scale:.1875,offset:[0,0]});
fs.writeFileSync(dir+'/curse-page.png',bytes);
fs.writeFileSync('build/original-motion-v4/wuxu_shiyan/curse-page.png',bytes);
const claws=[];
for(const pose of ['open','closed']){
 const raw=fs.readFileSync(dir+`/claw-${pose}-source.png`),p=PNG.sync.read(raw);
 const canvas=[512,Math.round(p.height/p.width*512)];
 const out=alignPose(raw,{canvas,scale:512/p.width,offset:[0,0]});
 fs.writeFileSync(dir+`/claw-${pose}.png`,out);
 fs.writeFileSync(`build/original-motion-v4/wuxu_shiyan/claw-${pose}.png`,out);
 claws.push({pose,sourceSize:[p.width,p.height],canvas,downloadBytes:out.length,decodedBytes:canvas[0]*canvas[1]*4,
  sourceSha256:crypto.createHash('sha256').update(raw).digest('hex')});
}
const meta={source:'built-in imagegen exec-a62e1fd7-3d9b-4bee-8d82-07629ee0342a',
 sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),
 palette:'charcoal black vellum / muted silver / lavender; original character untouched',
 downloadBytes:bytes.length,decodedBytes:216*288*4,claws,
 review:'P1/P2 live staging required; not a completed character animation'};
fs.writeFileSync(dir+'/curse-page-review.json',JSON.stringify(meta,null,2)+'\n');
console.log(meta);
