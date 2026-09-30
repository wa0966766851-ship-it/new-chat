import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { DeconstructedElfRegistry } from "../src/effects/abilityRegistry";

const directory = new URL("../src/data/elfProfiles/", import.meta.url);
let checked = 0;
for (const filename of readdirSync(directory).filter(name => name.endsWith(".ts"))) {
  const pureUrl = new URL(filename, directory);
  const source = ts.createSourceFile(filename, readFileSync(pureUrl, "utf8"), ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      assert.ok(statement.importClause?.isTypeOnly, `${filename} 只允許型別匯入，不可帶回執行程式`);
    }
  }
  const profiles = await import(pureUrl.href);
  const legacy = await import(new URL(`../src/effects/${filename}`, import.meta.url).href);
  for (const [name, profile] of Object.entries(profiles)) {
    assert.equal(legacy[name], profile, `${name} 的舊匯出必須保留相同物件`);
    assert.ok(Object.values(DeconstructedElfRegistry).includes(profile as never), `${name} 必須仍在描述登記表`);
    checked++;
  }
}
const registrySource = ts.createSourceFile("abilityRegistry.ts", readFileSync(new URL("../src/effects/abilityRegistry.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
for (const statement of registrySource.statements) {
  if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
    assert.ok(statement.moduleSpecifier.text === "./types" || statement.moduleSpecifier.text.startsWith("../data/elfProfiles/"),
      "描述登記表不應連帶匯入戰鬥 handler");
  }
}
assert.equal(checked, 23);
console.log(`描述資料解耦測試通過：${checked} 份舊匯出相容、登記完整、沒有執行程式相依。`);
