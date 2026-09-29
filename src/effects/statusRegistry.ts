// src/effects/statusRegistry.ts
import { StatusCategory } from './statusTypes';

export interface StatusRegistryEntry {
  name: string;
  categories: StatusCategory[];
  description: string;
  // 綁定的核心機制處理器
  mechanics: {
    type: 'CANT_ACT' | 'CANT_SWITCH' | 'EVOLUTION_TRANSFORM' | 'DAMAGE_TICK' | 'MODIFIER_LIMIT' | 'SPECIAL_BUFF' | 'TYPE_MATCHUP_OVERRIDE';
    params?: Record<string, any>;
  }[];
}

export const StatusRegistry: Record<string, StatusRegistryEntry> = {
  // ==========================================
  // 1. 【控制類異常】 (CONTROL)
  // ==========================================
  '麻痹': {
    name: '麻痺',
    categories: ['CONTROL'],
    description: '控制類異常狀態；處於該異常狀態則每回合無法行動',
    mechanics: [{ type: 'CANT_ACT' }]
  },
  '麻痺': { // Alias for common typo
    name: '麻痺',
    categories: ['CONTROL'],
    description: '控制類異常狀態；處於該異常狀態則每回合無法行動',
    mechanics: [{ type: 'CANT_ACT' }]
  },
  '疲憊': {
    name: '疲憊',
    categories: ['CONTROL'],
    description: '控制類異常狀態；處於該異常狀態則每回合無法行動',
    mechanics: [{ type: 'CANT_ACT' }]
  },
  '魘味': {
    name: '魘味',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常時，場上敵我雙方的異常狀態與能力等級狀態均對己方展示為無回合數的「魘味」。此效果只改變己方看到的顯示，不改變原有效果與回合數。',
    mechanics: []
  },
  '害怕': {
    name: '害怕',
    categories: ['CONTROL'],
    description: '控制類異常狀態；處於該異常狀態則每回合無法行動',
    mechanics: [{ type: 'CANT_ACT' }]
  },
  '睡眠': {
    name: '睡眠',
    categories: ['CONTROL'],
    description: '控制類異常狀態；處於該異常狀態則每回合無法行動，若受到攻擊技能命中則睡眠解除',
    mechanics: [{ type: 'CANT_ACT', params: { wakeOnHit: true } }]
  },
  '石化': {
    name: '石化',
    categories: ['CONTROL'],
    description: '控制類異常狀態；處於該異常狀態則每回合無法行動',
    mechanics: [{ type: 'CANT_ACT' }]
  },
  '癱瘓': {
    name: '癱瘓',
    categories: ['CONTROL', 'RESTRICTIVE'],
    description: '控制類異常；限制類異常；處於該異常狀態則每回合無法行動，且無法主動切換精靈下場',
    mechanics: [{ type: 'CANT_ACT' }, { type: 'CANT_SWITCH' }]
  },
  '狂信': {
    name: '狂信',
    categories: ['CONTROL'],
    description: '控制類異常狀態；處於該異常狀態則對手為信仰對象時自身無法行動；若進入狀態時自身沒有信仰對象，則本次狂信來源成為自身信仰對象',
    mechanics: [{ type: 'CANT_ACT', params: { condition: 'FAITH_TARGET' } }]
  },
  '冰封': {
    name: '冰封',
    categories: ['CONTROL', 'EVOLUTIONARY'],
    description: '控制類異常狀態；衍化類異常；處於該異常狀態則每回合無法行動；異常結束後轉化為速度 -1 與凍傷 3 回合',
    mechanics: [
      { type: 'CANT_ACT' },
      { type: 'EVOLUTION_TRANSFORM', params: { nextStatus: '凍傷', statDebuff: { speed: -1 }, nextDuration: 3 } }
    ]
  },
  '焚燼': {
    name: '焚燼',
    categories: ['CONTROL', 'EVOLUTIONARY'],
    description: '控制類異常狀態；衍化類異常；處於該異常狀態則每回合無法行動；異常結束後轉化為命中 -1 與燒傷狀態3 回合',
    mechanics: [
      { type: 'CANT_ACT' },
      { type: 'EVOLUTION_TRANSFORM', params: { nextStatus: '燒傷', statDebuff: { accuracy: -1 }, nextDuration: 3 } }
    ]
  },
  '詛咒': {
    name: '詛咒',
    categories: ['CONTROL', 'EVOLUTIONARY'],
    description: '控制類異常狀態；衍化類異常；處於該異常狀態則每回合無法行動；異常結束後隨機轉化為烈焰詛咒、虛弱詛咒、致命詛咒中的一種狀態3 回合',
    mechanics: [
      { type: 'CANT_ACT' },
      { type: 'EVOLUTION_TRANSFORM', params: { randomPool: ['烈焰詛咒', '虛弱詛咒', '致命詛咒'], nextDuration: 3 } }
    ]
  },
  '感染': {
    name: '感染',
    categories: ['CONTROL', 'EVOLUTIONARY'],
    description: '控制類異常狀態；衍化類異常；處於該異常狀態則每回合無法行動；異常結束後轉化為攻擊 -1、特攻 -1 與中毒狀態',
    mechanics: [
      { type: 'CANT_ACT' },
      { type: 'EVOLUTION_TRANSFORM', params: { nextStatus: '中毒', statDebuff: { atk: -1, spatk: -1 }, nextDuration: 3 } }
    ]
  },
  '神游': {
    name: '神游',
    categories: ['CONTROL', 'EVOLUTIONARY'],
    description: '控制類異常狀態；衍化類異常；處於該異常狀態則每回合無法行動；異常結束後轉化為3 回合失神狀態',
    mechanics: [
      { type: 'CANT_ACT' },
      { type: 'EVOLUTION_TRANSFORM', params: { nextStatus: '失神', nextDuration: 3 } }
    ]
  },
  '空定': {
    name: '空定',
    categories: ['CONTROL', 'EVOLUTIONARY'],
    description: '控制類異常狀態；衍化類異常；處於該異常狀態則每回合無法行動；異常結束後轉化為 3 回合沉默狀態',
    mechanics: [
      { type: 'CANT_ACT' },
      { type: 'EVOLUTION_TRANSFORM', params: { nextStatus: '沉默', nextDuration: 3 } }
    ]
  },
  '沉睡': {
    name: '沉睡',
    categories: ['CONTROL', 'EVOLUTIONARY'],
    description: '控制類異常狀態；衍化類異常；處於該異常狀態無法行動且期間受到致命一擊傷害時轉化為睡眠；異常結束後轉化為睡眠 3 回合',
    mechanics: [
      { type: 'CANT_ACT' },
      { type: 'EVOLUTION_TRANSFORM', params: { nextStatus: '睡眠', nextDuration: 3, transformOnCrit: true } }
    ]
  },

  // ==========================================
  // 2. 【弱化類異常】 (WEAKENING)
  // ==========================================
  '中毒': {
    name: '中毒',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則每回合對手出手時受到等同於最大體力 1/8 的真實傷害；若再度陷入中毒，額外附加 1 次最大體力 1/8 的真實傷害',
    mechanics: [
      { type: 'DAMAGE_TICK', params: { dmgType: 'REAL', valueType: 'PERCENT', value: 0.125, doubleOnStack: true } }
    ]
  },
  '燒傷': {
    name: '燒傷',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則每回合對手出手時受到等同於最大體力 1/8 的真實傷害，且攻擊技能初始威力降低 50%',
    mechanics: [
      { type: 'DAMAGE_TICK', params: { dmgType: 'REAL', valueType: 'PERCENT', value: 0.125 } },
      { type: 'SPECIAL_BUFF', params: { attackPowerMultiplier: 0.5 } }
    ]
  },
  '寄生': {
    name: '寄生',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則每回合對手出手時受到等同於最大體力 1/8 的真實傷害，並使對手恢復等量體力',
    mechanics: [
      { type: 'DAMAGE_TICK', params: { dmgType: 'REAL', valueType: 'PERCENT', value: 0.125, healSource: true } }
    ]
  },
  '凍傷': {
    name: '凍傷',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則每回合對手出手時受到等同於最大體力 1/8 的真實傷害',
    mechanics: [
      { type: 'DAMAGE_TICK', params: { dmgType: 'REAL', valueType: 'PERCENT', value: 0.125 } }
    ]
  },
  '混亂': {
    name: '混亂',
    categories: ['WEAKENING'],
    description: '弱化類異常；攻擊技能初始命中率降低 80%；處於該異常狀態則每回合對手出手時受到 50 點真實傷害',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { accuracyMultiplier: 0.2 } },
      { type: 'DAMAGE_TICK', params: { dmgType: 'REAL', valueType: 'FIXED', value: 50 } }
    ]
  },
  '衰弱': {
    name: '衰弱',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則受到的攻擊傷害額外提升；若衰弱回合數為 1/2/3/4/5，分別額外提升 25%/50%/100%/250%/500%，大於 5 回合仍為 500%',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { damageTakenIncreaseByTurn: [0.25, 0.5, 1.0, 2.5, 5.0] } }
    ]
  },
  '易燃': {
    name: '易燃',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則攻擊技能初始命中率降低 30%，且受到火系攻擊時將轉化為燒傷狀態',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { accuracyMultiplier: 0.7, transformOnFire: '燒傷' } }
    ]
  },
  '流血': {
    name: '流血',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則每回合對手出手時受到 80 點真實傷害',
    mechanics: [
      { type: 'DAMAGE_TICK', params: { dmgType: 'REAL', valueType: 'FIXED', value: 80 } }
    ]
  },
  '失明': {
    name: '失明',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則有 50% 概率攻擊技能丟失；非必中攻擊以「MISS」形式實現，必中攻擊技能以「攻擊技能無法造成傷害且附加效果失效」形式實現',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { missChance: 0.5, blockSureHitDamage: true } }
    ]
  },
  '束縛': {
    name: '束縛',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則所有先制效果失效，每回合對手出手時受到等同於自身最大體力 1/8 的百分比傷害',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { disablePriority: true } },
      { type: 'DAMAGE_TICK', params: { dmgType: 'PERCENT', valueType: 'PERCENT', value: 0.125 } }
    ]
  },
  '失神': {
    name: '失神',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則 50% 概率屬性技能失效',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { attributeSkillFailChance: 0.5 } }
    ]
  },
  '沉默': {
    name: '沉默',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則第五技能無效；處於該異常狀態則每回合結束時受到等同於自身最大體力 1/8 的百分比傷害',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { disableFifthSkill: true } },
      { type: 'DAMAGE_TICK', params: { dmgType: 'PERCENT', valueType: 'PERCENT', value: 0.125, timing: 'END' } }
    ]
  },
  '眩暈': {
    name: '眩暈',
    categories: ['RESTRICTIVE', 'EVOLUTIONARY'],
    description: '限制類異常，衍化類異常，處於該異常無法選擇所有類型技能，異常結束後轉化為3回合遲鈍',
    mechanics: [
      { type: 'MODIFIER_LIMIT', params: { disableAllSkillSelection: true } },
      { type: 'EVOLUTION_TRANSFORM', params: { nextStatus: '遲鈍', nextDuration: 3 } }
    ]
  },
  '神悔': {
    name: '神悔',
    categories: ['CONTROL', 'EVOLUTIONARY'],
    description: '控制類異常；衍化類異常；無法行動，異常結束後轉化為3回合失明',
    mechanics: [
      { type: 'CANT_ACT' },
      { type: 'EVOLUTION_TRANSFORM', params: { nextStatus: '失明', nextDuration: 3 } }
    ]
  },
  '臣服': {
    name: '臣服',
    categories: ['WEAKENING'],
    description: '弱化類異常；處於該異常狀態則無法造成固定傷害、百分比傷害及通過使用攻擊技能所造成的技能傷害',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { damageDealtImmuned: true } }
    ]
  },
  '沸湧': {
    name: '沸湧',
    categories: ['WEAKENING'],
    description: '處於該異常狀態則受到的攻擊傷害至少為其最大體力的 30%，對手打出致命一擊時效果提升至 50%',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { minDamageTakenPercent: 0.3, critMinDamageTakenPercent: 0.5 } }
    ]
  },
  '繳械': {
    name: '繳械',
    categories: ['WEAKENING', 'RESTRICTIVE'],
    description: '弱化類異常，限制類異常，無法選擇使用藥劑，選擇技能階段令選擇的技能PP值歸0，觸發成功時因該技能PP值為0則當回合無法行動',
    mechanics: [
      { type: 'MODIFIER_LIMIT', params: { disablePotions: true, drainSelectedPP: true } },
      { type: 'CANT_ACT', params: { condition: 'PP_ZERO' } }
    ]
  },
  '腐朽': {
    name: '腐朽',
    categories: ['WEAKENING'],
    description: '弱化類異常，處於該異常狀態減少、降低攻擊傷害效果衰減至0%且受到物理攻擊、特殊攻擊技能傷害提升30%且受到前述傷害時額外提高150點傷害；直至本回合戰鬥階段結束時未受到上述傷害則受到300點真實傷害且此異常回合數+2',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { reduceDmgEffectToZero: true, takePhysSpecDmgBonusPercent: 0.3, takePhysSpecDmgBonusFixed: 150 } },
      { type: 'DAMAGE_TICK', params: { dmgType: 'REAL', valueType: 'FIXED', value: 300, condition: 'NO_HIT', extendOnTrigger: 2 } }
    ]
  },
  '失溫': {
    name: '失溫',
    categories: ['WEAKENING', 'RESTRICTIVE'],
    description: '弱化類異常，限制類異常，無法選擇使用藥劑，戰鬥階段結束時受到180點真實傷害，減少4點技能pp值',
    mechanics: [
      { type: 'MODIFIER_LIMIT', params: { disablePotions: true } },
      { type: 'DAMAGE_TICK', params: { dmgType: 'REAL', valueType: 'FIXED', value: 180, ppDrain: 4, timing: 'END' } }
    ]
  },
  '烈焰詛咒': {
    name: '烈焰詛咒',
    categories: ['AUXILIARY'],
    description: '附屬類異常；附屬詛咒類異常；處於該異常狀態則每回合結束時受到等同於自身最大體力 1/8 的百分比傷害',
    mechanics: [
      { type: 'DAMAGE_TICK', params: { dmgType: 'PERCENT', valueType: 'PERCENT', value: 0.125, timing: 'END' } }
    ]
  },
  '遲鈍': {
    name: '遲鈍',
    categories: ['WEAKENING'],
    description: '弱化類異常，處於該異常狀態時速度能力值、正先制等級、造成非真實傷害減半（向下取整），受到非真實傷害翻倍',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { speedMultiplier: 0.5, priorityMultiplier: 0.5, nonTrueDmgDealtMultiplier: 0.5, nonTrueDmgTakenMultiplier: 2.0 } }
    ]
  },
  '窒息': {
    name: '窒息',
    categories: ['WEAKENING'],
    description: '弱化類異常狀態；處於該異常狀態時使用攻擊技能時轉化為撞擊（撞擊：威力 35，造成物理傷害）；異常結束或被解除時消耗自身全部體力令自身死亡',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { overrideAttack: '撞擊', dieOnEnd: true } }
    ]
  },

  // ==========================================
  // 3. 【限制類異常】 (RESTRICTIVE)
  // ==========================================
  '凝滯': {
    name: '凝滯',
    categories: ['WEAKENING', 'RESTRICTIVE'],
    description: '弱化類異常；限制類異常；處於該異常狀態則無法主動切換下場，但免疫受到的控制類異常狀態',
    mechanics: [
      { type: 'CANT_SWITCH' },
      { type: 'SPECIAL_BUFF', params: { immuneToCategory: 'CONTROL' } }
    ]
  },

  // ==========================================
  // 5. 【附屬類異常】 (AUXILIARY)
  // ==========================================
  '山神守護': {
    name: '山神守護',
    categories: ['AUXILIARY'],
    description: '附屬類異常；處於該異常狀態則每回合受到對手的攻擊傷害減少 80%',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { damageTakenMultiplier: 0.2 } }]
  },
  '狂暴': {
    name: '狂暴',
    categories: ['AUXILIARY'],
    description: '附屬類異常；處於該異常狀態則造成傷害翻倍',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { damageDealtMultiplier: 2 } }]
  },
  '平靜': {
    name: '平靜',
    categories: ['AUXILIARY'],
    description: '附屬類異常；處於該狀態使用技能時不受PP值限制且不消耗PP值，回合結束時受到最大體力1%的真實傷害(不致死)並恢復自身所有技能一定PP值(恢復量等於自身PP值上限最高者⅕，向上取整)',
    mechanics: [
      { type: 'SPECIAL_BUFF', params: { infinitePP: true, ppRegenOnEnd: 0.2 } },
      { type: 'DAMAGE_TICK', params: { dmgType: 'REAL', valueType: 'PERCENT', value: 0.01, nonLethal: true, timing: 'END' } }
    ]
  },
  '入魔': {
    name: '入魔',
    categories: ['AUXILIARY'],
    description: '附屬類異常；自身攻擊時克制倍數歸1並乘以神靈系、聖靈系、光系中對自身克制倍數之和(計算時基礎克制倍數默認為1倍，再乘以神靈系、聖靈系、光系三種屬性對該精靈克制倍數總和因此可超過4倍)，回合結束時若當回合未選擇攻擊技能則失去體力上限20%令自身所有附屬類異常回合數+1，反之減少當回合所選擇的攻擊技能1點PP值',
    mechanics: [
      { 
        type: 'TYPE_MATCHUP_OVERRIDE', 
        params: { 
          baseMultiplier: 1, 
          multiplierSources: ['神靈系', '聖靈系', '光系'] 
        } 
      }
    ]
  },
  '星哲': {
    name: '星哲',
    categories: ['AUXILIARY'],
    description: '附屬類異常；星附屬類異常狀態；該狀態下的精靈造成的固定傷害、百分比傷害提升 30%，每回合結束後恢復最大體力的 1/4',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { fixedDmgMultiplier: 1.3, healPercent: 0.25 } }]
  },
  '超頻': {
    name: '超頻',
    categories: ['AUXILIARY', 'EVOLUTIONARY'],
    description: '附屬類異常；衍化類異常；該狀態下精靈的技能先制 +1 且行動開始時恢復所選擇技能的全部 PP 值',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { priorityBonus: 1, restoreSelectedPP: true } }]
  },
  '砥礪': {
    name: '砥礪',
    categories: ['AUXILIARY'],
    description: '附屬類異常；該狀態下的精靈受到真實傷害後，若本回合未執行過附加異常狀態的效果，則直接增加此傷害值 80% 的體力',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { healOnTrueDmgPercent: 0.8 } }]
  },
  '星贖': {
    name: '星贖',
    categories: ['AUXILIARY'],
    description: '附屬類異常；星附屬類異常狀態；處於該異常狀態則體力恢復效果提升 30%，戰鬥階段結束時（每回合結束時）所有非限制類異常狀態的回合數 +1',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { healIncreasePercent: 0.3, extendStatusTurns: 1 } }]
  },
  '雷解': {
    name: '雷解',
    categories: ['AUXILIARY'],
    description: '附屬類異常；自身造成攻擊傷害後，附加對方該傷害值 60% 的真實傷害',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { bonusTrueDmgPercent: 0.6 } }]
  },
  '漸凍': {
    name: '漸凍',
    categories: ['AUXILIARY', 'EVOLUTIONARY'],
    description: '附屬類異常；衍化類異常；異常結束後轉化為 3回合冰封',
    mechanics: [{ type: 'EVOLUTION_TRANSFORM', params: { nextStatus: '冰封', nextDuration: 3 } }]
  },
  '星佑': {
    name: '星佑',
    categories: ['AUXILIARY'],
    description: '附屬類異常；星附屬類異常狀態；處於該異常狀態受到技能傷害降低 30% 且對手帶有正先制的技能無效；自身體力歸 0 時 100% 令自身重生一次並解除所有非控制類異常狀態',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { damageTakenMultiplier: 0.7, immunePrioritySkills: true, reviveOnce: true, purgeNonControlOnRevive: true } }]
  },
  '星護': {
    name: '星護',
    categories: ['AUXILIARY'],
    description: '附屬類異常；星附屬類異常狀態；處於該異常狀態受到固定傷害、百分比傷害降低 30%，100% 閃避對手所有技能且對手帶有必中的技能使用後該 PP 值歸 1；自身存在技能 PP 值被消耗歸 0 時令自身強制保留該技能最大 PP 值 100% 並解除自身所有非弱化類異常狀態',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { fixedPercentDmgTakenMultiplier: 0.7, dodgeAll: true, sureHitPPToOne: true, ppRestoreOnZero: true, purgeNonWeakeningOnPPZero: true } }]
  },
  '星賜': {
    name: '星賜',
    categories: ['AUXILIARY'],
    description: '附屬類異常；星附屬類異常狀態；該狀態下的精靈造成的攻擊傷害提升 30%，每回合結束後恢復 2 點 PP 值',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { damageDealtMultiplier: 1.3, ppRegenPerTurn: 2 } }]
  },
  '虛弱詛咒': {
    name: '虛弱詛咒',
    categories: ['AUXILIARY'],
    description: '附屬類異常；附屬詛咒類異常；處於該異常狀態則造成的攻擊傷害減少 50%',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { damageDealtMultiplier: 0.5 } }]
  },
  '致命詛咒': {
    name: '致命詛咒',
    categories: ['AUXILIARY'],
    description: '附屬類異常；附屬詛咒類異常；處於該異常狀態則受到的攻擊傷害提高 50%',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { damageTakenMultiplier: 1.5 } }]
  },
  '神話': {
    name: '神話',
    categories: ['BOSS_ONLY'],
    description: 'BOSS 專用異常狀態（黃色圖標）；免疫能力下降與異常狀態、PP 無限、所有技能必中。無回合數且不會隨回合遞減，下場後保留。',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { immuneStatDebuff: true, immuneStatus: true, infinitePP: true, sureHit: true } }]
  },
  '免疫': {
    name: '免疫',
    categories: ['BOSS_ONLY'],
    description: 'BOSS 專用異常狀態（藍色圖標）；免疫異常狀態、PP 無限。無回合數且不會隨回合遞減，下場後保留。',
    mechanics: [{ type: 'SPECIAL_BUFF', params: { immuneStatus: true, infinitePP: true } }]
  },
  '異常抵抗': {
    name: '異常抵抗',
    categories: ['AUXILIARY', 'NO_EFFECT'],
    description: '附屬類異常；無效果類異常；自身觸發異常狀態抗性抵抗時進行轉化產生的異常狀態；最多1回合且視為無效果異常',
    mechanics: [{ type: 'SPECIAL_BUFF' }]
  },
};
