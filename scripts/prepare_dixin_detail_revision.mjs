/** One versioned original-style strike replacement. No live publication. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261108-detail-revision/emperor_dixin';
fs.mkdirSync(dir,{recursive:true});
const source=dir+'/melee-source-v1.png';
if(!fs.existsSync(source))throw Error('缺少已保存的姿勢原圖：'+source);
const spec=JSON.parse(fs.readFileSync('docs/custom-anim/drafts/20261106-original-motion/emperor_dixin/transition-pilot-spec.json','utf8'));
const bytes=alignPose(fs.readFileSync(source),{canvas:spec.canvas,scale:1,offset:[120,1419]});
const file=dir+'/melee-aligned-v1.png';fs.writeFileSync(file,bytes);
spec.poses.melee={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',anchors:{muzzle:[135,1760]},review:{accepted:true,note:'僅准試播：依原畫補畫的橫向刺劍，保留金紫黑刺繡；尚未通過跨姿勢畫風與動作銜接驗收。'}};
const prepSource=dir+'/anticipation-source-v1.png';
if(!fs.existsSync(prepSource))throw Error('缺少已保存的姿勢原圖：'+prepSource);
for(const [name,offset] of [['anticipation',[410,995]],['step',[370,995]]]){
 const data=alignPose(fs.readFileSync(prepSource),{canvas:spec.canvas,scale:1,offset});
 const output=dir+'/'+name+'-aligned-v1.png';fs.writeFileSync(output,data);
 spec.poses[name]={file:output,sha256:crypto.createHash('sha256').update(data).digest('hex'),facing:'left',anchors:{muzzle:[offset[0]+40,offset[1]+520]},review:{accepted:true,note:'僅准試播：原圖細節準備姿勢；踏步重用同張圖位移40px，並非新增中間幀。尚待對戰銜接驗收。'}};
}
fs.writeFileSync(dir+'/spec.json',JSON.stringify(spec,null,2)+'\n');
console.log(dir+'/spec.json');
