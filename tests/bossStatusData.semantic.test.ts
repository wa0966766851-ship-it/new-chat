import assert from 'node:assert/strict';
import test from 'node:test';
import {StatusRegistry} from '../src/effects/statusRegistry';
import {BOSS_TRAITS} from '../src/data/bossTraits';

// 2026-10-29：BOSS 類異常的資料規範。
// 1. BOSS 特性在 PVP 被施加時屬「附屬類異常」，必須同時具備 AUXILIARY 與 BOSS_ONLY
// 2. 描述格式：附屬類異常；BOSS 類異常；處於該異常狀態則<效果>（等級 1/2/3 分別為 …）。無回合數且不會隨回合遞減，下場後保留
// 3. 描述不得殘留未代入的 {x}{y}{s} 模板

test('神話同時具備 AUXILIARY 與 BOSS_ONLY', () => {
  const e = StatusRegistry['神話'];
  assert.ok(e, '神話必須存在');
  assert.ok(e.categories.includes('AUXILIARY'), '神話應屬附屬類異常');
  assert.ok(e.categories.includes('BOSS_ONLY'), '神話應屬 BOSS 類異常');
});

test('免疫同時具備 AUXILIARY 與 BOSS_ONLY', () => {
  const e = StatusRegistry['免疫'];
  assert.ok(e.categories.includes('AUXILIARY'));
  assert.ok(e.categories.includes('BOSS_ONLY'));
});

test('神話描述保留「附屬類異常；BOSS 類異常；」前綴', () => {
  const d = StatusRegistry['神話'].description;
  assert.ok(d.startsWith('附屬類異常；BOSS 類異常；'), `實際：${d.slice(0, 40)}`);
});

test('所有 BOSS 特性都具備 AUXILIARY 與 BOSS_ONLY', () => {
  for (const t of BOSS_TRAITS) {
    if (t.conf === 'existing') continue;
    const e = StatusRegistry[t.status];
    assert.ok(e, `${t.name} 應有狀態條目`);
    assert.ok(e.categories.includes('AUXILIARY'), `${t.name} 應屬附屬類異常`);
    assert.ok(e.categories.includes('BOSS_ONLY'), `${t.name} 應屬 BOSS 類異常`);
  }
});

test('所有 BOSS 特性描述符合規範格式', () => {
  for (const t of BOSS_TRAITS) {
    if (t.conf === 'existing') continue;
    const d = StatusRegistry[t.status].description;
    assert.ok(d.startsWith('附屬類異常；BOSS 類異常；處於該異常狀態則'), `${t.name} 前綴不符：${d.slice(0, 40)}`);
    assert.ok(d.includes('無回合數且不會隨回合遞減，下場後保留'), `${t.name} 缺結尾說明`);
    assert.ok(!d.includes('。。'), `${t.name} 有重複句號`);
  }
});

test('描述不得殘留未代入的模板符號', () => {
  for (const t of BOSS_TRAITS) {
    if (t.conf === 'existing') continue;
    const d = StatusRegistry[t.status].description;
    assert.ok(!/[{}]/.test(d), `${t.name} 有未代入模板：${d.slice(0, 80)}`);
  }
});

test('有 lv 等級資料的特性要在描述寫出等級差異', () => {
  let checked = 0;
  for (const t of BOSS_TRAITS) {
    if (t.conf === 'existing') continue;
    if (!Array.isArray(t.lv) || t.lv.length !== 4) continue;
    const d = StatusRegistry[t.status].description;
    assert.ok(d.includes('等級 1/2/3 分別為'), `${t.name} 應寫出等級差異：${d.slice(0, 80)}`);
    checked++;
  }
  assert.ok(checked > 0, '應至少有一個特性帶 lv 資料');
});

console.log('BOSS 類異常資料規範：分類、描述格式、模板代入、等級差異 全部通過');
