// arena_16 挨打要立正 技能 Kit（DSH 20261018 第十七批 legacyWrapped 拆解）。
// 舊 handler：staged-arena/dragonHealingRegistry.ts DRAGON_HEALING_SKILLS['挨打要立正'] 已由技能表移除。
// 龍魂之源與印記以正式資源表示，由魂印的通用 resource_scaled_hits 逐段結算。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });

export const MIGRATED_ARENA16_AIDA_SKILL_KIT: ReviewedSequenceSkill[] = [{
  elfIds: ['arena_16'],
  name: '挨打要立正',
  description: '■ 必中\n🎯 自身獲得【龍魂之源】並全屬性 +1\n🎯 3 回合內，每回合吸取對手最大體力 1/3；對手未受到百分比傷害時，改為造成等量真實傷害並吸取\n🎯 下 2 回合自身所有技能先制 +2\n🎯 剝離對手的屬性，每剝離一種屬性便隨機附加 1 種異常狀態\n> 只要其中任意一次異常狀態附加失敗，便為自身附加 1 層【龍魂印記】\n> 【龍魂之源】：龍魂印記每次攻擊的基礎傷害額外提升（已喚醒龍數×50）點\n> 【龍魂印記】：自身每次使用技能後，每層令每條已喚醒的龍各造成 1 次 150 點龍系直接傷害；真龍・治癒喚醒後改按最高克制倍率計算',
  kit: [
    prop('必中', 'sure_hit', true, 0),
    // 自身獲得【龍魂之源】並全屬性+1
    seq('🎯 自身獲得【龍魂之源】並全屬性 +1', [
      { acts: [
        a('resource_mark_add', { id:'dragonSoulSource',name:'龍魂之源',displayChar:'源',unit:'層',side:'self',scope:'elf',persistsOffField:false,amount:1,maxCount:1,description:'龍魂印記每次傷害增加甦醒龍數×50點' }),
        a('stat', { side: 'self', stats: ['全屬性'], v: 1 }),
      ] },
    ], 1),
    // 3 回合內每回合吸取對手最大體力1/3；未受百分比傷害時改為等量真實傷害並吸取
    seq('🎯 3 回合內，每回合吸取對手最大體力 1/3；對手未受到百分比傷害時，改為造成等量真實傷害並吸取', [
      { acts: [a('timed',{turns:3,from:'now',trig:'self_skill',initial:true,label:'3回合使用技能吸取1/3',body:[{acts:[a('checked_percent_drain',{ratio:1/3,failTrue:0,replaceWithTrue:true})]}]})] },
    ], 2),
    // 下 2 回合自身所有技能先制 +2
    seq('🎯 下 2 回合自身所有技能先制 +2', [
      { acts: [a('prio_turns', { v: 2, turns: 2, next: true })] },
    ], 3),
    // 剝離對手的屬性；每剝離一種屬性便隨機附加 1 種異常
    seq('🎯 剝離對手的屬性，每剝離一種屬性便隨機附加 1 種異常狀態', [
      { acts: [
        a('peel_types', {side:'opp'}),
        a('status_seq', { side: 'opp', list: ['燒傷', '凍傷', '中毒', '麻痺', '害怕', '睡眠'], chance: 100, turns: 3, countFrom: 'peeledTypes' }),
      ] },
      { cond: [c('last_amount', {op:'高於',amount:0}, '本次剝離附加有失敗')], acts: [
        a('resource_mark_add', { id: 'arena.dragonSoulMark', name: '龍魂印記', displayChar: '魂', unit: '層', side: 'self', scope: 'elf', persistsOffField: true, amount: 1, maxCount: 99, description: '每次使用技能後：層數×已喚醒龍數次，每次150點龍系直接傷害' }),
      ] },
    ], 4),
  ],
}];
