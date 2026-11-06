import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';

/**
 * 2026-11-06 傷害分類／5021 改名：舊存檔（07ac2c4 的內建定義）必須自動升級。
 * fixture 由 07ac2c4 的 DEFAULT_ELVES 傾印（含當時 builtinEffectBindings 基準），不是以目前資料倒推。
 * 兩條路徑都驗證：
 *   A. 存檔帶基準指紋（builtinEffectBindings）→ 三方比較升級；
 *   B. 存檔沒有基準 → 靠 legacyBuiltinSignatures.json（scripts/generate_legacy_builtin_signatures.ts 產生）認領。
 */
const old: any[] = JSON.parse(readFileSync(new URL('./fixtures/savedBuiltinBeforeDamageTyping.07ac2c4.json', import.meta.url), 'utf8'));
const server = await createServer({server: {middlewareMode: true, hmr: false, watch: null}, appType: 'custom', logLevel: 'silent'});
try {
  const {DEFAULT_ELVES: defaults} = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {applySavedSkillCorrections: correct} = await server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
  const {canonicalElfName, upgradeLegacyElfName} = await server.ssrLoadModule('/src/data/legacyElfNames.ts');
  const {prepareSavedBattleRoster} = await server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
  const {repairSavedBuiltinStorage} = await server.ssrLoadModule('/src/data/savedBuiltinStorage.ts');
  const {soulDefinition} = await server.ssrLoadModule('/src/effects/soulDefinitionSource.ts');
  const stable = (v: unknown) => JSON.stringify(v);
  const canonical = (id: string) => defaults.find((e: any) => String(e.id) === id);
  const defs = (elf: any) => [...elf.skills, ...(elf.skillPool || [])];
  /**
   * 本次有改文字／實作的定義：fixture 是 07ac2c4 的凍結資料，與目前內建不同的定義就是本次改動（不手寫名單，避免漏掉）。
   * 另外釘住必須包含的已知項目，避免 fixture 被換成與現況相同而空轉。
   */
  const changedSkills: Record<string, string[]> = {};
  const changedSouls: string[] = [];
  for (const o of old) {
    const now = canonical(String(o.id));
    for (const s of defs(o)) {
      const c = defs(now).find((x: any) => x.name === s.name);
      if (c && (c.description !== s.description || JSON.stringify(c.kit) !== JSON.stringify(s.kit))) (changedSkills[String(o.id)] ??= []).push(s.name);
    }
    if (o.soulMark.description !== now.soulMark.description || JSON.stringify(soulDefinition(o).kit) !== JSON.stringify(soulDefinition(now).kit)) changedSouls.push(String(o.id));
  }
  const expectChanged: Record<string, string[]> = {'5003': ['萬鈞鎮魂', '殘軀鎖命'], '5004': ['千鳥俱寂'], '5010': ['星光·水天一色'], '5011': ['星光·粉末擊打'], '5031': ['禁靈領域'],
    '5021': ['神懺福音之章'], '7070': ['暗蝕雷驅'], '707070': ['魔化雷驅'], arena_16: ['挨打要立正']};
  for (const [id, names] of Object.entries(expectChanged)) for (const n of names) assert.ok(changedSkills[id]?.includes(n), `${id}/${n} 應有改動`);
  for (const id of ['5014', '5021', 'arena_16']) assert.ok(changedSouls.includes(id), `${id} 魂印應有改動`);
  // 舊 fixture 確實是舊文字（保證測試不是空轉）。
  const oldText = (id: string, name: string) => defs(old.find(e => String(e.id) === id)).find((s: any) => s.name === name).description;
  assert.match(oldText('5003', '萬鈞鎮魂'), /最大體力1\/4固定傷害/);
  assert.match(oldText('5004', '千鳥俱寂'), /等量固定傷害/);
  assert.match(oldText('5010', '星光·水天一色'), /等量固定傷害/);
  assert.match(oldText('5031', '禁靈領域'), /等量固定傷害[\s\S]*固定傷害翻倍/);
  assert.match(oldText('5003', '殘軀鎖命'), /等量戰鬥系傷害/);
  assert.match(oldText('7070', '暗蝕雷驅'), /系傷害/);
  assert.match(oldText('707070', '魔化雷驅'), /系傷害/);
  assert.match(old.find(e => String(e.id) === '5014').soulMark.description, /光系傷害/);
  assert.equal(old.find(e => String(e.id) === '5021').name, '治癒.龍魂再臨 次元龍');

  let checks = 0;
  for (const withBaseline of [true, false]) {
    for (const source of old) {
      const id = String(source.id), saved = structuredClone(source);
      if (!withBaseline) delete saved.builtinEffectBindings;
      saved.battleId = 'saved-instance'; saved.currentHp = 77;
      const before = structuredClone(saved);
      const fixed = correct(saved, defaults), now = canonical(id);
      assert.deepEqual(saved, before, '不原地修改存檔');
      assert.equal(fixed.name, now.name, `${id} 名稱升級`);
      assert.equal(fixed.battleId, 'saved-instance'); assert.equal(fixed.currentHp, 77);
      for (const name of changedSkills[id] || []) {
        const got = defs(fixed).find((s: any) => s.name === name), want = defs(now).find((s: any) => s.name === name);
        assert.equal(got.description, want.description, `${id}/${name} 文字升級（${withBaseline ? '有' : '無'}基準）`);
        assert.equal(stable(got.kit), stable(want.kit), `${id}/${name} 積木升級`);
      }
      if (changedSouls.includes(id)) {
        assert.equal(fixed.soulMark.description, now.soulMark.description, `${id} 魂印文字升級`);
        assert.equal(stable(soulDefinition(fixed).kit), stable(soulDefinition(now).kit), `${id} 魂印積木升級`);
      }
      assert.equal(correct(fixed, defaults), fixed, `${id} 冪等`); checks += 3;

      // 玩家改過的定義不得被覆蓋。
      for (const name of changedSkills[id] || []) {
        const edited = structuredClone(saved);
        const target = defs(edited).find((s: any) => s.name === name); target.description += '（玩家自訂）';
        const out = correct(edited, defaults);
        assert.equal(defs(out).find((s: any) => s.name === name).description, target.description, `${id}/${name} 玩家改過的文字必須保留`);
        checks++;
      }
    }
  }

  // 5021：舊名稱兩種分隔符＋空白寫法都升級；自訂精靈與 id 不符者不動。
  for (const legacy of ['治癒.龍魂再臨 次元龍', '治癒·龍魂再臨 次元龍', '治癒.龍魂再臨', '治癒龍魂再臨次元龍', '治癒·龍魂再臨']) {
    assert.equal(canonicalElfName(legacy), '治癒·龍魂再臨', legacy);
  }
  assert.equal(canonicalElfName('星光·魯斯王'), '星光·魯斯王');
  assert.equal(canonicalElfName(undefined), undefined);
  const dragon = old.find(e => String(e.id) === '5021');
  for (const legacy of ['治癒.龍魂再臨 次元龍', '治癒·龍魂再臨 次元龍']) {
    const saved = {...structuredClone(dragon), name: legacy}; delete saved.builtinEffectBindings;
    assert.equal(correct(saved, defaults).name, '治癒·龍魂再臨');
    assert.equal(stable(soulDefinition(correct(saved, defaults)).kit), stable(soulDefinition(canonical('5021')).kit));
    checks += 2;
  }
  const custom = {...structuredClone(dragon), id: 'custom_9', isCustom: true};
  assert.equal(upgradeLegacyElfName(custom), custom, '自訂精靈同名也不改名');
  assert.equal(upgradeLegacyElfName({...structuredClone(dragon), id: '5001'}).name, dragon.name, 'id 不符不改名');
  const current = canonical('5021');
  assert.equal(upgradeLegacyElfName(current), current, '已是正式名稱不重建物件');

  // 隊伍／背包預設在存檔裡只存舊物件：整條載入路徑（修復儲存、組隊）都要升級。
  const roster = prepareSavedBattleRoster([structuredClone(dragon)], defaults.filter((e: any) => String(e.id) !== '5021'), false, 'p1');
  assert.equal(roster[0].name, '治癒·龍魂再臨', '倉庫缺該精靈時直接以存檔升級');
  const roster2 = prepareSavedBattleRoster([{...structuredClone(dragon), id: 'x_old'}], defaults, false, 'p1');
  assert.equal(roster2[0].id, '5021', '以舊名稱找倉庫內建版本（名稱別名）');
  const store: Record<string, string> = {
    seer_p1_backpack_presets: JSON.stringify([{name: 'preset', team: [structuredClone(dragon)]}]),
    seer_default_elves_overrides: JSON.stringify({'5021': structuredClone(dragon)}),
    seer_last_used_p1_team: JSON.stringify([structuredClone(dragon), structuredClone(old.find(e => String(e.id) === '5004'))]),
  };
  const storage = {getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }};
  const report = repairSavedBuiltinStorage(storage, defaults);
  assert.ok(report.every((r: any) => r.status === 'repaired'), JSON.stringify(report));
  assert.equal(JSON.parse(store.seer_p1_backpack_presets)[0].team[0].name, '治癒·龍魂再臨');
  assert.equal(JSON.parse(store.seer_default_elves_overrides)['5021'].name, '治癒·龍魂再臨');
  const team = JSON.parse(store.seer_last_used_p1_team);
  assert.equal(team[0].name, '治癒·龍魂再臨');
  assert.equal(team[1].skills.find((s: any) => s.name === '千鳥俱寂').description, canonical('5004').skills.find((s: any) => s.name === '千鳥俱寂').description);
  checks += 6;
  console.log(`傷害分類／5021改名舊存檔升級：${checks} 項通過（有基準／無基準／玩家自訂保護／冪等／名稱別名／儲存修復）`);
} finally { await server.close(); }
