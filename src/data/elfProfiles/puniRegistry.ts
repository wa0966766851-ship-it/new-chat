import type { ElfDeconstructedProfile } from "../../effects/types";

export const PuniBaseDeconstructedProfile: ElfDeconstructedProfile = {
  id: "puni_base",
  name: "譜尼",
  soulMark: {
    holy_puni_base: {
      id: "mark.holy_puni_base",
      effectClass: "MARK",
      flavor: {
        name: "聖",
        description: "天生免疫每次受到的異常狀態；每回合結束時恢復最大體力25%與所有技能1點PP值"
      },
      mechanics: {}
    }
  },
  skills: {
    "極光": [
      {
        id: "puni_base.jiguang",
        effectClass: "ON_HIT",
        flavor: { name: "極光", description: "（無特殊效果）" },
        mechanics: {}
      }
    ],
    "神聖之光": [
      {
        id: "puni_base.shensheng_light",
        effectClass: "ON_HIT",
        flavor: { name: "神聖之光", description: "（無特殊效果）" },
        mechanics: {}
      }
    ],
    "虛無": [
      {
        id: "puni_base.xuwu",
        effectClass: "ON_HIT",
        flavor: { name: "虛無", description: "2個回合若先出手，對手技能失效" },
        mechanics: {}
      }
    ],
    "元素": [
      {
        id: "puni_base.yuansu",
        effectClass: "ON_HIT",
        flavor: { name: "元素", description: "額外附加200點真實傷害" },
        mechanics: {}
      }
    ],
    "能量": [
      {
        id: "puni_base.nengliang",
        effectClass: "ON_HIT",
        flavor: { name: "能量", description: "將所受的傷害2倍反饋對手" },
        mechanics: {}
      }
    ],
    "靈光之怒": [
      {
        id: "puni_base.lingguang_wrath",
        effectClass: "ON_HIT",
        flavor: { name: "靈光之怒", description: "對手能力等級越高此招威力越大" },
        mechanics: {}
      }
    ],
    "生命": [
      {
        id: "puni_base.shengming",
        effectClass: "ON_HIT",
        flavor: { name: "生命", description: "5回合內，每回合回復100點固定體力值" },
        mechanics: {}
      }
    ],
    "斷空破": [
      {
        id: "puni_base.duankong",
        effectClass: "ON_HIT",
        flavor: { name: "斷空破", description: "額外附加30點傷害" },
        mechanics: {}
      }
    ],
    "輪迴": [
      {
        id: "puni_base.lunhui",
        effectClass: "ON_HIT",
        flavor: { name: "輪迴", description: "回復自身最大體力的1/1" },
        mechanics: {}
      }
    ],
    "靈魂干涉": [
      {
        id: "puni_base.linghun",
        effectClass: "ON_HIT",
        flavor: { name: "靈魂干涉", description: "命中時100%令對手疲憊2回合" },
        mechanics: {}
      }
    ],
    "聖堂之門": [
      {
        id: "puni_base.shengtang",
        effectClass: "ON_HIT",
        flavor: { name: "聖堂之門", description: "消除對方能力增強效果" },
        mechanics: {}
      }
    ],
    "永恆": [
      {
        id: "puni_base.yongheng",
        effectClass: "ON_HIT",
        flavor: { name: "永恆", description: "回復自身所有PP值" },
        mechanics: {}
      }
    ],
    "聖潔": [
      {
        id: "puni_base.shengjie",
        effectClass: "ON_HIT",
        flavor: { name: "聖潔", description: "5回合內屬性技能對自身必定MISS" },
        mechanics: {}
      }
    ],
    "旋滅裂空陣": [
      {
        id: "puni_base.xuanmie",
        effectClass: "ON_HIT",
        flavor: { name: "旋滅裂空陣", description: "5回合每回合附加30點固定傷害" },
        mechanics: {}
      }
    ],
    "千烈虛光閃": [
      {
        id: "puni_base.qianlie",
        effectClass: "ON_HIT",
        flavor: { name: "千烈虛光閃", description: "解除自身能力下降狀態" },
        mechanics: {}
      }
    ],
    "聖光氣": [
      {
        id: "puni_base.shengguangqi",
        effectClass: "ON_HIT",
        flavor: { name: "聖光氣", description: "接下來2回合攻擊必定致命一擊" },
        mechanics: {}
      }
    ],
    "聖靈魔閃光": [
      {
        id: "puni_base.shenglingmo",
        effectClass: "ON_HIT",
        flavor: { name: "聖靈魔閃光", description: "降低對方1/8的HP" },
        mechanics: {}
      }
    ],
    "璨靈聖光": [
      {
        id: "puni_base.canling",
        effectClass: "ON_HIT",
        flavor: { name: "璨靈聖光", description: "必中，2回合內有100%機率免疫對手的攻擊傷害，5回合內每回合恢復自身體力1/3，遇到天敵時先制+1，下2回合攻擊必定先出手，使自身下2回合的攻擊威力翻倍" },
        mechanics: {}
      }
    ],
    "落芳天華": [
      {
        id: "puni_base.luofang",
        effectClass: "ON_HIT",
        flavor: { name: "落芳天華", description: "先制+3，吸收對手能力提升；附加100點固定傷害，每次使用額外附加100點，最高400點，遇到天敵時效果翻倍" },
        mechanics: {}
      }
    ],
    "聖靈悲魂曲": [
      {
        id: "puni_base.beihun",
        effectClass: "ON_HIT",
        flavor: { name: "聖靈悲魂曲", description: "先制+1，3回合內50%機率使對手的屬性技能失效，先出手時降低對手所有PP2點" },
        mechanics: {}
      }
    ],
    "聖影流光破": [
      {
        id: "puni_base.shengying",
        effectClass: "ON_HIT",
        flavor: { name: "聖影流光破", description: "必中，消除對手回合類效果，消除成功2回合內對手無法通過自身技能恢復HP，當回合未擊敗對手則自身特攻、速度+1，吸取對手150點固定體力，每次使用額外附加100點，最高350點" },
        mechanics: {}
      }
    ]
  }
};

export const ShenglingPuniDeconstructedProfile: ElfDeconstructedProfile = {
  id: "puni",
  name: "聖靈譜尼",
  soulMark: {
    holy_spirit_puni: {
      id: "mark.holy_spirit_puni",
      effectClass: "MARK",
      flavor: {
        name: "神",
        description: "虛無：受到攻擊傷害時，免疫下1次受到的攻擊傷害\n元素：登場時消除對手回合類效果，消除成功則對手下次技能無效\n能量：戰鬥階段結束時附加自身已損失體力50%的百分比傷害\n生命：戰鬥階段結束時恢復自身最大體力的1/4和隨機2個PP值未滿的技能1點PP值\n輪迴：對手出手回合若自身受到致命傷害則殘留1點體力，同時回合結束後自身體力、PP值、能力等級返回當回合選擇操作之後的狀態（每場戰鬥僅觸發1次）\n永恆：回合開始時若自身體力高於對手則當回合自身必定先手\n聖潔：天生免疫所有異常狀態和能力下降狀態"
      },
      mechanics: {}
    }
  },
  skills: {
    "極光": [
      {
        id: "puni.jiguang",
        effectClass: "ON_HIT",
        flavor: { name: "極光", description: "（無特殊效果）" },
        mechanics: {}
      }
    ],
    "神聖之光": [
      {
        id: "puni.shensheng_light",
        effectClass: "ON_HIT",
        flavor: { name: "神聖之光", description: "（無特殊效果）" },
        mechanics: {}
      }
    ],
    "虛無": [
      {
        id: "puni.xuwu",
        effectClass: "ON_HIT",
        flavor: { name: "虛無", description: "2個回合若先出手，對手技能失效" },
        mechanics: {}
      }
    ],
    "元素": [
      {
        id: "puni.yuansu",
        effectClass: "ON_HIT",
        flavor: { name: "元素", description: "額外附加200點真實傷害" },
        mechanics: {}
      }
    ],
    "能量": [
      {
        id: "puni.nengliang",
        effectClass: "ON_HIT",
        flavor: { name: "能量", description: "將所受的傷害2倍反饋對手" },
        mechanics: {}
      }
    ],
    "靈光之怒": [
      {
        id: "puni.lingguang_wrath",
        effectClass: "ON_HIT",
        flavor: { name: "靈光之怒", description: "對手能力等級越高此招威力越大" },
        mechanics: {}
      }
    ],
    "生命": [
      {
        id: "puni.shengming",
        effectClass: "ON_HIT",
        flavor: { name: "生命", description: "5回合內，每回合回復100點固定體力值" },
        mechanics: {}
      }
    ],
    "斷空破": [
      {
        id: "puni.duankong",
        effectClass: "ON_HIT",
        flavor: { name: "斷空破", description: "額外附加30點傷害" },
        mechanics: {}
      }
    ],
    "輪迴": [
      {
        id: "puni.lunhui",
        effectClass: "ON_HIT",
        flavor: { name: "輪迴", description: "回復自身最大體力的1/1" },
        mechanics: {}
      }
    ],
    "靈魂干涉": [
      {
        id: "puni.linghun",
        effectClass: "ON_HIT",
        flavor: { name: "靈魂干涉", description: "命中時100%令對手疲憊2回合" },
        mechanics: {}
      }
    ],
    "聖堂之門": [
      {
        id: "puni.shengtang",
        effectClass: "ON_HIT",
        flavor: { name: "聖堂之門", description: "消除對方能力增強效果" },
        mechanics: {}
      }
    ],
    "永恆": [
      {
        id: "puni.yongheng",
        effectClass: "ON_HIT",
        flavor: { name: "永恆", description: "回復自身所有PP值" },
        mechanics: {}
      }
    ],
    "聖潔": [
      {
        id: "puni.shengjie",
        effectClass: "ON_HIT",
        flavor: { name: "聖潔", description: "5回合內屬性技能對自身必定MISS" },
        mechanics: {}
      }
    ],
    "旋滅裂空陣": [
      {
        id: "puni.xuanmie",
        effectClass: "ON_HIT",
        flavor: { name: "旋滅裂空陣", description: "5回合每回合附加30點固定傷害" },
        mechanics: {}
      }
    ],
    "千烈虛光閃": [
      {
        id: "puni.qianlie",
        effectClass: "ON_HIT",
        flavor: { name: "千烈虛光閃", description: "解除自身能力下降狀態" },
        mechanics: {}
      }
    ],
    "聖光氣": [
      {
        id: "puni.shengguangqi",
        effectClass: "ON_HIT",
        flavor: { name: "聖光氣", description: "接下來2回合攻擊必定致命一擊" },
        mechanics: {}
      }
    ],
    "聖靈魔閃光": [
      {
        id: "puni.shenglingmo",
        effectClass: "ON_HIT",
        flavor: { name: "聖靈魔閃光", description: "降低對方1/8的HP" },
        mechanics: {}
      }
    ],
    // Exclusive skills
    "璨靈聖光": [
      {
        id: "puni.canling",
        effectClass: "ON_HIT",
        flavor: { name: "璨靈聖光", description: "必中，2回合內有100%機率免疫對手的攻擊傷害，5回合內每回合恢復自身體力1/3，遇到天敵時先制+1，下2回合攻擊必定先出手，使自身下2回合的攻擊威力翻倍" },
        mechanics: {}
      }
    ],
    "落芳天華": [
      {
        id: "puni.luofang",
        effectClass: "ON_HIT",
        flavor: { name: "落芳天華", description: "先制+3，吸收對手能力提升；附加100點固定傷害，每次使用額外附加100點，最高400點，遇到天敵時效果翻倍" },
        mechanics: {}
      }
    ],
    "聖靈悲魂曲": [
      {
        id: "puni.beihun",
        effectClass: "ON_HIT",
        flavor: { name: "聖靈悲魂曲", description: "先制+1，3回合內50%機率使對手的屬性技能失效，先出手時降低對手所有PP2點" },
        mechanics: {}
      }
    ],
    "聖影流光破": [
      {
        id: "puni.shengying",
        effectClass: "ON_HIT",
        flavor: { name: "聖影流光破", description: "必中，消除對手回合類效果，消除成功2回合內對手無法通過自身技能恢復HP，當回合未擊敗對手則自身特攻、速度+1，吸取對手150點固定體力，每次使用額外附加100點，最高350點" },
        mechanics: {}
      }
    ],
    "神靈之觸": [
      {
        id: "puni.shenling_touch",
        effectClass: "ON_HIT",
        flavor: { name: "神靈之觸", description: "先制+3；消除對手能力提升，消除成功則對手下1次攻擊技能無效；附加對手最大體力值15%的百分比傷害，連續使用每次增加10%，最高45%" },
        mechanics: {}
      }
    ],
    "聖光吟誦": [
      {
        id: "puni.yinsong",
        effectClass: "ON_HIT",
        flavor: { name: "聖光吟誦", description: "必中；命中後100%令對手疲憊3回合，未觸發則對手2回合內屬性技能無效；4回合內，受到對手攻擊時附加對方等同於對方最大體力1/3的百分比傷害；下兩回合對手受到攻擊傷害提升150%" },
        mechanics: {}
      }
    ],
    "神聖復甦": [
      {
        id: "puni.fusu",
        effectClass: "ON_HIT",
        flavor: { name: "神聖復甦", description: "先制+2；使雙方精靈所有技能PP歸零；消除雙方能力提升、下降狀態和回合類效果；恢復自身最大體力1/1，並附加等同於恢復量的百分比傷害" },
        mechanics: {}
      }
    ],
    "光榮之夢": [
      {
        id: "puni.guangrong",
        effectClass: "ON_HIT",
        flavor: { name: "光榮之夢", description: "必中；全屬性+1，對手不為混沌系時效果翻倍；3回合內每回合吸取對手能力強化狀態；恢復自身最大體力1/1並附加對手等同於恢復量的百分比傷害；下2回合自身所有技能先制+2" },
        mechanics: {}
      }
    ],
    "神聖啟示歌": [
      {
        id: "puni.qishige",
        effectClass: "ON_HIT",
        flavor: { name: "神聖啟示歌", description: "先制+1；先出手時使對手隨機2個技能PP歸零；後出手時下回合所有技能先制+3" },
        mechanics: {}
      }
    ],
    "神靈救世光": [
      {
        id: "puni.jiushiguang",
        effectClass: "ON_HIT",
        flavor: { name: "神靈救世光", description: "必中；消除對手回合類效果，消除成功則對手3回合內無法通過自身技能恢復體力；當回合未擊敗對手則自身下次攻擊附加對手等同於自身最大體力1/3的百分比傷害；吸取對手200體力，自身體力低於1/2時吸取效果翻倍" },
        mechanics: {}
      }
    ]
  }
};

