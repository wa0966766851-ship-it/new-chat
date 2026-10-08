import { DEFAULT_ELVES } from "../src/data/defaultElves";
import { getSkillProgram, getSoulProgram } from "../src/blocks/registry";
import { SKILL_MODE, SOUL_MODE } from "../src/blocks/specs";
import { writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { isPresentationOnly } from './lib/effectAudit';

type Coverage = { parsed: number; total: number; missing: string[] };

const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const details = args.has("--details");

function coverage(clauses: Array<{ parsed: boolean; raw: string; marker?: string }>): Coverage {
  const relevant = clauses.filter(clause => clause.marker !== "§");
  return {
    parsed: relevant.filter(clause => clause.parsed).length,
    total: relevant.length,
    missing: relevant.filter(clause => !clause.parsed).map(clause => clause.raw),
  };
}

function sum(rows: Coverage[]): Coverage {
  return rows.reduce<Coverage>((acc, row) => ({
    parsed: acc.parsed + row.parsed,
    total: acc.total + row.total,
    missing: [...acc.missing, ...row.missing],
  }), { parsed: 0, total: 0, missing: [] });
}

function percent(row: Coverage) {
  return row.total ? `${(row.parsed / row.total * 100).toFixed(1)}%` : "100.0%";
}

const rows = DEFAULT_ELVES.map(elf => {
  const skills = sum((elf.skills || []).map(skill => coverage(getSkillProgram(skill).clauses)));
  const soul = coverage(getSoulProgram(elf).clauses);
  const blockSkills = (elf.skills || []).filter(skill => SKILL_MODE[skill.name] === 'blocks').length;
  const hybridSkills = (elf.skills || []).filter(skill => Array.isArray(SKILL_MODE[skill.name])).length;
  const soulMode = SOUL_MODE[String(elf.id)] || SOUL_MODE[elf.name];
  return { elf, skills, soul, blockSkills, hybridSkills, soulMode };
});

const skills = sum(rows.map(row => row.skills));
const souls = sum(rows.map(row => row.soul));
const total = sum([skills, souls]);

console.log("\n# 積木覆蓋率稽核\n");
console.log('只統計攜帶技能＋魂印，不含其他特質及預備技能。解析率不代表實裝率／正確率；模式登記不代表每個效果已驗證。');
console.log("| ID | 精靈 | 技能解析 | 魂印解析 | 明確全積木技能 | 混合技能 | 魂印模式 |");
console.log("| --- | --- | ---: | ---: | ---: | ---: | --- |");
for (const row of rows) {
  console.log(`| ${row.elf.id} | ${row.elf.name} | ${row.skills.parsed}/${row.skills.total} (${percent(row.skills)}) | ${row.soul.parsed}/${row.soul.total} (${percent(row.soul)}) | ${row.blockSkills} | ${row.hybridSkills} | ${row.soulMode || "未明確指定，入口見逐句稽核"} |`);
}

console.log("\n## 合計\n");
console.log(`- 技能：${skills.parsed}/${skills.total} (${percent(skills)})，未解析 ${skills.missing.length} 子句。`);
console.log(`- 魂印：${souls.parsed}/${souls.total} (${percent(souls)})，未解析 ${souls.missing.length} 子句。`);
console.log(`- 整體：${total.parsed}/${total.total} (${percent(total)})。`);
const explicitModes = {
  allBlockSkills: Object.values(SKILL_MODE).filter(mode => mode === 'blocks').length,
  hybridSkills: Object.values(SKILL_MODE).filter(mode => Array.isArray(mode)).length,
  allBlockSouls: Object.values(SOUL_MODE).filter(mode => mode === 'blocks').length,
  hybridSouls: Object.values(SOUL_MODE).filter(mode => Array.isArray(mode)).length,
};
const layoutClauses = DEFAULT_ELVES.flatMap(elf => [...(elf.skills || []).flatMap(skill => getSkillProgram(skill).clauses), ...getSoulProgram(elf).clauses])
  .filter(clause => clause.marker !== '§' && isPresentationOnly(clause.raw));
const layoutCount = layoutClauses.length, parsedLayoutCount = layoutClauses.filter(clause => clause.parsed).length;
console.log(`- 明確全積木：${explicitModes.allBlockSkills} 個技能、${explicitModes.allBlockSouls} 個魂印；指定部分子句混合：${explicitModes.hybridSkills} 個技能、${explicitModes.hybridSouls} 個魂印。`);
const snapshot = { schemaVersion: 2, scope: 'carried skills + soul only; no traits or reserve skills',
  note: 'parser coverage and execution configuration are not battle implementation or correctness rates',
  summary: { skills: { parsed: skills.parsed, total: skills.total }, souls: { parsed: souls.parsed, total: souls.total },
    total: { parsed: total.parsed, total: total.total, presentationOnly: layoutCount, presentationOnlyParsed: parsedLayoutCount,
      nonPresentationParsed: total.parsed - parsedLayoutCount, nonPresentationTotal: total.total - layoutCount }, explicitModes },
  elves: rows.map(({ elf, ...row }) => ({ id: elf.id, name: elf.name, ...row })) };
const snapshotJson = JSON.stringify(snapshot, null, 2) + '\n';
const snapshotMd = ['# 積木解析與模式登記統計', '',
  '分母僅包含攜帶技能＋魂印；全部效果清單另含特質及預備技能。未解析原句完整保留於同名 JSON。', '',
  '| 範圍 | 已解析 | 子句總數 | 解析率 |', '|---|---:|---:|---:|',
  `| 技能 | ${skills.parsed} | ${skills.total} | ${percent(skills)} |`,
  `| 魂印 | ${souls.parsed} | ${souls.total} | ${percent(souls)} |`,
  `| 合計 | ${total.parsed} | ${total.total} | ${percent(total)} |`, '',
  `明確全積木：技能 ${explicitModes.allBlockSkills}、魂印 ${explicitModes.allBlockSouls}；混合登記：技能 ${explicitModes.hybridSkills}、魂印 ${explicitModes.hybridSouls}。`, '',
  '未明確登記不等於沒有執行：可能走專屬程式，也可能自動積木＋文字 fallback；正式入口見全精靈效果實裝核對清單。', '',
  '解析率、模式數量均不代表戰鬥實裝率或正確率。部分語意證據與未驗分支另外記錄，不由此表推定。', '',
  `為維持既有解析回歸基準，分母保留解析器拆分紀錄，其中 ${layoutCount} 個純Markdown標題／分隔行並非待實裝效果；逐句語意清單會單獨排除，兩種分母均有明確記錄。`, '',
  `排除版式後：${total.parsed - parsedLayoutCount}／${total.total - layoutCount} 個紀錄已解析；原解析器將 ${parsedLayoutCount} 個版式行標為已解析，不能拿來充當有行為的積木效果。`, '',
  '更新：`npm run audit:blocks`；明細：`npm run audit:blocks:details`；一致性及解析回歸：`npm run test:audit`。', ''].join('\n');
if (args.has('--write')) {
  writeFileSync('docs/audits/積木解析與執行統計.json', snapshotJson);
  writeFileSync('docs/audits/積木解析與執行統計.md', snapshotMd);
}
if (check) {
  assert.ok(readFileSync('docs/audits/積木解析與執行統計.json', 'utf8') === snapshotJson, '積木統計 JSON 已過期，請重新產生');
  assert.ok(readFileSync('docs/audits/積木解析與執行統計.md', 'utf8') === snapshotMd, '積木統計 MD 已過期，請重新產生');
}

if (details) {
  console.log("\n## 未解析子句\n");
  for (const row of rows) {
    if (!row.skills.missing.length && !row.soul.missing.length) continue;
    console.log(`\n### ${row.elf.id} ${row.elf.name}`);
    for (const clause of row.skills.missing) console.log(`- [技能] ${clause}`);
    for (const clause of row.soul.missing) console.log(`- [魂印] ${clause}`);
  }
}

if (check) {
  const failures: string[] = [];
  // 20261002：4 條成功／失敗延伸併回父效果；483/757 → 479/753。
  // 全部 31 個 blocks 技能仍逐句完整解析；不是刪除效果或放寬未解析要求。
  // 競技場五隻加入 25 技能＋18 魂印子句（handler 專屬執行，不走積木解析）：753 → 778，已解析維持 479。
  // 20261003：競技場五隻＋5030 技能描述改為 ■／🎯／> 逐行標記（原文不變，補必中／先制），子句拆細：778 → 912，已解析 479 → 536。
  // 20261003-2：無相諦補消逝、日月安屬沉默改戰鬥百科定義、龍魂之源／印記／之力說明行：912 → 915。
  // 20261005：5031完整描述＋5032～5034來源TXT加入；601/1034只是解析基準，不是實裝率。
  // 20261007：5035哈莫新增17/40技能與3/44魂印子句。原資料基準未降低；新增未解析項仍在報告。
  if (skills.parsed < 618 || skills.total !== 1074) failures.push(`技能覆蓋率退步或資料集改變：${skills.parsed}/${skills.total}`);
  // 5029 異境神霆·雷伊加入 16 個可稽核魂印子句；資料集基準由 409 更新為 427。
  // 競技場五隻魂印走專屬 handler：431 → 449，已解析維持 104。
  // 20261003-2：無極聖武補英雄之耀／武誅／亮節／威怯官方定義、龍之治癒補赤龍與四龍追加效果：449 → 456，已解析 104 → 105。
  // 20261004 P1 積木修正：轉化異常等正則補 $ 錨定，5023「將自身異常轉化為詛咒異常狀態且令自身詛咒回合數翻倍」後半句不再被吞掉，誠實標為未解析：105 → 104。
  if (souls.parsed < 115 || souls.total !== 623) failures.push(`魂印覆蓋率退步或資料集改變：${souls.parsed}/${souls.total}`);

  for (const name of Object.keys(SKILL_MODE)) {
    const skill = DEFAULT_ELVES.flatMap(elf => elf.skills || []).find(item => item.name === name);
    if (!skill) failures.push(`積木技能不存在：${name}`);
    else {
      // 指定子句模式（專屬 handler＋積木補指定子句，例如 5014 技能無效時子句）：只要求登記的子句可解析
      const mode = SKILL_MODE[name];
      const clauses = getSkillProgram(skill).clauses.filter((_, i) => mode === "blocks" || mode.includes(i));
      if (coverage(clauses).missing.length) failures.push(`積木技能仍有未解析子句：${name}`);
    }
  }
  for (const key of Object.keys(SOUL_MODE)) {
    const elf = DEFAULT_ELVES.find(item => String(item.id) === key || item.name === key);
    if (!elf) failures.push(`積木魂印精靈不存在：${key}`);
    else if (coverage(getSoulProgram(elf).clauses).missing.length) failures.push(`積木魂印仍有未解析子句：${elf.name}`);
  }

  if (failures.length) {
    console.error("\n覆蓋率檢查失敗：");
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log("\n覆蓋率回歸檢查：通過");
  }
}
