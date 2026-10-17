// 5035 御天龍神·哈莫 破曉 Kit：先制+3／必中／雙攻總和為特攻(差值>200→200固定傷害)／
// 消回合→疲憊／吸取提升→對手下2次物理受傷×2／吸取⅓(吸取後體力>½→威力×2)。
// 新機制：dmg_taken_uses（受方次數增傷 timer）、atk_gap 條件（雙攻差值）。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 先制+3\r\n■ 必中\r\n■ 本次攻擊計算技能傷害時以自身攻擊、特攻值總和作為自身特攻值計算，兩者差值高於200則額外附加對手200點固定傷害\r\n🎯 消除對手回合類效果，消除成功則100%令對手疲憊\r\n🎯 吸取對手能力提升狀態，吸取成功則對手下2次受到的物理攻擊技能傷害翻倍\r\n🎯 吸取對手最大體力⅓，吸取後若自身體力高於½則當回合技能威力提升100%';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

export const MIGRATED_HAMO_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5035'], name: '破曉', description: raw, kit: [
    property('■ 先制+3', 'base_priority', 3, 0),
    property('■ 必中', 'sure_hit', true, 1),
    // 本次攻擊以雙攻總和為特攻（既有引擎鍵 blkAtkSpatkSum）
    sequence('本次攻擊計算技能傷害時以自身攻擊、特攻值總和作為自身特攻值計算', [
      { acts: [a('atk_sum_calc', {})] },
    ], 2),
    // 雙攻差值高於 200 → 附加 200 點固定傷害
    sequence('兩者差值高於200則額外附加對手200點固定傷害', [
      { cond: [c('atk_gap', { side: 'self', op: '高於', amount: 200 }, '雙攻差值高於200')], acts: [
        a('dmg', { flat: 200, type: '固定' }),
      ] },
    ], 3),
    // 消回合 → 成功→100%疲憊
    sequence('消除對手回合類效果，消除成功則100%令對手疲憊', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('status', { side: 'opp', status: '疲憊', chance: 100, turns: 3 })] },
    ], 4),
    // 吸取對手能力提升；成功 → 對手下2次受到的物理傷害×2
    sequence('吸取對手能力提升狀態，吸取成功則對手下2次受到的物理攻擊技能傷害翻倍', [
      { acts: [a('stat_steal', { mode: '吸取' })] },
      { chain: 'success', acts: [a('dmg_taken_uses', { uses: 2, mult: 2, kind: '物理' })] },
    ], 5),
    // 吸取⅓；吸取後自身體力>½ → 當回合技能威力×2
    sequence('吸取對手最大體力⅓，吸取後若自身體力高於½則當回合技能威力提升100%', [
      { acts: [
        a('drain', { ratio: 1 / 3, true: false }),
      ] },
      { pre: false, cond: [c('hp_ratio', { side: 'self', op: '高於', ratio: 0.5 }, '吸取後體力高於½')], acts: [
        a('boost', { power: true, mult: 2 }),
      ] },
    ], 6),
  ] },
];
