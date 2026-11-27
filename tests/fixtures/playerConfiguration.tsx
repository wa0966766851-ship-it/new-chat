import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import PlayerConfigurationPanel from '../../src/components/PlayerConfigurationPanel';
const stats={hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100};
const base:any={id:'5000',name:'測試精靈',type:'普通',level:100,baseStats:stats,calculatedStats:stats,currentHp:100,maxHp:100,skills:[{name:'測試招式',type:'普通',category:'物理',power:90,pp:20}]};
const normalize=(e:any)=>({...e,calculatedStats:{...stats},currentHp:100,maxHp:100});
const loader=async()=>({elves:[base],aliases:{},normalize,validateKit:()=>{}});
const config={kind:'seer-player-config',schemaVersion:1,label:'貼上即帶入',appVersion:'test',entries:{seer_default_elves_overrides:JSON.stringify({'5000':{id:'5000',level:75}}),seer_last_used_p1_team:JSON.stringify({team:[{...base,battleId:'start'}],starterId:'start'}),seer_p1_suit:'future_armor'}};
localStorage.clear();localStorage.setItem('seer_p1_suit','original');localStorage.setItem('seer_ai_api_key','private-fixture-key');
(window as any).fixtureCode=JSON.stringify(config);(window as any).reloadCount=0;
function Fixture(){const [allowed,setAllowed]=useState(true);return <main style={{maxWidth:800,margin:'20px auto',padding:16}}><label style={{color:'white'}}><input aria-label="允許套用" type="checkbox" checked={allowed} onChange={e=>setAllowed(e.target.checked)}/>首頁狀態</label><PlayerConfigurationPanel canApply={allowed} catalogLoader={loader} onReload={()=>{(window as any).reloadCount++;}}/></main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
