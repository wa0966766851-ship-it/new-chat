import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import { getDeconstructedProfile } from "../src/effects/abilityRegistry";

/** 首頁只需要技能描述與類型等欄位，不必讀入完整魂印／戰鬥解構資料。 */
const source = ts.createSourceFile("defaultElves.ts", readFileSync("src/data/defaultElves.ts", "utf8"), ts.ScriptTarget.Latest, true);
const fields = ["category", "type", "accuracy", "alwaysHit", "isSureHit", "isFifthSkill"];
const references: Record<string, Record<string, unknown>> = {};
let count = 0;
function visit(node: ts.Node) {
  if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "mechanics") {
    assert.ok(fields.includes(node.name.text), `首頁新增讀取 ${node.name.text}，請先擴充技能參考欄位，不能靜默丟失`);
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "createRefSkill") {
    const [id, name] = node.arguments;
    assert.ok(id && name && ts.isStringLiteral(id) && ts.isStringLiteral(name), "動態技能參考需補上產生器規則，不能靜默省略");
    const entries = getDeconstructedProfile(id.text)?.skills?.[name.text];
    if (entries) {
      references[id.text] ??= {};
      references[id.text][name.text] = entries.map(entry => ({
        flavor: { description: entry.flavor.description },
        mechanics: Object.fromEntries(fields.filter(key => entry.mechanics[key] !== undefined).map(key => [key, entry.mechanics[key]])),
      }));
    }
    count++;
  }
  ts.forEachChild(node, visit);
}
visit(source);
const generated = JSON.stringify(references) + "\n";
const path = "src/data/skillReferences.generated.json";
if (process.argv.includes("--check")) assert.equal(readFileSync(path, "utf8"), generated, "技能參考資料過期，請執行 npm run data:skills");
else writeFileSync(path, generated);
console.log(`首頁技能參考：${count} 個呼叫已核對，${Buffer.byteLength(generated)} bytes；描述與命中／技能類型欄位保留。`);
