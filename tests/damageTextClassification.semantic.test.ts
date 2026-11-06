import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {createServer} from 'vite';
import {classifyDamagePhrase, damagePhraseProblems, damageTextProblems, extractDamagePhrases, OP_TYPE_TO_TEXT_CLASS} from '../src/battle/damageTextClass';

/**
 * 傷害文字分類稽核（2026-11-06 擁有者確認的規則，見 src/battle/damageTextClass.ts）：
 *  1. 全部精靈描述（魂印／特性／異能特質／技能／技能庫）與積木詞條原文：
 *     固定傷害須有固定數值（或「以…形式」）；百分比傷害須是比例／分數或由比例衍生的「等量」；
 *     X系傷害一律寫成「X系技能傷害」。
 *  2. 積木 dmg／dmg_equal／dmg_from_last 的 type 必須與同一詞條原文的傷害種類一致；
 *     X系技能傷害必須實作為 type 技能＋elem。
 *  3. 攻擊技能同一次使用附加的「X系技能傷害」（不經額外行動／計時器）必須與攻擊傷害各自結算後合併同一擊（appendToAttack）。
 *  4. 原始碼文字來源（TXT、描述 JSON、profile／registry、corrupted Rey）不得殘留「X系傷害」。
 */
let checks = 0;
const ok = (condition: unknown, message: string) => { assert.ok(condition, message); checks++; };

// ───────── 分類器單元（擁有者決策逐條）─────────
const cls = (t: string) => classifyDamagePhrase(t);
assert.equal(cls('附加對手300點固定傷害'), 'fixed');
assert.equal(cls('附加對手最大體力1/4百分比傷害'), 'percent');
assert.equal(cls('附加光系技能傷害'), 'typed_skill');
assert.equal(cls('附加300點真實傷害'), 'true');
assert.equal(cls('造成攻擊傷害提升'), 'attack');
assert.equal(cls('對方所受技能傷害1/4會以固定傷害形式反彈給自己'), 'form');
assert.equal(cls('沒有傷害詞'), null);
const problems = (t: string, previous = '') => extractDamagePhrases(t).flatMap(p => damagePhraseProblems(p, previous));
// 合規
for (const text of ['附加對手300點固定傷害', '每次攻擊5%附加20點固定傷害', '每有1級能力下降附加60點固定傷害', '已損失PP值*10點固定傷害', '附加對手敵我雙方能力等級*30的固定傷害',
  '對方所受技能傷害1/4會以固定傷害形式反彈給自己', '持有者造成的固定傷害減半', '免疫受到的固定傷害、百分比傷害', '受到的固定傷害、百分比傷害不超過66',
  '固定傷害翻倍', '附加對手最大體力1/4百分比傷害', '恢復自身最大體力1/3並附加等量百分比傷害', '附加自身最大體力與速度之和25%的百分比傷害',
  '附加該次攻擊傷害 100% 的百分比傷害', '恢復自身最大體力的 1/1，自身體力低於 1/2 時造成等量百分比傷害', '附加等同雙方被消除護盾與護罩總值的固定傷害',
  '附加自身最大體力50%的電.暗影系技能傷害', '最大體力⅓的光系技能傷害', '造成等量戰鬥系技能傷害', '直接附加對手300點遠古系技能傷害', '若對手免疫百分比傷害，則附加250點真實傷害'])
  assert.deepEqual(problems(text), [], text);
// 違規（舊寫法）
assert.match(problems('對手體力高於自身時附加對手最大體力1/4固定傷害')[0], /不得以比例/);
assert.match(problems('恢復自身最大體力1/3並附加等量固定傷害')[0], /百分比傷害/);
assert.match(problems('恢復自身最大體力的 1/1，自身體力低於 1/2 時造成等量固定傷害')[0], /百分比傷害/);
assert.match(problems('恢復自身最大體力的1/3並造成等量百分比傷害')[0] ?? '', /^$/);
assert.match(problems('恢復300點體力並造成等量百分比傷害')[0], /固定傷害/);
assert.match(problems('附加300點百分比傷害')[0], /固定傷害/);
assert.match(problems('附加自身最大體力50%的電.暗影系傷害')[0], /電\.暗影系技能傷害/);
assert.match(problems('額外造成對方等同於最大體力⅓的光系傷害')[0], /光系技能傷害/);
assert.match(problems('每條龍額外造成150點龍系直接傷害')[0], /龍系技能傷害/);
assert.match(problems('造成等量戰鬥系傷害')[0], /戰鬥系技能傷害/);
assert.match(damageTextProblems('4回合內每回合恢復自身最大體力的1/3並造成等量固定傷害\n  > 自身體力低於1/2時恢復效果和百分比傷害翻倍')[0].problems[0], /百分比傷害/);
checks += 40;

const root = new URL('../', import.meta.url).pathname;
const server = await createServer({server: {middlewareMode: true, hmr: false, watch: null}, appType: 'custom', logLevel: 'silent'});
try {
  const m = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  await m.loadImportedElves();
  const elves: any[] = m.DEFAULT_ELVES;
  ok(elves.length >= 47, '含延後載入的競技場／匯入精靈');

  // ───────── 1. 描述與積木原文 ─────────
  type Def = {elf: any; label: string; description: string; kit: any[]; category?: string};
  const defs: Def[] = [];
  const traitLists = (e: any) => {
    const a = e.alienTraits || {};
    return [['trait', e.trait], ...Object.entries(a).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((t: any) => [`alien.${k}`, t]))] as [string, any][];
  };
  for (const e of elves) {
    if (e.soulMark) defs.push({elf: e, label: `魂印「${e.soulMark.name}」`, description: e.soulMark.description || '', kit: e.soulMark.kit || []});
    for (const [k, t] of traitLists(e)) if (t && typeof t === 'object') defs.push({elf: e, label: `${k}「${t.name}」`, description: t.description || '', kit: t.kit || []});
    for (const s of [...(e.skills || []), ...(e.skillPool || [])]) defs.push({elf: e, label: `技能「${s.name}」`, description: s.description || '', kit: s.kit || [], category: s.category});
    if (e.kit?.length) defs.push({elf: e, label: 'elf.kit', description: '', kit: e.kit});
  }
  const walk = (x: any, cb: (node: any, ancestors: string[]) => void, anc: string[] = []) => {
    if (Array.isArray(x)) return x.forEach(v => walk(v, cb, anc));
    if (!x || typeof x !== 'object') return;
    cb(x, anc);
    const next = typeof x.op === 'string' ? [...anc, x.op] : anc;
    for (const v of Object.values(x)) walk(v, cb, next);
  };
  const issues: string[] = [];
  const seen = new Set<string>();
  const report = (id: string, label: string, text: string, list: {phrase: any; problems: string[]}[]) => {
    for (const {phrase, problems} of list) {
      const key = `${id}|${label}|${phrase.text}|${text.slice(Math.max(0, phrase.index - 12), phrase.index + 12)}|${problems[0]}`;
      if (seen.has(key)) continue; seen.add(key);
      issues.push(`${id} ${label}：${problems[0]} ⇐ …${text.slice(Math.max(0, phrase.index - 20), phrase.index + phrase.text.length)}`);
    }
  };
  for (const d of defs) {
    report(d.elf.id, d.label, d.description, damageTextProblems(d.description)); checks++;
    const kitTexts = new Set<string>();
    for (const entry of d.kit) {
      if (typeof entry.customText === 'string') kitTexts.add(entry.customText);
      if (typeof entry.params?.clause?.raw === 'string') kitTexts.add(entry.params.clause.raw);
    }
    for (const text of kitTexts) { report(d.elf.id, `${d.label}詞條`, text, damageTextProblems(text)); checks++; }
  }
  assert.deepEqual(issues, [], `傷害文字寫法問題 ${issues.length} 項：\n${issues.join('\n')}`);

  // ───────── 2. 積木實作 type 與原文一致 ─────────
  const typedOps = new Set(['dmg', 'dmg_equal', 'dmg_from_last']);
  const mismatches: string[] = [];
  let typedClauses = 0;
  for (const d of defs) {
    for (const entry of d.kit) {
      const text = [entry.customText, entry.params?.clause?.raw].filter((t): t is string => typeof t === 'string').join('\n');
      if (!text) continue;
      // 「全部詞」含只提到種類的（受到固定傷害、百分比傷害…）；「數量詞」只含實際給出數量的。
      const damaging = extractDamagePhrases(text).filter(p => ['fixed', 'form', 'percent', 'true', 'typed_skill'].includes(p.cls));
      const phrases = damaging.filter(p => !p.mention);
      const norm = (p: {cls: string}) => (p.cls === 'form' ? 'fixed' : p.cls);
      const allClasses = new Set(damaging.map(norm)), textClasses = new Set(phrases.map(norm));
      if (!allClasses.size) continue; // 摘要式標籤（「附加300點傷害」「受到最大體力真傷」）沒有寫出傷害種類，不構成矛盾
      const ops: any[] = [];
      walk(entry.params, node => { if (typeof node.op === 'string' && typedOps.has(node.op) && typeof node.p?.type === 'string' && OP_TYPE_TO_TEXT_CLASS[node.p.type]) ops.push(node); });
      if (!ops.length) continue;
      typedClauses++;
      const opClasses = new Set(ops.map(o => OP_TYPE_TO_TEXT_CLASS[o.p.type]));
      const where = `${d.elf.id} ${d.label} ⇐ ${text.replace(/\n/g, ' ').slice(0, 70)}`;
      for (const o of ops) {
        const c = OP_TYPE_TO_TEXT_CLASS[o.p.type];
        if (!allClasses.has(c)) mismatches.push(`${where}：實作 ${o.op}:${o.p.type} 但原文的傷害種類是 ${[...allClasses].join('／')}`);
        if (c === 'typed_skill') {
          if (!o.p.elem) mismatches.push(`${where}：X系技能傷害實作缺少 elem`);
          else if (!phrases.some(p => p.cls === 'typed_skill' && normalizeElem(p.elem!).endsWith(normalizeElem(o.p.elem))) && !/次元龍|技能屬性|最高/.test(String(o.p.elem))) {
            // 屬性字串可能是技能自身屬性（elem 取 s.type，例如「電.暗影」）；原文寫的元素必須是它的結尾。
            mismatches.push(`${where}：原文屬性與實作 elem「${o.p.elem}」不符`);
          }
        }
      }
      if (allClasses.size === 1 && opClasses.size > 1) mismatches.push(`${where}：原文只有一種傷害，實作卻混用 ${[...opClasses].join('／')}`);
      else if (allClasses.size === 1 && opClasses.size === 1 && [...allClasses][0] !== [...opClasses][0]) mismatches.push(`${where}：實作 ${[...opClasses][0]} ≠ 原文 ${[...allClasses][0]}`);
    }
  }
  assert.deepEqual(mismatches, [], `積木傷害種類與原文不一致 ${mismatches.length} 項：\n${mismatches.join('\n')}`);
  ok(typedClauses > 100, `掃描 ${typedClauses} 個含傷害積木的詞條`);

  // ───────── 3. 攻擊技能同次附加的 X系技能傷害：與攻擊獨立結算後合併同一擊 ─────────
  const NESTED = new Set(['timed', 'timed_uses', 'queue_extra_action', 'watch', 'deferred', 'delayed', 'effect_end_watch']);
  const unmerged: string[] = [];
  const merged: string[] = [];
  for (const e of elves) for (const s of [...(e.skills || []), ...(e.skillPool || [])]) {
    if (s.category === '屬性') continue; // 屬性技能沒有攻擊傷害可合併，維持獨立技能傷害
    for (const entry of s.kit || []) walk(entry.params, (node, anc) => {
      if (node.op !== 'dmg' || node.p?.type !== '技能' || anc.some(a => NESTED.has(a))) return;
      (node.p.appendToAttack === true ? merged : unmerged).push(`${e.id}/${s.name}`);
    });
  }
  assert.deepEqual(unmerged, [], `攻擊技能同次附加的技能傷害必須 appendToAttack：${unmerged.join('、')}`);
  assert.ok(merged.includes('5021/神懺福音之章'), '5021 神懺福音之章的次元龍系技能傷害與攻擊合併同一擊');
  const poem = elves.find(e => String(e.id) === '5021').skills.find((s: any) => s.name === '告命詩途');
  assert.equal(poem.category, '屬性', '告命詩途是屬性技能：次元龍系技能傷害維持獨立結算（appendToAttack 對屬性技能不合併）');
  checks += 3;

  // ───────── 4. 原始碼文字來源 ─────────
  const files: string[] = [];
  const collect = (dir: string, accept: (f: string) => boolean) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`, st = statSync(join(root, rel));
      if (st.isDirectory()) collect(rel, accept); else if (accept(rel)) files.push(rel);
    }
  };
  collect('elf_source_files', f => f.endsWith('.txt'));
  collect('src/data', f => /\.(ts|json)$/.test(f) && !/(codex|blockLibrary|block_templates|legacy|reviewedKits|descriptions\.compressed|skillReferences|\/imported\/)/.test(f));
  collect('src/effects/elves', f => f.endsWith('.ts'));
  files.push('src/effects/abilityRegistry.ts', 'docs/spirit-arena/heavyweights.json');
  // 只提到「受到的火系傷害」的減傷說明（elementDamageReduction），不是技能傷害的輸出文字。
  const allow = [/本方受到的火系傷害減半/];
  const stray: string[] = [];
  for (const f of files) {
    const text = readFileSync(join(root, f), 'utf8');
    for (const mm of text.matchAll(/[一-鿿.·・]{1,8}系(?:直接)?傷害/g)) {
      const line = text.slice(text.lastIndexOf('\n', mm.index) + 1, text.indexOf('\n', mm.index));
      if (allow.some(a => a.test(line))) continue;
      stray.push(`${f}：${mm[0]}`);
    }
    checks++;
  }
  assert.deepEqual([...new Set(stray)], [], '原始碼文字來源不得殘留「X系傷害」（須寫成「X系技能傷害」）');
  console.log(`傷害文字分類稽核：${checks} 項通過（描述／詞條 ${defs.length} 組定義、${typedClauses} 個含傷害積木詞條、${merged.length} 個合併攻擊技能傷害）`);
} finally { await server.close(); }

function normalizeElem(s: string) { return s.replace(/[.·・\s]/g, ''); }
