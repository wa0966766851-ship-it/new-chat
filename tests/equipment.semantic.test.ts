import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { applyEquipmentToElfStats } from '../src/data/suitsAndEyewears';

{
  const base = { hp: 1000, atk: 500, def: 300, spatk: 400, spdef: 300, speed: 350 };
  const result = applyEquipmentToElfStats(base, 'corrupter');
  assert.equal(result.atk, 550, '腐蝕者攻擊+10%必須增加50點，不能以0.1%結算');
  assert.equal(result.spatk, 440, '腐蝕者特攻+10%');
  assert.equal(result.hp, 1000, '不應加成體力');
}

/**
 * 裝備存取層測試
 *
 * 鎖住三件事：
 *   1. 讀寫的 key 必須與 Legacy 完全一致（seer_p1_suit 等）
 *   2. 只改一個欄位不得影響其他兩個
 *   3. localStorage 壞掉／不可用時不得拋錯
 */

const dom = new JSDOM('', { url: 'http://localhost:3000/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { readEquipment, writeEquipment, clearEquipment, isEquipped } = await import('../src/shell/equipment');

const ls = dom.window.localStorage;

// ── 空狀態 ──
{
  ls.clear();
  const e = readEquipment('p1');
  assert.deepEqual(e, { suit: '', eyewear: '', title: '' }, '沒設定時三個欄位都是空字串');
}

// ── 寫入後可讀回 ──
{
  ls.clear();
  writeEquipment('p1', 'suit', 'sky_cloud');
  assert.equal(readEquipment('p1').suit, 'sky_cloud');
  assert.equal(ls.getItem('seer_p1_suit'), 'sky_cloud', '必須用 Legacy 的 key');
}

// ── 只改一個欄位，不影響其他 ──
{
  ls.clear();
  writeEquipment('p1', 'suit', 'sky_cloud');
  writeEquipment('p1', 'eyewear', 'roamer_ah');
  writeEquipment('p1', 'title', 'some_title');
  const e = readEquipment('p1');
  assert.equal(e.suit, 'sky_cloud');
  assert.equal(e.eyewear, 'roamer_ah');
  assert.equal(e.title, 'some_title');

  writeEquipment('p1', 'suit', 'dark_angel');
  const e2 = readEquipment('p1');
  assert.equal(e2.suit, 'dark_angel', '換套裝');
  assert.equal(e2.eyewear, 'roamer_ah', '眼鏡不受影響');
  assert.equal(e2.title, 'some_title', '稱號不受影響');
}

// ── P1 與 P2 互不干擾 ──
{
  ls.clear();
  writeEquipment('p1', 'suit', 'a');
  writeEquipment('p2', 'suit', 'b');
  assert.equal(readEquipment('p1').suit, 'a');
  assert.equal(readEquipment('p2').suit, 'b');
  assert.equal(ls.getItem('seer_p1_suit'), 'a');
  assert.equal(ls.getItem('seer_p2_suit'), 'b');
}

// ── 卸下 ──
{
  ls.clear();
  writeEquipment('p1', 'suit', 'sky_cloud');
  clearEquipment('p1', 'suit');
  assert.equal(readEquipment('p1').suit, '');
  assert.equal(ls.getItem('seer_p1_suit'), '', '卸下要寫空字串，不是刪 key（與 Legacy 一致）');
}

// ── isEquipped ──
{
  ls.clear();
  writeEquipment('p2', 'title', 't1');
  assert.equal(isEquipped('p2', 'title', 't1'), true);
  assert.equal(isEquipped('p2', 'title', 't2'), false);
  assert.equal(isEquipped('p1', 'title', 't1'), false, '不能誤判另一側');
}

// ── localStorage 拋錯時不得崩，也不能假裝寫入成功 ──
{
  ls.clear();
  writeEquipment('p1', 'suit', 'sky_cloud');
  const proto = dom.window.Storage.prototype;
  const getOriginal = proto.getItem;
  const setOriginal = proto.setItem;
  try {
    proto.getItem = () => { throw new Error('blocked'); };
    assert.deepEqual(readEquipment('p1'), { suit: '', eyewear: '', title: '' });
    proto.getItem = getOriginal;
    proto.setItem = () => { throw new Error('quota'); };
    assert.doesNotThrow(() => writeEquipment('p1', 'suit', 'x'));
    assert.equal(writeEquipment('p1', 'suit', 'x').suit, 'sky_cloud', '失敗時回傳原配裝');
    assert.equal(ls.getItem('seer_p1_suit'), 'sky_cloud', '失敗不改動存檔');
  } finally { proto.getItem = getOriginal; proto.setItem = setOriginal; }
}

console.log('裝備存取：key 一致、單欄位隔離、P1/P2 隔離、卸下、容錯 通過');
