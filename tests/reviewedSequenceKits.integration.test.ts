import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,
  HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true,
  getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:(f:any)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});(window as any).__BATTLE_FAST__=true;
const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')!);
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
let rounds=0;
try {
  const {default:Battle}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElves.ts');
  const {REVIEWED_SEQUENCE_SKILL_KITS}=await server.ssrLoadModule('/src/data/reviewedSequenceSkillKits.ts');
  const {applyReviewedSkillKits}=await server.ssrLoadModule('/src/data/reviewedSkillKits.ts');
  const {getSoulMarkRegistry}=await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const {kitEntryIssue}=await server.ssrLoadModule('/src/effects/effectConnection.ts');
  const {skillBasePriority}=await server.ssrLoadModule('/src/battle/conditionalPriority.ts');
  const {getStatuses}=await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const wait={name:'原子驗收等待',type:'普通',category:'屬性',power:0,pp:20,maxPp:20,isSureHit:true,description:''};
  const make=(id:string,hp:number,speed:number):any=>({id,battleId:id,name:id,type:'普通',level:100,currentHp:hp,maxHp:20000,
    baseStats:{hp:20000,atk:100,def:1000,spatk:100,spdef:1000,speed},calculatedStats:{hp:20000,atk:100,def:1000,spatk:100,spdef:1000,speed},statStages:{},skills:[{...wait}]});
  defineCustomBlocks();
  for(const row of REVIEWED_SEQUENCE_SKILL_KITS)for(const elfId of row.elfIds) {
    const original=DEFAULT_ELVES.find((e:any)=>String(e.id)===elfId);
    const selected=[...original.skills,...(original.skillPool || [])].find((s:any)=>s.name===row.name);
    assert.equal(selected.description,row.description,`${elfId}/${row.name}不覆寫原文`);
    assert.equal(selected.effectMode,'kit');assert.deepEqual(selected.kit,row.kit);
    for(const e of row.kit)assert.equal(kitEntryIssue(e),null);validateKit(row.kit);
    const ws=new Blockly.Workspace(),copy=new Blockly.Workspace();
    const roots=row.kit.map((e:any)=>buildEntryBlock(ws as any,e)!);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),copy);
    const restored=roots.map((b:any,i:number)=>createKitBlockParser('skill')(copy.getBlockById(b.id)!,row.kit[i].node,row.kit[i].order)!);
    assert.deepEqual(restored,row.kit,`${elfId}/${row.name}編輯畫布保存不丟參數`);ws.dispose();copy.dispose();
    const tampered={...original,skills:[{...selected,description:row.description+'（不同原文）',effectMode:'auto',kit:undefined}]};
    assert.equal(applyReviewedSkillKits(tampered).skills[0].effectMode,'auto');
    for(const side of ['p1','p2'])for(const mode of ['normal','sealed','invalid','no-heal']) {
      const other=side==='p1'?'p2':'p1',self=make('reviewed-sequence-host',8000,200),enemy=make('reviewed-sequence-target',20000,100);
      self.isCustom=true;self.isAdditionalInvalid=mode==='sealed';self.skills=[{...selected,kit:restored},{...wait}];
      const receipts:any[]=[];getSoulMarkRegistry()[enemy.name]=(c:any,event:string,d:any)=>{
        if(event==='ON_ENTRANCE') {
          if(mode==='invalid') {c.setOpponentState('attackSkillInvalidTurns',9);c.setOpponentState('utilitySkillInvalidTurns',9);}
          if(mode==='no-heal')c.setOpponentState(`${side}_noHealTurns`,99);
        }
        if(event==='ON_DAMAGED'&&d.receipt)receipts.push(d.receipt);return false;
      };
      let driver:any;
      await act(async()=>root.render(React.createElement(Battle,{key:`${elfId}/${row.name}/${side}/${mode}`,initialP1Team:[side==='p1'?self:enemy],initialP2Team:[side==='p2'?self:enemy],
        p1StarterId:side==='p1'?self.id:enemy.id,p2StarterId:side==='p2'?self.id:enemy.id,battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(d:any)=>driver=d})));
      const applied=mode!=='sealed'&&mode!=='invalid';
      if(row.name==='電光火石')assert.equal(skillBasePriority(selected,self,enemy,getStatuses),1,'欄位+1與固有+1不重複');
      const turns=row.name==='生命'?7:1;
      for(let turn=1;turn<=turns;turn++) {
        await act(async()=>{const s=driver.getSyncState();driver.onSkillSelect('p1',s.p1.skills[side==='p1'&&turn>1?1:0]);driver.onSkillSelect('p2',s.p2.skills[side==='p2'&&turn>1?1:0]);});
        for(let i=0;i<150&&!(driver.getSyncState().turnNumber===turn+1&&driver.getSyncState().phase==='p1_select');i++)await act(async()=>{await new Promise(r=>setTimeout(r,20));});
        const s=driver.getSyncState(),label=`${elfId}/${row.name}/${side}/${mode}/回合${turn}`;
        assert.equal(s.turnNumber,turn+1,`${label}；${s.phase}`);
        const canHeal=applied&&mode!=='no-heal';
        const gain=row.name==='生命'?100*Math.min(turn,5):row.name==='輪迴'?12000:row.name==='幽冥頓悟'?6666:0;
        assert.equal(s[side].currentHp,8000+(canHeal?gain:0),label);
        if(row.name==='夜魔之球')assert.equal(receipts.filter(r=>r.damageType==='percent'&&r.settledAmount===3000).length,applied?1:0,`${label}當前體力15%僅一次`);
        if(row.name==='幽冥頓悟')for(const k of ['atk','def','spatk','spdef','speed','accuracy'])assert.equal(s[side].statStages[k] || 0,applied?1:0,`${label}/${k}`);
        if(row.name==='生命'&&turn>=5)assert.equal(s[`${side}Timers`].filter((t:any)=>t.payload?.block?.trig==='self_after_use').length,0,`${label}5回合後到期`);
        assert.ok(!s.logs.some((l:any)=>String(l.message || l.text || '').includes('效果待接通')),label);
        rounds++;
      }
      delete getSoulMarkRegistry()[enemy.name];
    }
  }
  console.log(`7份內建定義：原文保護／完整畫布重載／P1P2／封附加／技能無效／禁療／5回合到期，共${rounds}正式回合通過。`);
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
