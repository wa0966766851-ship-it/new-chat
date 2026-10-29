/**
 * 賽爾號 BWIKI（MediaWiki API）原始資料 → 本專案精靈資料（繁體）。
 *
 * 取得原始資料（雲端環境無法連到 BWIKI，需在使用者瀏覽器以同源 fetch 呼叫 API）：
 *   /seer/api.php?action=query&prop=revisions&rvprop=content|ids|timestamp&rvslots=main&format=json&titles=精灵:<ID>|技能:<ID>…|魂印:<ID>
 *   存成 docs/data/seer-wiki/<ID>.raw.json（保留 revid／timestamp 以便日後比對原文是否更新）。
 *
 * 轉換：
 *   node --import tsx scripts/import_seer_wiki.ts docs/data/seer-wiki/4937.raw.json docs/data/seerapi/4937.raw.json > src/data/imported/wiki_4937.json
 * 簡轉繁使用 opencc-js（cn → tw）。專案未列為依賴：執行前 `npm i --no-save opencc-js@1.0.5`，
 * 或設定 NODE_PATH 指到已安裝的位置。輸出檔只含資料，不含任何程式或 handler。
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

type Page = { title: string; revid?: number; timestamp?: string; wikitext: string | null };
type Raw = { source: string; fetchedAt: string; elf: Page; others: Page[] };

const require_ = createRequire(import.meta.url);
let toTw: (s: string) => string;
// opencc 對遊戲術語的誤轉（例：「先制為0」→「先製為0」），轉換後修正
const TERM_FIXES: [RegExp, string][] = [[/先製/g, '先制']];
try { const O = require_('opencc-js'); const c = O.Converter({ from: 'cn', to: 'tw' }); toTw = (s: string) => TERM_FIXES.reduce((t, [re, to]) => t.replace(re, to), c(s)); }
catch { console.error('需要 opencc-js：npm i --no-save opencc-js@1.0.5（或設定 NODE_PATH）'); process.exit(2); }

/** 解析 {{模板 |鍵=值 …}}（值為單行） */
export function templateFields(wikitext: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of wikitext.split('\n')) { const m = line.match(/^\|([^=]+)=(.*)$/); if (m) out[m[1].trim()] = m[2].trim(); }
  return out;
}
const CATEGORY: Record<string, string> = { 物理攻击: '物理', 特殊攻击: '特殊', 属性攻击: '屬性' };
/** 「必中（95%）」→ 必中；「97%」→ 命中率 97 */
function accuracy(text: string): { isSureHit: boolean; accuracy?: number } {
  if (/必中/.test(text)) return { isSureHit: true };
  const n = Number((text.match(/(\d+)%/) || [])[1]);
  return { isSureHit: false, ...(Number.isFinite(n) ? { accuracy: n } : {}) };
}

export function convert(raw: Raw) {
  const e = templateFields(raw.elf.wikitext || '');
  const byTitle = new Map(raw.others.map(p => [p.title, p]));
  const learn = (e['技能'] || '').split(';').filter(Boolean).map(s => { const [id, level, slot] = s.split('-'); return { id, level: Number(level), slot }; });
  const skill = (id: string, slot?: string) => {
    const p = byTitle.get(`技能:${id}`);
    if (!p?.wikitext) throw new Error(`缺少技能:${id}`);
    const f = templateFields(p.wikitext);
    const acc = accuracy(f['命中率'] || '');
    const priority = Number(f['先制'] || 0);
    const effect = toTw((f['技能效果'] || '').replace(/。$/, ''));
    // 逐句一行：技能本體屬性（必中／先制）標 ■；效果句標 🎯（附加效果，可被「附加效果失效」封印）。
    // wiki 不區分固有／附加，一律視為附加——此假設記在目標文件「待確認」。
    const lead = [acc.isSureHit ? '■ 必中' : '', priority ? `■ 先制${priority > 0 ? '+' : ''}${priority}` : ''].filter(Boolean);
    const effects = effect.split('；').map(x => x.trim()).filter(Boolean).map(x => `🎯 ${x}`);
    return {
      name: toTw(f['技能名称']), type: f['技能属性'] ? toTw(f['技能属性']) : '無屬性', category: CATEGORY[f['技能类型']] || '屬性',
      power: Number(f['威力'] || 0), pp: Number(f['次数'] || 0), priority, ...acc,
      ...(slot === '第五' ? { isFifthSkill: true } : {}),
      description: [...lead, ...effects].join('\n') || '無特殊效果',
      effectType: 'none', effectDetail: '',
      source: { wiki: p.title, revid: p.revid, timestamp: p.timestamp, slot: slot || null },
    };
  };
  const soulPage = raw.others.find(p => p.title.startsWith('魂印:'));
  const soul = soulPage?.wikitext ? templateFields(soulPage.wikitext) : null;
  const specials = learn.filter(l => l.slot);
  const order = ['先手', '防御', '强化', '制敌', '第五'];
  const carry = order.map(o => specials.find(s => s.slot === o)).filter(Boolean).slice(0, 5) as typeof learn;
  const stats = { hp: +e['体力'], atk: +e['攻击'], def: +e['防御'], spatk: +e['特攻'], spdef: +e['特防'], speed: +e['速度'] };
  return {
    id: `wiki_${e['ID']}`, seerId: Number(e['ID']), name: toTw(e['名称']), type: toTw(e['属性']), level: 100,
    height: Number(e['身高']) || undefined, weight: Number(e['体重']) || undefined,
    baseStats: stats,
    description: toTw(e['介绍'] || ''),
    soulMark: soul ? { name: '', badgeChar: '', description: toTw((soul['魂印效果'] || '').replace(/<br\s*\/?>/g, '\n').replace(/（boss无效）|\(boss无效\)/gi, '').trim()), effectType: 'none', effectValue: 0,
      source: { wiki: soulPage!.title, revid: soulPage!.revid, timestamp: soulPage!.timestamp } } : undefined,
    skills: carry.map(c => skill(c.id, c.slot)),
    skillPool: learn.map(l => skill(l.id, l.slot)),
    source: { api: raw.source, fetchedAt: raw.fetchedAt, wiki: raw.elf.title, revid: raw.elf.revid, timestamp: raw.elf.timestamp },
  };
}

/**
 * SeerAPI（https://api.seerapi.com/v1，官方 Unity 客戶端資料）覆蓋：魂印與攜帶技能的數值與效果以 SeerAPI 為準。
 * - 每個 skill_effect 一行；analyze_info 帶 [sprite name=iconHit]＝命中後附加效果 → 🎯；必中／先制 → ■。
 * - wiki 只提供攜帶欄位（先手／防御／强化／制敌／第五）與一般技能池。
 */
type SeerApiRaw = { source: string; fetchedAt: string; pet: any; soulmark: any; skills: any[]; types: Record<string, any>; categories: Record<string, any> };
const API_CATEGORY: Record<string, string> = { 物理攻击: '物理', 特殊攻击: '特殊', 属性技能: '屬性' };
export function applySeerApi(elf: any, api: SeerApiRaw) {
  const typeName = (url?: string) => (url && api.types[url]?.name) ? toTw(api.types[url].name) : '無屬性';
  const fromApi = (s: any, base: any) => {
    const lines = [s.must_hit ? '■ 必中' : '', s.priority ? `■ 先制${s.priority > 0 ? '+' : ''}${s.priority}` : '',
      ...s.skill_effect.map((e: any) => `${/\[sprite name=iconHit\]/.test(e.analyze_info || '') ? '🎯 ' : ''}${toTw(String(e.info).replace(/。$/, ''))}`)].filter(Boolean);
    const category = API_CATEGORY[api.categories[s.category.url]?.name] || base.category;
    return { ...base, name: toTw(s.name), category, type: category === '屬性' ? '無屬性' : typeName(s.type?.url), power: s.power, pp: s.max_pp,
      priority: s.priority || 0, isSureHit: !!s.must_hit, ...(s.must_hit ? {} : { accuracy: s.accuracy }), description: lines.join('\n') || '無特殊效果',
      source: { ...base.source, seerapi: `${api.source}/skill/${s.id}`, hash: s.hash, effectIds: s.skill_effect.map((e: any) => e.effect.id) } };
  };
  const byName = new Map(api.skills.map(s => [toTw(s.name), s]));
  const swap = (list: any[]) => list.map(sk => byName.has(sk.name) ? fromApi(byName.get(sk.name), sk) : sk);
  const soulLines = String(api.soulmark.desc).split('|').map(x => x.trim()).filter(x => x && !/^（boss无效）$/.test(x)).map(toTw);
  return { ...elf, skills: swap(elf.skills), skillPool: swap(elf.skillPool),
    soulMark: { ...elf.soulMark, description: soulLines.join('\n'), bossInvalid: /（boss无效）/.test(api.soulmark.desc),
      source: { ...(elf.soulMark?.source || {}), seerapi: `${api.source}/soulmark/${api.soulmark.id}`, hash: api.soulmark.hash } },
    source: { ...elf.source, seerapi: `${api.source}/pet/${api.pet.id}`, seerapiFetchedAt: api.fetchedAt } };
}

if (process.argv[2]) {
  const raw: Raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  let elf: any = convert(raw);
  if (process.argv[3]) elf = applySeerApi(elf, JSON.parse(readFileSync(process.argv[3], 'utf8')));
  process.stdout.write(JSON.stringify(elf, null, 2) + '\n');
}
