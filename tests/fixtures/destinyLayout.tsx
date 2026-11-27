import React from 'react';
import {createRoot} from 'react-dom/client';
import DestinyWheelScreen from '../../src/components/DestinyWheelScreen';
import type {Elf} from '../../src/types';
import '../../src/index.css';
const art='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150"><path d="M60 5 95 50 80 85 105 140 60 120 15 140 40 85 25 50Z" fill="#397cba" stroke="#16307a" stroke-width="4"/></svg>');
const names=['聖靈奧斯卡','格勞恩斯','洪荒·列奧尼達','月鈴極樂·奈尼芬多','六界神王','湮滅之主咤克斯'];
const elves=Array.from({length:24},(_,i)=>({id:String(9000+i),name:names[i%names.length]+i,type:'普通',level:100,destinyRank:i===0?'S':i<6?'A':i<10?'C':'B',path:art,baseStats:{hp:100,atk:110,def:100,spatk:100,spdef:100,speed:100},calculatedStats:{hp:500,atk:300,def:300,spatk:300,spdef:300,speed:300},currentHp:500,maxHp:500,skills:[{name:'驗收攻擊',type:'普通',category:'物理',power:80,pp:20,accuracy:100}],soulMark:{name:'驗收魂印',description:'回合開始時：\n> 顯示原文階層',effectType:'none',effectValue:0}})) as Elf[];
localStorage.setItem('destinyWheelView','B');
function Fixture(){const full=new URLSearchParams(location.search).get('shell')==='full';return <><header style={{height:50,background:'#121d2b',color:'white',padding:12,boxSizing:'border-box'}}>模擬新版頂列</header><div style={{display:'grid',gridTemplateColumns:!full&&innerWidth>=1000?'224px minmax(0,1fr)':'minmax(0,1fr)'}}>
 {!full&&innerWidth>=1000&&<aside style={{background:'#18202b',color:'white',padding:20}}>新版側欄</aside>}
 <div style={{minWidth:0}}><DestinyWheelScreen allElves={elves} initialBattleMode={new URLSearchParams(location.search).get('mode')==='PVP'?'PVP':'PVE'} onBack={()=>{}} onStartBattle={(...args)=>{(window as any).launched=args;}}/></div>
 </div></>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
