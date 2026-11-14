/** Rebuild saved studies without rerunning historical preparation/generation. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root='docs/custom-anim/drafts/20261106-original-motion';
for(const relative of ['emperor_dixin/transition-pilot-spec.json','liuren-weapon-pilot/take-pilot-spec.json','wuxu_shiyan/hurt-rig-spec.json','wuxu_zhuixing.json']){
 const result=spawnSync(process.execPath,['scripts/build_pose_animation.mjs','--spec',root+'/'+relative,'--out','build/original-motion-v4'],{stdio:'inherit',windowsHide:true});
 if(result.status!==0)throw Error('Baseline build failed: '+relative);
}
const sidecars={wuxu_liuren:{'sword.png':root+'/liuren-weapon-pilot/sword.png','standard-impact-green.png':'docs/custom-anim/drafts/20261108-detail-revision/shared-fx/standard-impact-green.png'},wuxu_shiyan:{'curse-page.png':root+'/wuxu_shiyan/curse-page.png','claw-open.png':root+'/wuxu_shiyan/claw-open.png','claw-closed.png':root+'/wuxu_shiyan/claw-closed.png','standard-impact-source.png':'docs/custom-anim/drafts/20261108-detail-revision/shared-fx/standard-impact-source.png'}};
for(const [id,files] of Object.entries(sidecars))for(const [name,source] of Object.entries(files))fs.copyFileSync(source,path.join('build/original-motion-v4',id,name));
