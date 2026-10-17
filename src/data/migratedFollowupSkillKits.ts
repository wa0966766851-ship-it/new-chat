import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';

const c = (name: string, p: Record<string, any> = {}) => ({ c: name, p, label: name });
const atHit = (raw: string, body: any[], order: number): KitEntry => ({
  ...sequence(raw, body, order), node: 'on_hit',
  params: { clause: { raw, marker: '🎯', trig: 'after_hit', parsed: true, body } },
});

/** 已有通用原子組成的整份技能；保留全文、角色與各句獨立成敗。 */
export const MIGRATED_FOLLOWUP_SKILL_KITS: ReviewedSequenceSkill[] = [{
  elfIds: ['5026'], name: '四象崩壞砲',
  description: '■ 必中\n🎯 使自身全屬性+1\n🎯 消除對手回合類效果，消除成功則雙方命中+1\n🎯 消除對手能力提升狀態，消除成功則自身3回合內受到攻擊傷害不超過3\n🎯 2回合內對手攻擊技能無效\n---\n【S級技能石】（PP 2/2）',
  kit: [
    property('■ 必中', 'sure_hit', true, 0),
    sequence('🎯 使自身全屬性+1', [{ acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1 })] }], 1),
    sequence('🎯 消除對手回合類效果，消除成功則雙方命中+1', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('stat', { side: 'both', stats: ['命中'], v: 1 })] },
    ], 2),
    sequence('🎯 消除對手能力提升狀態，消除成功則自身3回合內受到攻擊傷害不超過3', [
      { acts: [a('stat_clear', { side: 'opp', kind: 'up' })] },
      { chain: 'success', acts: [a('damage_cap_turns', { side: 'self', dir: 'in', kind: '攻擊', cap: 3, turns: 3 })] },
    ], 3),
    sequence('🎯 2回合內對手攻擊技能無效', [{ acts: [a('invalid_turns', { turns: 2, kind: '攻擊' })] }], 4),
    // 分隔線與技能石/PP資訊保留在全文；它們不產生戰鬥動作。PP仍使用技能槽原始資料。
  ],
}, {
  elfIds: ['5030'], name: '四象靈獸',
  description: '■ 先制+4\n■ 必中\n🎯 反轉自身能力下降狀態，反轉成功則100%依序令對手進入燒傷、凍傷、中毒、麻痺\n🎯 吸取對手能力提升狀態，吸取成功則下2次自身造成的攻擊傷害翻倍\n🎯 自身下2次受到技能傷害，則回饋給對手等同於自身雙防值總和65%的真實傷害',
  kit: [
    property('■ 先制+4', 'base_priority', 4, 0), property('■ 必中', 'sure_hit', true, 1),
    sequence('🎯 反轉自身能力下降狀態，反轉成功則100%依序令對手進入燒傷、凍傷、中毒、麻痺', [
      { acts: [a('stat_reverse', { side: 'self', kind: 'down' })] },
      { chain: 'success', acts: [a('status_seq', { list: ['燒傷', '凍傷', '中毒', '麻痺'], chance: 100 })] },
    ], 2),
    sequence('🎯 吸取對手能力提升狀態，吸取成功則下2次自身造成的攻擊傷害翻倍', [
      { acts: [a('stat_steal', { mode: '吸取' })] },
      { chain: 'success', acts: [a('dmg_mod_uses', { uses: 2, boost: 1, kind: '攻擊' })] },
    ], 3),
    sequence('🎯 自身下2次受到技能傷害，則回饋給對手等同於自身雙防值總和65%的真實傷害', [{ acts: [
      a('timed_uses', { uses: 2, trig: 'damaged_skill', body: [{ acts: [a('dmg', { base: 'stat:防禦和特防', of: 'self', ratio: .65, type: '真實' })] }] }),
    ] }], 4),
  ],
}, {
  elfIds: ['5010'], name: '星光·排山倒海',
  description: '🎯 無視對手攻擊免疫效果\n🎯 無視對手護盾效果\n🎯 命中後100%使對手冰封，未觸發則對手下2回合先制-2\n🎯 給對手造成傷害時，傷害數值的50%恢復自身體力',
  kit: [
    sequence('🎯 無視對手攻擊免疫效果', [{ acts: [a('ignore', { what: '攻擊免疫' })] }], 0),
    sequence('🎯 無視對手護盾效果', [{ acts: [a('ignore', { what: '護盾' })] }], 1),
    atHit('🎯 命中後100%使對手冰封，未觸發則對手下2回合先制-2', [
      { acts: [a('status', { side: 'opp', status: '冰封', chance: 100 })] },
      { chain: 'fail', acts: [a('prio_turns', { side: 'opp', turns: 2, v: -2, attackOnly: false })] },
    ], 2),
    sequence('🎯 給對手造成傷害時，傷害數值的50%恢復自身體力', [{ acts: [a('vampire', { ratio: .5, kind: '攻擊' })] }], 3),
  ],
}, {
  elfIds: ['5025'], name: '深淵凝視',
  description: '■ 必中\n🎯 5回合內令自身免疫並反彈所有異常狀態\n🎯 3回合內自身使用技能100%令對手害怕，未觸發則2回合內對手造成傷害無法超過280且攻擊技能附加效果失效\n🎯 下3次自身攻擊技能附加對手300點固定傷害，若對手受到此傷害後體力未減少則額外附加對手300點真實傷害\n🎯 下2次自身攻擊技能造成傷害提升150%',
  kit: [
    property('■ 必中', 'sure_hit', true, 0),
    sequence('🎯 5回合內令自身免疫並反彈所有異常狀態', [{ acts: [a('immune_status_turns', { turns: 5, reflect: true, cls: '' })] }], 1),
    sequence('🎯 3回合內自身使用技能100%令對手害怕，未觸發則2回合內對手造成傷害無法超過280且攻擊技能附加效果失效', [{ acts: [
      a('timed', { turns: 3, from: 'now', trig: 'self_skill', initial: true, body: [
        { acts: [a('status', { side: 'opp', status: '害怕', chance: 100 })] },
        { chain: 'fail', acts: [a('damage_cap_turns', { side: 'opp', dir: 'out', kind: '攻擊', cap: 280, turns: 2 }), a('add_invalid_turns', { turns: 2, kind: '攻擊' })] },
      ] }),
    ] }], 2),
    sequence('🎯 下3次自身攻擊技能附加對手300點固定傷害，若對手受到此傷害後體力未減少則額外附加對手300點真實傷害', [{ acts: [
      a('timed_uses', { uses: 3, trig: 'self_attack', body: [
        { acts: [a('dmg', { flat: 300, type: '固定' })] },
        { cond: [c('last_no_dmg')], acts: [a('dmg', { flat: 300, type: '真實' })] },
      ] }),
    ] }], 3),
    sequence('🎯 下2次自身攻擊技能造成傷害提升150%', [{ acts: [a('dmg_mod_uses', { uses: 2, boost: 1.5, kind: '攻擊' })] }], 4),
  ],
}, {
  elfIds: ['5027'], name: '曙天',
  description: '■ 先制+3\n■ 必中\n🎯 消除對手回合類效果，消除成功則100%令對手束縛，未觸發則本次造成的攻擊傷害翻倍\n🎯 吸取對手能力提升狀態，吸取成功則對手隨機2項技能PP值歸零\n🎯 傷害大於300吸取對手最大體力1/3\n🎯 傷害小於300自身下1次攻擊先制+1',
  kit: [
    property('■ 先制+3', 'base_priority', 3, 0), property('■ 必中', 'sure_hit', true, 1),
    sequence('🎯 消除對手回合類效果，消除成功則100%令對手束縛，未觸發則本次造成的攻擊傷害翻倍', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('status', { side: 'opp', status: '束縛', chance: 100 })] },
      { chain: 'any_fail', acts: [a('boost', { mult: 2, kind: '攻擊', power: false })] },
    ], 2),
    sequence('🎯 吸取對手能力提升狀態，吸取成功則對手隨機2項技能PP值歸零', [
      { acts: [a('stat_steal', { mode: '吸取' })] },
      { chain: 'success', acts: [a('pp_zero_random', { count: 2 })] },
    ], 3),
    atHit('🎯 傷害大於300吸取對手最大體力1/3', [{ cond: [c('dmg_cmp', { op: '大於', v: 300 })], acts: [a('drain', { ratio: 1 / 3, true: false })] }], 4),
    atHit('🎯 傷害小於300自身下1次攻擊先制+1', [{ cond: [c('dmg_cmp', { op: '小於', v: 300 })], acts: [a('prio_next', { uses: 1, v: 1, attackOnly: true })] }], 5),
  ],
}];
