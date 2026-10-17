// 5010 星光·魯斯王 星光·浪打千擊 Kit：5~10連擊（每擊20%機率攻擊、速度、命中+1）、消回合→對手2回合攻擊MISS、
// 對手星火之灼時+75%（體力低於對手翻倍）、20%百分比傷害（每次使用+10%，最高40%）。
// 通用 op：multi_hit、after_attack_hit+chance、clear_turn→turn_key_set{attackMissTurns}（修正舊handler死鍵 missTurns）、
// boost{x2If}、dmg{rampInc,rampCap}。
// 舊 handler missTurns 只寫不讀（真實死鍵）：改用引擎命中判定端的 attackMissTurns 通用鍵。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 必中\n🎯 1回合做5~10次攻擊，每次攻擊都有20%的幾率令自身攻擊+1，速度+1，命中+1\n🎯 消除對手回合類效果，消除成功則對手2回合內攻擊技能MISS\n🎯 對手處於星火之灼時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍\n🎯 附加自身最大體力20%的百分比傷害，每次使用增加10%，最高40%';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

export const MIGRATED_STARLIGHT_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5010'], name: '星光·浪打千擊', description: raw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 5~10 次攻擊（引擎 attackHitCountThisAction）
    sequence('1回合做5~10次攻擊', [
      { acts: [a('multi_hit', { min: 5, max: 10 })] },
    ], 1),
    // 每次攻擊 20% 機率：攻擊、速度、命中 +1
    { codeId: 'effect_sequence', node: 'after_attack_hit', source: 'skill', role: 'attached', order: 2,
      customText: '每次攻擊都有20%的幾率令自身攻擊+1，速度+1，命中+1',
      params: { clause: { raw: '每次攻擊都有20%的幾率令自身攻擊+1，速度+1，命中+1', trig: 'attack_hit', parsed: true, body: [
        { cond: [c('chance', { pct: 20 }, '20%幾率')], acts: [a('stat', { side: 'self', stats: ['攻擊', '速度', '命中'], v: 1 })] },
      ] } } },
    // 消除回合類效果，成功 → 對手 2 回合攻擊 MISS（attackMissTurns：引擎 computeHitChance 讀取端）
    sequence('消除對手回合類效果，消除成功則對手2回合內攻擊技能MISS', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [
        a('turn_key_set', { key: 'attackMissTurns', turns: 2, side: 'opp', label: '攻擊技能MISS' }),
      ] },
    ], 3),
    // 對手處於星火之灼時 +75%；體力低於對手翻倍（boost x2If）
    sequence('對手處於星火之灼時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍', [
      { cond: [c('has_mark', { side: 'opp', name: '星火之灼' }, '對手處於星火之灼')], acts: [
        a('boost', { mult: 1.75, kind: '攻擊', x2If: c('hp_cmp', { side: 'self', op: '低於' }, '體力低於對手') }),
      ] },
    ], 4),
    // 20% 百分比傷害，每次使用 +10%，最高 40%
    // 附加傷害在連擊主傷害結算之後（傷害結算後時點）；放在使用時點會先於主傷害，目標在 1 點體力時被附加傷害先擊敗而沒有主傷害。
    (() => {
      const text = '附加自身最大體力20%的百分比傷害，每次使用增加10%，最高40%';
      const body = [{ acts: [a('dmg', { base: '最大體力', of: 'self', ratio: 0.2, type: '百分比', rampInc: 10, rampCap: 40 })] }];
      return { ...sequence(text, body, 5), node: 'on_hit' as const, params: { clause: { raw: text, trig: 'after_hit', parsed: true, body } } };
    })(),
  ] },
];

