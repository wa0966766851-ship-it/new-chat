// arena_13 鋒毫浸血雨 技能 Kit（DSH 20261018 第十六批 legacyWrapped 拆解）。
// 舊 handler：staged-arena/tianfengRegistry.ts TIANFENG_SKILLS['鋒毫浸血雨']＋TIANFENG_AFTER_HIT 已空殼化。
// 時點：■ 必中＝技能屬性；🎯＝使用時（on_skill_use）；> 為上一條的補充條件；
//       ■ 若本技能無效＝on_invalid 條款（Miss／閃避／攻擊免疫皆觸發）。
// 「下 1 回合攻擊命中時」＝武裝後下一次攻擊命中（非當次）——以 turn_key_set 武裝＋on_hit 消費。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });

export const MIGRATED_ARENA13_FENGHAO_SKILL_KIT: ReviewedSequenceSkill[] = [{
  elfIds: ['arena_13'],
  name: '鋒毫浸血雨',
  description: '■ 必中\n🎯 下 1 回合攻擊命中時，消耗自身目前體力的 1/2，並對對手造成等量百分比傷害\n🎯 2 回合內令對手使用的屬性技能無效\n🎯 2 回合內每回合使用技能時，令對手攻擊、特攻、速度各 −1\n> 若該回合未觸發，則令對手下 2 回合攻擊技能無效\n■ 若本技能無效，消除對手回合類效果，並免疫對手下一次攻擊\n🎯 未擊敗對手時令其全屬性 −1\n> 未擊敗且對手未受到此全屬性下降效果時，令其 2 回合內無法主動切換精靈',
  kit: [
    prop('必中', 'sure_hit', true, 0),
    // 下 1 回合攻擊命中時：消耗自身目前體力½並造成等量百分比傷害（武裝旗標，命中時結算）
    seq('🎯 下 1 回合攻擊命中時，消耗自身目前體力的 1/2，並對對手造成等量百分比傷害', [
      { acts: [a('turn_key_set', { key: 'fenghaoBloodRainArmed', turns: 1, side: 'self', reason: '鋒毫浸血雨', label: '下1回合攻擊命中時消耗體力½' })] },
    ], 1),
    // 2 回合內令對手使用的屬性技能無效
    seq('🎯 2 回合內令對手使用的屬性技能無效', [
      { acts: [a('invalid_turns', { kind: '屬性', turns: 2 })] },
    ], 2),
    // 2 回合內每回合使用技能時：對手攻擊、特攻、速度各−1；若該回合未觸發則下2回合攻擊技能無效
    seq('🎯 2 回合內每回合使用技能時，令對手攻擊、特攻、速度各 −1', [
      { acts: [a('turn_key_set', { key: 'fenghaoPressureTurns', turns: 2, side: 'self', reason: '鋒毫浸血雨', label: '2回合內每回合使用技能壓制' })] },
    ], 3),
    seq('> 若該回合未觸發，則令對手下 2 回合攻擊技能無效', [
      { acts: [a('turn_key_set', { key: 'fenghaoPressureFallback', turns: 1, side: 'self', reason: '鋒毫浸血雨', label: '未觸發時改為下2回合攻擊技能無效' })] },
    ], 4),
    // 未擊敗對手時令其全屬性−1
    seq('🎯 未擊敗對手時令其全屬性 −1', [
      { acts: [a('stat', { side: 'opp', stats: ['全屬性'], v: -1 })] },
    ], 5),
    // 未擊敗且對手未受到此全屬性下降效果時：2回合內無法主動切換
    seq('> 未擊敗且對手未受到此全屬性下降效果時，令其 2 回合內無法主動切換精靈', [
      { acts: [a('no_switch', { turns: 2 })] },
    ], 6),
    // 若本技能無效：消除對手回合類效果＋免疫對手下一次攻擊
    seq('■ 若本技能無效，消除對手回合類效果，並免疫對手下一次攻擊', [
      { acts: [
        a('clear_turn', { side: 'opp' }),
        a('immune_attack_count', { count: 1 }),
      ] },
    ], 7),
  ],
}];
