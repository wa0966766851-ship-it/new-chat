import type { ElfDeconstructedProfile } from "../../effects/types";

export const ZhakesiAnnihilationDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'zhakesi_annihilation',
  name: '湮滅之主・咤克斯',
  soulMark: {
    demon: {
      id: 'mark.zhakesi_annihilation',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '咤',
        description: '戰鬥開始時獲得1層魔王咒怨，敵我雙方出戰背包內每有1個擁有瞬殺特性的精靈自身額外獲得1層魔王咒怨；自身位於出戰背包時，對方的秒殺效果失效改為使自身獲得1層魔王咒怨；\n\n對手使用技能時，若自身為滿體力則消除對手回合類效果與能力提升狀態，若自身不為滿體力則獲得等同於已損失體力值50%的護盾、護罩且當回合戰鬥階段結束時自身恢復回合開始時自身所擁有護盾、護罩之和的體力；\n自身擊敗對手時自身所有能力值提升35點並獲得2層魔王咒怨；自身被擊敗時，令對手的體力上限減少35%；\n\n魔王咒怨：自身觸發秒殺時，額外選擇對方所有體力與原本秒殺目標相等的精靈為目標，達到5層時自身免疫控制類異常狀態；每有1層受到的攻擊傷害減少5%、造成的攻擊傷害提升5%、自身攻擊有3%的機率造成的傷害不低於對手的最大體力值',
        combatLog: '👿 【咤】之魂印啟動！魔王咒怨籠罩，主宰深淵與虛無！'
      },
      mechanics: {
        trigger: 'BATTLE_START',
        devilCurseStartLayers: 1,
        backpackInstantKillBlock: true,
        dispelOppOnFullHp: true,
        shieldOnLowHp: true,
        killStatBoost35: true,
        deathReduceOppMaxHp35Pct: true
      }
    }
  },
  skills: {}
};

