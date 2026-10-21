import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { clauseIdentity, clauseExecution, digest, reviewedKitDigest, serializeAuditJson, evidenceState, findTextSources, normalizeSourceText, isPresentationOnly, type AuditEvidence } from '../scripts/lib/effectAudit';
import { applyReviewedSkillKits } from '../src/data/reviewedSkillKits';
import {isLegacyWrappedKit} from '../src/blocks/ops/legacyHandler';
import { REVIEWED_SOUL_KITS } from '../src/data/reviewedSoulKits';

let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log('✓ ' + name); }
check('文字指紋跨 Windows/Linux 換行一致，數值與空白修改仍失效', () => {
  assert.equal(digest('const n = 1;\n'), digest(Buffer.from('const n = 1;\r\n')));
  assert.notEqual(digest('const n = 1;\n'), digest('const n = 2;\n'));
  assert.notEqual(digest('const n = 1;\n'), digest('const n=1;\n'));
});
check('稽核JSON原文與巢狀子句跨換行一致，數值及其他空白仍嚴格比對', () => {
  const windows = { sourceText: '先制+3\r\n恢復150點', clauses: [{ raw: '技能\r\n命中', amount: 150 }] };
  const linux = { sourceText: '先制+3\n恢復150點', clauses: [{ raw: '技能\n命中', amount: 150 }] };
  assert.equal(serializeAuditJson(windows), serializeAuditJson(linux));
  assert.notEqual(serializeAuditJson(linux), serializeAuditJson({ ...linux, sourceText: '先制+1\n恢復150點' }));
  assert.notEqual(serializeAuditJson(linux), serializeAuditJson({ ...linux, clauses: [{ raw: '技能\n命中', amount: 151 }] }));
  assert.notEqual(serializeAuditJson(linux), serializeAuditJson({ ...linux, sourceText: '先制+3\n 恢復150點' }));
  assert.equal(windows.sourceText.includes('\r\n'), true, '序列化不得改寫來源物件');
});
check('子句ID不依賴索引或Markdown空白，但保留數值與重複出現次序', () => {
  assert.equal(clauseIdentity('1', '技能', '甲', '> **造成100點傷害**', 1), clauseIdentity('1', '技能', '甲', '造成 100點傷害', 1));
  assert.notEqual(clauseIdentity('1', '技能', '甲', '造成100點傷害', 1), clauseIdentity('1', '技能', '甲', '造成200點傷害', 1));
  assert.notEqual(clauseIdentity('1', '技能', '甲', '造成100點傷害', 1), clauseIdentity('1', '技能', '甲', '造成100點傷害', 2));
  assert.notEqual(normalizeSourceText('吸取'), normalizeSourceText('汲取'));
  assert.notEqual(normalizeSourceText('能力總和*70'), normalizeSourceText('能力總和70'));
  assert.notEqual(normalizeSourceText('體力>0'), normalizeSourceText('體力0'));
  assert.ok(isPresentationOnly('---')); assert.ok(isPresentationOnly('## ◆ 相關說明'));
  assert.ok(!isPresentationOnly('> **回合開始時：**')); // 觸發上下文仍須保留，不能草率刪除。
});
check('解析成功不把handler或特質對照自動改成積木執行', () => {
  assert.equal(clauseExecution('handler', true, 0), 'handler-review');
  assert.equal(clauseExecution('trait-review', true, 0), 'trait-review');
  assert.equal(clauseExecution('generic', true, 0), 'generic-soul-review');
});
check('混合模式只執行指定子句，未解析保留fallback風險', () => {
  assert.equal(clauseExecution('hybrid', true, 2, [2]), 'block-runtime');
  assert.equal(clauseExecution('hybrid', true, 1, [2]), 'handler-review');
  assert.equal(clauseExecution('blocks', false, 1), 'text-fallback-review');
  assert.equal(clauseExecution('kit', true, 0), 'authored-block-runtime');
  assert.equal(clauseExecution('kit', false, 0), 'blocked-unresolved');
  assert.equal(clauseExecution('description', false, 0), 'blocked-unresolved');
});
const temp = mkdtempSync(resolve(tmpdir(), 'seer-audit-evidence-'));
try {
  writeFileSync(resolve(temp, 'test.ts'), 'assert.equal(actual, expected);');
  writeFileSync(resolve(temp, 'runtime.ts'), 'export const n = 1;');
  const proof: AuditEvidence = { id: 'test', elfId: '1', entry: '甲', fragment: '造成傷害', testFile: 'test.ts', anchor: 'assert.equal',
    lastPassed: '2026-10-08', testSha256: digest(readFileSync(resolve(temp, 'test.ts'))),
    inputs: [{ path: 'runtime.ts', sha256: digest(readFileSync(resolve(temp, 'runtime.ts'))) }], scenario: '一個情境', expected: '對應值', remaining: '其他邊界' };
  check('只有有效測試紀錄也只是部分證據，不自動升級完整通過', () => assert.equal(evidenceState(temp, proof), 'partial-evidence'));
  check('文字證據只改換行仍有效，實裝內容修改即過期', () => {
    const test = 'assert.equal(actual, expected);\n';
    const runtime = 'export const n = 1;\n';
    const portableProof = { ...proof, testSha256: digest(test), inputs: [{ path: 'runtime.ts', sha256: digest(runtime) }] };
    writeFileSync(resolve(temp, 'test.ts'), test.replace(/\n/g, '\r\n'));
    writeFileSync(resolve(temp, 'runtime.ts'), runtime.replace(/\n/g, '\r\n'));
    assert.equal(evidenceState(temp, portableProof), 'partial-evidence');
    writeFileSync(resolve(temp, 'runtime.ts'), 'export const n = 2;\r\n');
    assert.equal(evidenceState(temp, portableProof), 'stale-evidence');
    writeFileSync(resolve(temp, 'test.ts'), 'assert.equal(actual, expected);');
    writeFileSync(resolve(temp, 'runtime.ts'), 'export const n = 1;');
  });
  check('完整解碼積木證據接受等價重新壓縮，數值、節點、角色及陣列順序變動仍過期', () => {
    const data = [{ name: '測試技能', kit: [{ node: 'after_action', role: 'innate', params: { amount: 150, targets: ['self', 'opp'] } }] }];
    const pack = (value: unknown, level: number) => JSON.stringify({ schemaVersion: 1, gzip: gzipSync(JSON.stringify(value), { level }).toString('base64') });
    const original = pack(data, 9);
    const packedProof: AuditEvidence = { ...proof, inputs: [{ path: 'kit.json', format: 'reviewed-kits', sha256: reviewedKitDigest(original) }] };
    const repacked = pack(data, 1); assert.notEqual(original, repacked);
    writeFileSync(resolve(temp, 'kit.json'), repacked);
    assert.equal(evidenceState(temp, packedProof), 'partial-evidence');
    for (const change of [
      (x: any) => x[0].kit[0].params.amount++, (x: any) => x[0].kit[0].node = 'on_invalid',
      (x: any) => x[0].kit[0].role = 'attached', (x: any) => x[0].kit[0].params.targets.reverse(),
    ]) {
      const changed = structuredClone(data); change(changed);
      writeFileSync(resolve(temp, 'kit.json'), pack(changed, 1));
      assert.equal(evidenceState(temp, packedProof), 'stale-evidence');
    }
    writeFileSync(resolve(temp, 'kit.json'), '{broken');
    assert.equal(evidenceState(temp, packedProof), 'stale-evidence');
  });
  check('測試檔改動使證據過期', () => assert.equal(evidenceState(temp, { ...proof, testSha256: 'old' }), 'stale-evidence'));
  check('實裝依賴改動使證據過期', () => assert.equal(evidenceState(temp, { ...proof, inputs: [{ path: 'runtime.ts', sha256: 'old' }] }), 'stale-evidence'));
  check('缺少依賴／斷言錨點／實際通過紀錄不得算有效證據', () => {
    assert.equal(evidenceState(temp, { ...proof, inputs: [] }), 'stale-evidence');
    assert.equal(evidenceState(temp, { ...proof, anchor: 'nonexistent' }), 'stale-evidence');
    assert.equal(evidenceState(temp, { ...proof, lastPassed: '' }), 'stale-evidence');
  });
  check('證據路徑不能越界讀取其他專案', () => assert.throws(() => evidenceState(temp, { ...proof, testFile: '../outside.ts' }), /越界/));
  mkdirSync(resolve(temp, 'elf_source_files/elf_files'), { recursive: true });
  writeFileSync(resolve(temp, 'elf_source_files/elf_files/新增 文字文件.txt'), '# 星軌重構·艾斯菲格\n造成100點傷害');
  writeFileSync(resolve(temp, 'elf_source_files/elf_files/2_別名.txt'), '特殊舊名稱');
  check('TXT支援ID命名及未命名檔案的精確首行，不用模糊匹配猜同一隻', () => {
    const sources = findTextSources(temp, [{ id: '1', name: '星軌重構·艾斯菲格' }, { id: '2', name: '另一名字' }, { id: '3', name: '艾斯菲格' }]);
    assert.equal(sources.get('1')?.length, 1); assert.equal(sources.get('2')?.length, 1); assert.equal(sources.get('3')?.length, 0);
  });
} finally { rmSync(temp, { recursive: true }); }
const report = JSON.parse(readFileSync('docs/全精靈效果實裝核對.json', 'utf8'));
const blocks = JSON.parse(readFileSync('docs/audits/積木解析與執行統計.json', 'utf8'));
check('逐句統計與模式統計不同分母，部分測試證據不得變成正確率', () => {
  assert.equal(report.schemaVersion, 2);
  const s = report.summary;
  assert.equal(s.parsed + s.unparsed, s.clauses);
  assert.equal(s.sourceRecords - s.presentationOnly, s.clauses);
  assert.equal(s.pending + s.partialEvidence + s.staleEvidence, s.clauses);
  assert.equal(s.fullyAccepted, 0);
  // Kit 遷移後兩份報告可能恰好涵蓋相同效果；不能以分母必須較大判斷治理正確性。
  const clauses = report.elves.flatMap((e: any) => e.entries).flatMap((e: any) => e.clauses);
  assert.equal(s.clauses, clauses.filter((c: any) => !c.explanation && !c.presentationOnly).length);
  assert.equal(blocks.summary.total.total, blocks.summary.skills.total + blocks.summary.souls.total);
  assert.equal(blocks.summary.total.nonPresentationTotal, blocks.summary.total.total - blocks.summary.total.presentationOnly);
  assert.deepEqual(blocks.summary.explicitModes, { allBlockSkills: 30, hybridSkills: 2, allBlockSouls: 6, hybridSouls: 0 });
  assert.ok(report.elves.flatMap((e: any) => e.entries).flatMap((e: any) => e.clauses).filter((c: any) => !c.parsed).every((c: any) => c.raw && c.id));
});
check('競技場五隻依整份已登記圖紙區分Kit與專屬入口，不誤記成generic或自動積木', () => {
  assert.equal(report.elves.filter((e:any)=>e.id.startsWith('arena_')).length,5);
  for (const e of report.elves.filter((e: any) => e.id.startsWith('arena_'))) {
    const soul = e.entries.find((x: any) => x.kind === '魂印');
    const authoredSoul = REVIEWED_SOUL_KITS.find(d => d.elfIds.includes(e.id) && d.name === soul.name && d.description === soul.sourceText);
    assert.ok(authoredSoul && authoredSoul.kit.length && !isLegacyWrappedKit(authoredSoul.kit), `${e.id} 須有原文吻合的完整魂印圖紙`);
    assert.equal(soul.route, 'kit', `${e.id} 魂印不得回退 handler`);
    for(const entry of e.entries.filter((x:any)=>x.kind==='技能')){
      const [authored] = applyReviewedSkillKits({ id: e.id, skills: [{ name: entry.name, description: entry.sourceText }] } as any).skills;
      assert.ok(authored.kit?.length && !isLegacyWrappedKit(authored.kit), `${e.id}/${entry.name} 須有完整圖紙`);
      assert.equal(entry.route, authored.effectMode, `${e.id}/${entry.name}`);
    }
  }
});
console.log(`稽核治理 ${checks} 個情境通過。`);
