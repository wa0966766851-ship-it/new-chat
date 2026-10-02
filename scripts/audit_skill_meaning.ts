import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import { SOUL_MARK_MAPPING } from '../src/effects/battleEventRegistry';
import { SKILL_MODE, SOUL_MODE } from '../src/blocks/specs';
import { parseSkill } from '../src/blocks/parse';

const handlers = new Map<string, string>();
const files = readdirSync('src/effects').filter(f => f.endsWith('Registry.ts') && f !== 'battleEventRegistry.ts');
const sources = Object.fromEntries(files.map(f => [f, readFileSync(resolve('src/effects', f), 'utf8')]));
// 證據只覆蓋列名行為；不從路由／解析率推定整招通過。
const round2Evidence: Record<string, string[]> = {
  '帝怒傾天': ['雙條件先制', '六能力唯讀視角', '每級30威力', '每級60固定傷害', '固有失效'],
  '鹿台悲歌': ['四層強化翻倍', '按施放前八荒吸取556', '施放後加兩層'],
  '毒噬魂絲': ['真正吸取強化與沉默', '原先無強化分枝', '高／半血體力吸取與回復', '無效補償setter'],
  '王·洛浦凌波': ['反轉自身下降並轉移', '消耗雙方盾罩1000', '威力加1000', '百分比700', '下次技能無效setter'],
  '王·深海之吻': ['消回合成功／失敗', '異常轉化成功／免疫保留', '汲取300', '水／淚百分比與護盾720'],
  '星光·浪打千擊': ['P1/P2真實5／10擊', '逐擊能力更新', '致死停止', '免死／重生續擊', '反擊致死停止', '附加失效'],
  '深潛者盛宴': ['克制延續：屬性與額外行動技能傷害計次、0傷害與粉傷不計次（單元）'],
};
for (const file of files) {
  const module = await import(pathToFileURL(resolve('src/effects', file)).href);
  for (const [name, value] of Object.entries(module)) if (name.endsWith('_SKILLS') && value && typeof value === 'object') for (const skill of Object.keys(value)) handlers.set(skill, file);
}
const elves = DEFAULT_ELVES.map(elf => ({ id: elf.id, name: elf.name, soulRoute: SOUL_MODE[elf.id] || SOUL_MODE[elf.name] || (SOUL_MARK_MAPPING[elf.name] ? 'handler' : 'generic'), soulText: elf.soulMark?.description,
  skills: [...(elf.skills || []), ...(elf.skillPool || [])].filter((s, i, all) => all.findIndex(x => x.name === s.name) === i).map(skill => {
    const mode = SKILL_MODE[skill.name] || (handlers.has(skill.name) ? 'handler' : 'blocks');
    const prog = parseSkill(skill.name, skill.description || '');
    return { name: skill.name, sourceText: skill.description, execution: mode, handlerFile: handlers.get(skill.name),
      classifications: prog.clauses.map(c => ({ text: c.raw, marker: c.marker, trigger: c.trig, parsed: c.parsed })),
      reviewFlags: [
        ...(/視為.*能力(?:提升|下降)/.test(skill.description || '') ? ['計算用能力視同：須驗證命中前、附加失效時與固有失效時'] : []),
        ...(/威力/.test(skill.description || '') ? ['威力計算：須驗證先吸取／消除／反轉後計算傷害，禁止替换成附加傷害'] : []),
        ...(/未觸發|消除成功|消除失敗|反轉成功|吸取成功/.test(skill.description || '') ? ['分枝結果：須以對應前項實際結果判定，不能用免疫或存在 handler 推定成功'] : []),
        ...(!prog.clauses.every(c => c.parsed) && mode === 'blocks' ? ['有未解析子句：須追到 fallback，不保證語義正確'] : []),
      ], semanticVerification: round2Evidence[skill.name] ? 'partial-behavior-verified-not-whole-skill' : 'pending-unless-evidence-in-report',
      ...(round2Evidence[skill.name] ? { verificationEvidence: { report: 'docs/技能文義第二輪修復與驗收_20261002.md',
        tests: ['tests/skillMeaningRound2.semantic.test.ts', ...(skill.name === '星光·浪打千擊' ? ['tests/skillMeaningRound2Integration.semantic.test.ts'] : [])],
        verifiedBehaviorSubset: round2Evidence[skill.name], remaining: '其餘子句、作用域與邊界仍待逐句核對' } } : {}),
    };
  }),
}));
const approximations = Object.entries(sources).flatMap(([file, source]) => source.split('\n').flatMap((line, i) => /簡化|模擬|Roughly|TODO|待實裝|邏輯已在|僅作為觸發標記/.test(line) ? [{ file, line: i + 1, text: line.trim(), verification: 'candidate-not-proof-of-active-execution' }] : []));
writeFileSync('docs/技能文義與替代實裝盤點_20261002.json', JSON.stringify({ note: '全量路由與分類盤點；解析率、註冊存在、註解均不是語義驗收證據。已確認缺陷與修復證據見同名 Markdown。', elves, approximations }, null, 2) + '\n');
console.log(`盤點 ${elves.length} 隻精靈，${elves.reduce((n,e) => n + e.skills.length, 0)} 個技能；${approximations.length} 個近似實裝註解候選。`);
