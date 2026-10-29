// B 組（未連接 73 項計畫）真 Kit：#36 5025 懼噬.虛實逆寫、#40 5027 星垂穹儀、#41 5027 星祈·繞指星瀾、
// #42 5027 星執·浩邃星幕。（#49 未轉，保留 handler）
// 新通用 op 見 src/blocks/ops/groupB.ts；本檔只放資料，描述需與精靈資料逐字相同。
// 未轉換（保留原 handler／通用路徑）：#44 5029 異、#46 5029 雷神、#47 5029 霆·禁雷敕令、#48 5030 聖、#50 5031 界；原因見提交說明。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
import type { Stmt } from '../blocks/model';

const c = (name: string, p: any, label: string) => ({ c: name, p, label });
/** 條件式先制（沿用既有 base_priority + conditions 查詢）。 */
const conditionalPriority = (text: string, value: number, order: number, conditions: any[]): KitEntry => ({
  ...property(text, 'base_priority', value, order), params: { property: 'base_priority', value, conditions },
});
const stageView = (text: string, value: string, order: number): KitEntry => ({
  codeId: 'skill_property', node: 'before_damage', source: 'skill', role: 'innate', order, customText: text,
  params: { property: 'stage_view', value, conditions: [] },
});
/** 命中後取得的持續效果（初次命中才取得）。 */
const hit = (raw: string, body: Stmt[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'on_hit', source: 'skill', role: 'attached', order, customText: raw,
  params: { clause: { raw, marker: '🎯', trig: 'after_hit', parsed: true, body } },
});
const clause = (node: KitEntry['node'], trig: string, role: 'innate' | 'attached', raw: string, body: Stmt[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node, source: 'skill', role, order, customText: raw,
  params: { clause: { raw, marker: role === 'innate' ? '■' : '🎯', trig, parsed: true, body } },
});

// ── #36 5025 懼噬.虛實逆寫 ──
const ZHAKESI_RAW = '■ 必中\n■ 當回合自身處於能力下降狀態時先制+3並視為同等級能力提升狀態\n🎯 反轉自身能力下降，反轉成功則100%令對手害怕，未觸發則附加對手等同於自身能力上升狀態的能力下降狀態\n🎯 自身每有1種能力等級與對手不相同則吸取對手120點體力，每有一種能力值等級（無論是否為上升狀態或能力下降狀態）相同則造成傷害提升12%\n🎯 下次擊敗對手則令對手下隻出戰精靈首回合進入害怕狀態';
const ZHAKESI_KIT: ReviewedSequenceSkill = {
  elfIds: ['5025'], name: '懼噬.虛實逆寫', description: ZHAKESI_RAW, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    conditionalPriority('■ 當回合自身處於能力下降狀態時先制+3', 3, 1, [c('stage', { side: 'self', kind: 'down' }, '自身處於能力下降')]),
    stageView('■ 視為同等級能力提升狀態', 'self_down_as_up', 2),
    sequence('反轉自身能力下降，反轉成功則100%令對手害怕，未觸發則附加對手等同於自身能力上升狀態的能力下降狀態', [
      { acts: [a('stat_reverse', { side: 'self', kind: 'down' })] },
      { cond: [c('success', {}, '反轉成功')], acts: [a('status', { side: 'opp', status: '害怕', chance: 100 })],
        elseActs: [a('stat_mirror', { side: 'opp', kind: 'down', fromKind: 'up' })] },
    ], 3),
    sequence('自身每有1種能力等級與對手不相同則吸取對手120點體力，每有一種能力值等級（無論是否為上升狀態或能力下降狀態）相同則造成傷害提升12%', [
      { acts: [a('drain', { flat: 120, true: false, per: 'stat_level_unequal_kinds' })] },
      { acts: [a('boost', { mult: 1, perInc: 0.12, per: 'stat_level_equal_kinds', kind: '攻擊' })] },
    ], 4),
    sequence('下次擊敗對手則令對手下隻出戰精靈首回合進入害怕狀態', [
      { acts: [a('watch', { trig: 'kill', body: [{ acts: [a('next_entry_status', { status: '害怕', turns: 1 })] }] })] },
    ], 5),
  ],
};

// ── #40 5027 星垂穹儀 ──
const STAR_VAULT_RAW = '■ 必中\n■ 若自身處於能力下降狀態則先制+3\n🎯 5回合內自身免疫受到的能力下降狀態\n🎯 令自身下1次受到的攻擊傷害轉化為體力\n🎯 反轉自身能力下降狀態，反轉成功則使對手隨機2個技能PP歸零\n🎯 自身下次主動切換下場後令己方下隻精靈出戰時抵擋下次受到的技能傷害、恢復300點體力並附加3回合星賜';
const STAR_VAULT_KIT: ReviewedSequenceSkill = {
  elfIds: ['5027'], name: '星垂穹儀', description: STAR_VAULT_RAW, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    conditionalPriority('■ 若自身處於能力下降狀態則先制+3', 3, 1, [c('stage', { side: 'self', kind: 'down' }, '自身處於能力下降')]),
    sequence('5回合內自身免疫受到的能力下降狀態', [{ acts: [a('immune_statdown_turns', { turns: 5 })] }], 2),
    sequence('令自身下1次受到的攻擊傷害轉化為體力', [{ acts: [a('convert_damage_to_heal_next', { n: 1, ratio: 1, kind: '攻擊' })] }], 3),
    sequence('反轉自身能力下降狀態，反轉成功則使對手隨機2個技能PP歸零', [
      { acts: [a('stat_reverse', { side: 'self', kind: 'down' })] },
      { chain: 'success', acts: [a('pp_zero_random', { count: 2 })] },
    ], 4),
    sequence('自身下次主動切換下場後令己方下隻精靈出戰時抵擋下次受到的技能傷害、恢復300點體力並附加3回合星賜', [
      { acts: [a('on_next_switch_in', { side: 'self', after: 'voluntary_switch_out', resource: 'none', ratio: 1, label: '下隻精靈出戰效果', body: [
        { acts: [
          a('block_damage_uses', { uses: 1, kind: '技能', key: 'next_entry_skill_block' }),
          a('heal_flat', { amount: 300 }),
          a('status', { side: 'self', status: '星賜', turns: 3, chance: 100 }),
        ] },
      ] })] },
    ], 5),
  ],
};

// ── #41 5027 星祈·繞指星瀾 ──
const STAR_PRAYER_RAW = '■ 必中\n■ 遇天敵時先制+3\n🎯 自身為天敵時威力翻倍並附加等同對手體力上限100%的真實傷害\n🎯 消耗自身全部體力，己方下隻出戰精靈先手且獲得體力上限等量的能量';
const STAR_PRAYER_KIT: ReviewedSequenceSkill = {
  elfIds: ['5027'], name: '星祈·繞指星瀾', description: STAR_PRAYER_RAW, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    conditionalPriority('■ 遇天敵時先制+3', 3, 1, [c('enemy', {}, '遇天敵')]),
    sequence('自身為天敵時威力翻倍並附加等同對手體力上限100%的真實傷害', [
      { cond: [c('self_enemy', {}, '自身為天敵')], acts: [
        a('boost', { mult: 2, power: true }),
        a('dmg', { base: '最大體力', of: 'opp', ratio: 1, type: '真實' }),
      ] },
    ], 2),
    sequence('消耗自身全部體力，己方下隻出戰精靈先手且獲得體力上限等量的能量', [
      { acts: [
        a('consume_hp_all', {}),
        a('on_next_switch_in', { side: 'self', after: 'now', resource: 'maxHp', ratio: 1, label: '下隻精靈出戰效果', body: [
          { acts: [
            a('first_next', { uses: 1 }),
            a('resource_mark_add', { id: 'star_energy', name: '能量', displayChar: '能', unit: '點', side: 'self', scope: 'elf', persistsOffField: true, description: '獲得的能量點數', ratio: 1 }),
          ] },
        ] }),
      ] },
    ], 3),
  ],
};

// ── #42 5027 星執·浩邃星幕 ──
const STAR_CURTAIN_RAW = '■ 必中\n🎯 將對手所有異常狀態轉化為自身星執最高項異常，吸取對手最大體力1/3\n🎯 對手3回合內屬性技能無效\n🎯 3回合內使用技能後100%隨機附加2種弱化異常\n🎯 當回合擊敗對手則令對手下隻登場精靈首次使用的技能所附加的效果失效';
const STAR_CURTAIN_KIT: ReviewedSequenceSkill = {
  elfIds: ['5027'], name: '星執·浩邃星幕', description: STAR_CURTAIN_RAW, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    sequence('將對手所有異常狀態轉化為自身星執最高項異常，吸取對手最大體力1/3', [
      { acts: [
        a('status_transfer_all', { side: 'opp', as: 'highest_mark', turns: 3 }),
        a('drain', { ratio: 1 / 3, true: false }),
      ] },
    ], 1),
    sequence('對手3回合內屬性技能無效', [{ acts: [a('invalid_turns', { turns: 3, kind: '屬性' })] }], 2),
    hit('3回合內使用技能後100%隨機附加2種弱化異常', [
      { acts: [a('timed', { turns: 3, from: 'now', trig: 'self_after_use', body: [
        { acts: [a('status_random', { count: 2, cls: '弱化類' })] },
      ] })] },
    ], 3),
    sequence('當回合擊敗對手則令對手下隻登場精靈首次使用的技能所附加的效果失效', [
      { acts: [a('watch', { trig: 'kill', actionOnly: true, body: [
        { acts: [a('on_next_switch_in', { side: 'opp', after: 'now', resource: 'none', ratio: 1, label: '下隻登場精靈首次技能附加失效', body: [
          { acts: [a('add_invalid_own', { uses: 1, kind: 'all' })] },
        ] })] },
      ] })] },
    ], 4),
  ],
};

export const MIGRATED_FINAL_B_SKILL_KITS: ReviewedSequenceSkill[] = [ZHAKESI_KIT, STAR_VAULT_KIT, STAR_PRAYER_KIT, STAR_CURTAIN_KIT];
