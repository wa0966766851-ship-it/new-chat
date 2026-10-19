// arena_16 但願不會是個怪物 技能 Kit（DSH 20261018 第十七批 legacyWrapped 拆解）。
// 舊 handler：staged-arena/dragonHealingRegistry.ts DRAGON_HEALING_SKILLS['但願不會是個怪物'] 由技能表移除。
// 【龍魂之力】的引擎讀取端（applySoulPower：ignoreDamageLimit／ignoreAttackImmunity／blkIgnoreBlock）
// 保留；Kit 以通用 ignore{what} 條款表達，不重造讀取端。
// 「以雙方除體力外最高能力值2倍視為自身特攻／最低能力值50%視為對手特防」＝傷害公式層替換，
// 已以 combat_stat_extrema 公式視圖實作雙方五維最大/最小值，未改動雙方面板。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const q=(text:string,property:string,value:any,order:number):KitEntry=>({codeId:'skill_property',source:'skill',role:'innate',node:'before_skill',order,customText:text,params:{property,value,conditions:[]}});
const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'skill', role: 'attached', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

export const MIGRATED_ARENA16_MONSTER_SKILL_KIT: ReviewedSequenceSkill[] = [{
  elfIds: ['arena_16'],
  name: '但願不會是個怪物',
  description: '■ 必中\n■ 使用時自身獲得【龍魂之力】；若使用前已擁有，對手先制等級無法高於自身，且本技能固定按最高克制倍率計算\n> 【龍魂之力】：攻擊時無視對手傷害限制、攻擊免疫與抵擋傷害效果\n■ 傷害計算時，以雙方除體力外最高能力值的 2 倍視為自身特攻，以雙方除體力外最低能力值的 50% 視為對手特防\n🎯 消除對手回合類效果；成功時附加 3 回合【疲憊】、【害怕】、【睡眠】\n> 每有 1 項異常未觸發，本技能傷害提升 100%\n🎯 本技能攻擊傷害每被減少 10 點，自身獲得 1 層【龍魂印記】，且自身所有能力值提升 10%\n🎯 擊敗對手時自身所有能力值提升 20%；未擊敗時，若自身當前最大體力較高，將對手體力上限提升至自身當前最大體力，並以相同提升值降低對手其餘五項能力\n■ 真龍已喚醒時，本技能強制執行命中效果，並令對手當回合無法以任何方式恢復體力',
  kit: [
    prop('必中', 'sure_hit', true, 0),
    q('雙方五維最高兩倍與最低一半作為本次攻防輸入','combat_stat_extrema',{attackScale:2,defenseScale:0.5},8),
    {...q('使用前已有龍魂之力時固定最高克制','fixed_type_multiplier',4,9),params:{property:'fixed_type_multiplier',value:4,conditions:[c('mark_count',{side:'self',id:'dragonSoulPower',op:'不小於',amount:1})]}},
    {...q('使用前已有龍魂之力時對手先制無法較高','cap_opponent_priority',true,10),node:'modify_priority',params:{property:'cap_opponent_priority',value:true,conditions:[c('mark_count',{side:'self',id:'dragonSoulPower',op:'不小於',amount:1})]}},
    // 使用時獲得【龍魂之力】；使用前已擁有→對手先制無法高於自身＋固定按最高克制倍率
    seq('■ 使用時自身獲得【龍魂之力】；若使用前已擁有，對手先制等級無法高於自身，且本技能固定按最高克制倍率計算', [
      { cond: [c('mark_count', { side: 'self', id: 'dragonSoulPower', op: '不小於', amount: 1 }, '使用前已擁有龍魂之力')], acts: [
        a('ignore', {what:'傷害限制'}),
      ] },
      { acts: [a('resource_mark_add', { id: 'dragonSoulPower', name: '龍魂之力', displayChar: '力', unit: '層', side: 'self', scope: 'elf', persistsOffField: true, amount: 1, maxCount: 1, description: '攻擊時無視對手傷害限制、攻擊免疫與抵擋傷害效果' })] },
    ], 1),
    // > 【龍魂之力】：攻擊時無視傷害限制、攻擊免疫與抵擋傷害
    seq('> 【龍魂之力】：攻擊時無視對手傷害限制、攻擊免疫與抵擋傷害效果', [
      { acts: [
        a('ignore', { what: '傷害限制' }),
        a('ignore', { what: '攻擊免疫' }),
        a('ignore', { what: '抵擋傷害' }),
      ] },
    ], 2),
    // 🎯 消除對手回合類效果；成功時附加3回合疲憊、害怕、睡眠
    seq('🎯 消除對手回合類效果；成功時附加 3 回合【疲憊】、【害怕】、【睡眠】', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [
        a('status_seq', { side: 'opp', list: ['疲憊', '害怕', '睡眠'], chance: 100, turns: 3, countFailures:true }),
        a('boost',{mult:1,perLastAmount:1,kind:'攻擊'}),
      ] },
    ], 3),
    // 🎯 本技能攻擊傷害每被減少10點，自身獲得1層【龍魂印記】，且自身所有能力值提升10%
    seq('🎯 本技能攻擊傷害每被減少 10 點，自身獲得 1 層【龍魂印記】，且自身所有能力值提升 10%', [
      { acts: [
        a('resource_mark_add', { id: 'arena.dragonSoulMark', name: '龍魂印記', displayChar: '魂', unit: '層', side: 'self', scope: 'elf', persistsOffField: true, amount: 1, maxCount: 99, description: '每次使用技能後：層數×已喚醒龍數次，每次150點龍系直接傷害' }),
        a('stat', { side: 'self', stats: ['全屬性'], v: 1 }),
      ] },
    ], 5),
    entry('on_hit','after_hit','擊敗時五維點數提升20%；未擊敗時對齊最大體力並扣相同五維點數',[
      {cond:[c('kill',{})],acts:[a('stat_points_scale',{side:'self',ratio:1.2,stats:['atk','def','spatk','spdef','speed']})]},
      {cond:[c('nokill',{})],acts:[a('match_max_hp',{side:'opp',source:'self',reduceStats:true})]},
    ],6),
    // ■ 真龍已喚醒時：強制執行命中效果＋對手當回合無法恢復體力
    seq('■ 真龍已喚醒時，本技能強制執行命中效果，並令對手當回合無法以任何方式恢復體力', [
      { cond: [c('mark_count', { side: 'self', id: 'trueDragon', op: '不小於', amount: 1 }, '真龍已喚醒')], acts: [
        a('sure_hit_force', {}),
        a('no_heal', { turns: 1, scope: 'all' }),
      ] },
    ], 7),
  ],
}];
