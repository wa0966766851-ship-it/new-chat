// 5013 柯爾霍德 王·夜予寒吟 Kit（DSH 20261017 第五批 legacyWrapped 拆解；stageDamage 通用件）。
// 舊路徑：keerhode/registry.ts 的橋接 handler（通用文字執行器）與 elfRegistryModules bridges 白名單一併移除。
import type { KitEntry } from '../effects/effectSystem.schema';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const c = (id: string, p: any) => ({ c: id, p, label: id });
const carriedEntry = (node: KitEntry['node'], trig: string, text: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node, source: 'skill', role: 'carried', order, customText: text,
  params: { clause: { raw: text, marker: '🎯', trig, parsed: true, body } },
});

const raw = '■ 必中\n■ 當回合自身處於能力下降狀態時先制+3\n🎯 消除敵我雙方能力上升、下降狀態，任一方消除失敗（含視為弱化無法解除）時附加對手敵我雙方能力等級*30的固定傷害\n🎯 消除敵我雙方回合類效果，消除成功則令對手場下所有精靈當前所有精靈PP值上限扣除至等同於當前技能PP值，此扣除效果最多扣除至1\n🎯 100%令雙方凝滯，同時令雙方任一方下次凝滯回合結束或被解除、轉化時令自身當回合結束體力調整為最大體力44%\n🎯 100%令雙方凍傷，未觸發則令對手2回合內所有攻擊技能正先制效果失效';

export const MIGRATED_KEERHODE_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5013'], name: '王·夜予寒吟', description: raw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // ■ 當回合自身處於能力下降狀態時先制+3（條件先制）
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order: 1,
      customText: '■ 當回合自身處於能力下降狀態時先制+3',
      params: { property: 'conditional_priority', value: 3, conditions: [c('stage', { side: 'self', kind: 'down' })] } },
    // 🎯 消除雙方上升＋下降；清除後任一方仍存在等級（含視為弱化無法解除者）→依雙方等級總和附加固定傷害
    sequence('🎯 消除敵我雙方能力上升、下降狀態，任一方消除失敗（含視為弱化無法解除）時附加對手敵我雙方能力等級*30的固定傷害', [
      { acts: [
        a('stat_clear', { side: 'both', kind: 'up' }),
        a('stat_clear', { side: 'both', kind: 'down' }),
      ] },
      { cond: [c('stage_any', { side: 'both', kind: 'any' })], acts: [
        a('stage_sum_damage', { flat: 30, sides: 'both' }),
      ] },
    ], 2),
    // 🎯 消除雙方回合類效果，成功→對手場下PP上限扣除至當前PP（最低1）
    sequence('🎯 消除敵我雙方回合類效果，消除成功則令對手場下所有精靈PP值上限扣除至等同於當前PP，最低扣除至1', [
      { acts: [a('clear_turn', { side: 'both' })] },
      { chain: 'success', acts: [a('pp_cap_floor_bench', { min: 1 })] },
    ], 3),
    // 🎯 100%雙方凝滯（未註明回合→共用預設3）；任一方凝滯結束/解除/轉化→一次性體力調整44%（時點由事件決定）
    sequence('🎯 100%令雙方凝滯', [
      { acts: [a('status', { side: 'both', status: '凝滯', turns: 3, chance: 100 })] },
    ], 4),
    carriedEntry('on_status_ended', 'status_end', '🎯 同時令雙方任一方下次凝滯回合結束或被解除、轉化時令自身當回合結束體力調整為最大體力44%', [
      { cond: [c('event_status', { statuses: ['凝滯'] })], acts: [
        a('once', { key: 'keerhode_wyyh_stagnationHeal', body: [{ acts: [a('hp_set', { side: 'self', ratio: 0.44 })] }] }),
      ] },
    ], 5),
    // 🎯 100%雙方凍傷（預設3回合）；未觸發→對手2回合內攻擊技能正先制效果失效
    sequence('🎯 100%令雙方凍傷，未觸發則令對手2回合內所有攻擊技能正先制效果失效', [
      { acts: [a('status', { side: 'both', status: '凍傷', turns: 3, chance: 100 })] },
      { chain: 'fail', acts: [a('no_pos_prio_turns', { turns: 2 })] },
    ], 6),
  ] },
];