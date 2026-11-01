// 單隻卡修斯原生動畫驗收：?skin=cassius-shandi｜cassius-original&side=p1｜p2&action=standby…
// 只放一個 PetActionSprite，避免兩個 WebGL 畫布在無頭瀏覽器互相遮蓋；朝向由正式 shouldMirrorBattleSprite 決定。
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PetActionSprite} from '../../src/components/battle/PetActionSprite';
import type {PetAction} from '../../src/battle/petAnimationRegistry';
import type {Elf} from '../../src/types';
const q=new URLSearchParams(location.search);
const side=(q.get('side')||'p2') as 'p1'|'p2',skin=q.get('skin')||undefined,action=(q.get('action')||'standby') as PetAction;
const elf={id:'5041',name:'岳峙淵渟.卡修斯',skinId:skin==='none'?undefined:skin,battleId:'cas-'+side} as unknown as Elf;
const anchorX=800;
createRoot(document.getElementById('root')!).render(<div style={{position:'relative',width:1600,height:700,overflow:'hidden'}}>
 <div style={{position:'absolute',left:anchorX,top:0,width:1,height:700,background:'#f0f4'}}/>
 <div style={{position:'absolute',left:anchorX,bottom:0,height:600}}>
  <PetActionSprite elf={elf} side={side} action={action} actionToken={1} width={440} height={486} viewport={{width:1600,height:600,anchorX}} onReady={()=>{}}/>
 </div></div>);
