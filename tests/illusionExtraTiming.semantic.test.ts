import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beginPetFormTransition, waitPetFormTransition } from '../src/battle/petFormTransitions';
import { ILLUSION_BEAT_MS, EXTRA_ANIM_MIN_MS } from '../src/battle/presentation';
import { poseBlendGhosts, POSE_BLEND_ALPHA } from '../src/battle/customPetClip';

// 2026-11-08：幻化與額外行動演出「沒有預留時間、馬上跳完」。
// 1) 幻化後外觀名稱／皮膚改變，播放器登記與播放層等待必須用同一個鍵（戰鬥實例），否則播放層等不到變身片段。
const original = { id: 'x', battleId: 'b-1', name: '原精靈', skinId: '' };
const disguised = { ...original, name: '幻化目標', skinId: 'skin-9' };
const release = beginPetFormTransition('p1', disguised); let done = false;
const wait = waitPetFormTransition('p1', original).then(() => { done = true; });
await new Promise(r => setTimeout(r, 30)); assert.equal(done, false, '以原精靈身分等待時能等到幻化外觀的變身片段');
release(); await wait; assert.equal(done, true);
// 2) 幻化留拍、額外行動最短演出
assert.ok(ILLUSION_BEAT_MS.simple >= 600 && ILLUSION_BEAT_MS.actions >= 200);
assert.ok(EXTRA_ANIM_MIN_MS >= 600);
const pres = readFileSync('src/battle/presentation.ts', 'utf8');
assert.match(pres, /anim\?\.category==='extra'\?Math\.max\(duration,EXTRA_ANIM_MIN_MS\):duration/);
assert.match(pres, /this\.morphSide=\{p1:morph\.includes\('p1'\),p2:morph\.includes\('p2'\)\}/);
// 3) UI：幻化閃光與額外行動衝刺＋金光，動畫長度可由播放層指定
const ui = readFileSync('src/components/BattleScreen.ui.tsx', 'utf8'), sprite = readFileSync('src/components/battle/ProportionalSprite.tsx', 'utf8');
assert.match(ui, /animDuration=\{isMorphing \? 0\.7 : isExtra \? 0\.65 : undefined\}/);
assert.match(readFileSync('src/components/BattleScreen.tsx', 'utf8'), /illusionMorph=\{presentation\.morphSide\}/);
assert.match(sprite, /duration: \(animDuration \?\? 0\.35\)\/animationSpeed/);
// 4) 自製動作換姿勢殘影：切換後兩格疊前一張姿勢（0.45→0.2），待機不套用、可關閉、同姿勢移動不套用
const A = [0, 0, .1, .1], B = [.2, 0, .3, .1], C1 = [0, 2, 2, 2, 2, 0, 0, 0], C2 = [1, 2, 3, 2, 3, 0, 1, 0];
const q = (c: number[], buv: number[], a = 1) => ({ c, buv, a });
const seq = [q(C1, A), q(C1, A), q(C2, B), q(C2, B), q(C2, B), q(C1, B)];
const g = poseBlendGhosts('attack', seq as any, A);
assert.deepEqual(g.map(x => x?.a ?? 0), [0, 0, POSE_BLEND_ALPHA[0], POSE_BLEND_ALPHA[1], 0, 0]);
assert.deepEqual(g[2]!.buv, A); assert.deepEqual(g[2]!.c, C1, '殘影用前一張姿勢的位置與圖格');
assert.ok(poseBlendGhosts('standby', seq as any, A).every(x => !x), '待機不套用');
assert.ok(poseBlendGhosts('attack', seq as any, A, false).every(x => !x), '可關閉');
assert.ok(poseBlendGhosts('attack', [q(C1, A), { ...q(C2, B), g: [{ p: [], u: [] }] }] as any, A).every(x => !x), '分層網格影格不套用');
console.log('幻化／額外行動演出時間：變身等待鍵一致、幻化留拍、額外行動最短 0.7 秒、UI 接線、自製動作換姿勢殘影通過');
process.exit(0);
