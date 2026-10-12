import assert from 'node:assert/strict';
import { MIGRATED_SEQUENCE_SKILL_KITS } from '../src/data/migratedSequenceSkillKits';
// 2026-10-12機械重構之前直接從原始完整物件擷取；不是依修後結果重新生成。
const fixtures = [
  {
    "ids": [
      "5003"
    ],
    "name": "天河衝擊",
    "fingerprint": "c8a6a8c3"
  },
  {
    "ids": [
      "5003"
    ],
    "name": "萬鈞鎮魂",
    "fingerprint": "3e9f1cf9"
  },
  {
    "ids": [
      "5003"
    ],
    "name": "混元護體",
    "fingerprint": "34f2434b"
  },
  {
    "ids": [
      "5003"
    ],
    "name": "淨·天河倒懸",
    "fingerprint": "607aa2e8"
  },
  {
    "ids": [
      "5002"
    ],
    "name": "盾先鋒制裁",
    "fingerprint": "f5bea9ab"
  },
  {
    "ids": [
      "5002"
    ],
    "name": "聖盾裁決",
    "fingerprint": "11bad4ac"
  },
  {
    "ids": [
      "5002"
    ],
    "name": "帝·永恆守護",
    "fingerprint": "7a932a09"
  },
  {
    "ids": [
      "5001"
    ],
    "name": "黯索魂噬",
    "fingerprint": "28864457"
  }
];
const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
function fingerprint(v: any) {
  let h = 2166136261;
  for (const c of JSON.stringify(canonical(v))) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
for (const f of fixtures) {
  const actual = MIGRATED_SEQUENCE_SKILL_KITS.find(d => d.name === f.name && JSON.stringify(d.elfIds) === JSON.stringify(f.ids));
  assert.ok(actual, f.name);
  const refactorBaseline=structuredClone(actual);
  // 使用者已確認未指明類型的傷害只指攻擊傷害；只有這兩個範圍修正是機械重構後的允許差異。
  // 舊指紋不重產：把此唯一已驗證差異還原後，其餘全部仍須符合原始基準。
  if(['萬鈞鎮魂','聖盾裁決'].includes(f.name)) {
    const action=refactorBaseline.kit[1].params.clause.body[0].acts[0];
    assert.equal(action.op,'vampire');assert.equal(action.p.kind,'攻擊');action.p.kind='技能';
  }
  assert.equal(fingerprint(refactorBaseline), f.fingerprint, f.name + ': 除已確認吸血範圍外，原文與所有參數不得變更');
}
console.log('8份／34條積木重構：除已確認兩處吸血範圍修正，其餘原物件指紋保持一致');
