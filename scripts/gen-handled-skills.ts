/**
 * 產生 src/effects/soulMarkHandledSkills.ts：
 * 列出「沒有 *_SKILLS 專屬 handler，但技能名稱已在魂印註冊表中以字串處理」的技能，
 * 通用描述執行器（genericSkillText）會略過它們，避免效果重複套用。
 * 用法：npx vite-node scripts/gen-handled-skills.ts
 */
import { DEFAULT_ELVES } from "../src/data/defaultElves";
import * as fs from "fs";
import ts from "typescript";
const dir = "src/effects";
const elfModules: Record<string, string> = JSON.parse(fs.readFileSync(`${dir}/elves/modules.json`, 'utf8'));
const files = [...fs.readdirSync(dir).filter(f => /Registry\.ts$/.test(f)),
  ...Object.values(elfModules).map(file => `elves/${file}`)];

/**
 * 只掃描 export function/const handle*SoulMark 的函式本體，並追蹤由
 * ctx.skill.name 派生的區域變數。舊版全文 includes 會把描述文字與 *_SKILLS
 * 登錄表也當成魂印分支，反而讓 fallback 被錯誤跳過。
 */
function handledNamesFromSoulHandlers(file: string): Set<string> {
  const text = fs.readFileSync(`${dir}/${file}`, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = new Set<string>();

  const functionBody = (node: ts.Node): ts.ConciseBody | undefined => {
    if (ts.isFunctionDeclaration(node) && node.name?.text.startsWith("handle") && node.name.text.endsWith("SoulMark")) return node.body;
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text.startsWith("handle") && decl.name.text.endsWith("SoulMark") && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) return decl.initializer.body;
      }
    }
    return undefined;
  };

  const containsSkillName = (node: ts.Node | undefined): boolean => {
    if (!node) return false;
    const text = node.getText(source);
    if (!/skill/i.test(text)) return false;
    const compact = text.replace(/\?\./g, ".").replace(/\s+/g, "");
    // 只認「依技能名分流」：ctx.skill.name / skill.name 與字串比較或 switch。
    // category / power / pp 等通用讀取不算，避免把全體技能都列入。
    if (/(?:ctx|context)\.skill\.name/.test(compact)) return true;
    if (/(?<![.\w])skill\.name(?![\w])/.test(text)) return true;
    if (/\bskillName\b/.test(compact)) return true;
    return false;
  };

  for (const top of source.statements) {
    const body = functionBody(top);
    if (!body) continue;
    const aliases = new Set<string>();
    const learnAliases = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && containsSkillName(node.initializer)) aliases.add(node.name.text);
      ts.forEachChild(node, learnAliases);
    };
    learnAliases(body);
    const referencesSkill = (node: ts.Node) => containsSkillName(node) || [...aliases].some(alias => new RegExp(`\\b${alias}\\b`).test(node.getText(source)));
    const collect = (node: ts.Node) => {
      if (ts.isBinaryExpression(node) && referencesSkill(node)) {
        for (const side of [node.left, node.right]) if (ts.isStringLiteralLike(side)) found.add(side.text);
      }
      if (ts.isCaseClause(node) && referencesSkill(node.parent.parent.expression) && ts.isStringLiteralLike(node.expression)) found.add(node.expression.text);
      ts.forEachChild(node, collect);
    };
    collect(body);
  }
  return found;
}

const handledBySoul = new Set<string>();
for (const file of files) for (const name of handledNamesFromSoulHandlers(file)) handledBySoul.add(name);

/** 靜態取得所有 *_SKILLS 物件的鍵，避免 Node 執行時載入 Vite 專用 import.meta.glob。 */
function registeredSkillNames(file: string): Set<string> {
  const text = fs.readFileSync(`${dir}/${file}`, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = new Set<string>();
  for (const top of source.statements) {
    if (!ts.isVariableStatement(top)) continue;
    for (const decl of top.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.name.text.endsWith("_SKILLS") || !decl.initializer || !ts.isObjectLiteralExpression(decl.initializer)) continue;
      for (const prop of decl.initializer.properties) {
        if (!ts.isPropertyAssignment(prop) && !ts.isMethodDeclaration(prop)) continue;
        const name = prop.name;
        if (ts.isStringLiteralLike(name) || ts.isIdentifier(name) || ts.isNumericLiteral(name)) found.add(name.text);
      }
    }
  }
  return found;
}

const registeredSkills = new Set<string>();
for (const file of files) for (const name of registeredSkillNames(file)) registeredSkills.add(name);
const names = new Set<string>();
for (const elf of DEFAULT_ELVES as any[]) for (const sk of elf.skills || []) {
  if (registeredSkills.has(sk.name)) continue;
  if (handledBySoul.has(sk.name)) names.add(sk.name);
}
const out = `// 自動產生：scripts/gen-handled-skills.ts（新增精靈後請重新執行）\nexport const SOUL_MARK_HANDLED_SKILLS = new Set<string>(${JSON.stringify([...names].sort(), null, 2)});\n`;
const outputPath = "src/effects/soulMarkHandledSkills.ts";
if (process.argv.includes("--check")) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8").replace(/\r\n/g, "\n") : "";
  if (current !== out) {
    console.error(`${outputPath} 已過期；請執行 npm run gen:handled-skills`);
    process.exitCode = 1;
  } else {
    console.log(`魂印技能重複執行清單：${names.size} 筆，檢查通過`);
  }
} else {
  fs.writeFileSync(outputPath, out);
  console.log(`wrote ${names.size} names`);
}
