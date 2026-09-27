/**
 * 產生 src/effects/soulMarkHandledSkills.ts：
 * 列出「沒有 *_SKILLS 專屬 handler，但技能名稱已在魂印註冊表中以字串處理」的技能，
 * 通用描述執行器（genericSkillText）會略過它們，避免效果重複套用。
 * 用法：npx vite-node scripts/gen-handled-skills.ts
 */
import { DEFAULT_ELVES } from "../src/data/defaultElves";
import { hasSkillHandler } from "../src/effects/battleEventRegistry";
import * as fs from "fs";
const dir = "src/effects";
const srcs = fs.readdirSync(dir).filter(f => /Registry\.ts$/.test(f)).map(f => fs.readFileSync(`${dir}/${f}`, "utf8"));
const names = new Set<string>();
for (const elf of DEFAULT_ELVES as any[]) for (const sk of elf.skills || []) {
  if (hasSkillHandler(sk.name)) continue;
  if (srcs.some(s => s.includes(`"${sk.name}"`) || s.includes(`'${sk.name}'`) || s.includes("`" + sk.name))) names.add(sk.name);
}
const out = `// 自動產生：scripts/gen-handled-skills.ts（新增精靈後請重新執行）\nexport const SOUL_MARK_HANDLED_SKILLS = new Set<string>(${JSON.stringify([...names].sort(), null, 2)});\n`;
fs.writeFileSync("src/effects/soulMarkHandledSkills.ts", out);
console.log(`wrote ${names.size} names`);
