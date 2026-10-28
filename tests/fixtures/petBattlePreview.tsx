// 正式 BattleScreen 與引擎；浮動工具不佔版面，不複製舞台、HUD 或出傷流程。
import React from 'react';
import {createRoot} from 'react-dom/client';
import BattleScreen from '../../src/components/BattleScreen';
import {GameDataProvider} from '../../src/contexts/GameDataContext';
import {writeAnimationSettings,DEFAULT_BATTLE_ANIMATION,ANIMATION_MODES,type AnimationMode} from '../../src/battle/animationSettings';
import {DEFAULT_ELVES,loadImportedElves} from '../../src/data/defaultElves';
import {availableElfSkins} from '../../src/data/elfSkins';
import {petAnimationBinding,getPetDegradeLog,clearPetDegrade} from '../../src/battle/petAnimationRegistry';
import {PET_ANIMATION_ASSETS} from '../../src/battle/petAnimationAssets';
import {petClipLeaseSnapshot} from '../../src/battle/petAnimationLoader';
import {workbenchElf,REY_OWNERS,type WorkbenchSelection} from '../helpers/petWorkbench';
import type {Elf} from '../../src/types';
import queue from './native-animation/queue.json';
import '../../src/index.css';
import './petWorkbench.css';
import {PetPerformancePanel} from './PetPerformancePanel';

type Driver=Parameters<NonNullable<React.ComponentProps<typeof BattleScreen>['onDriverInit']>>[0]&{isPresenting?:()=>boolean};
// 不在模組頂層 await：入口 chunk 與 importedElves 互相 import（fflate 由入口再匯出），
// 頂層 await 會和循環匯入互相等待而永遠不結算，畫面因此完全不渲染。改在元件內載入，行為也與正式版一致。
const REY_FALLBACK:Elf={id:'70',name:'雷伊',type:'電',seerId:70,height:180,weight:24,skills:[]} as Elf;
const roster:Elf[]=[...DEFAULT_ELVES];
const syncRoster=()=>{roster.length=0;roster.push(...DEFAULT_ELVES);if(!roster.some(e=>String(e.id)==='70'))roster.push(REY_FALLBACK);};
syncRoster();
function initialSelection(side:'p1'|'p2'):WorkbenchSelection{
 const q=new URLSearchParams(location.search),fallback=q.get('asset')==='zhakesi15010'?'5025':'70';
 const id=q.get(side==='p1'?'elf':'opponent')||q.get('elf')||fallback;
 return {id:roster.some(e=>String(e.id)===id)?id:fallback,skinId:q.get(side+'Skin')??(REY_OWNERS.includes(id)?'rey-original':'')};
}
function Workbench(){
 const [p1,setP1]=React.useState(()=>initialSelection('p1')),[p2,setP2]=React.useState(()=>initialSelection('p2'));
 const [open,setOpen]=React.useState(new URLSearchParams(location.search).get('tools')!=='0');
 const [attacker,setAttacker]=React.useState<'p1'|'p2'>('p1'),[mode,setMode]=React.useState<AnimationMode>('actions');
 const [scene,setScene]=React.useState('visual');const visual=scene!=='real';const [revision,setRevision]=React.useState(0),[search,setSearch]=React.useState('');
 const [rosterRev,setRosterRev]=React.useState(0);
 const [auditSource,setAuditSource]=React.useState('');
 const [status,setStatus]=React.useState({size:'',busy:false,phase:'',players:0,leases:'',degraded:''});
 const driver=React.useRef<Driver|null>(null);
 const teams=React.useMemo(()=>{const out={p1:workbenchElf(roster,p1,'p1',attacker,visual||p1.id==='70',scene==='mechanism'),p2:workbenchElf(roster,p2,'p2',attacker,visual||p2.id==='70',scene==='mechanism')};if(auditSource)for(const e of [out.p1,out.p2])Object.assign(e,{name:'素材 '+auditSource.split('/').pop(),path:auditSource,skinId:undefined,height:185});return out;},[p1,p2,attacker,visual,scene,revision,rosterRev,auditSource]);
 React.useEffect(()=>{writeAnimationSettings({...DEFAULT_BATTLE_ANIMATION,mode,elfModes:{},staticMode:mode==='static',intro:false});},[mode]);
 React.useEffect(()=>{
  const poll=()=>setStatus({size:innerWidth+' × '+innerHeight+' · DPR '+devicePixelRatio,busy:driver.current?.isPresenting?.()??false,phase:driver.current?.getState().phase||'準備中',players:document.querySelectorAll('[data-pet-ready="true"]').length,leases:petClipLeaseSnapshot().map(a=>a.id+' ×'+a.users+'：CPU 圖集 '+Math.round(a.rgbaBytes/1048576)+' MiB').join('；'),degraded:getPetDegradeLog().slice(-1).map(a=>a.side+' '+a.reason).join('')});
  poll();const timer=setInterval(poll,300);return()=>clearInterval(timer);
 },[]);
 React.useEffect(()=>{(window as any).petVisualAudit={
 roster:()=>roster.map(e=>({id:String(e.id),name:e.name,height:e.height,source:e.seerId,skins:availableElfSkins(e).map(s=>({id:s.id,binding:petAnimationBinding({...e,skinId:s.id})})),binding:petAnimationBinding(e)})),
 selectSource:(source:string)=>{setAuditSource(source);setMode('static');driver.current=null;setRevision(n=>n+1);},
 select:(id:string,skinId='')=>{setAuditSource('');clearPetDegrade();driver.current=null;setP1({id,skinId});setP2({id,skinId});setRevision(n=>n+1);},
 mode:(value:AnimationMode)=>setMode(value),
 action:(category:string)=>{const d=driver.current,s=d?.getState();if(!d||!s||d.isPresenting?.())return false;const i=category==='attack'?0:category==='sa'?1:2;d.onSkillSelect('p1',s.p1.skills[i]);d.onSkillSelect('p2',s.p2.skills[2]);return true;},
 diagnostics:()=>({degraded:getPetDegradeLog(),leases:petClipLeaseSnapshot(),state:driver.current?.getState().phase})
 };return()=>{delete (window as any).petVisualAudit;};},[rosterRev,revision]);
 const reset=()=>{clearPetDegrade();driver.current=null;setRevision(n=>n+1);};
 const run=async(index:number)=>{
  const d=driver.current,s=d?.getState();if(!d||d.isPresenting?.()||s.phase!=='p1_select')return;
  const chosen=(attacker==='p1'?s.p1:s.p2).skills[index],idle=(attacker==='p1'?s.p2:s.p1).skills[2];
  d.onSkillSelect('p1',attacker==='p1'?chosen:idle);
  const deadline=performance.now()+30000;
  while(driver.current===d&&d.isPresenting?.()&&performance.now()<deadline)await new Promise(r=>setTimeout(r,16));
  if(driver.current===d&&d.getState().phase==='p2_select'&&!d.isPresenting?.())d.onSkillSelect('p2',attacker==='p2'?chosen:idle);
 };
 function picker(side:'p1'|'p2',value:WorkbenchSelection,set:React.Dispatch<React.SetStateAction<WorkbenchSelection>>){
  const elf=roster.find(e=>String(e.id)===value.id)!,binding=petAnimationBinding({...elf,skinId:value.skinId}),asset=binding&&PET_ANIMATION_ASSETS[binding];
  const candidate=queue.items.find(a=>a.owner===value.id);
  return <fieldset><legend>{side==='p1'?'P1 左側 →':'P2 右側 ←'}</legend><label>精靈<select aria-label={side+' 精靈'} value={value.id} onChange={e=>{if(e.target.value===value.id)return;driver.current=null;set({id:e.target.value,skinId:REY_OWNERS.includes(e.target.value)?'rey-original':''});}}>{roster.map(e=><option key={e.id} value={e.id}>{e.name} #{e.id}</option>)}</select></label><label>皮膚<select aria-label={side+' 皮膚'} value={value.skinId} onChange={e=>{if(e.target.value===value.skinId)return;driver.current=null;set({...value,skinId:e.target.value});}}>{availableElfSkins(elf).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><p>{asset?asset.clip+' · '+(asset.physicalMotion==='stationary'?'原地物攻':'接近物攻')+' · '+(asset.size/1048576).toFixed(2)+' MiB 下載 · '+asset.atlas.join(' × ')+' 原始圖集' : candidate?'待適配：官方素材 '+candidate.nativeId+'，目前展示靜態圖，尚未開放動作':'尚未登記動畫來源，目前展示靜態圖'}</p></fieldset>;
 }
 return <><GameDataProvider><BattleScreen key={p1.id+':'+p1.skinId+'|'+p2.id+':'+p2.skinId+'|'+attacker+'|'+scene+'|'+revision} initialP1Team={[teams.p1]} initialP2Team={[teams.p2]} p1StarterId={teams.p1.id} p2StarterId={teams.p2.id} battleMode="PVP" preparedTeams randomSeed={11} onBackToMenu={reset} onRestartBattle={reset} onDriverInit={d=>{driver.current=d;(window as any).petBattle=d;}}/></GameDataProvider>
 <aside className={'pet-workbench '+(open?'is-open':'')} aria-label="動畫驗收工具"><button className="pet-workbench-toggle" onClick={()=>setOpen(!open)}>{open?'收起驗收工具':'動畫驗收工具'} · {status.size}</button><section hidden={!open}><h1>正式對戰畫面・動畫驗收</h1><p>沿用正式 HUD、技能列、站位、縮放與出傷時間軸。工具是浮層，收起後不改變場地尺寸。</p>
 {picker('p1',p1,setP1)}{picker('p2',p2,setP2)}
 <div className="pet-workbench-row"><label>出招方<select aria-label="出招方" value={attacker} onChange={e=>setAttacker(e.target.value as 'p1'|'p2')}><option value="p1">P1 → P2</option><option value="p2">P2 → P1</option></select></label><label>演出模式<select aria-label="演出模式" value={mode} onChange={e=>setMode(e.target.value as AnimationMode)}>{ANIMATION_MODES.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></label></div>
 <label>驗收場景<select aria-label="驗收場景" value={scene} onChange={e=>setScene(e.target.value)}><option value="visual">外觀與出傷驗收（固定數值、停用魂印）</option><option value="mechanism">魂印機制＋測試技能（含第五切換）</option><option value="real">原始隊伍實戰（正式技能與魂印）</option></select></label>
 {visual?<><p>五格為測試技能；{scene==='mechanism'?'保留正式魂印以驗證第五變身。':'停用魂印。'}原始資料與玩家存檔不修改。由正式引擎安排一回合，對方使用屬性技。</p><div className="pet-workbench-actions">{(['物理攻擊','特殊攻擊','屬性技能','額外行動','第五技能'] as const).map((name,i)=><button key={name} data-preview-action={['attack','sa','cp','extra','fifth'][i]} disabled={status.busy||status.phase!=='p1_select'} onClick={()=>run(i)}>{name}</button>)}</div></>:<div><p>原始技能與魂印；對手選擇第三格技能。仍可能結束戰鬥。</p><div className="pet-workbench-actions">{(attacker==='p1'?teams.p1:teams.p2).skills.slice(0,5).map((skill,i)=><button key={i} disabled={status.busy||status.phase!=='p1_select'} onClick={()=>run(i)}>{skill.isFifthSkill?'第五：':''}{skill.name}</button>)}</div></div>}
 <div className="pet-workbench-actions"><button onClick={reset}>重置／重試載入</button><button onClick={()=>{const first=p1;setP1(p2);setP2(first);}}>交換雙方</button><button onClick={()=>{void document.documentElement.requestFullscreen?.();}}>全螢幕驗收</button></div>
 <output aria-live="polite">{status.busy?'演出中':status.phase} · 原生播放器 {status.players}/2<br/>{status.leases||'無原生圖集使用中'}{status.degraded&&<><br/>已回退：{status.degraded}；可重試載入</>}</output>
 <details><summary>待適配佇列（{queue.items.length} 隻，來源索引 {queue.indexVersion}）</summary><p>找到素材不代表已適配。只有登記的皮膚能播放；未驗收項目不會偷偷套用。</p><input aria-label="篩選待適配精靈" placeholder="名稱或序號" value={search} onChange={e=>setSearch(e.target.value)}/><ul>{queue.items.filter(a=>(a.name+' '+a.owner+' '+a.nativeId).includes(search)).map(a=><li key={a.owner}><button onClick={()=>setP1({id:a.owner,skinId:REY_OWNERS.includes(a.owner)?'rey-original':''})}>{a.name}</button><small> #{a.nativeId} · {(a.bytes/1048576).toFixed(2)} MiB · {a.nativeId===70||a.nativeId===15010?'已接入，待畫面驗收':'待適配'}{a.textures.map((t,i)=><span key={i}> · {t.width}×{t.height}</span>)}</small></li>)}</ul></details>
 <PetPerformancePanel/>
 </section></aside></>;
}
// 先設定再掛載，避免子元件初次讀到其他模式而播放登場過場。
writeAnimationSettings({...DEFAULT_BATTLE_ANIMATION,mode:'actions',elfModes:{},intro:false});
// 名冊必須在第一幀就完整：匯入精靈若晚一步才進來，選單與初始選擇會對不上。
// 閘門放在最外層，Workbench 內的 hook 數量才不會隨載入狀態改變。
function App(){
 const [loaded,setLoaded]=React.useState(false);
 React.useEffect(()=>{let alive=true;loadImportedElves().then(()=>{if(alive){syncRoster();setLoaded(true);}}).catch(()=>{if(alive)setLoaded(true);});return()=>{alive=false};},[]);
 return loaded?<Workbench/>:<p style={{color:'#cbd5e1',padding:24}}>載入精靈名冊…</p>;
}
const root=createRoot(document.getElementById('root')!);
root.render(<App/>);
// 此入口含頂層 await，更新依賴時會重新執行；先卸載舊樹，避免重複 createRoot。
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
