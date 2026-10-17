// 5027 蓓麗安特 星河入眸 Kit：8 條款。第6句「5回合100%閃避＋到期恢復PP/體力」為本輪新機制——
// evade_turns 擴充 onExpire（到期子流程），修正舊 handler DodgeTurns 死鍵（只寫不讀，閃避從未生效）
// 與「到期恢復」完全缺失的雙重問題。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
import type { Stmt } from '../blocks/model';

const hit = (raw: string, body: Stmt[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'on_hit', source: 'skill', role: 'attached', order, customText: raw,
  params: { clause: { raw, marker: '🎯', trig: 'after_hit', parsed: true, body } },
});

const raw = '■ 必中\n🎯 全屬性+2\n🎯 3回合內自身能力提升狀態無法被消除或吸取\n🎯 5回合內自身免疫並反彈所有受到的異常狀態\n🎯 4回合內每回合使用技能恢復自身最大體力的1/2並造成等量百分比傷害\n🎯 3回合內使用技能汲取對手240點體力\n🎯 5回合內100%閃避對手的攻擊技能，效果結束後恢復自身所有技能3點PP值與1/3最大體力\n🎯 下2回合令自身使用所有技能先制+3';

export const MIGRATED_BELIENTE_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5027'], name: '星河入眸', description: raw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    sequence('全屬性+2', [
      { acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 2, chance: 100 })] },
    ], 1),
    sequence('3回合內自身能力提升狀態無法被消除或吸取', [
      { acts: [a('stat_protect_turns', { turns: 3 })] },
    ], 2),
    sequence('5回合內自身免疫並反彈所有受到的異常狀態', [
      { acts: [a('immune_status_turns', { turns: 5, reflect: true, cls: '' })] },
    ], 3),
    hit('4回合內每回合使用技能恢復自身最大體力的1/2並造成等量百分比傷害', [
      { acts: [a('timed', { turns: 4, from: 'now', trig: 'self_after_use', body: [
        { acts: [a('heal_then', { side: 'self', ratio: 0.5, body: [
          { acts: [a('dmg_from_last', { ratio: 1, type: '百分比' })] },
        ] })] },
      ] })] },
    ], 4),
    hit('3回合內使用技能汲取對手240點體力', [
      { acts: [a('timed', { turns: 3, from: 'now', trig: 'self_after_use', body: [
        { acts: [a('drain', { flat: 240, true: true })] },
      ] })] },
    ], 5),
    // 5回合100%閃避對手攻擊技能；效果結束後恢復所有技能3點PP與1/3最大體力（evade onExpire）
    sequence('5回合內100%閃避對手的攻擊技能，效果結束後恢復自身所有技能3點PP值與1/3最大體力', [
      { acts: [a('evade_turns', { chance: 100, kind: '攻擊', turns: 5, onExpire: [
        { acts: [
          a('pp_op', { side: 'self', mode: 'add', amount: 3 }),
          a('heal', { side: 'self', ratio: 1 / 3 }),
        ] },
      ] })] },
    ], 6),
    sequence('下2回合令自身使用所有技能先制+3', [
      { acts: [a('prio_turns', { turns: 2, v: 3 })] },
    ], 7),
  ] },
];
