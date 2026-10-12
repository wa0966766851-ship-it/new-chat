import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evidenceState } from '../scripts/lib/effectAudit';
const group = JSON.parse(readFileSync('docs/audits/monkey-baphomet-evidence.json', 'utf8'));
for (const proof of group.evidence) {
  assert.equal(evidenceState(process.cwd(), { ...proof, testFile: group.testFile, testSha256: group.testSha256,
    lastPassed: group.lastPassed, inputs: group.inputs }), 'partial-evidence', proof.id);
}
console.log('12條人工對應的本批部分證據有效；完整驗收狀態不自動升級');
