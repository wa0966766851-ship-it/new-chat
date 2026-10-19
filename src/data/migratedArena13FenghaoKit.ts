// arena_13 鋒毫浸血雨 技能 Kit（DSH 20261018 第十六批 legacyWrapped 拆解）。
// 舊 handler：staged-arena/tianfengRegistry.ts TIANFENG_SKILLS['鋒毫浸血雨']＋TIANFENG_AFTER_HIT 已空殼化。
// 時點：■ 必中＝技能屬性；🎯＝使用時（on_skill_use）；> 為上一條的補充條件；
//       ■ 若本技能無效＝on_invalid 條款（Miss／閃避／攻擊免疫皆觸發）。
// 「下1回合」限下一個回合；僅該回合真正命中的攻擊觸發，不跨未命中回合保留。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const at = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  ...seq(raw, body, order), node, params: { clause: { raw, trig, parsed: true, body } },
});

export const MIGRATED_ARENA13_FENGHAO_SKILL_KIT: ReviewedSequenceSkill[] = [{
  elfIds: ['arena_13'],
  name: '鋒毫浸血雨',
  description: '■ 必中\n🎯 下 1 回合攻擊命中時，消耗自身目前體力的 1/2，並對對手造成等量百分比傷害\n🎯 2 回合內令對手使用的屬性技能無效\n🎯 2 回合內每回合使用技能時，令對手攻擊、特攻、速度各 −1\n> 若該回合未觸發，則令對手下 2 回合攻擊技能無效\n■ 若本技能無效，消除對手回合類效果，並免疫對手下一次攻擊\n🎯 未擊敗對手時令其全屬性 −1\n> 未擊敗且對手未受到此全屬性下降效果時，令其 2 回合內無法主動切換精靈',
  kit: [
    prop('必中', 'sure_hit', true, 0),
    // 下 1 回合攻擊命中時：消耗自身目前體力½並造成等量百分比傷害（武裝旗標，命中時結算）
    seq('🎯 下 1 回合攻擊命中時，消耗自身目前體力的 1/2，並對對手造成等量百分比傷害', [
      { acts: [a('timed', { turns: 1, from: 'next', trig: 'self_after_attack', label: '血雨命中消耗', body: [
        { cond: [c('event_hit', {})], acts: [a('consume_current_health', { side: 'self', ratio: 0.5 }), a('dmg_equal', { type: '百分比' })] },
      ] })] },
    ], 1),
    // 2 回合內令對手使用的屬性技能無效
    seq('🎯 2 回合內令對手使用的屬性技能無效', [
      { acts: [a('invalid_turns', { kind: '屬性', turns: 2 })] },
    ], 2),
    // 2 回合內每回合使用技能時：對手攻擊、特攻、速度各−1；若該回合未觸發則下2回合攻擊技能無效
    seq('🎯 2 回合內每回合使用技能時，令對手攻擊、特攻、速度各 −1', [
      { acts: [a('timed', { turns: 2, from: 'now', trig: 'self_skill', initial: true, label: '血雨壓制',
        body: [{ acts: [a('stat', { side: 'opp', stats: ['攻擊', '特攻', '速度'], v: -1 })] }],
        onRoundMiss: [{ acts: [a('invalid_turns', { kind: '攻擊', turns: 2, next: true })] }],
      })] },
    ], 3),
    // 上述監控的onRoundMiss涵蓋下降未成功與當回合未能使用技能，回合末才判定。
    // 未擊敗對手時令其全屬性−1
    at('on_not_killed', 'not_killed', '🎯 未擊敗對手時令其全屬性 −1\n> 未擊敗且對手未受到此全屬性下降效果時，令其 2 回合內無法主動切換精靈', [
      { acts: [a('stat', { side: 'opp', stats: ['全屬性'], v: -1 })] },
      { chain: 'fail', acts: [a('no_switch', { turns: 2 })] },
    ], 5),
    // 未擊敗且對手未受到此全屬性下降效果時：2回合內無法主動切換
    // 若本技能無效：消除對手回合類效果＋免疫對手下一次攻擊
    at('on_invalid', 'on_invalid', '■ 若本技能無效，消除對手回合類效果，並免疫對手下一次攻擊', [
      { acts: [
        a('clear_turn', { side: 'opp' }),
        a('immune_attack_count', { count: 1 }),
      ] },
    ], 7),
  ],
}];
