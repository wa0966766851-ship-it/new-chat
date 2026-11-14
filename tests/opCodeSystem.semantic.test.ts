// P3/P4 regression: catalog codes, alias families, usage index, panel data.
// Pure data assertions — no DOM, no battle engine.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { OP_CATALOG, OP_CODES, opByCode, opCode, opsByFamily, OP_FAMILY_LABEL } from '../src/data/opCatalog';
import { OP_ALIAS_FAMILIES, ALIAS_BY_CODE, ALIAS_BY_OP, aliasFamiliesOf } from '../src/data/opAliases';

const usage = JSON.parse(fs.readFileSync(new URL('../docs/audits/op-usage.json', import.meta.url), 'utf8'));

let checks = 0;
const check = (name: string, fn: () => void) => { fn(); checks++; console.log('✓ ' + name); };

// 2026-11-14：catalog 已由 246 補齊（動作＋條件獨立編號），改以「全數唯一、雙向可查、無未編號引用」驗收，下限不得退回 P1。
check('P1 catalog: unique codes (≥ P1 baseline 246), roundtrip works', () => {
  const total = Object.keys(OP_CATALOG).length;
  assert.ok(total >= 246, `catalog ${total}`);
  assert.equal(new Set(OP_CODES).size, total);
  for (const [op, e] of Object.entries(OP_CATALOG)) {
    assert.equal(opCode(op), e.code);
    assert.equal(opByCode(e.code), op);
  }
});

check('P1 families: 10 action labels + Q 條件, counts sum to catalog size', () => {
  assert.equal(Object.keys(OP_FAMILY_LABEL).length, 11);
  assert.equal(OP_FAMILY_LABEL.Q, '條件判斷');
  const sum = Object.keys(OP_FAMILY_LABEL).reduce((n, f) => n + opsByFamily(f as any).length, 0);
  assert.equal(sum, Object.keys(OP_CATALOG).length);
});

check('P3 alias: 6 families, each canonical code exists in catalog', () => {
  assert.equal(OP_ALIAS_FAMILIES.length, 6);
  for (const f of OP_ALIAS_FAMILIES) {
    assert.ok(OP_CODES.includes(f.canonicalCode), `${f.id}: ${f.canonicalCode}`);
    assert.equal(ALIAS_BY_CODE[f.canonicalCode].id, f.id);
    assert.ok(f.members.includes(opByCode(f.canonicalCode)!), `${f.id}: canonical op is a member`);
  }
});

check('P3 alias: S-016 is 限制附加異常 and includes the 4-track ops', () => {
  const f = ALIAS_BY_CODE['S-016'];
  assert.equal(f.label, '限制附加異常狀態');
  for (const op of ['status_inflict_guard_turns', 'immune_status_turns', 'status_guard']) {
    assert.ok(f.members.includes(op), op);
    assert.ok(aliasFamiliesOf(op).some(x => x.id === 'status-inflict-guard'));
  }
});

check('P3 alias: reverse lookup by op works', () => {
  assert.ok(ALIAS_BY_OP['status_inflict_guard_turns'].includes('status-inflict-guard'));
  assert.ok(ALIAS_BY_OP['survive'].includes('fatal-survival'));
});

check('P2/P3 usage index: schema ≥2, 0 alias errors, 0 unindexed, reverse index usable', () => {
  assert.ok(usage.schemaVersion >= 2);
  assert.equal(usage.totals.aliasErrors, 0);
  assert.equal(usage.totals.unindexedRefs ?? usage.unindexed?.length ?? 0, 0, '資料層引用全部有代號');
  assert.equal(usage.aliasFamilies.length, 6);
  const s016 = usage.byCode['S-016'];
  assert.ok(s016);
  assert.ok(s016.elves.includes('5022'), '靜刃止水 must be reachable from S-016');
});

check('P4 panel data: every code resolves to an op, every family has a label', () => {
  for (const c of OP_CODES) {
    const op = opByCode(c);
    assert.ok(op, c);
    assert.ok(OP_FAMILY_LABEL[c[0] as keyof typeof OP_FAMILY_LABEL], c);
  }
});

console.log(`\nOp-code system P1–P4: ${checks}/${checks} passed`);
