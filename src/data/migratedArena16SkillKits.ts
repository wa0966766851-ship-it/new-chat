// arena_16 鎮世龍魂・龍之治癒 技能 Kit（DSH 20261017 第一批拆解）。
// 剛莖棍壓：由 legacy_handler 包裝拆成真積木——無視成功加成（新條件 ignore_success）、
// stage_view 雙視為、對手 PP 歸零技能數每個 +20%（boost per/perInc）、百分比傷害未造成時等量真實傷害（純既有 op 組合）。
// 舊 handler：staged-arena/dragonHealingRegistry.ts DRAGON_HEALING_SKILLS['剛莖棍壓'] 已刪；
// 其 BEFORE_DAMAGE 專屬加成分支一併移除（由本 Kit 的通用 op 表達）。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
const c = (id: string, p: any) => ({ c: id, p, label: id });
const at = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number, role: KitEntry['role'] = 'attached'): KitEntry => ({
  codeId: 'effect_sequence', node, source: 'skill', role, order, customText: raw, params: { clause: { raw, trig, parsed: true, body } } });
const query = (raw: string, value: any, order: number): KitEntry => ({
  codeId: 'skill_property', node: 'before_damage', source: 'skill', role: 'innate', order, customText: raw,
  params: { property: 'stage_view', value, conditions: [] } });

const raw = '■ 必中\n■ 無視對手攻擊免疫效果，無視成功時本次攻擊傷害提升 100%\n■ 無視對手傷害限制效果，無視成功時本次攻擊傷害提升 100%\n■ 傷害計算時，將自身能力下降視為同級能力提升，並將對手能力提升視為同級能力下降\n■ 對手每有 1 個技能 PP 為 0，本次攻擊傷害提升 20%\n🎯 附加自身最大體力 20% 的百分比傷害；若未造成百分比傷害，改為造成等量真實傷害';

export const MIGRATED_ARENA16_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['arena_16'], name: '剛莖棍壓', description: raw, kit: [
    prop('■ 必中', 'sure_hit', true, 0),
    // 無視對手攻擊免疫／傷害限制（固有；出手前生效）
    { ...seq('■ 無視對手攻擊免疫效果', [{ acts: [a('ignore', { what: '攻擊免疫' })] }], 1), role: 'innate' },
    { ...seq('■ 無視對手傷害限制效果', [{ acts: [a('ignore', { what: '傷害限制' })] }], 2), role: 'innate' },
    // 無視成功時本次攻擊傷害提升 100%（×2，各讀各的成功旗標；before_damage 讀 damageComp）。
    // 已知邊界：傷害限制的成功旗標在傷害公式內（3265）才寫入，before_damage 早於公式——
    // 第一擊讀不到、多段攻擊的第 2 擊起生效；攻擊免疫旗標於 3.2 免疫判定時寫入，第一擊即生效。
    at('before_damage', 'outgoing', '■ 無視攻擊免疫成功時本次攻擊傷害提升 100%', [
      { cond: [c('ignore_success', { what: '攻擊免疫' })], acts: [a('boost', { mult: 2, kind: '攻擊' })] },
    ], 3, 'innate'),
    at('before_damage', 'outgoing', '■ 無視傷害限制成功時本次攻擊傷害提升 100%', [
      { cond: [c('ignore_success', { what: '傷害限制' })], acts: [a('boost', { mult: 2, kind: '攻擊' })] },
    ], 4, 'innate'),
    // 傷害計算時：自身能力下降視為同級能力提升＋對手能力提升視為同級能力下降（兩個 stage_view 查詢並存）
    query('■ 傷害計算時，將自身能力下降視為同級能力提升，並將對手能力提升視為同級能力下降：自身下降視為提升', 'self_down_as_up', 5),
    query('■ 傷害計算時，將自身能力下降視為同級能力提升，並將對手能力提升視為同級能力下降：對手提升視為下降', 'opp_up_as_down', 6),
    // 對手每有 1 個技能 PP 為 0，本次攻擊傷害提升 20%（boost per/perInc：increasePercent += 0.2×n）
    at('before_damage', 'outgoing', '■ 對手每有 1 個技能 PP 為 0，本次攻擊傷害提升 20%', [
      { acts: [a('boost', { mult: 1, per: 'opp_pp_zero_skills', perInc: 0.2, kind: '攻擊' })] },
    ], 7, 'innate'),
    // 附加自身最大體力 20% 的百分比傷害；未造成（免疫／歸零）時改為等量真實傷害
    seq('🎯 附加自身最大體力 20% 的百分比傷害；若未造成百分比傷害，改為造成等量真實傷害', [
      { acts: [a('dmg', { base: '最大體力', of: 'self', ratio: 0.2, type: '百分比' })] },
      { cond: [c('last_amount', { op: '低於', amount: 1 })], acts: [a('dmg', { base: '最大體力', of: 'self', ratio: 0.2, type: '真實' })] },
    ], 8),
  ] },
];
