// 5023 無序·蝕言 梟律·置換 Kit（DSH 20261017 第二批 legacyWrapped 拆解）。
// 攜帶 pp_consumed：消除雙方護盾罩→吸取消除量70%（dmg_from_last 固定＋heal_equal）→
// 恢復全PP→偷取對手150藥劑並使用（use_stolen_item 新通用 op）→下2回合對手鎖切換。
// 舊 handler：wuxu-shiyan/registry.ts carried['梟律·置換'] 與 SHIYAN_SKILL_TRANSFORMS 同步移除。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
const c = (id: string, p: any) => ({ c: id, p, label: id });
const carried = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node, source: 'skill', role: 'carried', order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

const raw = '■ 雙方擁有護盾、護罩時先制+1\n■ 將對手能力提升狀態視為能力下降狀態\n◇ 攜帶此技能則該技能每次PP值被消耗時：\n> 消除雙方護盾、護罩效果並吸取對手等同於消除量70%的體力\n> 恢復自身所有技能PP值\n> 偷取對手150藥劑並立即使用\n> 下2回合對手無法主動切換精靈';

export const MIGRATED_WUXU_SHIYAN_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5023'], name: '械律·置換', description: raw, kit: [
    // ■ 雙方擁有護盾、護罩時先制+1（雙方有盾＝AND）
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order: 0,
      customText: '■ 雙方擁有護盾、護罩時先制+1',
      params: { property: 'conditional_priority', value: 1, conditions: [
        c('shield', { side: 'self' }),
        c('shield', { side: 'opp' }),
      ] } },
    // ■ 將對手能力提升狀態視為能力下降狀態
    { codeId: 'skill_property', node: 'before_damage', source: 'skill', role: 'innate', order: 1,
      customText: '■ 將對手能力提升狀態視為能力下降狀態',
      params: { property: 'stage_view', value: 'opp_up_as_down', conditions: [] } },
    // ◇ 攜帶：每次本槽 PP 被消耗時（role 攜帶；同一次使用每槽一次）
    carried('pp_consumed', 'pp_consumed', '◇ 攜帶此技能則該技能每次PP值被消耗時：\n> 消除雙方護盾、護罩效果並吸取對手等同於消除量70%的體力\n> 恢復自身所有技能PP值\n> 偷取對手150藥劑並立即使用\n> 下2回合對手無法主動切換精靈', [
      { acts: [
        a('clear_shield', { side: 'both', kind: 'both' }),
        a('dmg_from_last', { ratio: 0.7, type: '固定' }),
        a('heal_equal', {}),
        a('pp_op', { side: 'self', mode: 'recover' }),
        a('use_stolen_item', { itemId: 'hp_150' }),
        a('switch_lock', { side: 'opp', turns: 2, next: true }),
      ] },
    ], 2),
  ] },
];