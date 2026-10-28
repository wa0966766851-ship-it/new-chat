import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {DEFAULT_BATTLE_ANIMATION,normalizeAnimationSettings,animationModeFor,withAnimationMode,setElfAnimationMode,effectiveAnimationSettings} from '../src/battle/animationSettings';
import {petAnimationBinding,registerPetPlayer,readyPetActionDuration} from '../src/battle/petAnimationRegistry';
import {BattlePresentation} from '../src/battle/presentation';
import {registerPetAnimations,PET_BUNDLES} from '../server/petAnimations';
import {shouldMirrorBattleSprite} from '../src/battle/seerAssets';
const rey={id:'7070',name:'魔化.雷伊'};
let settings=normalizeAnimationSettings({staticMode:true,extra:false});assert.equal(animationModeFor(settings),'static');
settings=setElfAnimationMode(settings,rey,'actions');assert.equal(animationModeFor(settings,rey),'actions');assert.equal(effectiveAnimationSettings(settings,rey).skill,true);assert.equal(effectiveAnimationSettings(settings).skill,false);assert.equal(effectiveAnimationSettings(settings).intro,false);assert.equal(effectiveAnimationSettings(settings).damage,true,'靜態模式保留傷害飄字');
assert.equal(normalizeAnimationSettings(JSON.parse(JSON.stringify(settings))).elfModes?.['7070:魔化.雷伊'],'actions');
settings=setElfAnimationMode(settings,rey,'inherit');assert.equal(animationModeFor(settings,rey),'static');settings=withAnimationMode(settings,'simple');assert.equal(settings.extra,false);
assert.equal(animationModeFor(normalizeAnimationSettings({mode:'wrong',elfModes:{bad:'wrong'}})),'simple');
assert.equal(petAnimationBinding({...rey,skinId:undefined}),null,'原始外觀不隱式套用其他皮膚動畫');
for(const owner of [rey,{id:'707070',name:'墜霆.雷伊'},{id:'5029',name:'異境神霆·雷伊'}]){
 assert.equal(petAnimationBinding({...owner,skinId:'rey-original'}),'rey70');
 assert.equal(petAnimationBinding({...owner,skinId:'unregistered'}),null);
 assert.equal(petAnimationBinding(owner),null);
}
assert.equal(petAnimationBinding({id:'5029',name:'異境神霆·雷伊'}),null,'自製 ID 不得對應官方同 ID 動畫');
assert.equal(petAnimationBinding({id:'5029',name:'異境神霆·雷伊',path:'otherworld_thunder_rey',skinId:'rey-original'}),'rey70');
assert.equal(petAnimationBinding({...rey,path:'https://custom/art.png'}),null);
// 2026-10-25 政策變更：素材改由 PET_ANIMATION_ASSETS 逐檔登記的名稱解析，不再只認兩隻。
// 九青（自製 ID 5036）已登記官方 4543 動作；自訂圖址仍必須擋下，不因登記而放行。
assert.equal(petAnimationBinding({id:'5036',name:'九青'}),'jiuqing');
assert.equal(petAnimationBinding({id:'5036',name:'九青',path:'/elf-art/jiuqing_body.png'}),null,'自訂立繪不套用官方動作');
assert.equal(petAnimationBinding({id:'9999',name:'未登記的精靈'}),null,'未登記名稱不得回傳任何素材');
assert.equal(shouldMirrorBattleSprite(rey.name,'p1',false,'/api/pet-animations/bundle/rey70'),false,'動畫原生朝右，P1保留');
assert.equal(shouldMirrorBattleSprite(rey.name,'p2',false,'/api/pet-animations/bundle/rey70'),true,'P2只翻一次朝左');
assert.equal(readyPetActionDuration('p1',400),400);const a=registerPetPlayer('p1'),b=registerPetPlayer('p1');assert.equal(readyPetActionDuration('p1',400),3125);a();assert.equal(readyPetActionDuration('p1',400),3125);b();assert.equal(readyPetActionDuration('p1',400),400);
const observed:any[]=[];const p=new BattlePresentation(()=>{if(p.popups.length)observed.push(...p.popups);},()=>true,()=>setElfAnimationMode(withAnimationMode(DEFAULT_BATTLE_ANIMATION,'static'),rey,'simple'));
await p.stage({p1Team:[{...rey,battleId:'battle-rey'}],p1ActiveIndex:0});await p.record({side:'p1',elfId:'battle-rey',type:'skill',amount:20,delta:-20,before:100,after:80,maxHp:100});assert.equal(observed.length,1);assert.equal(p.hp.get('p1:battle-rey'),80);p.dispose();
const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-route-'));fs.mkdirSync(path.join(root,'launcher'));const cache=path.join(root,'cache');fs.writeFileSync(path.join(root,'launcher/animation-source.local.json'),JSON.stringify({cacheRoot:cache}));
const localData=Buffer.from('verified local bundle');
const fixtures=Object.fromEntries(Object.entries(PET_BUNDLES).map(([key,meta])=>[key,{...meta,size:localData.length,sha256:crypto.createHash('sha256').update(localData).digest('hex')}]));
const app=express();registerPetAnimations(app,root,{remote:false,bundles:fixtures,directory:path.join(root,'downloaded')});const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
try{const base=`http://127.0.0.1:${(server.address() as any).port}/api/pet-animations`;
assert.equal((await(await fetch(base+'/status')).json()).rey70,false);assert.equal((await fetch(base+'/bundle/rey70')).status,404);assert.equal((await fetch(base+'/bundle/settings')).status,404);
for(const data of Object.values(PET_BUNDLES)){const dir=path.join(cache,data.hash.slice(0,2),data.hash);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'__data'),localData);}
assert.equal((await(await fetch(base+'/status')).json()).rey70,true);assert.equal((await(await fetch(base+'/bundle/rey70')).arrayBuffer()).byteLength,localData.length);
const ray=PET_BUNDLES.rey70,rayFile=path.join(cache,ray.hash.slice(0,2),ray.hash,'__data');fs.writeFileSync(rayFile,Buffer.alloc(localData.length));assert.equal((await(await fetch(base+'/status')).json()).rey70,false,'本機同大小損毀素材也須拒絕，不可僅驗大小');assert.equal((await fetch(base+'/bundle/rey70')).status,404);
}finally{await new Promise<void>(r=>server.close(()=>r()));fs.rmSync(root,{recursive:true,force:true});}
console.log('三模式遷移、逐隻覆寫、明確外觀綁定、播放器引用計數、播放HP與白名單素材路由通過');
