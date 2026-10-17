import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';

const innate = (raw: string, op: string, p: any, order: number): KitEntry => ({ ...sequence(raw, [{ acts: [a(op, p)] }], order), role: 'innate' });
const onInvalid = (raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order, customText: raw,
  params: { clause: { raw, marker: '🎯', trig: 'on_invalid', parsed: true, body } },
});
const ppFull = (neg = false) => ({ c: 'pp_full', p: neg ? { neg: true } : {}, label: neg ? '此技能PP值未滿' : '此技能PP值為滿' });
// 「處於與毀滅機甲組合時」＝玩家狀態 marsMechaMode 為 destroy（未設定視為 speed）。
const destroyMode = (neg = false) => ({ c: 'player_state', p: { key: 'marsMechaMode', equals: 'destroy', fallback: 'speed', ...(neg ? { neg: true } : {}) }, label: neg ? '未處於毀滅機甲組合' : '處於毀滅機甲組合' });

const protocolRaw = '■ 先制+1\n■ 必中\n■ 攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）\n🎯 2回合內對手屬性技能附加效果失效且攻擊技能PP值消耗量提升20倍\n🎯 造成技能傷害提升70%，每次使用則本次造成技能傷害額外提升35%，此技能PP值為滿時效果翻倍，最高170%，處於與毀滅機甲組合時上限變為300%\n🎯 技能無效時，消除對手回合類效果，100%令對手癱瘓';
// 效果翻倍＝起始值與每次增量同時翻倍（70%→140%、+35%→+70%），上限不翻倍；故拆成 PP 滿／未滿 × 毀滅組合／否 四條。
const boost = (full: boolean, cap: number) => a('boost', { mult: full ? 2.4 : 1.7, kind: '技能', rampInc: full ? 70 : 35, rampCap: cap });

export const MIGRATED_FINAL_A_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5016'], name: '王·肅正協議', description: protocolRaw, kit: [
    property('■ 先制+1', 'base_priority', 1, 0),
    property('■ 必中', 'sure_hit', true, 1),
    innate('■ 攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）', 'no_resist', {}, 2),
    sequence('🎯 2回合內對手屬性技能附加效果失效且攻擊技能PP值消耗量提升20倍', [
      { acts: [a('add_invalid_turns', { kind: '屬性', turns: 2 }), a('pp_cost_mult', { turns: 2, mult: 20, kind: '攻擊' })] },
    ], 3),
    sequence('🎯 造成技能傷害提升70%，每次使用則本次造成技能傷害額外提升35%，此技能PP值為滿時效果翻倍，最高170%，處於與毀滅機甲組合時上限變為300%', [
      { cond: [ppFull(true), destroyMode(true)], acts: [boost(false, 170)] },
      { cond: [ppFull(true), destroyMode()], acts: [boost(false, 300)] },
      { cond: [ppFull(), destroyMode(true)], acts: [boost(true, 170)] },
      { cond: [ppFull(), destroyMode()], acts: [boost(true, 300)] },
    ], 4),
    onInvalid('🎯 技能無效時，消除對手回合類效果，100%令對手癱瘓', [
      { acts: [a('clear_turn', { side: 'opp' }), a('status', { side: 'opp', status: '癱瘓', chance: 100 })] },
    ], 5),
  ] },
];
