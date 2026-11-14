// Regression for the 2026-11-11 "瀏覽器儲存空間不足" incident.
// 1) Restoring a large save must NOT write an extra full seer_before_desktop_restore_* backup.
// 2) If one key exceeds quota, the remaining keys are still restored (no whole-batch rollback).
// 3) history/ is capped so repeated writes cannot grow without bound.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { JSDOM } from 'jsdom';
import { PlayerSaveStore, registerPlayerSaves } from '../server/playerSaves';
import { initializePlayerSave } from '../src/utils/playerSaveBridge';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seer-quota-test-'));
const app = express();
registerPlayerSaves(app, root);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(r => server.once('listening', r));
const origin = `http://127.0.0.1:${(server.address() as any).port}`;
const request: typeof fetch = (url, options = {}) => fetch(new URL(String(url), origin), { ...options, headers: { ...options.headers, Origin: origin } });
const dom = new JSDOM('<body></body>', { url: origin });
Object.assign(globalThis, { document: dom.window.document, location: dom.window.location, localStorage: dom.window.localStorage });

try {
  // Seed a disk save with several keys.
  const store = new PlayerSaveStore(root);
  const entries: Record<string, string> = {
    seer_small_a: 'A',
    seer_small_b: 'B',
    seer_big: 'X'.repeat(400000),
    seer_small_c: 'C',
  };
  const seeded = store.write(store.read().revision, entries);
  assert.ok(seeded, 'seed write succeeds');

  // Fake Storage that throws QuotaExceededError only for seer_big.
  const backing = new Map<string, string>();
  const quotaStorage = {
    get length() { return backing.size; },
    key(i: number) { return [...backing.keys()][i] ?? null; },
    getItem(k: string) { return backing.has(k) ? backing.get(k)! : null; },
    setItem(k: string, v: string) {
      if (k === 'seer_big') throw new DOMException('quota', 'QuotaExceededError');
      backing.set(k, v);
    },
    removeItem(k: string) { backing.delete(k); },
    clear() { backing.clear(); },
  } as unknown as Storage;
  // Make the disk version look newer so restore is triggered.
  quotaStorage.setItem('seer_desktop_save_revision', 'older-revision');

  const bridge = await initializePlayerSave(quotaStorage, request);
  // The big key failed, so sync is stopped, but the three small keys must be present.
  assert.equal(quotaStorage.getItem('seer_small_a'), 'A', 'small key A restored');
  assert.equal(quotaStorage.getItem('seer_small_b'), 'B', 'small key B restored');
  assert.equal(quotaStorage.getItem('seer_small_c'), 'C', 'small key C restored');
  assert.equal(quotaStorage.getItem('seer_big'), null, 'oversized key skipped, not rolled back');
  // No extra full backup should have been written into the browser.
  assert.ok(![...backing.keys()].some(k => k.startsWith('seer_before_desktop_restore_')),
    'no redundant full backup written during restore');
  bridge?.stop();

  // history cap: 25 writes must leave at most 20 history files.
  for (let i = 0; i < 25; i++) {
    const cur = store.read();
    const next = store.write(cur.revision, { ...cur.entries, seer_counter: String(i) });
    assert.ok(next, `write ${i} succeeds`);
  }
  const hist = fs.readdirSync(path.join(root, 'history')).filter(n => n.endsWith('.json'));
  assert.ok(hist.length <= 20, `history capped at 20, got ${hist.length}`);
  assert.ok(hist.length >= 1, 'history still keeps recent backups');

  console.log(`玩家存檔配額回歸：逐 key 容錯、無多餘整包備份、history 上限（${hist.length} 份）通過。`);
} finally {
  server.closeAllConnections();
  await new Promise<void>(r => server.close(() => r()));
  dom.window.close();
  fs.rmSync(root, { recursive: true, force: true });
}
