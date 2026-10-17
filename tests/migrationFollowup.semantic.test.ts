import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { MIGRATED_FOLLOWUP_SKILL_KITS } from '../src/data/migratedFollowupSkillKits';
import { MIGRATED_DEFERRED_DAMAGE_SKILL_KITS } from '../src/data/migratedDeferredDamageSkillKits';
import { MIGRATED_REFLECTION_SKILL_KITS } from '../src/data/migratedReflectionSkillKits';
import { MIGRATED_REACTION_SKILL_KITS } from '../src/data/migratedReactionSkillKits';
import { MIGRATED_RESULT_SKILL_KITS } from '../src/data/migratedResultSkillKits';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let checks = 0;
const check = async (name: string, fn: () => void | Promise<void>) => { await fn(); checks++; console.log(`✓ ${name}`); };
const strike = () => ({ ...h.wait(), name: '實際攻擊', category: '物理', power: 100 });
const definitions = [...MIGRATED_FOLLOWUP_SKILL_KITS, ...MIGRATED_DEFERRED_DAMAGE_SKILL_KITS,
  ...MIGRATED_REACTION_SKILL_KITS,
  ...MIGRATED_RESULT_SKILL_KITS,
  ...MIGRATED_REFLECTION_SKILL_KITS.filter(definition => definition.name === '無盡入侵')];
try {
  await check('11份完整原文及持有者匹配；正式載入路徑為Kit', async () => {
    const { effectRoute } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
    for (const definition of definitions) for (const id of definition.elfIds) {
      const skill = h.find(id, definition.name);
      assert.equal(skill.description, definition.description);
      assert.equal(skill.effectMode, 'kit'); assert.equal(effectRoute(skill, true), 'kit');
      assert.deepEqual(skill.kit, definition.kit);
    }
  });
  await check('11份圖紙實際Blockly保存重載，保留巢狀次數、成敗、期限、雙防及條件先手', () => {
    defineCustomBlocks();
    for (const definition of definitions) {
      const workspace = new Blockly.Workspace(), restored = new Blockly.Workspace();
      try {
        for (const entry of definition.kit) {
          const block = buildEntryBlock(workspace as any, entry); assert.ok(block);
          assert.notEqual(block.type, 'native_effect_reference');
        }
        Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace), restored);
        const entries = restored.getTopBlocks(false).map(block => {
          const entry = JSON.parse(block.data!).entry;
          return createKitBlockParser('skill')(block, entry.node, entry.order);
        }).sort((a, b) => a!.order - b!.order);
        assert.deepEqual(entries, definition.kit);
      } finally { workspace.dispose(); restored.dispose(); }
    }
  });
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 蒼穹斗轉：用本次正式傷害判斷300分支，百分比附加不灌入攻擊總傷害`,async()=>{
      for(const power of [1,500]){
        const skill={...h.find('arena_15','恆·蒼穹斗轉'),power};
        const [result]=await h.play(side,{self:h.unit('S',20000,[skill]),opp:h.unit('E',20000,[h.wait()])});
        const damage=20000-result.opp.currentHp-5000;
        assert.equal(damage>300,power===500,result.logs.join('\n'));
        assert.equal(Number(result.state[`${side}RegistryState`].blkImmuneStatusCount||0),power===500?1:0);
        const critical=(result.state[`${side}Timers`]||[]).filter((timer:any)=>timer.payload?.block?.crit);
        assert.equal(critical.length,power===1?1:0);
        if(power===1)assert.equal(critical[0].remaining,2);
      }
    });
    await check(`${side} 蒼穹斗轉：百分比免疫轉真傷，護罩承傷與上限0不觸發轉換`,async()=>{
      const skill={...h.find('arena_15','恆·蒼穹斗轉'),power:0,category:'屬性'};
      const immune={name:'測試百分比免疫',description:'',effectMode:'kit',kit:[{
        codeId:'effect_sequence',node:'before_damage',source:'mechanic',role:'innate',order:0,customText:'百分比免疫',
        params:{clause:{raw:'百分比免疫',trig:'incoming',parsed:true,body:[{acts:[{op:'dmg_mod',p:{dir:'in',kind:'百分比',reduce:1},label:'百分比免疫'}]}]}},
      }]};
      const [blocked]=await h.play(side,{self:h.unit('S',20000,[skill]),opp:h.unit('E',20000,[h.wait()],{extra:{trait:immune}})});
      assert.equal(blocked.opp.currentHp,15000,blocked.logs.join('\n'));
      const [shielded]=await h.play(side,{self:h.unit('S',20000,[skill]),opp:h.unit('E',20000,[h.wait()],{extra:{barrier:6000}})});
      assert.equal(shielded.opp.currentHp,20000,shielded.logs.join('\n'));
      assert.equal(shielded.opp.barrier,1000);
      const cap={name:'百分比上限0',description:'測試',effectMode:'kit',kit:[{
        codeId:'effect_sequence',node:'on_entered',source:'mechanic',role:'innate',order:0,
        params:{clause:{raw:'上限0不是免疫',trig:'entrance',parsed:true,body:[{acts:[{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'百分比',cap:0,turns:2},label:'上限0'}]}]}},
      }]};
      const [capped]=await h.play(side,{self:h.unit('S',20000,[skill]),opp:h.unit('E',20000,[h.wait()],{extra:{trait:cap}})});
      assert.equal(capped.opp.currentHp,20000,capped.logs.join('\n'));
    });
    await check(`${side} 原持有者魂印下編輯移除蒼穹附加，不重播舊同名處理`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
      const owner=DEFAULT_ELVES.find((elf:any)=>String(elf.id)==='arena_15');
      const skill=structuredClone(h.find('arena_15','恆·蒼穹斗轉'));
      skill.kit=skill.kit.filter((entry:any)=>entry.codeId==='skill_property');skill.power=1;
      const mk=(move:any)=>({self:h.unit('S',20000,[move],{extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),opp:h.unit('E',20000,[h.wait()])});
      const [baseline]=await h.play(side,mk({...skill,name:'同公式對照'}));
      const [edited]=await h.play(side,mk(skill));
      assert.equal(edited.opp.currentHp,baseline.opp.currentHp,edited.logs.join('\n'));
    });
    await check(`${side} 目瘴淵禁：新中毒不誤判原本中毒；感染轉化只清中毒`, async () => {
      const other=side==='p1'?'p2':'p1';
      for(const poisoned of [false,true]){
        const [result]=await h.play(side,{
          self:h.unit('S',20000,[h.find('5009','目瘴淵禁')],{speed:200}),
          opp:h.unit('E',20000,[h.wait()],{extra:{
            battleStatuses:poisoned?{'中毒':3,'狂暴':3}:{'狂暴':3},
            effects:(poisoned?['中毒','狂暴']:['狂暴']).map(id=>({id,name:id,duration:3})),
          }}),
        });
        assert.equal(Number(result.state[`${other}RegistryState`].attackSkillInvalidTurns||0)>0,poisoned,result.logs.join('\n'));
        assert.ok(h.statuses(result.opp).includes('感染'),result.logs.join('\n'));
        assert.ok(h.statuses(result.opp).includes('狂暴'),`轉化不解除其他異常：${JSON.stringify(result.opp.battleStatuses)}\n${result.logs.join('\n')}`);
        assert.ok(!h.statuses(result.opp).includes('中毒'));
      }
    });
    await check(`${side} 目瘴淵禁：下3回合吸取不提前生效，滿3回合後停止`,async()=>{
      const guard=h.kitSkill('吸取觀察防護',[
        {op:'immune_status_turns',p:{turns:6,cls:'',reflect:false}},
        {op:'dmg_mod_turns',p:{side:'self',dir:'in',kind:'百分比',reduce:.5,turns:6}},
      ],{priority:6});
      const history=await h.play(side,{
        self:h.unit('S',20000,[h.find('5009','目瘴淵禁'),h.wait()],{speed:200}),
        opp:h.unit('E',60000,[guard]), turns:(_,turn)=>[turn===1?0:1,0],
      },5);
      // 對手免疫異常、百分比减傷50%，避免異常扣血或第3次吸取即死亡遮掉到期情境。
      assert.deepEqual(history.map(result=>result.opp.currentHp),[60000,50000,40000,30000,30000],history[4].logs.join('\n'));
    });
    await check(`${side} 寒夜未央：對手下降時全屬性+2；吸取即時低血翻倍`,async()=>{
      for(const hp of [4999,5000]){
        const [result]=await h.play(side,{
          self:h.unit('S',hp,[h.find('5013','寒夜未央')],{maxHp:10000,speed:200}),
          opp:h.unit('E',24000,[h.wait()],{statStages:{atk:-1}}),
        });
        assert.equal(result.self.statStages.atk,2,result.logs.join('\n'));
        assert.equal(result.opp.currentHp,hp===4999?8000:16000,result.logs.join('\n'));
      }
    });
    await check(`${side} 背隳誓盟：使用時按特攻和速度40%附加，4回合到期不外溢`,async()=>{
      const history=await h.play(side,{
        self:h.unit('S',20000,[h.find('5034','背隳誓盟'),h.wait()]),
        opp:h.unit('E',20000,[h.wait()]),turns:(_,turn)=>[turn===1?0:1,0],
      },5);
      assert.deepEqual(history.map(result=>result.opp.currentHp),[19840,19680,19520,19360,19360]);
    });
    await check(`${side} 無盡入侵：只反彈本次致命傷害、2回合到期、下2回合受傷提升獨立起算`, async () => {
      const skill = h.find('5024', '無盡入侵');
      const critical = h.kitSkill('致命攻擊', [{ op: 'crit_uses', p: { uses: 1, scope: 'elf' } }], { category: '物理', power: 500 });
      const history = await h.play(side, {
        self: h.unit('S', 20000, [skill, h.wait()], { speed: 200 }), opp: h.unit('E', 20000, [critical]),
        turns: (_, turn) => [turn === 1 ? 0 : 1, 0],
      }, 3);
      assert.deepEqual(history.slice(0, 2).map(result => result.self.currentHp), [19740, 19480]);
      assert.deepEqual(history.map(result => result.opp.currentHp), [19740, 19090, 19090]);
      assert.ok(history[2].self.currentHp < 19220, '第3回合260點上限已到期');
      const normal = await h.play(side, {
        self: h.unit('S', 20000, [skill], { speed: 200 }), opp: h.unit('E', 20000, [{ ...strike(), power: 500 }]),
      });
      assert.equal(normal[0].opp.currentHp, 20000, '普通攻擊不觸發致命反彈');
    });
    await check(`${side} 反彈保留攻擊傷害分類，仍受原攻擊者的10點攻擊上限約束`, async () => {
      const skill = h.find('5024', '無盡入侵');
      const guardedCrit = h.kitSkill('有防護的致命攻擊', [
        { op: 'crit_uses', p: { uses: 1, scope: 'elf' } },
        { op: 'damage_cap_turns', p: { side: 'self', dir: 'in', kind: '攻擊', cap: 10, turns: 1 } },
      ], { category: '物理', power: 500 });
      const [result] = await h.play(side, {
        self: h.unit('S', 20000, [skill], { speed: 200, type: '草' }),
        opp: h.unit('E', 20000, [guardedCrit], { type: '水' }),
      });
      assert.equal(result.self.currentHp, 19740);
      assert.equal(result.opp.currentHp, 19990, result.logs.join('\n'));
    });
    await check(`${side} 噬心毒蝕：199點必定先手、200點不成立；不借用原持有者魂印`, async () => {
      const skill = { ...h.find('5018', '王.噬心毒蝕'), power: 0, category: '屬性' };
      for (const hp of [199, 200]) {
        const [result] = await h.play(side, {
          self: h.unit('S', hp, [skill], { maxHp: 10000, speed: 20 }),
          opp: h.unit('E', 20000, [{ ...strike(), priority: 6, power: 1 }], { speed: 500 }),
        });
        const selfMove = result.logs.findIndex((line: string) => line.includes('【S】使用了【王.噬心毒蝕】'));
        const oppMove = result.logs.findIndex((line: string) => line.includes('【E】使用了【實際攻擊】'));
        assert.ok(selfMove >= 0 && oppMove >= 0, result.logs.join('\n'));
        assert.equal(selfMove < oppMove, hp === 199, result.logs.join('\n'));
      }
    });
    await check(`${side} 使用時快照兩份同額傷害仍各結算一次；不計入主傷害、不外溢下一招`, async () => {
      const skill = { ...h.find('5018', '王.噬心毒蝕'), power: 0, category: '屬性' };
      const history = await h.play(side, {
        self: h.unit('S', 6000, [skill, h.wait()], { maxHp: 10000 }),
        opp: h.unit('E', 16000, [h.wait()], { maxHp: 20000 }),
        turns: (_, turn) => [turn === 1 ? 0 : 1, 0],
      }, 2);
      assert.deepEqual(history.map(result => result.opp.currentHp), [12000, 12000]);
      assert.equal(history[0].self.currentHp, 6000);
    });
    await check(`${side} 四象崩壞砲：消強成功才有3點上限；2回合無效及3回合上限各自到期`, async () => {
      const skill = h.find('5026', '四象崩壞砲');
      const run = (up: boolean) => h.play(side, {
        self: h.unit('S', 20000, [skill, h.wait()], { speed: 200 }),
        opp: h.unit('E', 20000, [strike()], { statStages: up ? { atk: 1 } : {} }),
        turns: (_, turn) => [turn === 1 ? 0 : 1, 0],
      }, 4);
      const history = await run(true), noBoost = await run(false);
      assert.deepEqual(history.slice(0, 3).map(r => r.self.currentHp), [20000, 20000, 19997]);
      assert.ok(history[3].self.currentHp < history[2].self.currentHp - 3);
      assert.ok(noBoost[2].self.currentHp < 19997);
      assert.equal(history[0].self.statStages.atk, 1); assert.equal(history[0].opp.statStages.atk || 0, 0);
    });
    await check(`${side} 四象靈獸：兩次技能屬性受傷各回饋雙防65%；固定傷害不消耗`, async () => {
      const skill = { ...h.find('5030', '四象靈獸'), power: 0, category: '屬性' };
      const typed = h.kitSkill('屬性傷害', [{ op: 'dmg', p: { flat: 20, type: '技能', elem: '普通' } }]);
      const fixed = h.kitSkill('固定傷害', [{ op: 'dmg', p: { flat: 20, type: '固定' } }]);
      const history = await h.play(side, {
        self: h.unit('S', 20000, [skill, h.wait()]), opp: h.unit('E', 20000, [fixed, typed]),
        turns: (_, turn) => [turn === 1 ? 0 : 1, turn === 1 ? 0 : 1],
      }, 4);
      assert.deepEqual(history.map(r => r.opp.currentHp), [20000, 19610, 19220, 19220]);
    });
    await check(`${side} 排山倒海：穿過攻擊免疫與護盾、僅回血一次；冰封失敗先制-2`, async () => {
      const skill = { ...h.find('5010', '星光·排山倒海'), isSureHit: true };
      const guard = h.kitSkill('防護', [
        { op: 'immune_attack_count', p: { count: 1 } }, { op: 'shield', p: { flat: 5000 } },
        { op: 'immune_status_turns', p: { turns: 3, reflect: false, cls: '' } },
      ], { priority: 6 });
      const history = await h.play(side, {
        self: h.unit('S', 5000, [h.wait(), skill], { maxHp: 20000 }),
        opp: h.unit('E', 20000, [guard, h.wait()]),
        turns: (_, turn) => turn === 1 ? [0, 0] : [1, 1],
      }, 2);
      const result = history[1], damage = 20000 - result.opp.currentHp;
      assert.ok(damage > 0, result.logs.join('\n')); assert.equal(result.opp.shield, 5000);
      assert.equal(result.self.currentHp, 5000 + Math.floor(damage * .5));
      const other = side === 'p1' ? 'p2' : 'p1';
      const priorityTimer = result.state[`${other}Timers`].find((timer: any) => timer.payload?.block?.prio === -2);
      assert.ok(priorityTimer, '對手先制應由獨立計時器保存，不覆寫對手自身先制');
      assert.equal(priorityTimer.remaining, 2);
      assert.ok(!h.statuses(result.opp).includes('冰封'));
    });
  }
  console.log(`接續技能：${checks}項通過（P1/P2正式引擎及Blockly；未授予全定義語意驗收）`);
} finally { await h.close(); }
