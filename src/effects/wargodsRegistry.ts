import { ElfDeconstructedProfile } from './types';

export const ReyDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'default_0',
  name: '雷伊',
  soulMark: {
    lei: {
      id: 'mark.lei',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '雷',
        description: '每回合結束時有 100% 機率使對手麻痺（無法行動 1 回合）',
        combatLog: '⚡ 雷神雷伊釋放雷之魂印，麻痺對手！'
      },
      mechanics: {
        trigger: 'ROUND_END',
        paralyzeChance: 1.0
      }
    }
  },
  skills: {}
};

export const GaiaDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'default_1',
  name: '蓋亞',
  soulMark: {
    zhan: {
      id: 'mark.zhan',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '戰',
        description: '當自身體力低於 50% 時，攻擊力提升 30%',
        combatLog: '🔥 戰神蓋亞觸發戰之魂印，越戰越勇！'
      },
      mechanics: {
        trigger: 'PASSIVE_STAT',
        lowHpThreshold: 0.5,
        atkBoost: 0.3
      }
    }
  },
  skills: {}
};

export const CassiusDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'default_2',
  name: '卡修斯',
  soulMark: {
    di: {
      id: 'mark.di',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '地',
        description: '每回合有 50% 機率免疫對手本回合的攻擊傷害；先出手則當回合對手技能無法造成攻擊傷害且附加效果失效，後出手則附加自身300點護盾',
        combatLog: '🪨 卡修斯觸發地之魂印！大地庇護抵擋傷害！'
      },
      mechanics: {
        trigger: 'ON_ATTACK_TAKEN',
        dodgeChance: 0.5,
        firstAttackSeal: true,
        secondAttackShield: 300
      }
    }
  },
  skills: {}
};

export const BlakeDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'default_3',
  name: '布萊克',
  soulMark: {
    mo: {
      id: 'mark.mo_base',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '魔',
        description: '造成的攻擊傷害提升 50%；100%閃避對手所有技能(對必中技能失效)；本場戰鬥僅限一次，死亡時保留1點體力並消除對手回合類效果，同時100%令對手害怕。',
        combatLog: '🌑 布萊克觸發魔之魂印，暗影之力守護！'
      },
      mechanics: {
        trigger: 'ROUND_START'
      }
    }
  },
  skills: {}
};
