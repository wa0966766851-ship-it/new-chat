import type { ElfDeconstructedProfile } from "../../effects/types";

export const ZhakesiFearDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'zhakesi_fear',
  name: '恐懼的化身·咤克斯',
  soulMark: {
    fear: {
      id: 'mark.zhakesi_fear',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '懼',
        description: '自身存活在出戰背包內時(自身在場時也生效)，每回合吸取敵我雙方所有精靈20點體力上限附加給自身，最多吸取至該精靈體力上限為1；戰鬥開始時為對手種下恐懼之種；回合開始時，若自身滿體力則令對手100%害怕，未觸發則消除雙方能力上升、下降狀態與回合類效果；戰鬥階段結束時，恢復自身已損失體力50%的體力值與1點PP值，同時對手受到等同於自身恢復量百分比傷害，若對手體力未滿則額外令對手全屬性-1且至少減至1，未觸發則對手下2回合無法主動切換精靈；\n恐懼之種:持有方所有精靈均無法附加害怕異常與觸發秒殺效果且每次受到害怕異常時當回合免疫害怕異常狀態但所選擇的技能PP值歸0且當回合若因此PP值為0時則無法行動，造成非真實傷害降低20%，受到非真實傷害提升40%，每次受到對手的攻擊時有20%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害，每次己方精靈登場或受到害怕狀態時提高1層，每有1層則上述機率提高2%，最高5層，達到5層時轉變為恐懼之花\n恐懼之花:持有方所有精靈均無法附加給敵我雙方任一方異常異常狀態與觸發秒殺效果，每回合開始時恐懼之花會令在場精靈進入害怕狀態，造成非真實傷害降低50%，受到非真實傷害提升100%，每次受到對手的攻擊時有50%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害',
        combatLog: '🦇 【懼】之魂印啟動！恐懼的化身降臨，為對手種下【恐懼之種】！'
      },
      mechanics: {
        trigger: 'BATTLE_START',
        absorbMaxHpPerTurn: 20,
        plantFearSeed: true,
        fullHpFearOrDispelBoth: true,
        endTurnHealLostHp50AndPP: true,
        seedToFlowerMaxLayers: 5
      }
    }
  },
  skills: {}
};

