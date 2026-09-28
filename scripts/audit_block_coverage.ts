import { DEFAULT_ELVES } from "../src/data/defaultElves";
import { getSkillProgram, getSoulProgram } from "../src/blocks/registry";
import { SKILL_MODE, SOUL_MODE } from "../src/blocks/specs";

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
  const blockSkills = (elf.skills || []).filter(skill => SKILL_MODE[skill.name]).length;
  const soulMode = SOUL_MODE[String(elf.id)] || SOUL_MODE[elf.name];
  return { elf, skills, soul, blockSkills, soulMode };
});

const skills = sum(rows.map(row => row.skills));
const souls = sum(rows.map(row => row.soul));
const total = sum([skills, souls]);

console.log("\n# 積木覆蓋率稽核\n");
console.log("| ID | 精靈 | 技能解析 | 魂印解析 | 積木技能 | 魂印模式 |");
console.log("| --- | --- | ---: | ---: | ---: | --- |");
for (const row of rows) {
  console.log(`| ${row.elf.id} | ${row.elf.name} | ${row.skills.parsed}/${row.skills.total} (${percent(row.skills)}) | ${row.soul.parsed}/${row.soul.total} (${percent(row.soul)}) | ${row.blockSkills} | ${row.soulMode || "handler/fallback"} |`);
}

console.log("\n## 合計\n");
console.log(`- 技能：${skills.parsed}/${skills.total} (${percent(skills)})，未解析 ${skills.missing.length} 子句。`);
console.log(`- 魂印：${souls.parsed}/${souls.total} (${percent(souls)})，未解析 ${souls.missing.length} 子句。`);
console.log(`- 整體：${total.parsed}/${total.total} (${percent(total)})。`);
console.log(`- 明確積木模式：${Object.keys(SKILL_MODE).length} 個技能、${Object.keys(SOUL_MODE).length} 個魂印。`);

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
  if (skills.parsed < 477 || skills.total !== 752) failures.push(`技能覆蓋率退步或資料集改變：${skills.parsed}/${skills.total}`);
  // 5029 異境神霆·雷伊加入 16 個可稽核魂印子句；資料集基準由 409 更新為 425。
  if (souls.parsed < 100 || souls.total !== 425) failures.push(`魂印覆蓋率退步或資料集改變：${souls.parsed}/${souls.total}`);

  for (const name of Object.keys(SKILL_MODE)) {
    const skill = DEFAULT_ELVES.flatMap(elf => elf.skills || []).find(item => item.name === name);
    if (!skill) failures.push(`積木技能不存在：${name}`);
    else if (coverage(getSkillProgram(skill).clauses).missing.length) failures.push(`積木技能仍有未解析子句：${name}`);
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
