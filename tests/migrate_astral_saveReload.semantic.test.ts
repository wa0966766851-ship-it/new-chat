// 5032/5033/5034 三精靈 Kit：原文保護＋packed 一致＋Blockly 畫布保存重載＋P1/P2 實戰。
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
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent',cacheDir:'node_modules/.vite-dsh-astral'});
let checked=0;
try {
  const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElves.ts');
  const {kitEntryIssue}=await server.ssrLoadModule('/src/effects/effectConnection.ts');
  const aesfiaSkills:any=await server.ssrLoadModule('/src/data/migratedAstralAesfiaKits.ts');
  const aesfiaSoul:any=await server.ssrLoadModule('/src/data/migratedAstralAesfiaSoulKit.ts');
  const aesfigSoul:any=await server.ssrLoadModule('/src/data/migratedAstralAesfigSoulKit.ts');
  const aesfigSkills:any=await server.ssrLoadModule('/src/data/migratedAstralAesfigSkillKits.ts');
  const mogosSkills:any=await server.ssrLoadModule('/src/data/migratedMogosSkillKits.ts');
  defineCustomBlocks();

  const allSkillDefs=[
    ...aesfiaSkills.MIGRATED_ASTRAL_AESFIA_KITS,
    ...aesfiaSkills.MIGRATED_ASTRAL_AESFIA_SKILLS_2,
    ...aesfiaSkills.MIGRATED_ASTRAL_AESFIA_FLASH,
    ...aesfigSkills.MIGRATED_ASTRAL_AESFIG_SKILLS,
    ...mogosSkills.MIGRATED_MOGOS_SKILLS,
  ];
  const allSoulDefs=[aesfiaSoul.MIGRATED_ASTRAL_AESFIA_SOUL_KIT, aesfigSoul.MIGRATED_ASTRAL_AESFIG_SOUL_KIT];
  assert.ok(allSkillDefs.length>=14, `技能 Kit 應至少 14 份（實得 ${allSkillDefs.length}）`);

  // ── A. 技能：原文保護＋合約＋畫布往返 ──
  for(const row of allSkillDefs){
    const elf=(DEFAULT_ELVES as any[]).find((e:any)=>String(e.id)===row.elfIds[0]);
    const selected=[...(elf.skills||[]),...(elf.skillPool||[])].find((s:any)=>s.name===row.name);
    assert.ok(selected, `${row.name} 存在於 5032/33/34`);
    assert.equal(selected.description,row.description,`${row.name} 原文不覆寫`);
    for(const e of row.kit){assert.equal(kitEntryIssue(e),null,`${row.name} 條目 ${e.order} 無待接通`);validateKit([e]);}
    const ws=new Blockly.Workspace(),copy=new Blockly.Workspace();
    const roots=row.kit.map((e:any)=>buildEntryBlock(ws as any,e)!);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),copy);
    const restored=roots.map((b:any,i:number)=>createKitBlockParser('skill')(copy.getBlockById(b.id)!,row.kit[i].node,row.kit[i].order)!);
    assert.deepEqual(restored,row.kit,`${row.name} 畫布保存重載不丟參數`);
    ws.dispose();copy.dispose();checked++;
  }

  // ── B. 魂印：合約＋畫布往返（soulmark 解析器）──
  for(const row of allSoulDefs){
    const elf=(DEFAULT_ELVES as any[]).find((e:any)=>String(e.id)===row.elfIds[0]);
    assert.equal(elf.soulMark?.name,row.name,'魂印名稱一致');
    assert.equal(elf.soulMark?.description,row.description,`${row.name} 魂印原文一致`);
    for(const e of row.kit){assert.equal(kitEntryIssue(e),null,`${row.name} 條目 ${e.order} 無待接通`);validateKit([e]);}
    const ws=new Blockly.Workspace(),copy=new Blockly.Workspace();
    const roots=row.kit.map((e:any)=>buildEntryBlock(ws as any,e)!);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),copy);
    const restored=roots.map((b:any,i:number)=>createKitBlockParser('soulmark')(copy.getBlockById(b.id)!,row.kit[i].node,row.kit[i].order)!);
    assert.deepEqual(restored,row.kit,`${row.name} 魂印畫布保存重載不丟參數`);
    ws.dispose();copy.dispose();checked++;
  }

  // ── C. P1/P2 實戰：三精靈各一回合無待接通（改名繞舊魂印，測技能 Kit 純度）──
  const {default:Battle}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const buildElf=(id:string,defs:any[])=>{
    const elf=structuredClone((DEFAULT_ELVES as any[]).find((e:any)=>String(e.id)===id));
    elf.name='驗收-'+id; elf.soulMark.effectType='none';
    for(const def of defs){const sk=elf.skills.find((s:any)=>s.name===def.name);if(sk){sk.effectMode='kit';sk.kit=structuredClone(def.kit);}}
    return elf;
  };
  const dummy=(id:string):any=>({id,battleId:id,name:id,type:'普通',level:100,currentHp:1_000_000_000,maxHp:1_000_000_000,
    baseStats:{hp:100000,atk:100,def:10000,spatk:100,spdef:10000,speed:50},calculatedStats:{hp:1e9,atk:200,def:20000,spatk:200,spdef:20000,speed:50},statStages:{},skills:[
      {name:'打',category:'物理',type:'普通',power:60,pp:99,maxPp:99,isSureHit:true,description:''},
      {name:'待機',category:'屬性',type:'普通',power:0,pp:99,maxPp:99,isSureHit:true,description:''}]});
  const cases = [
    { id: '5032', defs: [...aesfiaSkills.MIGRATED_ASTRAL_AESFIA_KITS, ...aesfiaSkills.MIGRATED_ASTRAL_AESFIA_SKILLS_2] },
    { id: '5033', defs: aesfigSkills.MIGRATED_ASTRAL_AESFIG_SKILLS },
    { id: '5034', defs: mogosSkills.MIGRATED_MOGOS_SKILLS },
  ] as any[];
  for(const side of ['p1','p2'] as const){
    for(const tc of cases){
      const self=buildElf(tc.id,tc.defs),enemy=dummy('foe-'+tc.id);
      let driver:any;
      await act(async()=>root.render(React.createElement(Battle,{key:`astral/${tc.id}/${side}`,initialP1Team:[side==='p1'?self:enemy],initialP2Team:[side==='p2'?self:enemy],
        p1StarterId:side==='p1'?self.id:enemy.id,p2StarterId:side==='p2'?self.id:enemy.id,battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(d:any)=>driver=d})));
      await act(async()=>{const s=driver.getSyncState();driver.onSkillSelect('p1',s.p1.skills[0]);driver.onSkillSelect('p2',s.p2.skills[side==='p1'?1:0]);});
      for(let i=0;i<150&&!(driver.getSyncState().turnNumber===2&&driver.getSyncState().phase==='p1_select');i++)await act(async()=>{await new Promise(r=>setTimeout(r,20));});
      const s=driver.getSyncState();
      assert.equal(s.turnNumber,2,`${tc.id}/${side} 回合推進（實際 ${s.turnNumber}/${s.phase}）`);
      const pending=(s.logs||[]).some((l:any)=>String(l.message||l.text||'').includes('效果待接通'));
      console.log(`  ${tc.id}/${side}: pending=${pending}`);
      assert.ok(!pending,`${tc.id}/${side} 不得有待接通`);
      checked++;await act(async()=>root.render(React.createElement('div')));
    }
  }
  console.log(`三精靈 Kit：原文保護／合約／畫布保存重載／P1P2實戰，${checked} 項通過。`);
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
