import assert from 'node:assert/strict';
import { spriteHeightRatio, DEFAULT_HEIGHT_RATIO, opaqueBoxFromPixels, placeSprite } from '../src/battle/spriteMetrics';
import { judgeTurnLimit, countedAlive, PEAK_TURN_LIMIT } from '../src/battle/turnLimit';
import { signIconFor } from '../src/battle/effectIcons';

// 立繪比例：身高越高，可見高度比例越大；無效值用中間值
const hs = [38, 49.5, 100, 195, 266, 360, 500];
const rs = hs.map(spriteHeightRatio);
for (let i = 1; i < rs.length; i++) assert.ok(rs[i] > rs[i - 1], `身高 ${hs[i]} 比例應大於 ${hs[i - 1]}`);
assert.ok(rs[0] >= 0.4 && rs.at(-1)! <= 0.98);
for (const bad of [0, -5, NaN, 1568883]) assert.equal(spriteHeightRatio(bad), DEFAULT_HEIGHT_RATIO);

// 不透明區域：只有中間 2×2 不透明
const W = 4, H = 4, px = new Uint8ClampedArray(W * H * 4);
for (const [x, y] of [[1, 2], [2, 2], [1, 3], [2, 3]]) px[(y * W + x) * 4 + 3] = 255;
const box = opaqueBoxFromPixels(px, W, H, 1, W, H);
assert.deepEqual([box.left, box.top, box.right, box.bottom], [1, 2, 3, 4]);

// 擺放：可見高度＝場地高×比例；寬度超過上限等比縮小；腳底貼地
const p = placeSprite({ w: 400, h: 400, left: 100, top: 100, right: 300, bottom: 400 }, 1000, 600, 0.5);
assert.equal((400 - 100) * p.scale, 300, '可見高度 300');
assert.equal(p.offsetBottom + 0, 0, '腳底貼地');
assert.equal(p.offsetX, -200 * p.scale, '水平置中於可見區域');
const wide = placeSprite({ w: 1000, h: 300, left: 0, top: 0, right: 1000, bottom: 300 }, 400, 600, 0.6);
assert.equal(1000 * wide.scale, 400, '過寬時以寬度上限縮放');

// 巔峰 6V6：滿 50 回合依存活精靈數判勝負，額外精靈不計
const elf = (hp: number, extra = false) => ({ currentHp: hp, isExtra: extra }) as any;
const dead = (e: any) => e.currentHp <= 0;
const a = [elf(1), elf(1), elf(0), elf(1, true), elf(1, true)];
const b = [elf(1), elf(0), elf(0)];
assert.equal(countedAlive(a, dead), 2, '額外精靈不計入');
assert.equal(judgeTurnLimit('peak_6v6', PEAK_TURN_LIMIT - 1, a, b, dead), null, '未滿 50 回合不判');
assert.equal(judgeTurnLimit('peak_6v6', PEAK_TURN_LIMIT, a, b, dead), 'p1');
assert.equal(judgeTurnLimit('peak_6v6', PEAK_TURN_LIMIT, [elf(1)], [elf(1), elf(1, true)], dead), 'draw');
assert.equal(judgeTurnLimit('normal_6v6', 99, a, b, dead), null, '一般 6V6 不套用');
const seven = [...Array(7)].map(() => elf(1));
assert.equal(countedAlive(seven, dead), 6, '第 7 位以後視為額外精靈');

// 三主寵星光型態印記圖示（SeerAPI sign 96/97/98）
assert.equal(signIconFor('星芳之纏'), '/seer/signbuff/96.png');
assert.equal(signIconFor('星海之浸'), '/seer/signbuff/97.png');
assert.equal(signIconFor('星火之灼'), '/seer/signbuff/98.png');
console.log('對戰版面：立繪身高比例、可見區域擺放、巔峰 50 回合判定、三主寵印記圖示通過');

// 無極聖武【英雄之耀】：只有「機率 ≤50% 使對方陷入異常」的通用特性扣層；頑強、瞬殺、反抗等不算
{
  const { hasLowChanceStatusTrait } = await import('../src/effects/elves/staged-arena/wujiRegistry');
  assert.equal(hasLowChanceStatusTrait('受到普通攻擊時有 8% 使對方麻痺'), true);
  assert.equal(hasLowChanceStatusTrait('自身的物理攻擊有 8% 機率使對方害怕'), true);
  assert.equal(hasLowChanceStatusTrait('受到致死攻擊時有 8% 機率餘下 2 點體力'), false);
  assert.equal(hasLowChanceStatusTrait('進攻類技能有 7.0% 機率秒殺對方'), false);
  assert.equal(hasLowChanceStatusTrait('受到特殊攻擊時有 14% 機率使對方攻擊降低 1 個等級'), false);
  const { countsAgainstHeroGlory, heroGloryGain, heroGloryDescription } = await import('../src/effects/elves/staged-arena/wujiRegistry');
  assert.equal(hasLowChanceStatusTrait('使用攻擊技能後 30% 令對手害怕'), true, '專屬特性寫法：令對手');
  assert.equal(hasLowChanceStatusTrait('攻擊後 100% 令對手麻痺'), false, '高於 50% 不算');
  assert.equal(hasLowChanceStatusTrait('回合結束時 50% 解除自身異常狀態'), false, '解除異常不算');
  // 檢測專屬特性（魂印）與通用特性，不檢測特質
  assert.equal(countsAgainstHeroGlory({ soulMark: { description: '受到攻擊時 20% 使對方中毒' } }), true, '專屬特性計入');
  assert.equal(countsAgainstHeroGlory({ trait: { description: '8% 使對方燒傷' } }), true, '通用特性計入');
  assert.equal(countsAgainstHeroGlory({ alienTraits: { generalTrait: { description: '8% 使對方麻痺' } } }), true, '通用特性計入');
  assert.equal(countsAgainstHeroGlory({ soulMark: { description: '免疫異常' }, alienTraits: { gen2Trait: { description: '10% 使對方害怕' }, alienTrait: { description: '10% 使對方麻痺' } } } as any), false, '特質不計入');
  assert.equal(heroGloryGain(500, 300, 3), 90);
  assert.match(heroGloryDescription(3, 90, 200), /目前 3 層：.*各 \+90/);
  const { STAGED_ARENA_ELVES } = await import('../src/data/stagedArenaElves');
  assert.ok(STAGED_ARENA_ELVES.every(e => e.skills.every(s => s.category !== '屬性' || s.type === '無屬性')), '競技場精靈屬性技能顯示無屬性圖示');
  console.log('無極聖武英雄之耀扣層條件、競技場屬性技能圖示通過');
}
