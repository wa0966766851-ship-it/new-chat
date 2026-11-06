import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PNG} from 'pngjs';
import {PARTS,BONES,ALPHA_THRESHOLD} from '../scripts/lib/skeletalRig/parts.mjs';
import {claimParts,fillUnowned,pointInPoly,samplePose,boneMatrices} from '../scripts/lib/skeletalRig/rigCore.mjs';
import {STANDBY} from '../scripts/lib/skeletalRig/motion.mjs';
const p=PNG.sync.read(fs.readFileSync('public/elf-art/wuxu_zhuixing_body_new.png'));
const alpha=Uint8Array.from({length:p.width*p.height},(_,i)=>p.data[i*4+3]);
const owner=claimParts(p.width,p.height,alpha,PARTS,ALPHA_THRESHOLD);fillUnowned(owner,p.width,p.height,alpha,ALPHA_THRESHOLD);
const head=PARTS.findIndex(p=>p.id==='head');let visible=0,missing=0,stolen=0,headPixels=0;
for(let i=0;i<owner.length;i++)if(alpha[i]>ALPHA_THRESHOLD){visible++;if(owner[i]<0)missing++;
 if(pointInPoly(PARTS[head].poly,i%p.width+.5,Math.floor(i/p.width)+.5)){headPixels++;if(owner[i]!==head)stolen++;}
}
assert.equal(missing,0,'來源有遺失的可見像素');assert.equal(stolen,0,'頭部被其他部件取得');assert.ok(headPixels>0);
console.log(JSON.stringify({visible,missing,headPixels,stolen}));

// 使用者確認的待機契約：不原地漂移／轉環、不讓砲獨立於持砲身體擺動。
// 此處檢查變換與循環，不以測試通過宣稱美術或接縫已驗收。
const rest=boneMatrices(BONES,samplePose(STANDBY.pose,0));
for(let frame=0;frame<STANDBY.frames;frame++){
 const matrices=boneMatrices(BONES,samplePose(STANDBY.pose,frame));
 for(const name of ['root','legL','legR','ringR'])
  assert.deepEqual(matrices[name],rest[name],`待機 ${name} 在第 ${frame} 幀應穩定`);
 assert.deepEqual(matrices.cannon,matrices.torso,'持砲待機不能讓砲獨立於軀幹旋轉或位移');
 if(frame===STANDBY.frames-1)for(const bone of BONES)
  assert.deepEqual(matrices[bone.name],rest[bone.name],`循環結尾 ${bone.name} 未復位`);
}
assert.equal(STANDBY.fx.length,0,'待機不疊加無用途的蓄力光暈');
console.log('待機循環、固定腳底／後環、持砲跟隨通過；不代表出招美術驗收');
