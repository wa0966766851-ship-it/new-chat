import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { planLogArchive, applyLogArchive } from '../tools/organizeWorkspace.mjs';
const root = mkdtempSync(resolve(tmpdir(), 'seer-log-archive-test-'));
try {
  writeFileSync(resolve(root, 'a.log'), 'test a'); writeFileSync(resolve(root, 'b.log'), 'test b');
  writeFileSync(resolve(root, 'source.ts'), 'untouched');
  let plan = planLogArchive(root, '20261008');
  assert.equal(plan.moves.length, 2); assert.ok(existsSync(resolve(root, 'a.log')), '預覽不搬檔');
  assert.throws(() => planLogArchive(root, '../outside'), /八位數/);
  assert.throws(() => applyLogArchive(plan), /Git專案/);
  mkdirSync(resolve(root, '.git'));
  writeFileSync(resolve(root, 'a.log'), 'changed');
  assert.throws(() => applyLogArchive(plan), /已改變/);
  assert.ok(existsSync(resolve(root, 'a.log')), '過期計畫不能搬任何檔');
  plan = planLogArchive(root, '20261008');
  const result = applyLogArchive(plan);
  assert.equal(result.moved.length, 2); assert.equal(result.failed.length, 0);
  assert.equal(readFileSync(resolve(root, 'source.ts'), 'utf8'), 'untouched');
  assert.equal(readFileSync(resolve(plan.directory, 'a.log'), 'utf8'), 'changed');
  const saved = JSON.parse(readFileSync(result.manifest, 'utf8'));
  assert.deepEqual(saved.moved, plan.moves); assert.ok(saved.recovery.includes('禁止覆寫'));
  writeFileSync(resolve(root, 'a.log'), 'new run');
  assert.throws(() => planLogArchive(root, '20261008'), /不覆寫/);
  assert.equal(readFileSync(resolve(root, 'a.log'), 'utf8'), 'new run');
  console.log('日誌整理：預覽、路徑／Git保護、過期拒絕、內容保留、清單及不覆寫通過。');
} finally { rmSync(root, { recursive: true }); }
