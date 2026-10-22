import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { parseElfBlueprint } from '../src/utils/elfBlueprint';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (fn: any) => setTimeout(fn,0), cancelAnimationFrame: clearTimeout, alert: () => {} });
dom.window.confirm = () => true;
(window as any).__BATTLE_FAST__ = true;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode:true }, appType:'custom', logLevel:'silent' });
let count = 0;
try {
  const { EffectConnectionInspector: Inspector } = await server.ssrLoadModule('/src/components/EffectConnectionInspector.tsx');
  const { default: Editor } = await server.ssrLoadModule('/src/components/ElfEditor.tsx');
  const { ElfBlocklyPanel: Panel } = await server.ssrLoadModule('/src/components/ElfBlocklyPanel.tsx');
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  let definition: any = { name:'連接使用技能', description:'🎯 恢復自身70點體力', effectMode:'description' };
  await act(async () => root.render(React.createElement(Inspector, { definition,kind:'skill',
    onModeChange:(mode: string) => definition.effectMode=mode, onKitChange:(kit: any) => definition.kit=kit })));
  const distill = [...document.querySelectorAll('button')].find(b => b.textContent==='煉成可編輯積木')!;
  assert.ok(distill); assert.equal(distill.disabled,false);
  await act(async () => distill.click());
  assert.equal(definition.effectMode,'kit'); assert.equal(definition.kit[0].codeId,'effect_sequence'); assert.equal(definition.kit[0].params.clause.body[0].acts[0].p.amount,70);
  assert.equal(definition.description,'🎯 恢復自身70點體力'); count++;

  const entry = (node: string,amount: number,source='soulmark',role='attached') => ({codeId:'heal',node,params:{amount},source,role,order:0});
  const initial: any = structuredClone(DEFAULT_ELVES[0]);
  initial.name='連接驗收精靈'; initial.id='connection-elf'; initial.isCustom=true;
  initial.builtinEffectBindings={schemaVersion:1,elfId:initial.id,definitions:{soul:'1:42:abc:123'}};
  initial.soulMark={name:'連接魂印',description:'回合開始恢復30點',effectMode:'kit',effectType:'none',effectValue:0,kit:[entry('round_start',30)]};
  initial.kit=[];
  initial.trait=undefined;
  initial.alienTraits={gen2Trait:{name:'連接特質',description:'回合結束恢復40點',effectMode:'kit',kit:[entry('round_end',40)]}};
  initial.skills=[{...initial.skills[0],...definition,type:'普通',category:'物理',power:40,pp:10,maxPp:10,isSureHit:true,
    kit:[entry('on_skill_use',5,'skill','innate'),entry('on_hit',70,'skill')]}];
  const original = JSON.stringify(initial);
  let panelWrites = 0;
  const noWrite = () => { panelWrites++; };
  await act(async () => root.render(React.createElement(Panel, { elf: initial, elfName: initial.name,
    soulKit: initial.soulMark.kit, skills: initial.skills, onSoulKitChange:noWrite, onSkillKitChange:noWrite,
    onSoulModeChange:noWrite, onSkillModeChange:noWrite, onTraitChange:noWrite,
    onInsertSoulDesc:noWrite, onInsertSkillDesc:noWrite })));
  assert.ok(document.querySelector('[aria-label="積木工作流程"]'));
  assert.equal(document.querySelector('.blocklySvg'),null,'原文核對不得建立Blockly工作區');
  assert.ok(document.querySelector('[aria-label="效果連接狀態"]')); count++;
  await act(async () => [...document.querySelectorAll('button')].find(b=>b.textContent==='3 驗收清單')!.click());
  assert.ok(document.querySelector('[aria-label="逐句驗收工作區"]'));
  assert.match(document.body.textContent!,/待測試證據/);
  assert.equal(document.querySelector('[aria-label="效果連接狀態"]'),null,'分區不重複堆疊');
  assert.equal(document.querySelector('.blocklySvg'),null); count++;
  const target = document.querySelector('[aria-label="積木編輯對象"]') as HTMLSelectElement;
  await act(async () => {target.value='trait:gen2Trait';target.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  assert.match(document.body.textContent!,/連接特質/);
  assert.match(document.body.textContent!,/回合結束恢復40點/);
  assert.equal(panelWrites,0,'查看、切頁與選取特質不得改寫草稿或來源');
  assert.equal(JSON.stringify(initial),original); count++;
  let saved: any;
  await act(async () => root.render(React.createElement(Editor,{initialElf:initial,onSaveElf:(elf: any)=>saved=elf,onBack:()=>{}})));
  const save = [...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='儲存精靈修改')!;
  assert.ok(save); await act(async()=>save.click()); assert.ok(saved);
  assert.equal(saved.soulMark.effectMode,'kit'); assert.deepEqual(saved.soulMark.kit,initial.soulMark.kit,'儲存正式魂印欄位，不再只有根 kit');
  assert.deepEqual(saved.skills[0].kit,initial.skills[0].kit);
  assert.deepEqual(saved.alienTraits.gen2Trait.kit,initial.alienTraits.gen2Trait.kit); count++;
  const restored = parseElfBlueprint(JSON.stringify({schemaVersion:2,manualElf:saved})).elf;
  assert.deepEqual(restored.skills[0].kit,saved.skills[0].kit); count++;
  assert.deepEqual(saved.builtinEffectBindings,initial.builtinEffectBindings,'編輯保存不得丟來源版本');
  assert.deepEqual(restored.builtinEffectBindings,saved.builtinEffectBindings,'圖紙往返保留來源版本');
  assert.throws(()=>parseElfBlueprint(JSON.stringify({schemaVersion:2,manualElf:{...saved,builtinEffectBindings:{schemaVersion:1,elfId:'wrong-owner',definitions:{}}}})),/builtinEffectBindings/);

  let driver: any;
  const make = (id: string,speed: number): any => ({id,battleId:id,name:id,type:'普通',level:100,
    currentHp:1000,maxHp:1000,baseStats:{hp:1000,atk:100,def:1000,spatk:100,spdef:1000,speed},
    calculatedStats:{hp:1000,atk:100,def:1000,spatk:100,spdef:1000,speed},statStages:{},
    skills:[{name:'等待',type:'普通',category:'屬性',power:0,pp:10,maxPp:10}]});
  for (const side of ['p1','p2']) for (const sealed of [false,true]) {
    const self={...make('connection-holder',200),...structuredClone(restored),id:'connection-holder',battleId:'connection-holder',
      currentHp:400,maxHp:1000,calculatedStats:make('x',200).calculatedStats,isAdditionalInvalid:sealed};
    const other=make('connection-target',100);
    await act(async()=>root.render(React.createElement(Battle,{key:`${side}:${sealed}`,initialP1Team:[side==='p1'?self:other],
      initialP2Team:[side==='p2'?self:other],p1StarterId:side==='p1'?self.id:other.id,p2StarterId:side==='p2'?self.id:other.id,
      battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(d: any)=>driver=d})));
    const before=driver.getSyncState()[side].currentHp;
    assert.equal(before,430,`${side}/${sealed} 開局回合開始恢復30，選招前即生效且只一次`);
    (globalThis as any).__BATTLE_SEED__=19;
    await act(async()=>{driver.onSkillSelect('p1',driver.getSyncState().p1.skills[0]);driver.onSkillSelect('p2',driver.getSyncState().p2.skills[0]);});
    for(let i=0;i<150 && !(driver.getSyncState().turnNumber===2 && driver.getSyncState().phase==='p1_select');i++)
      await act(async()=>{await new Promise(r=>setTimeout(r,20));});
    const state=driver.getSyncState();
    assert.equal(state.turnNumber,2);assert.equal(state.phase,'p1_select');
    // 首回合開始30已在start派發；出手不可再重播。固有5、命中70、回合末40各一次。
    assert.equal(state[side].currentHp-before,sealed?45:115,`${side}/${sealed} 出手及回合末回復量／來源不得重複`);
    assert.equal(state[side].currentHp-400,sealed?75:145,`${side}/${sealed} 含開局回合開始的完整回復量`);
    assert.ok(state[side==='p1'?'p2':'p1'].currentHp<1000,'主攻擊傷害仍然執行');
    assert.equal(state[side].skills[0].pp,9); count++;
  }
  console.log(`畫面煉成→編輯儲存→圖紙重載→真實戰鬥：${count} 項通過（雙側／附加失效）。`);
} finally { await act(async()=>root.unmount());await server.close();dom.window.close(); }
