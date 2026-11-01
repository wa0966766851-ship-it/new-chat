// 卡修斯（5041）雙皮膚的正式 BattleScreen 驗收頁：?skin=cassius-shandi｜cassius-original｜none，
// ?mode=static｜actions。P1／P2 都放卡修斯，用來目視確認面對面、並量測靜態與動態的可見尺寸。
import React from 'react';
import {createRoot} from 'react-dom/client';
import BattleScreen from '../../src/components/BattleScreen';
import {GameDataProvider} from '../../src/contexts/GameDataContext';
import {writeAnimationSettings,DEFAULT_BATTLE_ANIMATION} from '../../src/battle/animationSettings';
import type {Elf,Skill} from '../../src/types';
import '../../src/index.css';
const q=new URLSearchParams(location.search);
writeAnimationSettings({...DEFAULT_BATTLE_ANIMATION,mode:q.get('mode')==='static'?'static':'actions',intro:false});
const skills=(['物理','特殊','屬性'] as const).map((category,i)=>({name:`驗收${category}`,category,type:'地面',power:i===2?0:30,pp:99,maxPp:99,accuracy:100,isSureHit:true,priority:0,description:'',effectMode:'kit',kit:[]} as Skill));
function elf(side:string):Elf{
 const stats={hp:10000,atk:200,def:200,spatk:200,spdef:200,speed:side==='p1'?200:100};
 const skin=q.get('skin');
 return {id:'5041',name:'岳峙淵渟.卡修斯',skinId:skin&&skin!=='none'?skin:undefined,battleId:`cas-${side}`,type:'地面',level:100,height:196,baseStats:stats,calculatedStats:stats,currentHp:10000,maxHp:10000,critValue:16,skills:structuredClone(skills),soulMark:{name:'',description:'',effectType:'none',effectValue:0,effectMode:'kit',kit:[]}} as unknown as Elf;
}
const p1=elf('p1'),p2=elf('p2');
createRoot(document.getElementById('root')!).render(<GameDataProvider><BattleScreen initialP1Team={[p1]} initialP2Team={[p2]} p1StarterId={p1.id} p2StarterId={p2.id} battleMode="PVP" preparedTeams randomSeed={11} onBackToMenu={()=>{}} onRestartBattle={()=>{}} onDriverInit={driver=>{(window as any).petBattle=driver;}}/></GameDataProvider>);
