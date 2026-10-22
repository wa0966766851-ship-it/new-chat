// 5000 聖靈譜尼 魂印「神」真 Kit 拆解驗收（DSH 20261018 最後衝刺·組 5）。
// 雙側（P1/P2）正式 headless 引擎實戰；合成精靈帶真名與真 soulMark。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import legacySoulKits from '../src/data/legacySoulKitFingerprints.json';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const puni = DEFAULT_ELVES.find((e: any) => String(e.id) === '5000');
  const { MIGRATED_GROUP5_HOLY_PUNI_SOUL_KIT: KIT } = await h.server.ssrLoadModule('/src/data/migratedGroup5HolyPuniSoulKit.ts');
  const { kitEntryIssue } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  assert.equal(puni.soulMark?.name, '神');
  assert.equal(puni.soulMark?.effectMode, 'kit');
  assert.ok(!JSON.stringify(puni.soulMark.kit || []).includes('legacy_handler'), '不得殘留包裝');
  assert.equal(puni.soulMark.description, KIT.description, 'Kit description 與實際載入原文逐字相同');
  assert.deepEqual(puni.soulMark.kit, structuredClone(KIT.kit));
  for (const e of KIT.kit) assert.equal(kitEntryIssue(e), null, 'kitEntryIssue: ' + e.customText);
  for (const k of ['5000', '聖靈譜尼']) assert.ok(!(k in h.S), 'SOUL_MARK_MAPPING 不得殘留：' + k);
  checks++; console.log('OK 5000 魂印「神」已是真 Kit（無包裝、無舊映射、合約全過）');

  const puniUnit = (id: string, hp: number, skills: any[], o: any = {}) => {
    const b = structuredClone(puni);
    b.id = id; b.battleId = id; b.name = '聖靈譜尼'; b.level = 100; b.type = '神靈';
    b.maxHp = o.maxHp ?? hp; b.currentHp = hp;
    b.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    b.calculatedStats = { hp: b.maxHp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    b.skills = skills; b.statStages = o.statStages || {}; b.shield = 0; b.barrier = 0;
    b.soulMark = puni.soulMark;
    return b;
  };
  const hit = (name = '打', power = 100, extra: any = {}) => ({ name, category: '物理', type: '普通', power, pp: 99, maxPp: 99, isSureHit: true, description: '', ...extra });
  const wait = () => h.wait();
  const {applySavedSkillCorrections:correct}=await h.server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
  // 舊背包真的含有頂層描述積木，不能只刪除 soulMark.kit 假裝舊存檔。
  const old = structuredClone(puni);
  delete old.soulMark.kit; delete old.soulMark.effectMode;
  old.kit=structuredClone(legacySoulKits.definitions.find(d=>d.elfId==='5000')!.kit);
  const original=structuredClone(old),fixed=correct(old,[puni]);
  assert.equal(fixed.soulMark.effectMode,'kit','真實舊描述積木必須升級到可執行魂印');
  assert.deepEqual(old,original,'不修改輸入存檔');
  assert.deepEqual(fixed.kit,old.kit,'保留頂層原始資料');
  assert.equal(correct(fixed,[puni]),fixed,'重複修復不重建物件');
  const edited=structuredClone(old);edited.kit[0].params={userChanged:true};
  assert.equal(correct(edited,[puni]).soulMark,edited.soulMark,'改過的頂層積木不可覆寫');
  const explicit=structuredClone(old);explicit.soulMark.effectMode='none';
  assert.equal(correct(explicit,[puni]).soulMark,explicit.soulMark,'明確停用的魂印不可覆寫');

  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    {
      const self = puniUnit('5000',100000,[wait()]);
      self.soulMark=structuredClone(old.soulMark);self.kit=structuredClone(old.kit);
      const inflict=h.kitSkill('沉睡與弱化',[
        {op:'status',p:{side:'opp',status:'沉睡',turns:3,chance:100}},
        {op:'stat',p:{side:'opp',stats:['攻擊','防禦'],v:-2}},
      ]);
      const opp=h.unit('E',90000,[inflict],{maxHp:100000,speed:300});
      const [broken]=await h.play(side,{self:structuredClone(self),opp:structuredClone(opp),turns:()=>[0,0]},1);
      assert.ok(h.statuses(broken.self).includes('沉睡'),'舊頂層描述積木重現免控失效');
      assert.equal(broken.self.statStages.atk,-2,'舊頂層描述積木重現免弱化失效');
      const [repaired]=await h.play(side,{self:correct(self,[puni]),opp,turns:()=>[0,0]},1);
      assert.ok(!h.statuses(repaired.self).includes('沉睡'),side+' 舊背包修復後免沉睡');
      assert.equal(repaired.self.statStages.atk||0,0,side+' 舊背包修復後免弱化');
      checks++;
    }
    // 已有非空 kit 的舊版本也要升級；先前只補缺漏的修復涵蓋不到。
    {
      const previous=structuredClone(puni);
      previous.soulMark.description+=' 舊版本測試';
      previous.soulMark.kit=previous.soulMark.kit.filter((entry:any)=>!['before_status_apply','on_entered'].includes(entry.node));
      const self=puniUnit('5000',100000,[wait()]);self.soulMark=previous.soulMark;
      const linked=correct(self,[previous]);
      assert.ok(linked.builtinEffectBindings,'記錄上次來源');
      const inflict=h.kitSkill('新版防護驗證',[
        {op:'status',p:{side:'opp',status:'沉睡',turns:3,chance:100}},
        {op:'stat',p:{side:'opp',stats:['攻擊','防禦'],v:-2}},
      ]);
      const opp=h.unit('E',90000,[inflict],{maxHp:100000,speed:300});
      const [before]=await h.play(side,{self:structuredClone(linked),opp:structuredClone(opp),turns:()=>[0,0]},1);
      assert.ok(h.statuses(before.self).includes('沉睡'),side+' 有 kit 的舊版重現缺少防護');
      assert.equal(before.self.statStages.atk,-2);
      const upgraded=correct(linked,[puni]);
      const [after]=await h.play(side,{self:upgraded,opp,turns:()=>[0,0]},1);
      assert.ok(!h.statuses(after.self).includes('沉睡'),side+' 來源版本升級後免控');
      assert.equal(after.self.statStages.atk||0,0,side+' 來源版本升級後免弱化');
      checks++;
    }
    // ① 虛無：受到攻擊傷害後，免疫下 1 次受到的攻擊傷害（受傷→免疫→受傷→免疫 交替）
    {
      // 自身最大體力 1e8、體力 20000：每回合「生命」固定回復 25000000，受傷量＝25000000 −（本回合體力淨變化）。
      const self = puniUnit('S', 20000, [wait()], { maxHp: 100000000 });
      const opp = h.unit('E', 1e9, [hit('打', 100)], { maxHp: 1e9, speed: 300 });
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 4);
      const lost = r.map((x, i) => 25000000 - (x.self.currentHp - (i ? r[i - 1].self.currentHp : 20000)));
      assert.ok(lost[0] > 0, side + ' 第1次受傷：' + JSON.stringify(lost));
      assert.equal(lost[1], 0, side + ' 第2次被免疫');
      assert.ok(lost[2] > 0, side + ' 第3次再受傷');
      // 第4回合生命回復已封頂在最大體力（20000+3×25000000+25000000>1e8），改以免疫日誌斷言。
      assert.equal(r[3].logs.filter(l => l.includes('免疫了【打】')).length, 2, side + ' 第2、4次皆被免疫：' + JSON.stringify(lost));
      checks++;
    }
    // ② 元素：登場時消除對手回合類效果，成功則對手下次技能無效；對手沒有回合類效果則不無效
    {
      const bench = puniUnit('Z', 100000, [wait()]);
      const starter = h.unit('P', 100000, [wait(), wait()]);
      const opp = h.unit('E', 50000, [h.turnEffectSkill(), h.healSkill(1000)], { maxHp: 100000 });
      const r = await h.play(side, { self: starter, selfBench: [bench], opp, turns: (_e, t) => t === 1 ? [0, 0] : [{ switch: 1 }, 1] }, 2);
      assert.ok(h.timers(r[0].state, other).some((x: string) => x.startsWith('測試用回合類效果') || x.length), side + ' 第1回合對手有回合類效果：' + h.timers(r[0].state, other).join(','));
      assert.ok(r[1].logs.some(l => l.includes('消除了回合類效果')), side + ' 登場消除回合類效果');
      assert.ok(r[1].logs.some(l => l.includes('技能無效') && l.includes('補')), side + ' 消除成功→對手下次技能無效：' + r[1].logs.slice(-6).join('｜'));
      assert.equal(r[1].opp.currentHp, 50000, side + ' 對手補血被無效');
      checks++;
    }
    {
      const bench = puniUnit('Z', 100000, [wait()]);
      const starter = h.unit('P', 100000, [wait(), wait()]);
      const opp = h.unit('E', 50000, [wait(), h.healSkill(1000)], { maxHp: 100000 });
      const r = await h.play(side, { self: starter, selfBench: [bench], opp, turns: (_e, t) => t === 1 ? [0, 0] : [{ switch: 1 }, 1] }, 2);
      assert.equal(r[1].opp.currentHp, 51000, side + ' 對手無回合類效果→消除失敗→補血照常生效');
      checks++;
    }
    // ③④ 能量＋生命：戰鬥階段結束
    {
      const mk = (pp: number) => ({ ...wait(), name: 'w' + pp, pp, maxPp: 5 });
      const self = puniUnit('S', 60000, [mk(1), mk(3), mk(5)], { maxHp: 100000 });
      const opp = h.unit('E', 90000, [wait()], { maxHp: 100000 });
      const [r] = await h.play(side, { self, opp, turns: () => [2, 0] }, 1);
      assert.equal(r.opp.currentHp, 90000 - 20000, side + ' 能量：已損失體力40000×50%＝20000 百分比傷害');
      assert.equal(r.self.currentHp, 60000 + 25000, side + ' 生命：恢復最大體力1/4（能量取回復前的已損失體力）');
      const pps = r.self.skills.map((s: any) => s.pp);
      assert.equal(pps[0] + pps[1] + pps[2], 1 + 3 + 4 + 2, side + ' 使用第3槽（5→4）後三槽皆未滿，隨機2個各+1：' + JSON.stringify(pps));
      checks++;
    }
    {
      const mk = (n: string, pp: number) => ({ ...wait(), name: n, pp, maxPp: 5 });
      const self = puniUnit('S', 100000, [mk('a', 1), mk('b', 3), mk('c', 2), mk('d', 5), mk('e', 5)], { maxHp: 100000 });
      const opp = h.unit('E', 90000, [wait()], { maxHp: 100000 });
      const [r] = await h.play(side, { self, opp, turns: () => [3, 0] }, 1);
      const pps = r.self.skills.map((s: any) => s.pp);
      // 使用第4槽（5→4）後 a,b,c,d 皆未滿；e 為滿 PP 不得被選中。
      const deltas = [pps[0] - 1, pps[1] - 3, pps[2] - 2, pps[3] - 4];
      assert.equal(deltas.reduce((x, y) => x + y, 0), 2, side + ' 未滿 PP 技能隨機 2 個各 +1（共 +2）：' + JSON.stringify(pps));
      assert.ok(deltas.every(v => v === 0 || v === 1), side + ' 每個最多 +1');
      assert.equal(pps[4], 5, side + ' 滿 PP 技能不動');
      checks++;
    }
    // ⑤ 輪迴：對手出手回合受致命傷害→殘留1點體力，回合結束後體力／PP／能力等級返回選擇操作後狀態；每場限1次
    {
      const raise = h.kitSkill('強化', [{ op: 'stat', p: { side: 'self', stats: ['攻擊'], v: 2 } }], { pp: 4, maxPp: 9 });
      const self = puniUnit('S', 500, [raise], { maxHp: 100000, speed: 100 });
      const lethal = hit('絕殺', 50000, { pp: 99 });
      const opp = h.unit('E', 1e9, [lethal], { maxHp: 1e9, speed: 300 }); // 體力夠大，避免被「能量」百分比傷害打死而提前結束
      // 第2回合受「虛無」免疫（第1次受傷後免疫下1次攻擊），第3回合再次致命傷害才驗證每場僅1次。
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 3);
      assert.ok(r[0].logs.some(l => l.includes('時空倒流')), side + ' 輪迴日誌：' + r[0].logs.join('｜'));
      assert.equal(r[0].self.currentHp, 500, side + ' 回合結束體力返回快照（500）');
      assert.equal(r[0].self.skills[0].pp, 4, side + ' PP 返回快照（4）');
      assert.equal(r[0].self.statStages.atk || 0, 0, side + ' 能力等級返回快照（0）');
      assert.equal(r[2].logs.filter(l => l.includes('時空倒流')).length, 1, side + ' 每場僅1次（全程只倒流1次）');
      assert.equal(r[2].self.currentHp, 0, side + ' 第2次致命傷害不再保護');
      checks++;
    }
    // ⑥ 永恆：體力高於對手→必定先手（即使速度較慢）；低於對手則否
    {
      const first = async (selfHp: number) => {
        const self = puniUnit('S', selfHp, [wait()], { maxHp: 100000, speed: 50 });
        const opp = h.unit('E', 70000, [wait()], { maxHp: 100000, speed: 300 });
        const [r] = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
        const idx = (n: string) => r.logs.findIndex(l => l.includes(n) && l.includes('使用了'));
        return idx('聖靈譜尼') >= 0 && idx('聖靈譜尼') < idx('【E】');
      };
      assert.equal(await first(90000), true, side + ' 體力高於對手→先手');
      assert.equal(await first(50000), false, side + ' 體力低於對手→不先手（速度較慢）');
      checks++;
    }
    // ⑦ 聖潔：天生免疫所有異常狀態與能力下降狀態
    {
      const self = puniUnit('S', 100000, [wait()]);
      const para = h.kitSkill('麻', [{ op: 'status', p: { side: 'opp', status: '麻痺', turns: 3, chance: 100 } }]);
      const drop = h.kitSkill('降', [{ op: 'stat', p: { side: 'opp', stats: ['攻擊', '防禦'], v: -2 } }]);
      const opp = h.unit('E', 90000, [para, drop], { maxHp: 100000, speed: 300 });
      const r = await h.play(side, { self, opp, turns: (_e, t) => [0, t - 1] }, 2);
      assert.ok(!h.statuses(r[0].self).includes('麻痺'), side + ' 免疫麻痺');
      assert.equal(r[1].self.statStages.atk || 0, 0, side + ' 免疫能力下降（攻擊）');
      assert.equal(r[1].self.statStages.def || 0, 0, side + ' 免疫能力下降（防禦）');
      checks++;
    }
    // 天生防護不能被消除回合類效果拿走；雙側、真實結算，不只檢查積木存在。
    {
      const self = puniUnit('S', 100000, [wait()]);
      const clear = h.kitSkill('清回合', [{op:'clear_turn',p:{side:'opp'}}]);
      const inflict = h.kitSkill('沉睡弱化', [
        {op:'status',p:{side:'opp',status:'沉睡',turns:3,chance:100}},
        {op:'stat',p:{side:'opp',stats:['攻擊','防禦'],v:-2}},
      ]);
      const opp = h.unit('E',90000,[clear,inflict],{maxHp:100000,speed:300});
      const r = await h.play(side,{self,opp,turns:(_e,t)=>[0,t===1?0:1]},2);
      assert.ok(!h.statuses(r[1].self).includes('沉睡'),side+' 清回合後仍天生免控');
      assert.equal(r[1].self.statStages.atk||0,0,side+' 清回合後仍天生免弱化');
      checks++;
    }
  }
  console.log('5000 魂印「神」：' + checks + ' 項通過');
} finally { await h.close(); }
