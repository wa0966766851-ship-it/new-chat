// P2 (+P3 alias): Build an L4 usage index — which elf / skill / Kit entry calls which op.
// Pure scan: reads src/data/**/*Kit*.ts as text, never imports or executes them.
// No runtime / dispatch changes. See docs/op-code-system.md.
//
//   node --import tsx scripts/gen_op_usage.ts          # write docs/audits/op-usage.json
//   node --import tsx scripts/gen_op_usage.ts --check  # verify the file is up to date
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { OP_CATALOG, opCode, OP_CODE_TO_NAME, CONDITION_CATALOG, isConditionOp } from '../src/data/opCatalog';
import { OP_ALIAS_FAMILIES, ALIAS_BY_OP } from '../src/data/opAliases';

const root = process.cwd();
const dataDir = path.join(root, 'src/data');
const outPath = path.join(root, 'docs/audits/op-usage.json');

interface Usage {
  code: string | null;
  op: string;
  /** Whether this reference came from a() (action) or c() (condition). */
  context: 'action' | 'condition';
  /** Set when the same op name is used in the wrong context (logic risk). */
  contextWarning?: string;
  file: string;
  elfIds: string[];
  definitionName: string;
}

/** Extract elfIds + name from a Kit definition header, and every referenced op. */
function scanFile(file: string): Usage[] {
  const text = fs.readFileSync(path.join(dataDir, file), 'utf8');
  // Header may be `export const X = [ { elfIds: [...], name: '...', ... } ]`.
  // We associate each op with the nearest preceding elfIds/name in the same file.
  const headers: { at: number; elfIds: string[]; name: string }[] = [];
  const elfRe = /elfIds:\s*\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = elfRe.exec(text))) {
    const ids = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]);
    // nearest `name: '...'` after this elfIds (within the same object literal)
    const rest = text.slice(m.index, m.index + 400);
    const nm = rest.match(/name:\s*['"]([^'"]+)['"]/);
    headers.push({ at: m.index, elfIds: ids, name: nm?.[1] ?? '' });
  }
  const headerAt = (pos: number) => {
    let best = headers[0];
    for (const h of headers) if (h.at <= pos) best = h; else break;
    return best;
  };
  const usages: Usage[] = [];
  const push = (pos: number, op: string, context: 'action' | 'condition') => {
    const h = headerAt(pos);
    const code = context === 'condition' ? (opCode(op, 'condition') ?? null) : (opCode(op, 'action') ?? null);
    let contextWarning: string | undefined;
    if (context === 'condition' && !isConditionOp(op) && !OP_CATALOG[op]?.conditionCode)
      contextWarning = 'c() 引用了非條件 op（可能誤用動作名當條件）';
    if (context === 'action' && isConditionOp(op) && OP_CATALOG[op]?.kind === 'condition')
      contextWarning = 'a() 引用了條件專用 op（可能誤用條件名當動作）';
    usages.push({ code, op, context, ...(contextWarning ? { contextWarning } : {}), file, elfIds: h?.elfIds ?? [], definitionName: h?.name ?? '' });
  };
  for (const mm of text.matchAll(/\ba\(\s*['"]([a-z_][a-z0-9_]*)['"]/g)) push(mm.index, mm[1], 'action');
  for (const mm of text.matchAll(/\bc\(\s*['"]([a-z_][a-z0-9_]*)['"]/g)) push(mm.index, mm[1], 'condition');
  for (const mm of text.matchAll(/\bop:\s*['"]([a-z_][a-z0-9_]*)['"]/g)) push(mm.index, mm[1], 'action');
  return usages;
}

const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.ts') && /Kit|kit/.test(f));
const all: Usage[] = files.flatMap(scanFile);

const byOp: Record<string, {
  actionCode: string | null; conditionCode: string | null;
  count: number; actionCount: number; conditionCount: number;
  elves: string[]; definitions: string[];
}> = {};
for (const u of all) {
  const e = byOp[u.op] ??= {
    actionCode: null, conditionCode: null, count: 0, actionCount: 0, conditionCount: 0,
    elves: [], definitions: [],
  };
  e.count++;
  if (u.context === 'action') { e.actionCount++; if (u.code) e.actionCode = u.code; }
  else { e.conditionCount++; if (u.code) e.conditionCode = u.code; }
  for (const id of u.elfIds) if (!e.elves.includes(id)) e.elves.push(id);
  if (u.definitionName && !e.definitions.includes(u.definitionName)) e.definitions.push(u.definitionName);
}
for (const e of Object.values(byOp)) { e.elves.sort(); e.definitions.sort(); }

// A reference is "indexed" when its context resolved to a code.
const unindexed = all.filter(u => !u.code).map(u => ({ op: u.op, context: u.context, file: u.file, definitionName: u.definitionName }));
const contextWarnings = all.filter(u => u.contextWarning).map(u => ({
  op: u.op, context: u.context, warning: u.contextWarning!, file: u.file, definitionName: u.definitionName,
}));
const byCode: Record<string, { op: string; count: number; elves: string[]; context: 'action' | 'condition' }> = {};
for (const u of all) {
  if (!u.code) continue;
  const e = byCode[u.code] ??= { op: u.op, count: 0, elves: [], context: u.context };
  e.count++;
  for (const id of u.elfIds) if (!e.elves.includes(id)) e.elves.push(id);
}
for (const e of Object.values(byCode)) e.elves.sort();

const catalogCodes = new Set(Object.values(OP_CATALOG).map(e => e.code));
const unusedCodes = [...catalogCodes].filter(c => !byCode[c]).sort();

// P3: alias families. Verify every canonical code exists and every member is a real op.
const aliasErrors: string[] = [];
for (const f of OP_ALIAS_FAMILIES) {
  if (!catalogCodes.has(f.canonicalCode)) aliasErrors.push(`${f.id}: canonicalCode ${f.canonicalCode} 不存在於 catalog`);
  if (OP_CODE_TO_NAME[f.canonicalCode] && !f.members.includes(OP_CODE_TO_NAME[f.canonicalCode]))
    aliasErrors.push(`${f.id}: canonicalCode 對應的 op 未列為 member`);
}
const aliasFamilies = OP_ALIAS_FAMILIES.map(f => {
  const used = f.members.filter(op => byOp[op]);
  return {
    id: f.id,
    canonicalCode: f.canonicalCode,
    family: f.family,
    label: f.label,
    intent: f.intent,
    memberCount: f.members.length,
    usedMembers: used.sort(),
    unusedMembers: f.members.filter(op => !byOp[op]).sort(),
    elves: [...new Set(used.flatMap(op => byOp[op].elves))].sort(),
    referenceCount: used.reduce((n, op) => n + byOp[op].count, 0),
  };
});
const aliasOfOp: Record<string, string[]> = Object.fromEntries(
  Object.entries(ALIAS_BY_OP).filter(([op]) => byOp[op]).sort(([a], [b]) => a.localeCompare(b))
);

const actionRefs = all.filter(u => u.context === 'action').length;
const conditionRefs = all.filter(u => u.context === 'condition').length;
const indexedRefs = all.filter(u => u.code).length;

const snapshot = {
  schemaVersion: 3,
  note: 'L4 usage index, ACTION/CONDITION split + P3 alias families. Actions resolve to FAMILY-###, conditions to Q-###. unindexedRefs are references whose context had no code (not an error).',
  totals: {
    dataFiles: files.length,
    opReferences: all.length,
    actionRefs,
    conditionRefs,
    indexedRefs,
    distinctOpsReferenced: Object.keys(byOp).length,
    unindexedRefs: unindexed.length,
    contextWarnings: contextWarnings.length,
    catalogCodes: catalogCodes.size,
    conditionCatalogCodes: Object.keys(CONDITION_CATALOG).length,
    usedCodes: Object.keys(byCode).length,
    unusedCodes: unusedCodes.length,
    aliasFamilies: aliasFamilies.length,
    aliasErrors: aliasErrors.length,
  },
  byCode,
  byOp: Object.fromEntries(Object.entries(byOp).sort(([a], [b]) => a.localeCompare(b))),
  aliasFamilies,
  aliasOfOp,
  aliasErrors,
  unindexed,
  contextWarnings,
  unusedCodes,
};
const json = JSON.stringify(snapshot, null, 2) + '\n';

if (process.argv.includes('--check')) {
  assert.equal(fs.readFileSync(outPath, 'utf8'), json, 'op-usage.json 已過期，請執行 node --import tsx scripts/gen_op_usage.ts');
  console.log('op-usage: check OK');
} else {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json);
  console.log(`op-usage: ${files.length} files, ${all.length} refs (${actionRefs} action / ${conditionRefs} condition), ${indexedRefs} indexed, ${unindexed.length} unindexed, ${contextWarnings.length} context warnings, ${aliasFamilies.length} alias families, ${aliasErrors.length} alias errors`);
}
