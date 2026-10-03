import assert from 'node:assert/strict';
import { hiddenFromViewer, viewerMaskTerms, maskViewerText } from '../src/battle/viewerPerspective';
import { statusVisual } from '../src/battle/effectIcons';
import { StatusRegistry } from '../src/effects/statusRegistry';
import { skillTypeMultiplier } from '../src/battle/skillTypeOverride';

const hidden: any = { name: '無序.六刃', isConcealed: true, skills: [{ name: '靜刃止水' }], soulMark: { name: '刃' }, alienTraits: { general: { name: '鋒芒' } } };
assert.equal(hiddenFromViewer(hidden, 'p2'), true, '敵方隱匿：掩蓋');
assert.equal(hiddenFromViewer(hidden, 'p1'), false, '己方隱匿：完整顯示');
assert.equal(hiddenFromViewer(hidden), true, '未指定陣營時保守掩蓋');
const terms = viewerMaskTerms([hidden, { name: '譜尼', skills: [{ name: '虛無' }] } as any]);
assert.equal(maskViewerText('【無序.六刃】使用了【靜刃止水】，觸發【鋒芒】', terms), '【未知精靈】使用了【未知技能】，觸發【未知效果】');
assert.equal(maskViewerText('譜尼使用了虛無', terms), '譜尼使用了虛無', '未隱匿精靈不受影響');

// 魘昧：官方圖標、弱化＋限制類
assert.equal(statusVisual('魘昧')?.icon, '/seer/abnormal/44.png');
assert.equal(statusVisual('魘味')?.icon, '/seer/abnormal/44.png', '舊字形也取官方圖標');
assert.deepEqual(StatusRegistry['魘昧'].categories, ['WEAKENING', 'RESTRICTIVE']);

// 固定按最高克制倍率（4 倍）
assert.equal(skillTypeMultiplier({ fixedTypeMultThisAction: 4 }, '龍', '水'), 4);
console.log('視角迷霧：隱匿只對敵方掩蓋、文字掩蓋、魘昧圖標與分類、固定克制倍率通過。');
