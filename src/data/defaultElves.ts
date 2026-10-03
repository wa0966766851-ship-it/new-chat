import { ELF_TEXT } from "./elfDescriptions";
import SOURCE_TEXT from "./elfSourceText.json";
import { ELF_ID_MAPPING } from "./elfRegistry";
import { Elf, Skill, StatChange } from "../types";
import { KitEntry } from "../effects/effectSystem.schema";
import { calculateElfStats } from "../utils/statCalculator";
import SKILL_REFERENCES from "./skillReferences.generated.json";
import { getEffectiveInscriptions } from "./inscriptionsCatalog";
import { parseStatChangesFromText } from "../utils/statChangeManager";
import { parseStatusesFromText } from "../utils/statusManager";
import { OTHERWORLD_REY_SEED } from "./otherworldRey";
import { HOLY_MILES_SEED } from "./holyMiles";
import { STAGED_ARENA_ELVES } from "./stagedArenaElves";

function createRefSkill(
  elfId: string,
  name: string,
  type: string,
  category: '物理' | '特殊' | '屬性',
  power: number,
  pp: number,
  priority: number = 0,
  options: {
    isSureHit?: boolean;
    isFifthSkill?: boolean;
    accuracy?: number;
    fallbackDesc?: string;
    effectType?: Skill['effectType'];
    effectDetail?: string;
  } = {}
): Skill {
  const entries = (SKILL_REFERENCES as Record<string, Record<string, {
    flavor: { description: string };
    mechanics: Partial<Pick<Skill, 'category' | 'type' | 'accuracy' | 'isSureHit' | 'isFifthSkill'>> & { alwaysHit?: boolean };
  }[]>>)[elfId]?.[name];
  
  let description = options.fallbackDesc || '';
  let resolvedCategory = category;
  let resolvedType = type;
  let resolvedAccuracy = options.accuracy ?? 100;
  let resolvedSureHit = options.isSureHit ?? false;
  let resolvedFifthSkill = options.isFifthSkill ?? false;

  if (entries && entries.length > 0) {
    const descParts: string[] = [];
    if (priority !== 0 && !entries.some(e => e.flavor.description.includes(`先制`))) {
      descParts.push(priority > 0 ? `先制+${priority}` : `先制${priority}`);
    }
    if (options.isSureHit && !entries.some(e => e.flavor.description.includes(`必中`))) {
      descParts.push(`必中`);
    }
    entries.forEach(e => {
      if (e.mechanics.category) resolvedCategory = e.mechanics.category;
      if (e.mechanics.type) resolvedType = e.mechanics.type;
      if (e.mechanics.accuracy !== undefined) resolvedAccuracy = e.mechanics.accuracy;
      if (e.mechanics.alwaysHit !== undefined || e.mechanics.isSureHit !== undefined) resolvedSureHit = Boolean(e.mechanics.alwaysHit || e.mechanics.isSureHit);
      if (e.mechanics.isFifthSkill !== undefined) resolvedFifthSkill = e.mechanics.isFifthSkill;

      if (e.flavor.description && e.flavor.description !== '（無特殊效果）') {
        descParts.push(e.flavor.description);
      }
    });
    if (descParts.length > 0) {
      description = descParts.join('；');
    }
  }
  // 使用者確認過的標準描述優先
  const textKey = ELF_ID_MAPPING[elfId] || elfId;
  const stdText = ELF_TEXT[textKey]?.skills?.[name];
  if (stdText) description = stdText;
  if (!description) {
    description = '（無特殊效果）';
  }

  return {
    name,
    type: resolvedType,
    category: resolvedCategory,
    power,
    pp,
    priority,
    accuracy: resolvedAccuracy,
    isSureHit: resolvedSureHit,
    isFifthSkill: resolvedFifthSkill,
    description,
    effectType: options.effectType || 'none',
    effectDetail: options.effectDetail || '',
    statChanges: parseStatChangesFromText(description),
    statusEffects: parseStatusesFromText(description)
  };
}

const SEED_ELVES: (Omit<Elf, "id" | "calculatedStats" | "currentHp" | "maxHp"> & { id?: string })[] = [
  {
    id: "5001",
    name: "悲歌.索比拉特",
    type: "暗影",
    level: 100,
    height: 49.5,
    weight: 1.9,
    gender: "無性別",
    baseStats: {"hp":165,"atk":70,"def":113,"spatk":140,"spdef":113,"speed":134},
    interceptorEffect: {"id":"dirge_shield","name":"悲歌護盾","description":"陣亡時，為我方下一隻出場精靈賦予等同於自身最大體力 80% 的精靈護罩，並免疫異常 2 回合！","type":"on_death","triggerLog":"🎡【命運攔截·悲歌護盾】：將餘暉化為精靈護罩！我方下一隻出戰精靈獲得巨額護罩與 2 回合不滅免控！"},
    soulMark: {"name":"黯","badgeChar":"黯","description":"自身每次受到技能傷害時令對手進入害怕狀態，未觸發則當回合結束時吸取對手所有技能1點PP值；回合結束若自身未受到技能傷害，則下次被擊敗時黯痕回合數+1；自身被擊敗時消除對手回合類效果與能力提升狀態並為對方在場精靈附加黯痕印記；黯痕：持有者每次技能傷害無法超過1點且造成的百分比與固定傷害減半，對方無視傷害限制時改為本次技能傷害減半，持續3回合，期間持有者無法附加雙方任一方異常狀態且受到攻擊技能傷害翻倍\n\n【命運之輪 C 級專屬攔截：悲歌護盾】\n陣亡時，為我方下一隻出場精靈賦予等同於自身最大體力 80% 的精靈護罩，並免疫異常 2 回合！","effectType":"custom","effectValue":0},
    skills: [
      {"name":"黯索魂噬","type":"暗影","category":"特殊","power":85,"pp":20,"priority":3,"isSureHit":true,"description":"先制+3；必中；消除對手回合類效果，消除成功則令對手害怕；消除對手能力提升狀態，消除成功則對手全屬性-1","effectType":"none","effectDetail":""},
      {"name":"陰世遊靈","type":"無屬性","category":"屬性","power":0,"pp":10,"isSureHit":true,"description":"必中；全屬性+1；4回合內每回合恢復自身最大體力1/2；下3回合自身攻擊技能附加250點真實傷害；下2回合所有技能先制+2","priority":0,"effectType":"none","effectDetail":""},
      {"name":"影之牢籠","type":"無屬性","category":"屬性","power":0,"pp":5,"priority":1,"isSureHit":true,"description":"必中；先制+1；消耗自身全部體力，以令下次被擊敗時黯痕回合數+1；附加對手300點固定傷害，若對手因此被擊敗則自身保留1點體力","effectType":"none","effectDetail":""},
      {"name":"幽冥噬魂","type":"暗影","category":"特殊","power":120,"pp":10,"accuracy":95,"description":"5回合內免疫並反彈所有異常狀態；3回合內自身使用技能則100%令對手害怕；3回合內對手使用攻擊技能時100%令對手束縛；3回合內自身使用攻擊技能時若攻擊技能無效則消除對手回合類效果","effectType":"none","effectDetail":""},
      {"name":"黯·萬魂歸寂","type":"暗影","category":"特殊","power":160,"pp":5,"priority":1,"isSureHit":true,"isFifthSkill":true,"description":"必中；先制+1；消除對手回合類效果，消除成功則對手2回合內屬性技能無效；造成傷害100%恢復自身體力；2回合內100%閃避對手攻擊技能；3回合內自身死亡時強制存活並保留1點體力","effectType":"none","effectDetail":""}
    ]
  },
  {
    id: "5002",
    name: "帝皇之盾",
    type: "聖靈.戰鬥",
    level: 100,
    height: 195,
    weight: 75,
    gender: "雄性",
    baseStats: {"hp":165,"atk":130,"def":115,"spatk":70,"spdef":105,"speed":150},
    interceptorEffect: {"id":"block_attack","name":"封技攔截","description":"登場時，釋放強大命運磁場，使對手當前精靈下 1 回合無法使用攻擊技能！","type":"on_enter","triggerLog":"🎡【命運攔截·封技】：強大的命運磁場籠罩戰場，封鎖了對手下回合的攻擊技！"},
    soulMark: {"name":"盾","badgeChar":"盾","description":"登場時獲得自身最大體力1/3的護盾；回合開始時自身擁有護盾則免疫所有異常狀態並令對手全屬性-1；自身被擊敗時將剩餘護盾值轉化為守護印記附加給下一隻登場的己方精靈；守護印記：持有者受到攻擊傷害減少25%，每層額外+10%，最高55%，持續4回合；自身被擊敗時消除對手能力提升狀態並令對手2回合內攻擊技能PP消耗提升3倍\n\n【命運之輪 C 級專屬攔截：封技攔截】\n登場時，使對手當前精靈下 1 回合無法使用攻擊技能！","effectType":"custom","effectValue":0},
    skills: [
      {"name":"盾先鋒制裁","type":"聖靈.戰鬥","category":"物理","power":85,"pp":20,"priority":3,"isSureHit":true,"description":"先制+3；必中；消除對手能力提升狀態，消除成功則對手全屬性-1；消除對手回合類效果，消除成功則對手2回合內屬性技能無效","effectType":"none","effectDetail":""},
      {"name":"帝永壁令","type":"無屬性","category":"屬性","power":0,"pp":5,"isSureHit":true,"description":"必中；全屬性+1，自身處於能力提升狀態時強化效果翻倍；4回合內每回合恢復自身最大體力1/3，並將恢復量的50%轉化為護盾；自身免疫下2次異常狀態；下2回合所有技能先制+2","priority":0,"effectType":"none","effectDetail":""},
      {"name":"盾碎同歸","type":"無屬性","category":"屬性","power":0,"pp":5,"priority":1,"isSureHit":true,"description":"必中；先制+1；消耗自身全部護盾值；每消耗100點護盾值令對手隨機1個技能PP歸零；消耗護盾值為0時自身全屬性+2且下回合先制+3","effectType":"none","effectDetail":""},
      {"name":"聖盾裁決","type":"聖靈.戰鬥","category":"物理","power":140,"pp":10,"priority":0,"isSureHit":true,"description":"必中；造成傷害的40%恢復自身體力；自身擁有護盾時附加護盾值70%的百分比傷害；自身不處於護盾狀態時本技能威力提升100%","effectType":"none","effectDetail":""},
      {"name":"帝·永恆守護","type":"聖靈.戰鬥","category":"物理","power":160,"pp":5,"priority":1,"isSureHit":true,"isFifthSkill":true,"description":"必中；先制+1；消除對手回合類效果，消除成功則對手下1次技能無效；自身擁有護盾時附加護盾值等量真實傷害；附加對手最大體力1/3百分比傷害，未擊敗對手時恢復自身等量體力","effectType":"none","effectDetail":""}
    ]
  },
  {
    id: "5003",
    name: "天蓬元帥八戒",
    type: "地面.戰鬥",
    level: 100,
    height: 163,
    weight: 388,
    gender: "雄性",
    baseStats: {"hp":180,"atk":130,"def":125,"spatk":70,"spdef":115,"speed":115},
    interceptorEffect: {"id":"pp_chain","name":"時空枷鎖","description":"登場首回合，消耗對手所有技能 2 點 PP 上限與當前 PP！","type":"on_enter","triggerLog":"🎡【命運攔截·時空枷鎖】：時空扭曲！對手全體技能 PP 上限與當前值減少了 2 點！"},
    soulMark: {"name":"淨","badgeChar":"淨","description":"自身受到攻擊時消除對手能力提升狀態；自身體力高於1/2時受到攻擊傷害減少25%，低於1/2時減少50%；回合結束時自身體力低於1/4則恢復自身最大體力1/3並令對手全屬性-1；自身被擊敗時令對手體力上限減少40%且2回合內無法恢復體力，對手每處於1種能力下降狀態則額外減少10%且回合數+1\n\n【命運之輪 C 級專屬攔截：時空枷鎖】\n登場首回合，消耗對手所有技能 2 點 PP 上限與當前 PP！","effectType":"custom","effectValue":0},
    skills: [
      {"name":"天河衝擊","type":"戰鬥","category":"物理","power":85,"pp":20,"priority":3,"isSureHit":true,"description":"先制+3；必中；消除對手能力提升狀態，消除成功則對手全屬性-1；消除對手回合類效果，消除成功則對手2回合內無法恢復體力","effectType":"none","effectDetail":""},
      {"name":"殘軀鎖命","type":"無屬性","category":"屬性","power":0,"pp":5,"priority":2,"isSureHit":true,"description":"必中；先制+2；全屬性+1，自身處於能力提升狀態時強化效果翻倍；4回合內自身體力受到攻擊傷害不超過200點；4回合內每回合恢復自身最大體力1/3，恢復量的50%轉化為附加對手等量戰鬥系傷害；下2回合對手受到攻擊傷害提升100%","effectType":"none","effectDetail":""},
      {"name":"萬鈞鎮魂","type":"戰鬥","category":"物理","power":150,"pp":5,"priority":0,"isSureHit":true,"description":"必中；造成傷害的40%恢復自身體力；對手體力高於自身時附加對手最大體力1/4固定傷害；未擊敗對手則對手全屬性-1","effectType":"none","effectDetail":""},
      {"name":"混元護體","type":"無屬性","category":"屬性","power":0,"pp":5,"isSureHit":true,"description":"必中；4回合內免疫並反彈所有非附屬類異常狀態；命中後100%令對手害怕；3回合內自身受到的單次攻擊傷害不超過280點；下2回合自身所有攻擊技能先制+2","priority":0,"effectType":"none","effectDetail":""},
      {"name":"淨·天河倒懸","type":"戰鬥","category":"物理","power":160,"pp":5,"priority":1,"isSureHit":true,"isFifthSkill":true,"description":"必中；先制+1；消除對手回合類效果，消除成功則對手3回合內無法恢復體力且屬性技能無效；自身體力低於對手時造成傷害提升100%並恢復等量體力","effectType":"none","effectDetail":""}
    ]
  },
  {
    id: "5004",
    name: "皮特薩拉羅",
    type: "飛行",
    level: 100,
    height: 150,
    weight: 80,
    gender: "雌性",
    baseStats: {"hp":160,"atk":70,"def":110,"spatk":140,"spdef":110,"speed":145},
    soulMark: {"name":"翎","badgeChar":"翎","description":"自身使用攻擊技能時100%機率令對手麻痺，對手處於能力下降狀態時額外附加對手最大體力1/3的百分比傷害；回合結束時自身體力低於1/2則消除對手回合類效果並令對手全屬性-1；自身首次受到致命傷害時保留1點體力並令對手進入麻痺狀態；自身被擊敗時消除對手回合類效果，然後依次令對手進入麻痺、害怕、癱瘓狀態（三種異常各消耗1次免疫次數）；自身位於背包時對方切換登場有100%機率進入麻痺","effectType":"custom","effectValue":0},
    skills: [
      {"name":"翎封禁之羽","type":"飛行","category":"特殊","power":85,"pp":20,"priority":3,"isSureHit":true,"description":"先制+3；必中；消除對手能力提升狀態，消除成功則對手全屬性-1；消除對手回合類效果，消除成功則令對手麻痺","effectType":"none","effectDetail":""},
      {"name":"千鳥俱寂","type":"無屬性","category":"屬性","power":0,"pp":5,"isSureHit":true,"description":"必中；全屬性+1，自身處於能力提升狀態時強化效果翻倍；消除對手回合類效果；4回合內每回合恢復自身最大體力1/3並附加等量固定傷害；下2回合自身攻擊技能必定令對手麻痺；下2回合所有技能先制+2","priority":0,"effectType":"none","effectDetail":""},
      {"name":"翎羽風暴","type":"無屬性","category":"屬性","power":0,"pp":5,"isSureHit":true,"description":"必中；4回合內免疫並反彈所有非附屬類異常狀態；消除對手回合類效果，消除成功則對手2回合內屬性技能無效；免疫下1次受到的攻擊；100%令對手害怕","priority":0,"effectType":"none","effectDetail":""},
      {"name":"千翎破陣","type":"飛行","category":"特殊","power":130,"pp":10,"priority":1,"isSureHit":true,"description":"先制+1；必中；消除對手回合類效果，消除成功則對手2回合內攻擊技能無效；對手處於異常狀態時本技能威力提升100%","effectType":"none","effectDetail":""},
      {"name":"翎萬羽歸宗","type":"飛行","category":"特殊","power":160,"pp":5,"priority":1,"isSureHit":true,"isFifthSkill":true,"description":"必中；先制+1；消除對手回合類效果，消除成功則令對手疲憊；對手處於異常狀態時造成傷害提升100%並恢復等量體力；對手不處於異常狀態時附加對手最大體力1/3百分比傷害","effectType":"none","effectDetail":""}
    ],
    skillPool: [
      {"name":"翎封禁之羽","type":"飛行","category":"特殊","power":85,"pp":20,"priority":3,"isSureHit":true,"description":"先制+3；必中；消除對手能力提升狀態，消除成功則對手全屬性-1；消除對手回合類效果，消除成功則令對手麻痺","effectType":"none","effectDetail":""},
      {"name":"千鳥俱寂","type":"無屬性","category":"屬性","power":0,"pp":5,"isSureHit":true,"description":"必中；全屬性+1，自身處於能力提升狀態時強化效果翻倍；消除對手回合類效果；4回合內每回合恢復自身最大體力1/3並附加等量固定傷害；下2回合自身攻擊技能必定令對手麻痺；下2回合所有技能先制+2","priority":0,"effectType":"none","effectDetail":""},
      {"name":"翎羽風暴","type":"無屬性","category":"屬性","power":0,"pp":5,"isSureHit":true,"description":"必中；4回合內免疫並反彈所有非附屬類異常狀態；消除對手回合類效果，消除成功則對手2回合內屬性技能無效；免疫下1次受到的攻擊；100%令對手害怕","priority":0,"effectType":"none","effectDetail":""},
      {"name":"千翎破陣","type":"飛行","category":"特殊","power":130,"pp":10,"priority":1,"isSureHit":true,"description":"先制+1；必中；消除對手回合類效果，消除成功則對手2回合內攻擊技能無效；對手處於異常狀態時本技能威力提升100%","effectType":"none","effectDetail":""},
      {"name":"翎萬羽歸宗","type":"飛行","category":"特殊","power":160,"pp":5,"priority":1,"isSureHit":true,"isFifthSkill":true,"description":"必中；先制+1；消除對手回合類效果，消除成功則令對手疲憊；對手處於異常狀態時造成傷害提升100%並恢復等量體力；對手不處於異常狀態時附加對手最大體力1/3百分比傷害","effectType":"none","effectDetail":""}
    ]
  },
  {
    id: "5005",
    name: "布萊克",
    type: "暗影",
    level: 100,
    height: 125,
    weight: 46,
    gender: "雄性",
    baseStats: { hp: 128, atk: 123, def: 96, spatk: 82, spdef: 98, speed: 122 },
    soulMark: {
      name: "魔",
      badgeChar: "魔",
      description: "造成的攻擊傷害提升 50%；100%閃避對手所有技能(對必中技能失效)；本場戰鬥僅限一次，死亡時保留1點體力並消除對手回合類效果，同時100%令對手害怕。",
      effectType: "custom",
      effectValue: 0
    },
    skills: [
      createRefSkill("warrior_black", "雙重暗影", "暗影", "物理", 150, 5, 0, { fallbackDesc: "令對手防禦 -1，並 100% 令對手進入害怕狀態" }),
      createRefSkill("warrior_black", "夜魔之球", "暗影", "特殊", 85, 15, 1, { fallbackDesc: "先制+1；附加對手當前體力 15% 的百分比傷害" }),
      createRefSkill("warrior_black", "幽冥頓悟", "無屬性", "屬性", 0, 10, 0, { fallbackDesc: "必中；自身全屬性+1，並恢復自身 1/3 最大體力" }),
      createRefSkill("warrior_black", "狂夜屠戮", "普通", "物理", 130, 10, 0, { fallbackDesc: "造成大量物理攻擊傷害" }),
      createRefSkill("warrior_black", "夜魔神襲", "暗影", "特殊", 160, 5, 0, { fallbackDesc: "必中；解除自身能力下降狀態；造成傷害的 50% 恢復自身體力", isFifthSkill: true })
    ]
  },
  {
    id: "300",
    name: "譜尼",
    type: "聖靈",
    level: 100,
    height: 360,
    weight: 0,
    gender: "無性別",
    baseStats: { hp: 150, atk: 115, def: 110, spatk: 150, spdef: 110, speed: 115 },
    soulMark: {
      name: "聖",
      badgeChar: "聖",
      description: ELF_TEXT["300"].soulMark!,
      effectType: "status_immune",
      effectValue: 25
    },
    skills: [
      createRefSkill('puni_base', '聖靈魔閃光', '聖靈', '特殊', 160, 5, 0),
      createRefSkill('puni_base', '千烈虛光閃', '聖靈', '特殊', 140, 10, 0),
      createRefSkill('puni_base', '旋滅裂空陣', '聖靈', '物理', 135, 10, 0),
      createRefSkill('puni_base', '聖堂之門', '聖靈', '特殊', 100, 15, 0),
      createRefSkill('puni_base', '聖影流光破', '聖靈', '特殊', 160, 5, 0, { isSureHit: true, isFifthSkill: true })
    ],
    skillPool: [
      createRefSkill('puni_base', '極光', '普通', '物理', 60, 40),
      createRefSkill('puni_base', '虛無', "無屬性", '屬性', 0, 1),
      createRefSkill('puni_base', '神聖之光', '聖靈', '特殊', 70, 40),
      createRefSkill('puni_base', '元素', '聖靈', '特殊', 5, 5),
      createRefSkill('puni_base', '能量', '聖靈', '物理', 0, 5),
      createRefSkill('puni_base', '靈光之怒', '聖靈', '特殊', 80, 30),
      createRefSkill('puni_base', '生命', "無屬性", '屬性', 0, 5),
      createRefSkill('puni_base', '斷空破', '普通', '物理', 100, 20),
      createRefSkill('puni_base', '輪迴', "無屬性", '屬性', 0, 1),
      createRefSkill('puni_base', '靈魂干涉', "無屬性", '屬性', 0, 20),
      createRefSkill('puni_base', '永恆', "無屬性", '屬性', 0, 5),
      createRefSkill('puni_base', '聖潔', "無屬性", '屬性', 0, 5),
      createRefSkill('puni_base', '聖光氣', "無屬性", '屬性', 0, 10),
      createRefSkill('puni_base', '璨靈聖光', "無屬性", '屬性', 0, 5, 0, { isSureHit: true }),
      createRefSkill('puni_base', '落芳天華', '聖靈', '特殊', 80, 5, 3),
      createRefSkill('puni_base', '聖靈悲魂曲', '聖靈', '特殊', 150, 5, 1),
      createRefSkill('puni_base', '聖影流光破', '聖靈', '特殊', 160, 5, 0, { isSureHit: true })
    ],
    kit: [
      // ── 魂印「聖」(carried 永久) ──
      { codeId: "puni_base_m1", params: {}, node: "passive_always", source: "soulmark", order: 1 },
      { codeId: "puni_base_m2", params: {}, node: "round_end", source: "soulmark", order: 2 },
      { codeId: "puni_base_m3", params: {}, node: "round_end", source: "soulmark", order: 3 },

      // ── 主技：聖靈魔閃光 ──
      { codeId: "puni_base_mo", params: {}, node: "after_action", source: "skill", order: 1 },

      // ── 主技：千烈虛光閃 ──
      { codeId: "puni_base_qianlie", params: {}, node: "before_skill", source: "skill", order: 1 },

      // ── 主技：旋滅裂空陣 ──
      { codeId: "puni_base_xuanmie", params: {}, node: "after_action", source: "skill", order: 1 },

      // ── 主技：聖堂之門 ──
      { codeId: "puni_base_shengtang", params: {}, node: "before_skill", source: "skill", order: 1 },

      // ── 主技：聖影流光破 ──
      { codeId: "puni_base_shengying_b", params: {}, node: "before_skill", source: "skill", order: 1 },
      { codeId: "puni_base_shengying_c", params: {}, node: "after_action", source: "skill", order: 2 },
      { codeId: "puni_base_shengying_d", params: {}, node: "after_action", source: "skill", order: 3 },
      { codeId: "puni_base_shengying_e", params: {}, node: "after_action", source: "skill", order: 4 },

      // ── 備選技能 ──
      { codeId: "puni_base_xuwu", params: {}, node: "after_action", source: "skill", order: 5 },
      { codeId: "puni_base_yuansu", params: {}, node: "after_action", source: "skill", order: 6 },
      { codeId: "puni_base_nengliang", params: {}, node: "after_action", source: "skill", order: 7 },
      { codeId: "puni_base_lingguang", params: {}, node: "before_damage", source: "skill", order: 8 },
      { codeId: "puni_base_shengming", params: {}, node: "after_action", source: "skill", order: 9 },
      { codeId: "puni_base_duankong", params: {}, node: "after_action", source: "skill", order: 10 },
      { codeId: "puni_base_lunhui", params: {}, node: "after_action", source: "skill", order: 11 },
      { codeId: "puni_base_linghun", params: {}, node: "after_action", source: "skill", order: 12 },
      { codeId: "puni_base_yongheng", params: {}, node: "after_action", source: "skill", order: 13 },
      { codeId: "puni_base_shengjie", params: {}, node: "after_action", source: "skill", order: 14 },
      { codeId: "puni_base_shengguangqi", params: {}, node: "after_action", source: "skill", order: 15 },
      { codeId: "puni_base_canling_1", params: {}, node: "after_action", source: "skill", order: 16 },
      { codeId: "puni_base_canling_2", params: {}, node: "after_action", source: "skill", order: 17 },
      { codeId: "puni_base_canling_3", params: {}, node: "before_skill", source: "skill", order: 18 },
      { codeId: "puni_base_canling_4", params: {}, node: "after_action", source: "skill", order: 19 },
      { codeId: "puni_base_canling_5", params: {}, node: "after_action", source: "skill", order: 20 },
      { codeId: "puni_base_luofang_1", params: {}, node: "before_skill", source: "skill", order: 21 },
      { codeId: "puni_base_luofang_2", params: {}, node: "after_action", source: "skill", order: 22 },
      { codeId: "puni_base_luofang_3", params: {}, node: "before_damage", source: "skill", order: 23 },
      { codeId: "puni_base_beihun_1", params: {}, node: "after_action", source: "skill", order: 24 },
      { codeId: "puni_base_beihun_2", params: {}, node: "after_action", source: "skill", order: 25 }
    ]
  },
  {
    id: "5006",
    name: "星光·魔焰猩猩",
    type: "火",
    level: 100,
    height: 128,
    weight: 50,
    gender: "雄性",
    baseStats: { hp: 162, atk: 147, def: 114, spatk: 70, spdef: 114, speed: 138 },
    soulMark: {
      name: "灼",
      badgeChar: "灼",
      description: "每次登場時，為對手附加3回合的星火之灼；自身每次使用攻擊後附加3回合的星火之灼；自身使用物理/特殊攻擊技能時則計算傷害時令攻擊、特攻等於原本二者總和；自身使用物理攻擊後恢復自身最大體力的1/3並造成等量百分比傷害，自身使用特殊攻擊後附加自身最大體力1/3 of the百分比傷害並於附加後恢復自身等同於附加成功量的體力，每次觸發時恢復自身所有技能1點PP值；星火之灼：持有者體力恢復效果減少100%，每次受到攻擊傷害後擁有者額外受到傷害值100%的百分比傷害並恢復對方在場精靈等量體力與1點所有技能PP值，若對手為水系則星火之灼消失並額外附加傷害值100%的真實傷害並恢復對方在場精靈等量體力與所有技能全部PP值，持續3回合重複獲取時重置為3回合。",
      effectType: "custom",
      effectValue: 100
    },
    description: "星光匯聚的烈焰雄獅，掌握無盡怒火與熾熱爆發的秘律，擁有專屬印記【星火之灼】與獨特強大的火焰之力。",
    skills: [
      createRefSkill('starlight_monkey', '星光·音速火拳', '火', '物理', 90, 20, 3, { accuracy: 97 }),
      createRefSkill('starlight_monkey', '星光·冥想', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 95 }),
      createRefSkill('starlight_monkey', '星光·不滅之火', '火', '特殊', 160, 5, 0, { isSureHit: true, accuracy: 95 }),
      createRefSkill('starlight_monkey', '星光·覺醒', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 95 }),
      createRefSkill('starlight_monkey', '星光·魔焰裂空', '火', '物理', 160, 5, 0, { isSureHit: true, isFifthSkill: true, accuracy: 95 })
    ],
    skillPool: [
      createRefSkill('starlight_monkey', '衝頂', '普通', '物理', 40, 35, 0, { accuracy: 100 }),
      createRefSkill('starlight_monkey', '縮頭', "無屬性", '屬性', 0, 40, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('starlight_monkey', '灰燼', '火', '特殊', 40, 30, 0, { accuracy: 100 }),
      createRefSkill('starlight_monkey', '熱量集合', "無屬性", '屬性', 0, 20, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('starlight_monkey', '火焰車', '火', '物理', 95, 25, 0, { accuracy: 100 }),
      createRefSkill('starlight_monkey', '星光·火花', '火', '特殊', 120, 10, 0, { accuracy: 95 }),
      createRefSkill('starlight_monkey', '星光·壓迫', "無屬性", '屬性', 0, 10, 0, { accuracy: 95 }),
      createRefSkill('starlight_monkey', '星光·靈絕擊', '火', '物理', 130, 10, 0, { accuracy: 95 }),
      createRefSkill('starlight_monkey', '星光·冥想', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 95 }),
      createRefSkill('starlight_monkey', '星光·不滅之火', '火', '特殊', 160, 5, 0, { isSureHit: true, accuracy: 95 }),
      createRefSkill('starlight_monkey', '星光·覺醒', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 95 }),
      createRefSkill('starlight_monkey', '星光·絕命火焰', '火', '特殊', 150, 5, 0, { isSureHit: true, accuracy: 97 }),
      createRefSkill('starlight_monkey', '星光·魔焰裂空', '火', '物理', 160, 5, 0, { isSureHit: true, isFifthSkill: true, accuracy: 95 })
    ]
  },
  {
    id: "5007",
    name: "混濁海妖.布林克克",
    type: "混沌.水",
    level: 100,
    height: 159,
    weight: 980,
    gender: "雌性",
    baseStats: { hp: 183, atk: 140, def: 110, spatk: 70, spdef: 110, speed: 132 },
    soulMark: {
      name: "濁",
      badgeChar: "濁",
      description: "戰鬥開始時，克塔亞特作為額外精靈加入敵方；自身在場期間，對手每次受到真實傷害時直接增加自身等量體力並令自身本場戰鬥造成非真實傷害提升4%(最多疊加32次)；自身位於場下期間，對手每次受到真實傷害時消耗自身當前體力⅛以令自身本場戰鬥受到非真實傷害降低4%(最多疊加16次，執行時若判斷體力可降為0時不執行)；回合開始時，若場上存在本次在場期間不大於2回合或在場超過8回合以上的精靈，則自身體力上限提升20%並恢復自身全部體力與pp值；克塔亞特:水系額外精靈，加入時複製己方所有精靈能力值的總和一半作為自身能力值；己方精靈每次出戰時令其漸凍1回合，未觸發則3回合內造成非真實傷害減半n次(n=本次在場期間所受到真實傷害次數)；己方精靈任意戰鬥階段節點結算時自身額外汲取己方在場精靈當前體力¼；本場戰鬥結束時，令己方所有已死亡精靈與隨機1隻背包內存活精靈消逝，自身不計入勝負計算時的精靈數判定；自身死亡時消逝，並令己方所有精靈失去自身當前體力上限⅛的體力上限",
      effectType: "none",
      effectValue: 0
    },
    skills: [
      {
        name: "溺咒之握",
        type: "水",
        category: "物理",
        power: 100,
        pp: 15,
        description: "先制:+3；吸取並反轉對手能力提升狀態；技能威力額外提升對手最大體力*1/3+個體值；將對手所處的凍傷狀態轉化為冰封，轉化成功則附加等同於對手最大體力⅛的真實傷害；",
        priority: 3,
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "癡愚之觸",
        type: "混沌",
        category: "物理",
        power: 100,
        pp: 15,
        description: "先制:+3；消除對手回合類效果，消除成功則附加等同於對手最大體力20%的真實傷害；命中後100%令對方中毒，未觸發則100%令對手感染；3回合內，若對手使用技能時不處於控制類異常狀態，則無效對手下次攻擊，觸發無效成功則額外無效對手下次攻擊；",
        priority: 3,
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "深海働哭",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        isSureHit: true,
        description: "必中；自身攻擊、雙防、速度、命中+2；汲取對手當前體力¼；5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，吸取後對手體力未減少則額外附加對手300點真實傷害；命中時令對手100%漸凍1回合，未觸發或對手已處於漸凍則回合結束時消除對手回合類效果並令對手100%冰封，同時解除自身非所有非附屬類異常狀態；",
        priority: 0,
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "不淨者之約",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 4,
        isSureHit: true,
        description: "必中；攜帶此技能則自身死亡時，消耗對方額外精靈克塔亞特最大體力40%以令自身重生並解除所處異常狀態，若對手額外精靈克塔亞特體力不足則改為令其死亡以令自身重生；5回合內自身免疫並反彈所有非附屬類異常狀態；對手為自身天敵時額外先制+3；令對手全屬性-1、凍傷，任一項未觸發或均觸發則100%令對手冰封；令自身100%狂暴；下2回合對手所有技能先制-2，若對手當前速度高於自身則改為先制-3；",
        priority: 0,
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "深潛者盛宴",
        type: "水.混沌",
        category: "物理",
        power: 160,
        pp: 5,
        description: "■ 必中\n■ 自身處於能力下降狀態時先制+3且使用技能不受PP值限制、將自身任意能力下降狀態視為至少2倍同等級的全屬性能力提升\n■ 造成傷害時取水系、混沌系、水.混沌、普通系中克制倍數最高者，未擊敗對手則延續至自身下2次自身造成技能傷害\n🎯 自身下2次技能無效時令本次技能額外造成對手當前體力¼的水系技能傷害且令對手100%漸凍1回合\n🎯 吸取對手300點體力，雙方每處於1種能力等級提升/下降狀態則額外吸取前額外吸取對手40點（每次視為獨立吸取1次），吸取後任意1次對手體力未因此減少則額外汲取對手當前體力¼\n🎯 3回合內自身造成技能傷害提升50%，雙方任一方處於異常狀態則效果翻倍",
        priority: 0,
        effectType: "none",
        effectDetail: ""
      }
    ]
  },
  {
    id: "5008",
    name: "鎮魂.巴弗洛",
    type: "飛行.超能",
    level: 100,
    height: 110,
    weight: 36,
    gender: "雌性",
    baseStats: { hp: 162, atk: 143, def: 110, spatk: 70, spdef: 110, speed: 150 },
    soulMark: {
      name: "鎮",
      description: "若自身存活於出戰背包內或在場則演奏鎮魂歌：每回合開始時為敵方在場精靈附加1道魂殤。魂殤：持有者回合結束時，每有1道令自身體力調整減少最大體力25%；上限4道，下場後消失。雙方任一方受到混亂異常、窒息異常時：直到上述異常結束前自身抵擋受到的技能傷害且自身受到異常時立即轉化為混亂。登場時：為對手附加3回合窒息，為自身附加3回合混亂；任一項未觸發則對手3回合內造成固定傷害、百分比傷害減少40%。使用攻擊技能時：若自身處於異常狀態，附加對手等同於自身通過專屬特性抵擋的傷害100%的真實傷害；若自身不處於異常狀態，自身下回合所有技能先制+1。",
      effectType: "none",
      effectValue: 0,
      badgeChar: "鎮"
    },
    skills: [
      {
        name: "贖魂讚詩",
        type: "飛行.超能",
        category: "物理",
        power: 90,
        pp: 20,
        priority: 3,
        effectType: "none",
        effectDetail: "",
        description: "自身處於異常狀態時先制+1且必定命中；消除對手回合類效果，消除成功則對手流血；將對手所處的異常狀態轉化為害怕；4回合內若對手使用攻擊技能則進入窒息狀態"
      },
      {
        name: "亂魂舞",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 1,
        effectType: "none",
        effectDetail: "",
        description: "令自身進入混亂，自身處於混亂則攻擊、速度、命中+2；令對手100%窒息，未觸發則自身雙防+1；4回合內自身使用技能恢復最大體力½並造成等量百分比傷害；下2回合自身攻擊技能造成傷害提升100%；下2回合自身所有技能先制+2"
      },
      {
        name: "鎖魂曲",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 1,
        effectType: "none",
        effectDetail: "",
        description: "對手存在護盾、護罩時先制+2；消除雙方回合類效果、能力上升、下降狀態、護盾與護罩並附加對手等同於自身速度值50%的百分比傷害；4回合內自身免疫所有控制類異常狀態；3回合內對手PP值消耗量提升20倍且戰鬥階段結束時受到已損失PP值*10點固定傷害；先出手則自身下次死亡時100%重生"
      },
      {
        name: "引魂咏",
        type: "飛行.超能",
        category: "物理",
        power: 120,
        pp: 10,
        priority: 2,
        effectType: "absorb",
        effectDetail: "heal:25%",
        description: "自身處於異常狀態時先制+1且必定命中；若對手不處於異常狀態時造成傷害提升100%；吸取對手最大體力25%，每次使用提升10%，最高50%；技能無效時，消除對手回合類效果，100%令對手流血、窒息"
      },
      {
        name: "訣別",
        type: "飛行.超能",
        category: "物理",
        power: 160,
        pp: 5,
        priority: 0,
        effectType: "none",
        effectDetail: "",
        description: "雙倍吸取對手能力提升狀態，吸取成功則對手下2回合正先制效果失效；附加給對手等同於自身能力提升狀態的能力下降狀態，若該效果未滿足條件或未觸發則令對手隨機2項技能PP值歸零；技能威力提升35%，對手任意1項技能PP值小於2點則提升效果加倍；敵我雙方同時進入混亂、流血狀態，觸發成功則雙方每有1回合異常狀態則吸取對手150點固定體力"
      }
    ]
  },
  {
    id: "5009",
    name: "誑獅魔軀.魔獅迪露",
    type: "普通",
    level: 100,
    height: 187.3,
    weight: 33.9,
    gender: "雌性",
    baseStats: { hp: 140, atk: 160, def: 80, spatk: 160, spdef: 80, speed: 130 },
    soulMark: {
      name: "獅",
      description: "戰鬥開始時令自身體力值與其上限調整為3000000，為自身附加5道魔軀枷鎖；回合開始時：若自身體力不低於對手，自身附加給對手自身所處的異常狀態並解除自身所有異常狀態，2回合內自身免疫所有異常狀態，造成非真實傷害提升50%；若自身體力低於¼時，直到下場前每回合開始時自身受到最大體力75%的真實傷害；常駐效果：自身在場期間該專屬特性下場後保留且效果不因死亡後失效；自身體力上限始終無法被以任意形式變化(包含消逝)；自身受到技能傷害且自身體力不為0時，恢復自身雙防值50%的體力並吸取對手所有技能1點pp值；自身受到固定傷害且自身體力不為0時，吸取對手自身雙防值50%的體力；自身受到百分比傷害且自身體力不為0時，吸取對手等同於自身最大體力0.0187%的體力值；自身受到真實傷害時，1回合內若死亡時強制存活保留1點體力並解除自身異常狀態。自身使用技能時：若回合開始時自身體力低於¼，自身使用技能時1回合內對手受到傷害不小於對手體力上限，1回合內對手無法恢復體力且受到等同於最大體力的真實傷害，若對手擁有魔軀枷鎖則額外消耗對手所有體力。\n\n魔軀枷鎖：持有者每有1道則受到攻擊傷害與重量提升200%，每次受到真實傷害時轉移1道魔軀枷鎖給對手，最多5道(下場後保留)。",
      effectType: "none",
      effectValue: 0,
      badgeChar: "獅"
    },
    skills: [
      {
        name: "狻猊噬",
        type: "普通",
        category: "物理",
        power: 90,
        pp: 15,
        priority: 3,
        isSureHit: true,
        effectType: "none",
        effectDetail: "",
        description: "消除對手回合類效果，消除成功則恢復對手全部體力；對手體力每有1%，則自身攻擊技能威力提升2%；自身體力未滿則吸取對手最大體力⅓；自身體力未滿則令對手感染"
      },
      {
        name: "負岳勢",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        effectType: "none",
        effectDetail: "",
        description: "自身處於能力下降狀態時先制+3；將能力下降狀態附加給對手，附加成功則對手下次使用的技能無效；令自身全屬性+1，自身體力每高於對手1000000點效果額外全屬性+1；下2回合自身攻擊技能造成傷害提升100%；下2回合自身所有技能先制+2"
      },
      {
        name: "目瘴淵禁",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 1,
        isSureHit: true,
        effectType: "none",
        effectDetail: "",
        description: "4回合內自身免疫並反彈所有異常狀態；100%令對手中毒，未觸發或對手處於中毒則2回合內對手攻擊技能無效；將對手所處的中毒狀態轉化為感染；下3回合自身使用技能吸取對手最大體力⅓，吸取後對手體力未減少則附加雙方300點真實傷害且100%令對手冰封"
      },
      {
        name: "劫盡歸塵",
        type: "普通",
        category: "特殊",
        power: 150,
        pp: 10,
        priority: 2,
        isSureHit: true,
        effectType: "none",
        effectDetail: "",
        description: "消除雙方回合類效果並為雙方附加中毒、凍傷、燒傷，上述任意異常結束或解除時自身恢復全部體力；令己方免疫下2次異常狀態，免疫成功則在場精靈恢復自身最大體力⅓並造成等量百分比傷害；令對手隨機3個不為0的技能PP值歸0；技能無效時，消除對手回合類效果，100%令對手感染"
      },
      {
        name: "辟冥·鎮獄斷",
        type: "普通",
        category: "物理",
        power: 187,
        pp: 5,
        priority: 0,
        isSureHit: true,
        effectType: "none",
        effectDetail: "",
        description: "無視對手正先制效果；計算攻擊傷害時雙攻值視為二者之和且技能威力提升其總和的18.7%，特攻不小於攻擊時先制額外+1且無視對手傷害限制效果，攻擊不少於特攻則無視對手免疫效果並吸取對手等同於自身體力0.0187%的體力，對手體力減少量低於180時則附加雙方187點真實傷害；消除對手能力提升狀態，消除成功則對手100%感染、冰封、焚燼；未擊敗對手則自身下次使用技能額外先制+2"
      }
    ]
  },
  {
    id: "5000",
    name: "聖靈譜尼",
    type: "神靈",
    level: 100,
    height: 500,
    weight: 0,
    gender: "無性別",
    baseStats: { hp: 180, atk: 110, def: 120, spatk: 150, spdef: 120, speed: 140 },
    soulMark: {
      name: "神",
      badgeChar: "神",
      description: ELF_TEXT["5000"].soulMark!,
      effectType: "custom",
      effectValue: 25
    },
    skills: [
      createRefSkill('puni', '神靈之觸', '神靈', '特殊', 90, 10, 3),
      createRefSkill('puni', '聖光吟誦', "無屬性", '屬性', 0, 5, 0, { isSureHit: true }),
      createRefSkill('puni', '神聖復甦', '神靈', '物理', 0, 1, 2),
      createRefSkill('puni', '光榮之夢', "無屬性", '屬性', 0, 5, 0, { isSureHit: true }),
      createRefSkill('puni', '神靈救世光', '神靈', '特殊', 160, 5, 0, { isSureHit: true, isFifthSkill: true })
    ],
    skillPool: [
      createRefSkill('puni_base', '聖靈魔閃光', '聖靈', '特殊', 160, 5, 0),
      createRefSkill('puni_base', '千烈虛光閃', '聖靈', '特殊', 140, 5, 0),
      createRefSkill('puni_base', '旋滅裂空陣', '聖靈', '物理', 135, 5, 0),
      createRefSkill('puni_base', '聖堂之門', '聖靈', '特殊', 100, 15, 0),
      createRefSkill('puni_base', '聖影流光破', '聖靈', '特殊', 160, 5, 0, { isSureHit: true }),
      createRefSkill('puni', '極光', '普通', '物理', 60, 40),
      createRefSkill('puni', '虛無', "無屬性", '屬性', 0, 1),
      createRefSkill('puni', '神聖之光', '聖靈', '特殊', 70, 40),
      createRefSkill('puni', '元素', '聖靈', '特殊', 5, 5),
      createRefSkill('puni', '能量', '聖靈', '物理', 0, 5),
      createRefSkill('puni', '靈光之怒', '聖靈', '特殊', 80, 30),
      createRefSkill('puni', '生命', "無屬性", '屬性', 0, 5),
      createRefSkill('puni', '斷空破', '普通', '物理', 100, 20),
      createRefSkill('puni', '輪迴', "無屬性", '屬性', 0, 1),
      createRefSkill('puni', '靈魂干涉', "無屬性", '屬性', 0, 10),
      createRefSkill('puni', '聖潔', "無屬性", '屬性', 0, 5),
      createRefSkill('puni', '永恆', "無屬性", '屬性', 0, 5),
      createRefSkill('puni', '神聖啟示歌', '神靈', '特殊', 150, 5, 0),
      createRefSkill('puni_base', '璨靈聖光', "無屬性", '屬性', 0, 5, 0, { isSureHit: true }),
      createRefSkill('puni_base', '落芳天華', '聖靈', '特殊', 80, 5, 3),
      createRefSkill('puni_base', '聖靈悲魂曲', '聖靈', '特殊', 150, 5, 1),
      createRefSkill('puni_base', '聖光氣', "無屬性", '屬性', 0, 10)
    ],
    kit: [
      // ── 從 puni_base 繼承的主技與備選技能 ──
      { codeId: "puni_base_mo", params: {}, node: "after_action", source: "skill", order: 101 },
      { codeId: "puni_base_qianlie", params: {}, node: "before_skill", source: "skill", order: 102 },
      { codeId: "puni_base_xuanmie", params: {}, node: "after_action", source: "skill", order: 103 },
      { codeId: "puni_base_shengtang", params: {}, node: "before_skill", source: "skill", order: 104 },
      { codeId: "puni_base_shengying_b", params: {}, node: "before_skill", source: "skill", order: 105 },
      { codeId: "puni_base_shengying_c", params: {}, node: "after_action", source: "skill", order: 106 },
      { codeId: "puni_base_shengying_d", params: {}, node: "after_action", source: "skill", order: 107 },
      { codeId: "puni_base_shengying_e", params: {}, node: "after_action", source: "skill", order: 108 },
      { codeId: "puni_base_xuwu", params: {}, node: "after_action", source: "skill", order: 109 },
      { codeId: "puni_base_yuansu", params: {}, node: "after_action", source: "skill", order: 110 },
      { codeId: "puni_base_nengliang", params: {}, node: "after_action", source: "skill", order: 111 },
      { codeId: "puni_base_lingguang", params: {}, node: "before_damage", source: "skill", order: 112 },
      { codeId: "puni_base_shengming", params: {}, node: "after_action", source: "skill", order: 113 },
      { codeId: "puni_base_duankong", params: {}, node: "after_action", source: "skill", order: 114 },
      { codeId: "puni_base_lunhui", params: {}, node: "after_action", source: "skill", order: 115 },
      { codeId: "puni_base_linghun", params: {}, node: "after_action", source: "skill", order: 116 },
      { codeId: "puni_base_yongheng", params: {}, node: "after_action", source: "skill", order: 117 },
      { codeId: "puni_base_shengjie", params: {}, node: "after_action", source: "skill", order: 118 },
      { codeId: "puni_base_shengguangqi", params: {}, node: "after_action", source: "skill", order: 119 },

      // ── 魂印「神」(carried 永久) ──
      { codeId: "puni_holy_void", params: {}, node: "on_damaged", source: "soulmark", order: 1 },
      { codeId: "puni_holy_element_a", params: {}, node: "on_entered", source: "soulmark", order: 2 },
      { codeId: "puni_holy_element_b", params: {}, node: "on_entered", source: "soulmark", order: 3 },
      { codeId: "puni_holy_energy", params: {}, node: "battle_phase_end", source: "soulmark", order: 4 },
      { codeId: "puni_holy_life_a", params: {}, node: "battle_phase_end", source: "soulmark", order: 5 },
      { codeId: "puni_holy_life_b", params: {}, node: "battle_phase_end", source: "soulmark", order: 6 },
      { codeId: "puni_holy_reincarn_a", params: {}, node: "self_fatal", source: "soulmark", order: 7 },
      { codeId: "puni_holy_reincarn_b", params: {}, node: "round_end", source: "soulmark", order: 8 },
      { codeId: "puni_holy_eternal", params: {}, node: "round_start", source: "soulmark", order: 9 },
      { codeId: "puni_holy_sacred_a", params: {}, node: "passive_always", source: "soulmark", order: 10 },
      { codeId: "puni_holy_sacred_b", params: {}, node: "passive_always", source: "soulmark", order: 11 },

      // ── 主技：神靈之觸 ──
      { codeId: "puni_holy_touch_1", params: {}, node: "before_skill", source: "skill", order: 12 },
      { codeId: "puni_holy_touch_2", params: {}, node: "after_action", source: "skill", order: 13 },
      { codeId: "puni_holy_touch_3", params: {}, node: "after_action", source: "skill", order: 14 },

      // ── 主技：聖光吟誦 ──
      { codeId: "custom", customText: "命中後100%令對手疲憊3回合", params: {}, node: "on_hit", source: "skill", order: 15 },
      { codeId: "custom", customText: "未觸發則對手2回合內屬性技能無效", params: {}, node: "on_hit", source: "skill", order: 16 },
      { codeId: "custom", customText: "4回合內，受到對手攻擊時附加對方等同於對方最大體力1/3的百分比傷害", params: {}, node: "on_damaged", source: "skill", order: 17 },
      { codeId: "custom", customText: "下兩回合對手受到攻擊傷害提升150%", params: {}, node: "after_action", source: "skill", order: 18 },

      // ── 主技：神聖復甦 ──
      { codeId: "puni_holy_revive_1", params: {}, node: "after_action", source: "skill", order: 19 },
      { codeId: "puni_holy_revive_2", params: {}, node: "before_skill", source: "skill", order: 20 },
      { codeId: "puni_holy_revive_3", params: {}, node: "before_skill", source: "skill", order: 21 },
      { codeId: "puni_holy_revive_4", params: {}, node: "after_action", source: "skill", order: 22 },
      { codeId: "puni_holy_revive_5", params: {}, node: "after_action", source: "skill", order: 23 },

      // ── 主技：光榮之夢 ──
      { codeId: "custom", customText: "全屬性+1，對手不為混沌系時效果翻倍", params: {}, node: "after_action", source: "skill", order: 24 },
      { codeId: "custom", customText: "3回合內每回合吸取對手能力強化狀態", params: {}, node: "round_end", source: "skill", order: 25 },
      { codeId: "custom", customText: "恢復自身最大體力1/1並附加對手等同於恢復量的百分比傷害", params: {}, node: "after_action", source: "skill", order: 26 },
      { codeId: "custom", customText: "下2回合自身所有技能先制+2", params: {}, node: "round_start", source: "skill", order: 28 },

      // ── 主技：神靈救世光 ──
      { codeId: "custom", customText: "消除對手回合類效果", params: {}, node: "before_skill", source: "skill", order: 29 },
      { codeId: "custom", customText: "消除成功則對手3回合內無法通過自身技能恢復體力", params: {}, node: "after_action", source: "skill", order: 30 },
      { codeId: "custom", customText: "當回合未擊敗對手則自身下次攻擊附加對手等同於自身最大體力1/3的百分比傷害", params: {}, node: "after_action", source: "skill", order: 31 },
      { codeId: "custom", customText: "吸取對手200體力，自身體力低於1/2時吸取效果翻倍", params: {}, node: "after_action", source: "skill", order: 32 }
    ]
  },
  {
    id: "5010",
    name: "星光·魯斯王",
    type: "水",
    level: 100,
    height: 110,
    weight: 47.5,
    gender: "雄性",
    baseStats: { hp: 170, atk: 142, def: 114, spatk: 70, spdef: 114, speed: 135 },
    soulMark: {
      name: "海",
      description: "每次登場時，為對手附加 3 回合的星海之浸；自身每次使用攻擊後附加 3 回合的星海之浸。自身所有技能必定打出致命一擊。每場戰鬥限 1 次，自身受到致死傷害時，若自身的等級為 100 則消除對手能力提升狀態、回合類效果並恢復全部體力值、PP 值，然後獲得等同於自身體力值的護盾、護罩。\n星海之浸:持有者所使用的屬性技能無效，每次受到攻擊傷害後擁有者額外受到傷害值100%的百分比傷害並恢復對方在場精靈等量體力與1點所有技能PP值，若對手為草系則星海之浸消失並額外附加傷害值100%的真實傷害並恢復對方在場精靈等量體力與所有技能全部PP值，持續3回合重複獲取時重置為3回合。",
      badgeChar: "海",
      effectType: "custom",
      effectValue: 100
    },
    description: "星光映照下的汪洋王者，擁有絕佳的水系統領之力與專屬印記【星海之浸】，具備獨一無二的第五技能專屬替換庫。",
    skills: [
      {
        name: "星光·閃擊",
        type: "水",
        category: "物理",
        power: 85,
        pp: 20,
        priority: 3,
        description: "先制+3；消除對手能力提升狀態，消除成功則 2 回合內對手造成的攻擊傷害不超過 200 點，若對手不處於能力提升狀態則 2 回合內對手所有體力恢復效果減少 50%；2 回合內免疫所有受到的異常狀態；2 回合內免疫能力下降狀態",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "星光·隨風逐浪",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；全屬性+1，自身當前體力高於最大體力的 1/2 時強化效果翻倍；下 2 回合自身造成的攻擊傷害翻倍；下 2 回合攻擊忽略對手 25% 的雙防值；下 2 回合若自身選擇使用技能則無視對手能力提升狀態",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "克制",
        type: "普通",
        category: "物理",
        power: 0,
        pp: 5,
        priority: -6,
        description: "先制-6；將所受的傷害 2 倍反饋給對手",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "星光·排山倒海",
        type: "水",
        category: "物理",
        power: 150,
        pp: 5,
        priority: 0,
        description: "無視對手攻擊免疫效果；無視對手護盾效果；命中後 50% 使對手冰封，未觸發則對手下 2 回合先制-2；給對手造成傷害時，傷害數值的 50% 恢復自身體力",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "星光·浪打千擊",
        type: "水",
        category: "物理",
        power: 160,
        pp: 5,
        priority: 0,
        isSureHit: true,
        isFifthSkill: true,
        description: "必中；1 回合做 5~10 次攻擊，每次攻擊都有 20% 的幾率令自身攻擊+1，速度+1，命中+1；消除對手回合類效果，消除成功則對手 2 回合內攻擊技能 MISS；對手處於星火之灼時造成的攻擊傷害提升 75%，若自身體力低於對手則效果翻倍；附加自身最大體力 20% 的百分比傷害，每次使用增加 10%，最高 40%",
        effectType: "none",
        effectDetail: ""
      }
    ],
    skillPool: [
      { name: "閃擊", type: "普通", category: "物理", power: 45, pp: 35, priority: 1, description: "先制+1", effectType: "none", effectDetail: "" },
      { name: "玩水", type: "無屬性", category: "屬性", power: 0, pp: 15, priority: 0, description: "（無特殊效果）", effectType: "none", effectDetail: "" },
      { name: "克制", type: "普通", category: "物理", power: 0, pp: 5, priority: -6, description: "先制-6；將所受的傷害 2 倍反饋給對手", effectType: "none", effectDetail: "" },
      { name: "水流噴射", type: "水", category: "特殊", power: 40, pp: 20, priority: 1, description: "先制+1", effectType: "none", effectDetail: "" },
      { name: "虛張聲勢", type: "無屬性", category: "屬性", power: 0, pp: 15, priority: 0, isSureHit: true, description: "必中；技能使用成功時，100% 改變自身防禦等級+2", effectType: "none", effectDetail: "" },
      { name: "星光·閃擊", type: "水", category: "物理", power: 85, pp: 20, priority: 3, description: "先制+3；消除對手能力提升狀態，消除成功則 2 回合內對手造成的攻擊傷害不超過 200 點，若對手不處於能力提升狀態則 2 回合內對手所有體力恢復效果減少 50%；2 回合內免疫所有受到的異常狀態；2 回合內免疫能力下降狀態", effectType: "none", effectDetail: "" },
      { name: "海嘯旋風", type: "水", category: "特殊", power: 70, pp: 20, priority: 0, description: "命中後 10% 令對方凍傷", effectType: "none", effectDetail: "" },
      { name: "劍舞", type: "無屬性", category: "屬性", power: 0, pp: 15, priority: 0, isSureHit: true, description: "必中；技能使用成功時，100% 改變自身攻擊等級+2", effectType: "none", effectDetail: "" },
      { name: "龍之牙", type: "龍", category: "物理", power: 80, pp: 15, priority: 0, description: "（無特殊效果）", effectType: "none", effectDetail: "" },
      { name: "星光·海嘯旋風", type: "水", category: "物理", power: 130, pp: 10, priority: 0, description: "命中後 100% 令對方凍傷", effectType: "none", effectDetail: "" },
      { name: "星光·劍舞", type: "無屬性", category: "屬性", power: 0, pp: 5, priority: 0, description: "技能使用成功時，100% 改變自身攻擊等級+2；技能使用成功時，100% 改變自身速度等級+2；技能使用成功時，100% 改變自身命中等級+2", effectType: "none", effectDetail: "" },
      { name: "星光·克制", type: "水", category: "物理", power: 140, pp: 5, priority: -6, isSureHit: true, description: "先制-6；必中；反彈 2 倍的傷害給對手並使自身恢復等量體力；造成的傷害低於 200 則自身下 1 次受到的傷害降低 300 點", effectType: "none", effectDetail: "" },
      { name: "星光·水天一色", type: "無屬性", category: "屬性", power: 0, pp: 5, priority: 0, isSureHit: true, description: "必中；4 回合內免疫並反彈所有受到的異常狀態；解除自身能力下降效果，解除成功則下 2 回合先制+2；恢復自身最大體力的 1/1，自身體力低於 1/2 時造成等量固定傷害；3 回合內受到攻擊則對手下回合受到的傷害翻倍", effectType: "none", effectDetail: "" },
      { name: "星光·驚濤駭浪", type: "水", category: "特殊", power: 140, pp: 5, priority: 0, description: "解除自身所處的異常狀態，解除成功令對手冰封", effectType: "none", effectDetail: "" },
      { name: "星光·隨風逐浪", type: "無屬性", category: "屬性", power: 0, pp: 5, priority: 0, isSureHit: true, description: "必中；全屬性+1，自身當前體力高於最大體力的 1/2 時強化效果翻倍；下 2 回合自身造成的攻擊傷害翻倍；下 2 回合攻擊忽略對手 25% 的雙防值；下 2 回合若自身選擇使用技能則無視對手能力提升狀態", effectType: "none", effectDetail: "" },
      { name: "星光·排山倒海", type: "水", category: "物理", power: 150, pp: 5, priority: 0, description: "無視對手攻擊免疫效果；無視對手護盾效果；命中後 50% 使對手冰封，未觸發則對手下 2 回合先制-2；給對手造成傷害時，傷害數值的 50% 恢復自身體力", effectType: "none", effectDetail: "" },
      { name: "星光·浪打千擊", type: "水", category: "物理", power: 160, pp: 5, priority: 0, isSureHit: true, isFifthSkill: true, description: "必中；1 回合做 5~10 次攻擊，每次攻擊都有 20% 的幾率令自身攻擊+1，速度+1，命中+1；消除對手回合類效果，消除成功則對手 2 回合內攻擊技能 MISS；對手處於星火之灼時造成的攻擊傷害提升 75%，若自身體力低於對手則效果翻倍；附加自身最大體力 20% 的百分比傷害，每次使用增加 10%，最高 40%", effectType: "none", effectDetail: "" },
      { name: "星光·怒濤狂湧", type: "水", category: "物理", power: 160, pp: 5, priority: 0, isSureHit: true, isFifthSkill: true, description: "必中；消除對手能力提升狀態，消除成功則對手2回合內無法使用屬性技能；造成的傷害50%恢復自身體力", effectType: "none", effectDetail: "" }
    ]
  },
  {
    id: "5011",
    name: "星光·麗莎布布",
    type: "草",
    level: 100,
    height: 87.3,
    weight: 2,
    gender: "雌性",
    baseStats: { hp: 180, atk: 70, def: 120, spatk: 135, spdef: 120, speed: 120 },
    soulMark: {
      name: "芳",
      badgeChar: "芳",
      description: "每次登場時，為對手附加3回合的星芳之纏，自身每次使用攻擊後附加3回合的星芳之纏；回合開始時，若自身體力高於對手則當回合受到的非真實傷害減少50%，若自身體力低於對手則回合結束後恢復自身最大體力的35%；星芳之纏：持有者造成的非真實傷害額外減少50%；每次受到攻擊傷害後擁有者額外受到傷害值100%的百分比傷害並恢復對方在場精靈等量體力與1點所有技能PP值，若對手為火系則星芳之纏消失並額外附加傷害值100%的真實傷害並恢復對方在場精靈等量體力與所有技能全部PP值，持續3回合重複獲取時重置為3回合。",
      effectType: "custom",
      effectValue: 100
    },
    description: "星光匯聚的自然仙子，掌握繁花與星辰的生長秘律，擁有專屬印記【星芳之纏】與獨特強大的植物光合治癒之力。",
    skills: [
      createRefSkill('starlight_lisa', '星光·究極吸取', '草', '特殊', 90, 20, 3, { accuracy: 97 }),
      createRefSkill('starlight_lisa', '星光·光合作用', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 95 }),
      createRefSkill('starlight_lisa', '星光·花草能量', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 95 }),
      createRefSkill('starlight_lisa', '星光·飛葉風暴', '草', '特殊', 150, 5, 0, { isSureHit: true, accuracy: 97 }),
      createRefSkill('starlight_lisa', '星光·金光綠葉', '草', '特殊', 160, 5, 0, { isSureHit: true, isFifthSkill: true, accuracy: 95 })
    ],
    skillPool: [
      createRefSkill('starlight_lisa', '撞擊', '普通', '物理', 35, 35, 0, { accuracy: 95 }),
      createRefSkill('starlight_lisa', '縮頭', "無屬性", '屬性', 0, 40, 0, { isSureHit: true }),
      createRefSkill('starlight_lisa', '吸取', '草', '特殊', 20, 25),
      createRefSkill('starlight_lisa', '疾風刃', '草', '物理', 55, 25, 0, { accuracy: 95 }),
      createRefSkill('starlight_lisa', '詛咒', "無屬性", '屬性', 0, 10, 0, { isSureHit: true }),
      createRefSkill('starlight_lisa', '星光·究極吸取', '草', '特殊', 90, 20, 3, { accuracy: 97 }),
      createRefSkill('starlight_lisa', '強力吸取', '草', '特殊', 40, 15),
      createRefSkill('starlight_lisa', '寄生種子', "無屬性", '屬性', 0, 10),
      createRefSkill('starlight_lisa', '捨身撞擊', '普通', '物理', 120, 15),
      createRefSkill('starlight_lisa', '星光·攻碎', '草', '物理', 120, 10, 0, { accuracy: 95 }),
      createRefSkill('starlight_lisa', '星光·花草護體', "無屬性", '屬性', 0, 10, 0, { accuracy: 95 }),
      createRefSkill('starlight_lisa', '星光·粉末擊打', '草', '特殊', 130, 10, 0, { accuracy: 95 }),
      createRefSkill('starlight_lisa', '星光·光合作用', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 95 }),
      createRefSkill('starlight_lisa', '星光·捨身撞擊', '草', '物理', 300, 5, 0, { accuracy: 95 }),
      createRefSkill('starlight_lisa', '星光·花草能量', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 95 }),
      createRefSkill('starlight_lisa', '星光·飛葉風暴', '草', '特殊', 150, 5, 0, { isSureHit: true, accuracy: 97 }),
      createRefSkill('starlight_lisa', '星光·金光綠葉', '草', '特殊', 160, 5, 0, { isSureHit: true, isFifthSkill: true, accuracy: 95 })
    ]
  },
  {
    id: "5012",
    name: "冰魄·柯爾德",
    type: "冰",
    level: 100,
    height: 185,
    weight: 90,
    gender: "雄性",
    baseStats: { hp: 175, atk: 155, def: 120, spatk: 80, spdef: 120, speed: 140 },
    soulMark: {
      name: "冰",
      badgeChar: "冰",
      description: "常駐效果：自身受到的非真實傷害額外減少60%，若以此法減少的傷害值不高於200點則戰鬥階段結束時自身受到25%的真實傷害；若不低於200點且自身擁有寂殺之魄則令對手凍傷3回合，未觸發則消除對手回合類效果且下2回合對手無法主動切換精靈；自身受到真實傷害時獲得1道寂殺之魄，汲取對手受到傷害值2倍的體力值；受到致死真實傷害時自身強制存活並恢復自身1點體力；自身無視對手的能力提升效果，若存在1道寂殺之魄額外無視自身能力下降，存在2道改為視為對手能力下降與自身能力上升並觸發對應效果，存在3道攻擊時無視對手傷害限制、免疫攻擊且對手1回合內回血下降100%；自身使用攻擊技能後：若對手處於能力提升狀態100%令對手冰封，未觸發附加200點肅霜之禁。寂殺之魄：異常狀態時無視對手不高於層數的先制（異常時3倍），最高3層下場保留；肅霜之禁：造成的技能傷害無法超過點數，觸發或主動下場減少200點，對手每有寂殺之魄減少效果下降50點，最高200點（boss無效）。",
      effectType: "custom",
      effectValue: 60
    },
    description: "賽爾號冰系精靈王超進化形態，極寒領域的絕對統治者，擁有專屬印記【寂殺之魄】與【肅霜之禁】，能將寒氣凝聚成絕對禁錮。",
    skills: [
      {
        name: "傲視千川",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；全屬性+1，對手處於冰封狀態時強化效果翻倍；下2回合對手受到的傷害提高100%；下2回合自身所有技能先制+2；下2回合對手無法主動切換精靈",
        effectType: "stat_up",
        effectDetail: "all+1"
      },
      {
        name: "凝寒止喧",
        type: "冰",
        category: "物理",
        power: 1,
        pp: 20,
        priority: 3,
        isSureHit: false,
        description: "先制+3；自身處於能力下降時先制+1（總先制+4）；消除對手回合類效果，消除成功則2回合內令對手使用的屬性技能無效；連續攻擊對手90次，對手每有50點肅霜之禁則額外攻擊10次，自身處於能力提升/下降狀態時效果翻倍；技能無效時消除對手回合類效果，100%令對手冰封，未觸發冰封則2回合內對手攻擊技能附加效果失效",
        effectType: "none",
        effectDetail: "multi_hit:90"
      },
      {
        name: "冰天花葬",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；5回合內免疫並反彈所有受到的異常狀態；100%使對手冰封，未觸發則對手雙防+1；附加給對手並解除自身所處的異常狀態，解除成功令對手2回合內對手攻擊技能附加效果失效；5回合內每回合吸取對手最大體力的1/3，吸取體力時若自身體力低於最大體力的1/2則吸取效果翻倍，對手體力未減少則附加雙方150點真實傷害與2回合凍傷；為對手附加自身攻擊值15%的肅霜之禁",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "王·蒼銀之棺",
        type: "冰",
        category: "物理",
        power: 150,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；無視自身負先制等級；消除敵我雙方回合類效果並同時進入3回合凝滯，自身凝滯、凍傷狀態解除或是結束時則恢復自身所有體力；敵我雙方同時進入3回合凍傷，自身凍傷狀態解除或是結束時則恢復自身所有技能PP值；若對手處於凍傷狀態則1回合內100%令對手使用的技能附加效果失效",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "王·霜祲霞罰",
        type: "冰",
        category: "物理",
        power: 160,
        pp: 5,
        priority: 0,
        isSureHit: true,
        isFifthSkill: true,
        description: "必中；無視對手護盾效果；若自身處於能力下降狀態則先制+3；【精靈王特權】攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；反轉自身能力下降狀態，反轉成功則免疫下1次受到的異常狀態；附加自身最大體力40%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/2則恢復效果和百分比傷害翻倍",
        effectType: "none",
        effectDetail: "king_privilege_no_weak,ignore_shield"
      }
    ],
    skillPool: [
      {
        name: "傲視千川",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；全屬性+1，對手處於冰封狀態時強化效果翻倍；下2回合對手受到的傷害提高100%；下2回合自身所有技能先制+2；下2回合對手無法主動切換精靈",
        effectType: "stat_up",
        effectDetail: "all+1"
      },
      {
        name: "王·霜祲霞罰",
        type: "冰",
        category: "物理",
        power: 160,
        pp: 5,
        priority: 0,
        isSureHit: true,
        isFifthSkill: true,
        description: "必中；無視對手護盾效果；若自身處於能力下降狀態則先制+3；【精靈王特權】攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；反轉自身能力下降狀態，反轉成功則免疫下1次受到的異常狀態；附加自身最大體力40%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/2則恢復效果和百分比傷害翻倍",
        effectType: "none",
        effectDetail: "king_privilege_no_weak,ignore_shield"
      },
      {
        name: "凝寒止喧",
        type: "冰",
        category: "物理",
        power: 1,
        pp: 20,
        priority: 3,
        isSureHit: false,
        description: "先制+3；自身處於能力下降時先制+1（總先制+4）；消除對手回合類效果，消除成功則2回合內令對手使用的屬性技能無效；連續攻擊對手90次，對手每有50點肅霜之禁則額外攻擊10次，自身處於能力提升/下降狀態時效果翻倍；技能無效時消除對手回合類效果，100%令對手冰封，未觸發冰封則2回合內對手攻擊技能附加效果失效",
        effectType: "none",
        effectDetail: "multi_hit:90"
      },
      {
        name: "冰天花葬",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；5回合內免疫並反彈所有受到的異常狀態；100%使對手冰封，未觸發則對手雙防+1；附加給對手並解除自身所處的異常狀態，解除成功令對手2回合內對手攻擊技能附加效果失效；5回合內每回合吸取對手最大體力的1/3，吸取體力時若自身體力低於最大體力的1/2則吸取效果翻倍，對手體力未減少則附加雙方150點真實傷害與2回合凍傷；為對手附加自身攻擊值15%的肅霜之禁",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "王·蒼銀之棺",
        type: "冰",
        category: "物理",
        power: 150,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；無視自身負先制等級；消除敵我雙方回合類效果並同時進入3回合凝滯，自身凝滯、凍傷狀態解除或是結束時則恢復自身所有體力；敵我雙方同時進入3回合凍傷，自身凍傷狀態解除或是結束時則恢復自身所有技能PP值；若對手處於凍傷狀態則1回合內100%令對手使用的技能附加效果失效",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "霜凍之錮",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；4回合內免疫並反彈所有受到的異常狀態；命中則80%使對手冰封，未觸發則吸取對手能力提升狀態；4回合內每回合吸取對手最大體力的1/3，自身體力低於最大體力的1/2時轉變為吸取對手最大體力的1/2",
        effectType: "none",
        effectDetail: ""
      }
    ]
  },
  {
    id: "5013",
    name: "柯爾霍德",
    type: "冰.暗影",
    level: 100,
    height: 182,
    weight: 73,
    gender: "雄性",
    baseStats: { hp: 181, atk: 147, def: 121, spatk: 80, spdef: 121, speed: 140 },
    soulMark: {
      name: "凕",
      badgeChar: "凕",
      description: "覺醒魂印【凕】：自身每次受到不小於自身當前體力⅓的非真實傷害時，本次受到傷害減少60%並附加對手等同於減少傷害值的霜寒幽光，若受到小於自身當前體力⅓的非真實傷害時，汲取對手傷害值60%的體力；在場敵我雙方任一方受到真實傷害時則為自身附加1道未暝之夜同時令自身當回合若首次死亡時強制存活並保留1點體力，若回合開始時自身當前體力不高於最大體力½或對手無法主動切換精靈時則取消需受到真實傷害觸發條件；回合結束時若自身當前體力不低於最大體力⅓則解除自身所有異常狀態，下2回合自身免疫並反彈所有異常同時反彈成功時將當回合對手所處的異常狀態轉化為冰封，解除異常狀態成功則對手下2回合所有技能附加效果失效。(未暝之夜:無視對手能力上升且技能先制+1，造成傷害提升150%且吸血100%；大於1道時改為每有1道將對手視為至少處於1級全屬性下降。霜寒幽光:固傷、百分比傷害若超過霜寒幽光值10%時減半，持有者在場吸取隨機不在場精靈技能PP，下場附加給下隻出戰精靈並限制切換。)",
      effectType: "custom",
      effectValue: 60
    },
    description: "賽爾號冰·暗影系雙屬性精靈王覺醒形態，掌控幽冥寒冰與永夜禁咒的至高主宰。",
    skills: [
      {
        name: "寒淵之殤",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；4回合免疫並反彈所有異常；命中後100%令對手害怕，若未觸發則減少對手最大體力1/3；下2回合對手受到傷害提升100%",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "蒼白冥步",
        type: "冰.暗影",
        category: "物理",
        power: 90,
        pp: 20,
        priority: 3,
        isSureHit: false,
        description: "先制+3；對手處於能力下降狀態時先制+1且必定命中；消除對手回合類效果，消除成功則令對手所有屬性技能PP值歸0；3回合內自身100%閃避對手所有攻擊，對手命中後則令對手隨機2個PP值不為0的技能歸0；3回合內自身回合類效果被消除則令敵我雙方同時進入凝滯狀態",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "寒夜未央",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；全屬性+1，若對手處於能力下降狀態時強化效果翻倍；5回合內每回合自身使用技能吸取對手最大體力的1/3，若自身體力低於1/2則吸取效果翻倍，吸取後對手體力未減少則附加對手300點真實傷害；命中後100%令對手衰弱，未觸發則3回合內自身使用技能附加對手250點真實傷害且使用後令對手當回合屬性技能附加效果失效；下2回合自身所有技能先制+2",
        effectType: "stat_up",
        effectDetail: "all+1"
      },
      {
        name: "王·夜予寒吟",
        type: "冰.暗影",
        category: "物理",
        power: 150,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；當回合自身處於能力下降狀態時先制+3；消除敵我雙方能力上升、下降狀態，任一方消除失敗（含視為弱化無法解除）時附加對手敵我雙方能力等級*30的固定傷害；消除敵我雙方回合類效果，消除成功則令對手場下所有精靈當前所有精靈PP值上限扣除至等同於當前技能PP值，此扣除效果最多扣除至1；100%令雙方凝滯，同時令雙方任一方下次凝滯回合結束或被解除、轉化時令自身當回合結束體力調整為最大體力44%；100%令雙方凍傷，未觸發則令對手2回合內所有攻擊技能正先制效果失效",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "王·凜冬葬歌",
        type: "冰.暗影",
        category: "物理",
        power: 160,
        pp: 5,
        priority: 0,
        isSureHit: true,
        isFifthSkill: true,
        description: "必中；對手處於能力下降狀態時先制+3；攻擊時造成的傷害不會出現微弱（若微弱則轉為普通）；複製對手能力提升，複製成功則對手3回合內攻擊技能無法造成攻擊傷害與附加異常狀態；2回合內對手體力恢復量下降100%；吸取對手最大體力40%，每次使用增加10%，最高60%；對手處於能力下降狀態時傷害提升150%",
        effectType: "none",
        effectDetail: "king_privilege_no_weak"
      }
    ],
    skillPool: [
      {
        name: "寒淵之殤",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；4回合免疫並反彈所有異常；命中後100%令對手害怕，若未觸發則減少對手最大體力1/3；下2回合對手受到傷害提升100%",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "蒼白冥步",
        type: "冰.暗影",
        category: "物理",
        power: 90,
        pp: 20,
        priority: 3,
        isSureHit: false,
        description: "先制+3；對手處於能力下降狀態時先制+1且必定命中；消除對手回合類效果，消除成功則令對手所有屬性技能PP值歸0；3回合內自身100%閃避對手所有攻擊，對手命中後則令對手隨機2個PP值不為0的技能歸0；3回合內自身回合類效果被消除則令敵我雙方同時進入凝滯狀態",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "寒夜未央",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；全屬性+1，若對手處於能力下降狀態時強化效果翻倍；5回合內每回合自身使用技能吸取對手最大體力的1/3，若自身體力低於1/2則吸取效果翻倍，吸取後對手體力未減少則附加對手300點真實傷害；命中後100%令對手衰弱，未觸發則3回合內自身使用技能附加對手250點真實傷害且使用後令對手當回合屬性技能附加效果失效；下2回合自身所有技能先制+2",
        effectType: "stat_up",
        effectDetail: "all+1"
      },
      {
        name: "王·夜予寒吟",
        type: "冰.暗影",
        category: "物理",
        power: 150,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；當回合自身處於能力下降狀態時先制+3；消除敵我雙方能力上升、下降狀態，任一方消除失敗（含視為弱化無法解除）時附加對手敵我雙方能力等級*30的固定傷害；消除敵我雙方回合類效果，消除成功則令對手場下所有精靈當前所有精靈PP值上限扣除至等同於當前技能PP值，此扣除效果最多扣除至1；100%令雙方凝滯，同時令雙方任一方下次凝滯回合結束或被解除、轉化時令自身當回合結束體力調整為最大體力44%；100%令雙方凍傷，未觸發則令對手2回合內所有攻擊技能正先制效果失效",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "王·凜冬葬歌",
        type: "冰.暗影",
        category: "物理",
        power: 160,
        pp: 5,
        priority: 0,
        isSureHit: true,
        isFifthSkill: true,
        description: "必中；對手處於能力下降狀態時先制+3；攻擊時造成的傷害不會出現微弱（若微弱則轉為普通）；複製對手能力提升，複製成功則對手3回合內攻擊技能無法造成攻擊傷害與附加異常狀態；2回合內對手體力恢復量下降100%；吸取對手最大體力40%，每次使用增加10%，最高60%；對手處於能力下降狀態時傷害提升150%",
        effectType: "none",
        effectDetail: "king_privilege_no_weak"
      }
    ]
  },
  {
    id: "5014",
    name: "聖光斯嘉麗",
    type: "聖靈.光",
    level: 100,
    height: 174,
    weight: 56,
    gender: "雌性",
    baseStats: { hp: 160, atk: 80, def: 135, spatk: 146, spdef: 135, speed: 134 },
    soulMark: {
      name: "燦",
      badgeChar: "燦",
      description: "燦: 戰鬥開始時，珀妮作為額外精靈加入己方與斯嘉麗共同作戰；自身每次受到非真實傷害降低至原始傷害的⅓，每次降低成功則令己方附加1層燦界聖芒，同時恢復最大體力1/3於當回合結束時造成對手等同於恢復量的百分比傷害，之後自身下場後，則1回合內令己方下隻出戰精靈登場前1回合獲得上述降低傷害效果與回合結束時恢復效果，每有1層燦界聖芒則延長1回合；自身使用技能時令自身特攻、速度+2、命中+1並附加對手特防、速度-2、命中-1，對手使用技能時令對手雙攻、速度-2、命中-1並附加自身雙防、速度、命中+1，前述效果執行時若雙方能力等級變化不高於10則2回合內自身攻擊技能計算傷害時以弱點傷害計算並附加對手星贖1回合，已存在星贖則改為回合數+1。(珀妮:光系額外精靈，所有能力值均為斯嘉麗⅓，己方在場精靈每次受到麻痺時後將當前所處異常狀態轉化為星贖且當回合直到戰鬥階段結束前回合類效果無法被消除；斯嘉麗在場期間每次出手流程結束後(含斯嘉麗選擇技能因故未能出手)進行一次額外行動造成對方等同於最大體力⅓的光系傷害且100%令對手失明，未觸發失明或對手已處於失明則消除對手回合類效果且令斯嘉麗下2次造成的攻擊傷害提升150%；己方斯嘉麗死亡4回合後在背包內重生，己方每有1層燦界聖芒則重生所需回合降低1回合。燦界聖芒:己方在場精靈每次受到失明後將當前所處異常狀態轉化為星贖且直到戰鬥階段結束前能力上升狀態無法被消除；己方戰鬥階段結束時敵我雙方每有1回合星贖則己方在場精靈控制類異常狀態的回合數降低燦界聖芒層數2倍，異常回合數最高降至1回合；對方技能戰鬥階段結束時敵我雙方每有1回合星贖降低對手等同於燦界聖芒層數所有技能等量技能PP值，最多降低至1點PP值，若對手被降低後PP值不大於1時額外令對手PP值該技能PP值上限歸1(上限3層，下場後保留)。弱點傷害:計算傷害以對手當前雙防值中較低者的60%作為對手的防禦值或特防值計算)",
      effectType: "custom",
      effectValue: 66
    },
    description: "賽爾號聖靈·光系雙屬性精靈王覺醒形態，與摯友珀妮攜手引導聖靈之芒，照耀整個宇宙的至高聖光。",
    skills: [
      {
        name: "純白聖翎",
        type: "聖靈.光",
        category: "特殊",
        power: 90,
        pp: 20,
        priority: 3,
        isSureHit: false,
        description: "先制+3；消除對手能力提升狀態，消除成功則令對手所有攻擊技能PP值歸0；3回合內對手屬性技能無效且使用後令該技能PP值歸0；技能無效時恢復自身最大體力½且下次受到異常狀態時轉化為星贖",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "晨曦昭世",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 1,
        isSureHit: true,
        description: "先制+1；必中；5回合內自身免疫並反彈所有異常狀態；4回合內，自身使用技能則附加對手等同於自身最大體力20%的真實傷害；2回合內自身免疫受到的攻擊，雙方每存在異常狀態1回合則額外延長1回合；3回合內，自身回合類效果被消除時令敵我雙方星贖，已存在星贖則改為回合數+2，未觸發則敵方下2回合無法主動切換精靈",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "暮光舞動",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；令自身特攻、雙防、速度+2、命中+1；5回合內自身使用技能恢復自身最大體力1/3並造成等量百分比傷害，自身體力低於最大體力½時效果翻倍；將對手屬性變為暗影系，若對手識別屬性為暗影系則令對手下次技能無效；下2回合自身所有技能先制+2；技能無效時，下2次攻擊將對手視為暗影系，自身攻擊視為光系",
        effectType: "stat_up",
        effectDetail: "spatk+2,def+2,spdef+2,speed+2,accuracy+1"
      },
      {
        name: "王·凰歌盡霄",
        type: "聖靈.光",
        category: "特殊",
        power: 150,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；自身處於能力下降時當回合先制+3；與對手交換自身低於對手的能力等級，交換成功則令自身無效下次對手的攻擊技能且當回合與下次造成攻擊傷害提升150%；技能威力提升75%，敵我雙方每有1個技能當前PP值低於1時提升30%；吸取對手等同於當回合自身造成攻擊傷害100%的體力",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "王·聖璨天潔",
        type: "聖靈.光",
        category: "特殊",
        power: 160,
        pp: 5,
        priority: 0,
        isSureHit: true,
        isFifthSkill: true,
        description: "必中；攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；消除對手回合類效果，消除成功則對手麻痺，未觸發則自身免疫下1次受到的異常狀態；附加自身最大體力30%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/3則恢復效果和百分比傷害翻倍；附加對手最大體力1/3的百分比傷害，未擊敗對手則恢復自身等量體力值",
        effectType: "none",
        effectDetail: "king_privilege_no_weak"
      }
    ],
    skillPool: [
      {
        name: "純白聖翎",
        type: "聖靈.光",
        category: "特殊",
        power: 90,
        pp: 20,
        priority: 3,
        isSureHit: false,
        description: "先制+3；消除對手能力提升狀態，消除成功則令對手所有攻擊技能PP值歸0；3回合內對手屬性技能無效且使用後令該技能PP值歸0；技能無效時恢復自身最大體力½且下次受到異常狀態時轉化為星贖",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "晨曦昭世",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 1,
        isSureHit: true,
        description: "先制+1；必中；5回合內自身免疫並反彈所有異常狀態；4回合內，自身使用技能則附加對手等同於自身最大體力20%的真實傷害；2回合內自身免疫受到的攻擊，雙方每存在異常狀態1回合則額外延長1回合；3回合內，自身回合類效果被消除時令敵我雙方星贖，已存在星贖則改為回合數+2，未觸發則敵方下2回合無法主動切換精靈",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "暮光舞動",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；令自身特攻、雙防、速度+2、命中+1；5回合內自身使用技能恢復自身最大體力1/3並造成等量百分比傷害，自身體力低於最大體力½時效果翻倍；將對手屬性變為暗影系，若對手識別屬性為暗影系則令對手下次技能無效；下2回合自身所有技能先制+2；技能無效時，下2次攻擊將對手視為暗影系，自身攻擊視為光系",
        effectType: "stat_up",
        effectDetail: "spatk+2,def+2,spdef+2,speed+2,accuracy+1"
      },
      {
        name: "王·凰歌盡霄",
        type: "聖靈.光",
        category: "特殊",
        power: 150,
        pp: 5,
        priority: 0,
        isSureHit: true,
        description: "必中；自身處於能力下降時當回合先制+3；與對手交換自身低於對手的能力等級，交換成功則令自身無效下次對手的攻擊技能且當回合與下次造成攻擊傷害提升150%；技能威力提升75%，敵我雙方每有1個技能當前PP值低於1時提升30%；吸取對手等同於當回合自身造成攻擊傷害100%的體力",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "王·聖璨天潔",
        type: "聖靈.光",
        category: "特殊",
        power: 160,
        pp: 5,
        priority: 0,
        isSureHit: true,
        isFifthSkill: true,
        description: "必中；攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；消除對手回合類效果，消除成功則對手麻痺，未觸發則自身免疫下1次受到的異常狀態；附加自身最大體力30%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/3則恢復效果和百分比傷害翻倍；附加對手最大體力1/3的百分比傷害，未擊敗對手則恢復自身等量體力值",
        effectType: "none",
        effectDetail: "king_privilege_no_weak"
      }
    ]
  },
  {
    id: "5015",
    name: "混沌·布萊克",
    type: "混沌.暗影",
    level: 100,
    height: 195,
    weight: 75,
    gender: "雄性",
    baseStats: { hp: 174, atk: 150, def: 118, spatk: 70, spdef: 118, speed: 130 },
    soulMark: {
      name: "夜",
      badgeChar: "夜",
      description: "自身所有異常狀態免疫類效果始終無法免疫狂暴且狂暴無法被轉化為其他異常狀態；自身能力提升狀態被消除或吸取時，100%使對手害怕，未觸發則將自身受到的下1次異常狀態轉化為3回合的狂暴狀態；自身處於狂暴狀態時所有技能先制+1；對手使用屬性技能則自身免疫下1次受到的異常狀態且自身下1次攻擊技能無視對手傷害限制、傷害免疫、攻擊免疫效果；對手使用攻擊技能則自身有100%的機率閃避對手攻擊，若該效果觸發則下2次攻擊技能先制+2且造成的傷害提升50%，若該效果未觸發則回合結束時附加自身攻擊值50%的百分比傷害並回復等量體力值；自身死亡時100%的機率會殘留1點體力，同時回合結束時解除自身異常狀態，消除對手回合類效果並100%令對手詛咒，吸取對手最大體力1/3，使自身進入3回合的狂暴狀態(每場戰鬥最多觸發1次)",
      effectType: "custom",
      effectValue: 0
    },
    description: "賽爾號混沌·暗影系精靈，夜神布萊克吸納混沌之力後的強大極限形態，狂暴與閃避反擊的極限大師。",
    skills: [
      {
        name: "蒼茫幽魂舞",
        type: "混沌.暗影",
        category: "物理",
        power: 150,
        pp: 5,
        accuracy: 100,
        priority: 1,
        description: "先制+1；先出手時對手當回合屬性技能無效；命中後使對手隨機的1個技能的PP值歸零；命中後100%使對手害怕，未觸發則使自身進入狂暴狀態；附加自身攻擊值30%的百分比傷害並恢復等量體力，若對手免疫百分比傷害，則附加等量真實傷害",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "狂影逆命沖",
        type: "暗影",
        category: "物理",
        power: 150,
        pp: 5,
        accuracy: 95,
        priority: 0,
        description: "使對手隨機的1個技能的PP值歸零；60%令對手害怕，每次使用概率增加10%，最高概率100%",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "孑然孤夢",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        accuracy: 100,
        priority: 0,
        isSureHit: true,
        description: "必中；全屬性+1，對手處於異常狀態時強化狀態翻倍；4回合內吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍；若對手免疫百分比傷害，則附加250點真實傷害；下2回合打出致命一擊則吸取對手350點體力；下2回合自身所有技能先制+2且攻擊必定致命",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "暗耀明滅",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        accuracy: 100,
        priority: 0,
        isSureHit: true,
        description: "必中；5回合內免疫並反彈除狂暴外所有受到的異常狀態；3回合內，對手使用攻擊技能則自身全屬性+1且對手兩回合內屬性技能無效；3回合內，對手使用屬性技能則對手全屬性-1且2回合內攻擊技能無法造成技能傷害且附加效果失效；3回合內若自身回合類效果被消除則吸取對手最大體力的1/3",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "夜·冥昭瞢闇",
        type: "混沌.暗影",
        category: "物理",
        power: 160,
        pp: 5,
        accuracy: 95,
        priority: 0,
        isSureHit: true,
        isFifthSkill: true,
        description: "必中；攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；消除對手回合類效果，消除成功則自身無效對方下1次攻擊技能；造成的傷害低於300則附加自身攻擊力與最大體力總和25%的百分比傷害，自身處於狂暴狀態則改為附加真實傷害；造成的傷害高於300則對手100%詛咒；擊敗對手則下回合開始使自身進入3回合狂暴狀態",
        effectType: "none",
        effectDetail: "king_privilege_no_weak"
      }
    ],
    skillPool: [
      {
        name: "夜洛烏澤",
        type: "混沌.暗影",
        category: "物理",
        power: 85,
        pp: 20,
        accuracy: 100,
        priority: 3,
        isSureHit: true,
        description: "先制+3；必中；吸取對手能力提升狀態，吸取成功則自身下1回合必定先出手；將自身能力下降狀態反饋給對手，反饋成功則對手詛咒；出手時體力低於1/3時威力3倍",
        effectType: "none",
        effectDetail: ""
      }
    ]
  },
  {
    id: "5016",
    name: "變革·馬爾修斯",
    type: "機械",
    level: 100,
    height: 230,
    weight: 138,
    gender: "無性別",
    baseStats: { hp: 183, atk: 80, def: 120, spatk: 150, spdef: 120, speed: 137 },
    soulMark: {
      name: "械",
      badgeChar: "械",
      description: "自身擁有堅壁、極速、毀滅三種機甲於在場期間協助自身戰鬥，不在場期間協助己方進行戰鬥，戰鬥開始時令自身技能中的PP值改為充能值且戰鬥中始終視為PP值為滿且為可選狀態(boss有效)\n\n登場時啟動堅壁機甲並與極速機甲組合，之後每次選擇使用第五技能時則吸取對手最大體力的⅓，若與極速機甲組合時則於使用技能後切換成與毀滅機甲進行組合，若與毀滅機甲組合時則於使用技能後切換成與極速機甲進行組合進行戰鬥(吸取體力效果boss無效，其餘Boss有效)\n\n戰鬥階段結束時，若自身本回合未選擇第五技能或第五技能無效，則下回合使用攻擊技能時消耗該技能所有充能值並汲取對手等同於15倍消耗值的體力值且當回合攻擊技能造成傷害提升150%(boss有效)\n\n堅壁機甲:己方馬爾修斯在場期間令其每回合首次受到異常狀態時解析、開始免疫並記錄該異常狀態直到戰鬥結束時；回合開始時附加等同於自身最大體力⅓的護盾與護罩且護盾與護罩存在時自身首次受到的非真實傷害減半1次；回合結束時恢復自身最大體力的⅓並附加對手等量百分比傷害，若護盾護罩消失時則額外提前觸發1次(回合結束時可再次觸發)；馬爾修斯不在場期間己方在場精靈免疫所有己解析並記錄的異常狀態，每回合結束時每存在1種異常紀錄則為馬爾修斯恢復1點充能值(下場後保留，堅壁機甲效果boss有效)\n\n極速機甲:己方馬爾修斯在場期間令其回合開始效果額外附加使用所有技能時先制額外+2(同時令己方變為被挑戰方)；先出手時攻擊傷害結算前使對手全屬性-1，馬爾修斯處於速度能力提升狀態時效果翻倍；後出手則下2回合對手先制效果失效且執行附加控制類異常效果時令堅壁機甲紀錄該異常；己方馬爾修斯不在場期間若對手先制等級高於己方在場精靈，則當回合結束時恢復自身技能1到5位中末位充能低於原PP值上限的技能至充能等於PP值上限且令對手下回合正先制效果失效(下場後保留)\n\n毀滅機甲:馬爾修斯在場期間令其所有攻擊技能威力提升100%，每次使用額外提升10%，最高170%；每次出手後若對手體力低於30%則消耗對手所有體力與該技能1點充能值以提升自身所有能力值30%；每次出手後若對手體力高於30%則消耗該技能1點充能值以附加對手最大體力30%的百分比傷害並恢復自身等量體力；己方馬爾修斯不在場期間若對方對敵我雙方任一方在場精靈執行消耗體力的效果，則消耗馬爾修斯隨機其中1個技能令本次消耗體力效果降低15%(下場後保留)\n\n（除變身特效與標註效果以外的所有效果boss無效）\n充能值:戰鬥開始時PP值等量充能值，此後充能值數量無視PP值上限，最低為0",
      effectType: "custom",
      effectValue: 0
    },
    description: "賽爾號機械系精靈，機械精靈王馬爾修斯變革升級的巔峰強大形態！三大機甲「堅壁、極速、毀滅」全方位覆蓋攻防與聯防，解析免疫一切異常！",
    skills: [
      {
        name: "革新已至",
        type: "機械",
        category: "特殊",
        power: 90,
        pp: 20,
        accuracy: 100,
        priority: 3,
        description: "先制+3；無視對手免疫攻擊效果；無效對手下次攻擊技能；吸取對手能力提升狀態，吸取成功則下2回合對手受到攻擊時必定為致命一擊；吸取對手當前體力1/4，PP值為滿時吸取效果翻倍",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "源生壁壘",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        accuracy: 100,
        priority: 0,
        description: "此技能PP值為滿時當回合先制+3；3回合內自身使用技能對手每回合速度-2、命中-2，未觸發則2回合內對手無法主動切換精靈；4回合內對手每次使用攻擊技能時吸取對手最大體力1/3；4回合內對手使用攻擊技能時100%使對手癱瘓；抵擋下1次攻擊，抵擋成功則附加對手等量真實傷害並恢復自身等量體力",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "核心重構",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        accuracy: 100,
        priority: 0,
        isSureHit: true,
        description: "必中；解除自身異常狀態，解除成功則令堅壁機甲解析並記錄此異常狀態；5回合內自身使用技能恢復自身體力1/3並附加對手等量百分比傷害，自身體力低於1/2時效果翻倍；5回合內自身使用技能吸取對手350點固定體力，對手受到固定傷害後體力未減少則附加300點真實傷害；3回合內若對手使用攻擊技能則100%令對手隨機2個技能PP值不為0的技能歸0並將降低的PP值總和轉變為自身技能補充等量充能",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "王·肅正協議",
        type: "機械",
        category: "特殊",
        power: 160,
        pp: 5,
        accuracy: 100,
        priority: 1,
        isSureHit: true,
        description: "必中；攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；2回合內對手屬性技能附加效果失效且攻擊技能PP值消耗量提升20倍；造成技能傷害提升70%，每次使用則本次造成技能傷害額外提升35%，此技能PP值為滿時效果翻倍，最高170%，處於與毀滅機甲組合時上限變為300%；技能無效時，消除對手回合類效果，100%令對手癱瘓",
        effectType: "none",
        effectDetail: "king_privilege_no_weak"
      },
      {
        name: "王·超限共頻",
        type: "無屬性",
        category: "屬性",
        power: 0,
        pp: 10,
        accuracy: 100,
        priority: 3,
        isSureHit: true,
        isFifthSkill: true,
        description: "必中；此技能PP值為滿時無視自身能力下降狀態；消除雙方回合類效果，消除成功則令對手燒傷、麻痺、疲憊，任一種異常未觸發則令對手隨機1個技能PP值不為0的技能歸0並將降低的PP值總和轉變為自身充能未滿的技能等量充能；消除雙方能力上升、下降狀態、護盾與護罩，消除任意一項則吸取對手等同於對手最大體力70%的百分比傷害；3回合內對手體力恢復量下降100%；特攻+1、防禦+1、特防+1、速度+1、命中+1，自身技能中存在充能時效果翻倍，若存在技能中充能為0的技能則補充所有技能5點充能；5回合內免疫並反彈所有異常狀態",
        effectType: "none",
        effectDetail: ""
      }
    ],
    skillPool: []
  },
  {
    id: "5017",
    name: "人皇·帝辛",
    type: "遠古",
    level: 100,
    height: 190,
    weight: 98,
    gender: "雄性",
    baseStats: { hp: 165, atk: 155, def: 115, spatk: 85, spdef: 115, speed: 135 },
    evs: { hp: 255, atk: 255, def: 0, spatk: 0, spdef: 0, speed: 0 },
    soulMark: {
      name: "荒",
      badgeChar: "荒",
      description: "登場時自身獲得2層八荒，若對方上回合主動切換則額外獲得2層；回合結束時對方當回合若使用技能則失去1層八荒，若對方當回合未使用技能則獲得1層八荒，若對方主動切換精靈時則額外獲得2層八荒並附加墮魔印記；自身擊敗對手時消除自身所有的八荒層數；八荒層數效果（同時獲得該層及以下所有效果）：1層：每有1層自身攻擊威力提升13%；2層：每有1層技能附加39點固傷；3層：回合結束吸取對手所有技能2點PP與1/3最大體力，若被免疫百分比傷害則改為造成300點真實傷害並自身獲得1層伏魔印記；5層：回合結束恢復自身1/3最大體力與已損失體力1/3，並有50%機率使對手下回合技能失效；7層：回合結束獲得等同於自身伏魔印記層數的防禦護罩，並吸取對手等同於對方墮魔印記層數的能力提升狀態；8層：若對手持有墮魔印記，上述效果翻倍；若自身持有伏魔印記，計算八荒層數時視為翻倍（僅強化已解鎖效果，無法提前解鎖高層效果）；9層：當達到9層時觸發誅魔天陣，持續9回合；誅魔天陣：期間對方每次受到任意傷害時體力始終無法高於上次受到傷害前，自身受非真實傷害降低等同於對方已損失體力(可降低至0)；天陣正常結束關閉時，自身體力降為1、清空所有技能PP且1回合內自身無法主動切換精靈",
      effectType: "custom",
      effectValue: 0
    },
    skills: [
      createRefSkill('dixin', '鹿台悲歌', '遠古', '物理', 150, 5, 0, { accuracy: 100 }),
      createRefSkill('dixin', '人皇御宇', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('dixin', '帝怒傾天', '遠古', '物理', 150, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('dixin', '玄鳥天命', '遠古', '物理', 90, 5, 0, { accuracy: 100 }),
      createRefSkill('dixin', '九鼎震八荒', '遠古', '物理', 160, 5, 0, { isSureHit: true, accuracy: 100, isFifthSkill: true })
    ],
    skillPool: [
      createRefSkill('dixin', '鹿台悲歌', '遠古', '物理', 150, 5, 0, { accuracy: 100 }),
      createRefSkill('dixin', '人皇御宇', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('dixin', '帝怒傾天', '遠古', '物理', 150, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('dixin', '玄鳥天命', '遠古', '物理', 90, 5, 0, { accuracy: 100 }),
      createRefSkill('dixin', '九鼎震八荒', '遠古', '物理', 160, 5, 0, { isSureHit: true, accuracy: 100, isFifthSkill: true })
    ]
  },
  {
    id: "5018",
    name: "蟲后·奧佩婭",
    type: "蟲",
    level: 100,
    height: 175,
    weight: 52,
    gender: "雌性",
    baseStats: { hp: 175, atk: 70, def: 118, spatk: 152, spdef: 118, speed: 137 },
    evs: { hp: 255, atk: 0, def: 0, spatk: 255, spdef: 0, speed: 0 },
    soulMark: {
      name: "后",
      badgeChar: "后",
      description: "登場時：己方背包內所有精靈每有n隻存活或識別帶有蟲系的精靈則自身直到下場獲得等同於所有能力值n*10%總和的臨時能力值且前n次自身攻擊技能連擊次數+1；敵方背包內所有精靈每有一隻陣亡或識別帶有蟲系的精靈則直到下場前對手使用攻擊技能時攻擊威力降低10%；前述效果觸發時若敵我雙方存在識別帶有混沌系的精靈，則場下所有帶有混沌系精靈所有能力值降低60%並附加給自身，自身直到下場前無視對手攻擊免疫效果、攻擊免疫/抵擋/轉化傷害效果、攻擊傷害限制效果；對手使用技能時：若該技能為攻擊技能時令對手下次屬性技能附加效果失效(下場後保留)，若該技能為屬性技能時令對手下次攻擊技能附加效果失效(下場後保留)；每次觸發前述效果時，恢復自身最大體力50%，令對手當回合造成的非真實傷害降低50%且當回合戰鬥階段結束時令使用的技能PP值歸0；該技能為攻擊技能則額外令對手所有相同類型的技能PP值歸0；該技能為屬性技能則額外令2回合內自身受到非真實傷害降低效果觸發時比例變為99%；自身使用技能時：不消耗技能PP值；100%令對手中毒，未觸發則消除對手回合類效果並有等同於自身體力當前百分比機率令對手害怕；若該技能PP值為滿或為屬性技能，則當回合出手流程結束時將對手所處的中毒異常狀態轉化為感染；若該技能PP值不為滿或為攻擊技能，吸取對手所有技能2點PP值",
      effectType: "custom",
      effectValue: 0
    },
    skills: [
      createRefSkill('opeia', '毒噬魂絲', '蟲', '特殊', 80, 20, 3, { isSureHit: true, accuracy: 100 }),
      createRefSkill('opeia', '蟲群庇護', "屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('opeia', '蟲后之冠', "屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('opeia', '王.噬心毒蝕', '蟲', '特殊', 150, 5, -1, { isSureHit: true, accuracy: 100 }),
      createRefSkill('opeia', '王·鏽腑喰心', '蟲', '特殊', 160, 5, 0, { isSureHit: true, accuracy: 100, isFifthSkill: true })
    ],
    skillPool: [
      createRefSkill('opeia', '毒噬魂絲', '蟲', '特殊', 80, 20, 3, { isSureHit: true, accuracy: 100 }),
      createRefSkill('opeia', '蟲群庇護', "屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('opeia', '蟲后之冠', "屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('opeia', '王.噬心毒蝕', '蟲', '特殊', 150, 5, -1, { isSureHit: true, accuracy: 100 }),
      createRefSkill('opeia', '王·鏽腑喰心', '蟲', '特殊', 160, 5, 0, { isSureHit: true, accuracy: 100, isFifthSkill: true })
    ]
  },
  {
    id: "5019",
    name: "眾神之父·奧丁",
    type: "遠古",
    level: 100,
    height: 177,
    weight: 76,
    gender: "雄性",
    baseStats: { hp: 175, atk: 155, def: 112, spatk: 70, spdef: 112, speed: 136 },
    evs: { hp: 255, atk: 255, def: 0, spatk: 0, spdef: 0, speed: 0 },
    natureModifiers: { hp: 1.0, atk: 1.1, def: 1.0, spatk: 0.9, spdef: 1.0, speed: 1.0 },
    soulMark: {
      name: "ᛏ",
      badgeChar: "ᛏ",
      description: "登場時為己方背包中末位精靈附加ᛏ符文，末位精靈已擁有ᛏ符文時順延附加至前一順位；回合開始時若對方在場精靈在場回合數未超過2回合且技能沒有符文則按照技能1到5位分別附加ᛈ、ᛁ、ᚦᚺ、ᚾ、ᛃ符文，若自身在場回合數未超過2回合且技能沒有符文則按照技能1到5位分別附加ᚨ、ᛉ、ᚱᚷ、ᛇ、ᛖ；自身附加的符文於選擇技能階段時激活直到該精靈下場後剝離，自身剝離時恢復該技能全部PP值且每剝離1道激活狀態的符文則直接增加等同於自身最大體力20%的體力值，對手剝離時失去該技能全部PP值且每剝離1道激活狀態的符文則對手受到對手最大體力20%的真實傷害(造成致死傷害時保留1點體力但PP值上限最高的技能PP值上限歸0)；回合結束時恢復自身最大體力⅓並附加對手等量百分比傷害，恢復前自身體力低於對手則下次對手所有技能先制-2且造成技能傷害降低50%，恢復後自身體力高於對手則下次所有技能先制+2且造成技能傷害提升50%；決鬥:在場精靈直到任一方被擊敗前雙方無法附加控制類異常狀態與主動切換下場\n\nᛏ:持有該符文者提升所有能力值20%但每次出戰時與對手當前在場精靈發起決鬥(下場後保留，上限1道)\n\nᚨ:激活後直到下場前持有者免疫所有異常狀態且每回合開始時將對手所處的弱化類異常延長至3回合\nᛉ:激活後直到下場前對手能力提升效果失效且無法觸發場下精靈對場上精靈的效果\nᚱᚷ:激活後直到下場前持有者所有技能必定命中、強制執行命中效果且選擇技能時不受PP值限制\nᛇ:激活後令持有者的對手相同位置技能PP值上限與該技能相同，超出部分的PP值每有1點轉化為附加對手100點真實傷害\nᛖ:激活後直到下場前持有者的對手正先制效果無法高於先制+1且擊敗效果失效\n\nᛈ:激活後直到下場前持有者每次選擇該技能轉化為使用自身技能中與對手所選擇使用技能相同位置技能\nᛁ:激活後則直到下場前持有者此技能固有效果失效且造成非真實傷害減半\nᚦᚺ:激活後則直到下場前持有者護盾與護罩附加效果失效且回合結束時受到等同於護盾與護罩總和20%的真實傷害\nᚾ:激活後則直到下場前持有者失去能力值20%\nᛃ:持有者無法觸發未擊敗對手時效果且對手每次使用技能時被對手吸取最大體力40%",
      effectType: "custom",
      effectValue: 0
    },
    skills: [
      createRefSkill('odin', 'ᚷᚢᚾᚷᚾᛁᚱ ᚦᚱᛖᚢᛗᚨᛞᚱ', '遠古', '物理', 90, 20, 3, { isSureHit: true, accuracy: 100 }),
      createRefSkill('odin', 'ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('odin', 'ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('odin', 'ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ', '遠古', '物理', 160, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('odin', 'ᚱᚨᚷᚾᚨᚱᛟᚲ', '遠古', '特殊', 140, 0, 0, { isSureHit: true, accuracy: 100, isFifthSkill: true })
    ],
    skillPool: [
      createRefSkill('odin', 'ᚷᚢᚾᚷᚾᛁᚱ ᚦᚱᛖᚢᛗᚨᛞᚱ', '遠古', '物理', 90, 20, 3, { isSureHit: true, accuracy: 100 }),
      createRefSkill('odin', 'ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('odin', 'ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ', "無屬性", '屬性', 0, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('odin', 'ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ', '遠古', '物理', 160, 5, 0, { isSureHit: true, accuracy: 100 }),
      createRefSkill('odin', 'ᚱᚨᚷᚾᚨᚱᛟᚲ', '遠古', '特殊', 140, 0, 0, { isSureHit: true, accuracy: 100, isFifthSkill: true })
    ]
  },

  {
    id: "5020",
    name: "皮皮",
    type: "飛行",
    level: 100,
    height: 38,
    weight: 2.5,
    gender: "無性別",
    baseStats: { hp: 85, atk: 120, def: 70, spatk: 50, spdef: 55, speed: 100 },
    soulMark: {
      name: "無",
      badgeChar: "無",
      description: "無特殊魂印",
      effectType: "none",
      effectValue: 0
    },
    skills: [
      {
        name: "撞擊",
        type: "普通",
        category: "物理",
        power: 35,
        pp: 35,
        priority: 0,
        accuracy: 100,
        description: "（無特殊效果）",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "鳴叫",
        type: "屬性",
        category: "屬性",
        power: 0,
        pp: 40,
        priority: 0,
        accuracy: 100,
        description: "技能使用後100%改變對方攻擊等級-1",
        effectType: "stat_down",
        effectDetail: "atk-1"
      },
      {
        name: "電光火石",
        type: "普通",
        category: "物理",
        power: 40,
        pp: 30,
        priority: 1,
        accuracy: 100,
        description: "先手攻擊",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "飛翼拍擊",
        type: "飛行",
        category: "物理",
        power: 60,
        pp: 35,
        priority: 0,
        accuracy: 100,
        description: "（無特殊效果）",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "誘惑",
        type: "屬性",
        category: "屬性",
        power: 0,
        pp: 20,
        priority: 0,
        accuracy: 100,
        description: "技能使用後100%改變對方命中等級-1",
        effectType: "stat_down",
        effectDetail: "accuracy-1"
      },
      {
        name: "手下留情",
        type: "普通",
        category: "物理",
        power: 40,
        pp: 40,
        priority: 0,
        accuracy: 100,
        description: "威力40 傷害大於對方體力時，對方會餘下1體力",
        effectType: "mercy",
        effectDetail: ""
      }
    ],
    skillPool: [
      {
        name: "異常測試",
        type: "飛行",
        category: "屬性",
        power: 0,
        pp: 30,
        priority: 3,
        isSureHit: true,
        description: "先制+3；必中；威力0；附加雙方所有精靈全部異常狀態",
        effectType: "none",
        effectDetail: "test_all_status_both"
      },
      {
        name: "測試異常用2",
        type: "飛行",
        category: "屬性",
        power: 0,
        pp: 30,
        priority: 3,
        isSureHit: true,
        description: "先制+3；附加自身目前所有異常狀態",
        effectType: "none",
        effectDetail: "test_all_status_self"
      },
      {
        name: "測試·控制類",
        type: "飛行",
        category: "屬性",
        power: 0,
        pp: 30,
        priority: 3,
        isSureHit: true,
        description: "先制+3；必中；威力0；附加雙方全體控制類異常狀態",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "測試·弱化類",
        type: "飛行",
        category: "屬性",
        power: 0,
        pp: 30,
        priority: 3,
        isSureHit: true,
        description: "先制+3；必中；威力0；附加雙方全體弱化類異常狀態",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "測試·限制類",
        type: "飛行",
        category: "屬性",
        power: 0,
        pp: 30,
        priority: 3,
        isSureHit: true,
        description: "先制+3；必中；威力0；附加雙方全體限制類異常狀態",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "測試·衍化類",
        type: "飛行",
        category: "屬性",
        power: 0,
        pp: 30,
        priority: 3,
        isSureHit: true,
        description: "先制+3；必中；威力0；附加雙方全體衍化類異常狀態",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "測試·附屬類",
        type: "飛行",
        category: "屬性",
        power: 0,
        pp: 30,
        priority: 3,
        isSureHit: true,
        description: "先制+3；必中；威力0；附加雙方全體附屬類異常狀態",
        effectType: "none",
        effectDetail: ""
      }
    ]
  },
  {
    id: "5021",
    name: "治癒.龍魂再臨 次元龍",
    type: "次元龍",
    level: 100,
    height: 197,
    weight: 68,
    gender: "雄性",
    baseStats: { hp: 185, atk: 75, def: 120, spatk: 160, spdef: 120, speed: 140 },
    soulMark: {
      name: "龍",
      badgeChar: "龍",
      description: "自身位於出戰背包內(無論是否為出戰/場下/額外精靈)，敵我雙方所有精靈(無論是否為出戰/場下/額外精靈)所有回合開始效果時額外所有精靈附加1篇詩章\n\n自身根據持有詩章數量獲得以下效果：\n1:每有1篇詩章先制+1；將對手能力提升視為同等級能力下降，自身能力下降視為同等級能力提升\n2:使用技能無視PP值限制並吸取對手所有技能1點PP值\n3:回合開始時解除自身所處的異常狀態，詩章大於3則自身免疫所有異常狀態\n4:使用技能吸取對手最大體力的40%並減少下次受到的技能傷害40%；每持有2篇詩章效果吸取效果額外提升10%\n5:每有1篇詩章，攻擊傷害提升20%，受到技能傷害減少10%\n6:雙方每有50點精靈護盾、精靈護罩，自身攻擊技能威力額外提升50點\n7:攻擊附加雙方體力差值的真實傷害\n8:無視對手攻擊免疫效果，無視傷害限制效果，無視成功時攻擊技能所造成的技能傷害提升100%\n9:為自身賦予等於自身攻擊傷害的護盾與護罩(可疊加無上限)\n10以上:攻擊附加等同對方最大體力值的技能傷害\n\n自身每場戰鬥首次死亡時解除自身所處異常狀態強制存活，當回合保留1點體力並免疫異常狀態，自身進入龍魂直到戰鬥結束\n\n龍魂:使用技能會額外執行龍魂效果\n\n詩章:紀錄持有者精靈的體力上限，當持有精靈死亡時，詩章將轉移給存活狀態的治癒.龍魂再臨 次元龍以增加其等量體力上限，治癒.龍魂再臨 次元龍若存在複數精靈則會同時轉移相同數量給予所有治癒.龍魂再臨 次元龍(每篇詩章獨立計算且無上限，下場後保留)",
      effectType: "none",
      effectValue: 0
    },
    skills: [
      {
        name: "閱世",
        type: "次元龍",
        category: "特殊",
        power: 85,
        pp: 20,
        priority: 3,
        accuracy: 100,
        description: "先制+3，若對手處於回合類效果則傷害提升100%並消除回合類效果，吸取對手能力提升狀態，吸取成功則令對手下2次屬性技能無效，若未觸發則另自身全屬性+1\n龍魂:當自身處於龍魂時發動，此技能無視對手正先制等級，傷害額外提升100%，若此技能無效，消除回合類效果並令對手詛咒",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "敕界歸元",
        type: "屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        accuracy: 100,
        description: "必中，5回合內免疫並反彈異常狀態，命中後令對手害怕，未觸發則為自身附加1篇詩章，3回合內對手使用攻擊技能，使用攻擊技能後的下2回屬性技能附加效果失效，3回合內對手使用屬性技能後，自身吸取對手最大體力的1/3\n龍魂:當自身處於龍魂時發動， 對手處於異常狀態時自身免疫下2次異常狀態，對手不處於異常時，1回合內自身抵擋所有非真實傷害",
        isSureHit: true,
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "告命詩途",
        type: "屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        accuracy: 100,
        description: "必中，全屬性+1，自身持有詩章則效果翻倍，自身不存在詩章則為自身書4篇。吸取對手最大體力的1/3，自身持有大於3篇詩章效果翻倍。下2回合先制+2，自身先制等級大於0時提升為先制+3。下2回合對手受到的攻擊傷害提升150%\n龍魂:當自身處於龍魂時發動， 對手每有1點PP值附加50點次元龍系技能傷害且下2回合對手無法主動切換精靈，雙方每存在1個PP值為滿的技能則翻倍1次",
        isSureHit: true,
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "神懺福音之章",
        type: "次元龍",
        category: "特殊",
        power: 150,
        pp: 5,
        priority: 0,
        accuracy: 100,
        description: "必中，若自身處於能力下降先制+3並使對手下次攻擊技能無效。未擊敗對手下2回合先制+2。\n龍魂:當自身處於龍魂時發動，雙方技能每有1點PP值附加50點次元龍系技能傷害，對方PP值均為滿時效果翻倍。下次擊敗對手恢復全部體力和PP值",
        isSureHit: true,
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "遺典.妄世律裁",
        type: "次元龍",
        category: "特殊",
        power: 160,
        pp: 5,
        priority: 0,
        accuracy: 100,
        description: "必中，自身每有1篇詩章攻擊傷害提升20%，對方每有1種PP值為滿的技能則附加對方當前體力20%的百分比傷害。若詩章大於2，每有1篇附加100點真實傷害。令對手下2回合先制-1，自身不為滿體力時令對手3回合內屬性技能附加效果失效。\n龍魂:自身體力大於對手時攻擊傷害的100%回復自身體力值，自身體力低於對手時附加雙方體力差值70%的真實傷害，雙方每存在1個PP值為滿的技能則翻倍7次",
        isSureHit: true,
        effectType: "none",
        effectDetail: "",
        isFifthSkill: true
      }
    ]
  },
  {
    id: "5022",
    name: "無序.六刃",
    type: "邪靈.戰鬥",
    level: 100,
    isAlienElf: true,
    trait: { name: "亂舞", description: "攻擊/特攻提升 12% 且造成技能傷害時隨機選擇對方任意場下精靈/額外精靈作為增加一個攻擊目標", effectType: "none", effectValue: 0 },
    inscriptions: [{ id: "liuren_qianghua", name: "強化", description: "無序六刃專屬刻印『強化』，所有屬性提升，專為突破極限而生。", stats: { hp: 120, atk: 50, def: 40, spatk: 50, spdef: 40, speed: 30 } }],
    height: 266,
    weight: 66,
    gender: "雄性",
    baseStats: { hp: 172, atk: 165, def: 111, spatk: 60, spdef: 111, speed: 136 },
    alienTraits: {
      gen2Trait: {
        name: "無我 / 戰士",
        description: "【無我】每次受到異常狀態時立即轉化為平靜，若轉化的異常中帶有狂暴則轉化觸發後令自身平靜異常回合數翻倍。\n【戰士】戰鬥中始終被視為異能精靈；自身戰鬥開始時與每次登場時獲得隱匿；自身下場後若己方隱匿精靈不超過3個，則恢復下隻出戰精靈所有技能PP值並附加隱匿印記；自身造成攻擊傷害時計算傷害始終以弱點傷害計算，計算弱點時若對方每存在1點護盾、1%傷害減少時弱點傷害則計算傷害時對手剩餘雙防值60%效果額外降低1%，最低降低至1；自身攻擊克制倍數取技能擁有的屬性中攻擊對手的最優克制系別計算傷害；自身攻擊無視對手攻擊免疫效果、傷害限制效果、免疫、抵擋、轉化傷害效果與護盾承傷效果。"
      },
      exclusiveTrait: {
        name: "無序星魂使徒",
        description: "對異能精靈造成傷害翻倍且擊敗後令其消逝"
      }
    },
    soulMark: {
      name: "專屬特性",
      badgeChar: "六",
      description: "自身每次出戰時:\n>紀錄自身原始體力上限\n>令自身受到自身最大體力⅙的真實傷害\n>令對手受到對手最大體力⅙的真實傷害\n>>觸發成功則己方上隻出戰精靈恢復上述受到真實傷害總和，同時自身獲得上述受到真實傷害量6倍的臨時體力上限(下場後消失)\n>之後若對手主動/死亡切換精靈，或自身進入異常狀態則再次觸發出戰效果並將原臨時體力上限變為永久體力上限\n\n常駐效果:\n>自身恢復體力無法恢復/增加超過至自身原始體力上限\n>自身造成非真實傷害提升120%\n>>自身體力每降低0.1%，上述效果提升120%，體力低於最大體力½時效果翻倍\n>自身每次受到真實傷害時\n>>2回合內抵擋受到的所有技能傷害且受到的固定傷害、百分比傷害不超過60\n>>直至上述效果結束的下回合結束時自身是否存活不受當前體力值限制\n>自身每次使用技能時，恢復自身最大體力⅙並造成等量百分比傷害",
      effectType: "none",
      effectValue: 0
    },
    skills: [
      {
        name: "狂刃無生",
        type: "邪靈.戰鬥",
        category: "物理",
        power: 66,
        pp: 36,
        priority: 6,
        accuracy: 100,
        isSureHit: true,
        description: "先制+6\n必中\n消除敵我雙方回合類效果，消除成功則令雙方狂暴\n消除敵我雙方能力上升、下降狀態與護盾、護罩效果，消除成功則附加自身最大體力66%的百分比傷害\n自身每損失1點體力，則附加對手1點真實傷害，每損失6點，則額外附加6點真實傷害",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "靜刃止水",
        type: "邪靈.戰鬥",
        category: "物理",
        power: 66,
        pp: 6,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中\n該技能每有1點PP值則先制+1且技能連擊次數+1\n6回合內自身免疫並反彈所有異常狀態\n解除雙方所有異常狀態，解除成功則3回合對手所有技能附加效果失效且無法附加敵我雙方任一方異常狀態\n附加666點固定傷害",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "蟄刃復歸",
        type: "邪靈.戰鬥",
        category: "物理",
        power: 66,
        pp: 6,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中\n該技能每有1點PP值則先制+1且技能連擊次數+1\n令自身平靜，自身處於平靜狀態則攻擊、雙防、速度、命中+1\n5回合內自身恢復最大體力⅓並造成等量百分比傷害，自身體力低於最大體力½時恢復效果與造成百分比傷害翻倍\n下2回合自身使用技能先制+6\n下次死亡時，若下隻出戰己方精靈在場超過6回合則自身重生",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "六刃碎界斷",
        type: "邪靈.戰鬥",
        category: "物理",
        power: 66,
        pp: 6,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中\n該技能每有1點PP值則先制+1且技能連擊次數+3\n6回合內對手體力恢復量下降100%\n附加自身雙攻值總和66%的百分比傷害\n3回合內令對手雙防-1，未觸發則2回合內對手攻擊技能無效且當回合結束時受到當前雙防值總和66%的百分比傷害",
        effectType: "none",
        effectDetail: ""
      },
      {
        name: "終焉·六花斬",
        type: "邪靈.戰鬥",
        category: "物理",
        power: 666,
        pp: 0,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        isFifthSkill: true,
        description: "必中\n自身處於異常狀態時先制+3且無視對手正先制效果\n雙方每有1個技能PP值不為滿則吸取對手1次66點體力(每次吸取體力獨立)，若吸取後對手體力未減少則該次改為汲取體力\n雙方每有1個技能PP值為滿則吸取對手1次66點體力(每次吸取體力獨立)，若吸取後對手體力未減少則該次改為汲取體力\n進行6次額外行動，每次行動依序以邪靈、戰鬥、邪靈.戰鬥、邪靈、戰鬥、邪靈.戰鬥為順序進行攻擊且每次造成66點技能傷害，額外行動期間不會造成傷害直到行動結束時對方所有精靈受到6次行動造成的傷害總和技能傷害，場下精靈死亡時令其消逝並轉化其能力值總和20%給予自身",
        effectType: "none",
        effectDetail: ""
      }
    ]
  },
  {
    id: "5023",
    name: "無序·蝕言",
    type: "機械.暗影",
    level: 100,
    height: 190,
    weight: 110,
    gender: "雄性",
    baseStats: { hp: 196, atk: 70, def: 132, spatk: 70, spdef: 132, speed: 145 },
    destinyRank: "S",
    isConcealed: false,
    isAlienElf: true,
    trait: { name: "亂舞", description: "攻擊/特攻提升 12% 且造成技能傷害時隨機選擇對方任意場下精靈/額外精靈作為增加一個攻擊目標", effectType: "none", effectValue: 0 },
    inscriptions: [{ id: "liuren_qianghua", name: "強化", description: "無序六刃專屬刻印『強化』，所有屬性提升，專為突破極限而生。", stats: { hp: 120, atk: 50, def: 40, spatk: 50, spdef: 40, speed: 30 } }],
    alienTraits: {
      gen2Trait: {
        name: "修復 / 咒術師",
        description: "【修復】\n己方其他精靈受到任意衍化類異常時，當回合戰鬥階段時會立即衍化並恢復自身與該精靈所有技能1點PP值與250點體力\n\n【咒術師】\n>戰鬥中被視為異能精靈\n每次登場時:\n>召喚與自身能力值相等的賽博怨靈作為額外精靈加入己方(特防始終與無序·蝕言經過專屬特性調整過後的特防保持一致)\n>自身下場後則怨靈死亡並消逝\n常駐效果:\n>賽博怨靈存在時自身詛咒類異常回合數不會減少\n自身選擇技能時:\n>若自身處於任一種詛咒類狀態則選擇技能時消耗該技能1點PP值\n>>賽博怨靈於行動階段發動1次魔咒(進行1次額外行動，以機械.暗影、機械、暗影系中克制倍數最高的屬性直接造成所選技能威力值+n點傷害並附加自身等同於傷害值的護盾與護罩(n=自身當前詛咒回合數)同時恢復自身等量體力值，同時隨機令敵方場下其中1隻精靈受到n乘以50%的真實傷害)\n>若戰鬥階段結束時若未選擇使用技能則改為賽博怨靈於該階段發動1次滅靈魔咒(進行1次額外行動，以機械.暗影、機械、暗影系中克制倍數最高的屬性直接造成技能中威力最高者的威力值+n點傷害並附加自身等同於傷害值的護盾與護罩(n=自身當前詛咒回合數)同時恢復自身等量體力值，同時隨機令敵方場下其中1隻精靈受到n乘以50%的真實傷害)\n>自身死亡時\n>>若存在怨靈會代替自身死亡以保留無序·蝕言20%體力(每次登場僅觸發1次)\n>>此後賽博怨靈執行上述效果中額外行動時對敵方場下造成真實傷害比例翻倍"
      },
      exclusiveTrait: {
        name: "無序星魂使徒",
        description: "對異能精靈造成傷害翻倍且擊敗後令其消逝"
      }
    },
    soulMark: {
      name: "蝕言",
      description: "回合開始時:\n>若自身不處於詛咒狀態則令敵我雙方進入3回合詛咒異常狀態\n戰鬥階段結束時:\n>將自身異常轉化為詛咒異常狀態且令自身詛咒回合數翻倍\n常駐效果:\n>若自身在背包內且存活\n>>將自身與己方其他所有場下精靈特防值直接調整為自身特防值/10(餘數無條件進位)\n>>修正敵方所有精靈特殊攻擊計算公式改為只能造成等同於特攻值的傷害\n>>>然後若自身最終特防值每有1點特防則對手造成上述傷害時減少1%\n>自身死亡時，還原對手特殊攻擊計算公式",
      effectType: "custom",
      effectValue: 3,
      badgeChar: "蝕"
    },
    skills: [
      {
        name: "影契·噬滅",
        type: "暗影",
        category: "物理",
        power: 100,
        pp: 20,
        priority: 3,
        accuracy: 100,
        description: "對手處於能力提升狀態時先制+1並將對手能力提升狀態視為能力下降狀態\n攜帶此技能則該技能每次PP值被消耗時:\n>消除雙方回合類效果、能力提升、下降狀態\n>100%令雙方同時進入害怕、詛咒異常狀態\n>令對手全屬性-1\n>吸取對手最大體力¼，自身體力低於最大體力½時效果翻倍",
        effectType: "absorb",
        effectDetail: "yingqi_shimie_pp_consume"
      },
      {
        name: "械律·置換",
        type: "機械",
        category: "特殊",
        power: 100,
        pp: 20,
        priority: 3,
        accuracy: 100,
        description: "雙方擁有護盾、護罩時先制+1並將對手能力提升狀態視為能力下降狀態\n攜帶此技能則該技能每次PP值被消耗時:\n>消除雙方護盾、護罩效果並吸取對手等同於消除量70%的體力\n>恢復自身所有技能PP值\n>偷取對手150藥劑並立即使用\n>下2回合對手無法主動切換精靈",
        effectType: "heal",
        effectDetail: "xielu_zhihuan_pp_consume"
      },
      {
        name: "血稅迴轉",
        type: "機械.暗影",
        category: "物理",
        power: 130,
        pp: 10,
        priority: 1,
        accuracy: 100,
        description: "攜帶此技能則該技能每次PP值被消耗時:\n>令自身雙防、速度、命中+2，雙攻-1\n>4回合內每回合吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，對手體力為減少則恢復己方所有不在場精靈200點體力\n>3回合內使用技能附加300點固定傷害，對手體力未減少則附加300點真實傷害\n>下2回合自身所有技能先制+2",
        effectType: "stat_up",
        effectDetail: "xueshui_huizhuan_pp_consume"
      },
      {
        name: "啟蟄·冥土荒蕪",
        type: "機械.暗影",
        category: "特殊",
        power: 150,
        pp: 5,
        priority: 0,
        accuracy: 100,
        description: "攜帶此技能則該技能每次PP值被消耗時:\n>令對手100%腐朽，未觸發則100%癱瘓\n>3回合內對手使用攻擊技能則隨機進入2種異常狀態\n>3回合內對手使用屬性技能則下2回合攻擊技能無法造成傷害且附加效果失效\n>3回合內自身免疫能力下降狀態",
        effectType: "status_inflict",
        effectDetail: "qizhe_mingtu_pp_consume"
      },
      {
        name: "安息契",
        type: "機械.暗影",
        category: "物理",
        power: 300,
        pp: 1,
        priority: -1,
        accuracy: 100,
        isFifthSkill: true,
        description: "將自身能力下降狀態視為對手處於同等級能力下降狀態\n攜帶此技能則該技能每次PP值被消耗時:\n>令對手所有攻擊技能PP值歸0\n>2回合內對手屬性技能無效且無法附加自身異常狀態\n>額外消耗自身所有技能1點PP值\n>附加自身最大體力40%的百分比傷害並恢復自身等量體力，對手體力高於最大體力½時效果翻倍\n>下次擊敗對手時100%令對手下隻出戰精靈詛咒",
        effectType: "absorb",
        effectDetail: "anxi_qi_pp_consume"
      }
    ]
  },
  {
    id: "5024",
    name: "湮滅之主・咤克斯",
    type: "混沌",
    level: 100,
    height: 1568883,
    weight: 1000000,
    gender: "無性別",
    baseStats: { hp: 182, atk: 70, def: 114, spatk: 142, spdef: 114, speed: 138 },
    destinyRank: "S",
    isConcealed: false,
    isAlienElf: false,
    soulMark: {
      name: "咤",
      description: "戰鬥開始時獲得1層魔王咒怨，敵我雙方出戰背包內每有1個擁有瞬殺特性的精靈自身額外獲得1層魔王咒怨；自身位於出戰背包時，對方的秒殺效果失效改為使自身獲得1層魔王咒怨；\n\n對手使用技能時，若自身為滿體力則消除對手回合類效果與能力提升狀態，若自身不為滿體力則獲得等同於已損失體力值50%的護盾、護罩且當回合戰鬥階段結束時自身恢復回合開始時自身所擁有護盾、護罩之和的體力；\n自身擊敗對手時自身所有能力值提升35點並獲得2層魔王咒怨；自身被擊敗時，令對手的體力上限減少35%；\n\n魔王咒怨：自身觸發秒殺時，額外選擇對方所有體力與原本秒殺目標相等的精靈為目標，達到5層時自身免疫控制類異常狀態；每有1層受到的攻擊傷害減少5%、造成的攻擊傷害提升5%、自身攻擊有3%的機率造成的傷害不低於對手的最大體力值",
      effectType: "custom",
      effectValue: 5,
      badgeChar: "咤"
    },
    skills: [
      {
        name: "無限・虛數湮滅",
        type: "混沌",
        category: "物理",
        power: 90,
        pp: 20,
        priority: 3,
        accuracy: 100,
        isSureHit: true,
        description: "先制+1；必中；消除對手回合類效果，消除成功則令對手疲憊，未觸發則100%令對手詛咒；消除對手能力提升狀態，消除成功則令對手害怕，未觸發則100%令對手詛咒；2回合內令對手使用的屬性技能無效；恢復自身最大體力1/1並附加對手等量百分比傷害",
        effectType: "dispel",
        effectDetail: "wuxian_xushu_yanmie"
      },
      {
        name: "沉寂・永夜悼亡",
        type: "屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中；免疫下 2 次自身受到的異常狀態；命中後 100% 令對手詛咒，未觸發則恢復自身最大體力的 1/1體力且 3 回合內自身受到的傷害不超過 200；下 2 回合造成的攻擊傷害額外提升 150%；3 回合內自身使用所有攻擊技能都附有 15% 的秒殺機率。",
        effectType: "buff",
        effectDetail: "chenji_yongye_daowang"
      },
      {
        name: "崩解・萬念劫灰",
        type: "屬性",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中；全屬性 +1，自身處於能力提升狀態時強化效果翻倍；4 回合內每回合使用技能吸取對手最大體力的 1/3，吸取體力時若自身體力低於最大體力的 1/2 則吸取效果翻倍，對手免疫百分比傷害時額外附加 250 點真實傷害；2 回合內令自身無效對手的攻擊技能；下 2 回合攻擊忽略對手 34% 的雙防值；下 2 回合令自身所有技能先制 +3。",
        effectType: "stat_up",
        effectDetail: "bengjie_wannian_jiehui"
      },
      {
        name: "劫數・限界歸無",
        type: "混沌",
        category: "特殊",
        power: 150,
        pp: 5,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中；若自身處於能力下降狀態則先制+3；反轉自身能力下降狀態，反轉成功則附加給對手等同的能力下降狀態；令對方背包內(場上場下)體力上限最低的精靈體力上限提升至與自身相等並恢復等量體力，然後此精靈所有非體力上限的能力值減少提升的數值，最多減少100點且最多減少至1；未擊敗對手則令對方場下陣亡的首位精靈消逝；擊敗對手則對方下隻出戰時精靈首回合先制效果失效。",
        effectType: "special",
        effectDetail: "jieshu_xianjie_guiwu"
      },
      {
        name: "絕滅・萬物哀鳴",
        type: "混沌",
        category: "特殊",
        power: 0,
        pp: 5,
        priority: 1,
        accuracy: 100,
        isFifthSkill: true,
        isSureHit: true,
        description: "先制+1；必中；廢除此技能，恢復對方精靈的全部體力，消耗此技能的全部PP值並獲得等量的魔王咒怨，然後若魔王咒怨層數高於5則秒殺對手且本次造成的攻擊傷害不低於對方所有精靈體力上限之和；當回合出手流程結束後若擊敗對手則對方下隻精靈出戰時100%進入詛咒狀態",
        effectType: "special",
        effectDetail: "juemie_wanwu_aiming"
      }
    ],
    skillPool: [
      {
        name: "超重力壓迫",
        type: "邪靈.神秘",
        category: "特殊",
        power: 85,
        pp: 20,
        priority: 3,
        accuracy: 100,
        description: "先制+3；命中後15%秒殺對手；2回合內對手屬性技能無效",
        effectType: "none",
        effectDetail: "chaozhongli_yapao"
      },
      {
        name: "無盡入侵",
        type: "--",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        accuracy: 100,
        description: "下2回合對手受到的傷害提高150%；5回合內免疫並反彈異常狀態；2回合內反彈對手致命一擊的傷害；2回合內受到的傷害不超過260",
        effectType: "buff",
        effectDetail: "wujin_ruqin"
      },
      {
        name: "絕滅死亡",
        type: "--",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        accuracy: 100,
        description: "全屬性+1，對手處於異常狀態時強化效果翻倍；4回合內，每回合吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍；4回合內免疫並反彈異常狀態",
        effectType: "stat_up",
        effectDetail: "juemie_siwang"
      },
      {
        name: "魔王天權震",
        type: "邪靈.神秘",
        category: "特殊",
        power: 150,
        pp: 5,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中；將自身能力下降狀態雙倍回饋給對手；未擊敗對手則己方下2次攻擊必定致命一擊（己方代表會繼承給場下所有精靈，同類效果觸發時會重置次數至最高值後再消耗次數）",
        effectType: "special",
        effectDetail: "mowang_tianquanzhen"
      },
      {
        name: "毀傷湧進",
        type: "邪靈.神秘",
        category: "物理",
        power: 140,
        pp: 5,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中；使對手隨機進入兩種非附屬類異常狀態",
        effectType: "status_inflict",
        effectDetail: "huishang_yongjin"
      }
    ]
  },
  {
    id: "5025",
    name: "恐懼的化身·咤克斯",
    type: "混沌·暗影",
    level: 100,
    height: 1888888,
    weight: 88888888,
    gender: "無性別",
    baseStats: { hp: 182, atk: 60, def: 114, spatk: 150, spdef: 114, speed: 140 },
    destinyRank: "S",
    isConcealed: false,
    isAlienElf: false,
    soulMark: {
      name: "懼",
      description: "自身存活在出戰背包內時(自身在場時也生效)，每回合吸取敵我雙方所有精靈20點體力上限附加給自身，最多吸取至該精靈體力上限為1；\n戰鬥開始時為對手種下恐懼之種；\n回合開始時，若自身滿體力則令對手100%害怕，未觸發則消除雙方能力上升、下降狀態與回合類效果；\n戰鬥階段結束時，恢復自身已損失體力50%的體力值與1點PP值，同時對手受到等同於自身恢復量百分比傷害，若對手體力未滿則額外令對手全屬性-1且至少減至1，未觸發則對手下2回合無法主動切換精靈；\n\n恐懼之種:持有方所有精靈均無法附加害怕異常與觸發秒殺效果且每次受到害怕異常時當回合免疫害怕異常狀態但所選擇的技能PP值歸0且當回合若因此PP值為0時則無法行動，造成非真實傷害降低20%，受到非真實傷害提升40%，每次受到對手的攻擊時有20%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害，每次己方精靈登場或受到害怕狀態時提高1層，每有1層則上述機率提高2%，最高5層，達到5層時轉變為恐懼之花\n恐懼之花:持有方所有精靈均無法附加給敵我雙方任一方異常異常狀態與觸發秒殺效果，每回合開始時恐懼之花會令在場精靈進入害怕狀態，造成非真實傷害降低50%，受到非真實傷害提升100%，每次受到對手的攻擊時有50%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害",
      effectType: "custom",
      effectValue: 5,
      badgeChar: "懼"
    },
    skills: [
      {
        name: "懼噬・恐源浸染",
        type: "混沌·暗影",
        category: "特殊",
        power: 90,
        pp: 20,
        priority: 3,
        accuracy: 100,
        isSureHit: false,
        description: "先制+3\n對手處於能力提升狀態則先制+1且必定命中，成功命中則恢復自身全部體力\n反轉對手能力上升狀態，反轉失敗則消除對手能力提升狀態\n3回合內對手無法恢復體力且屬性技能附加效果失效",
        effectType: "custom",
        effectDetail: "jushi_kongyuan_jinran"
      },
      {
        name: "深淵凝視",
        type: "無",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中\n5回合內令自身免疫並反彈所有異常狀態\n3回合內自身使用技能100%令對手害怕，未觸發則2回合內對手造成傷害無法超過280且攻擊技能附加效果失效\n下3次自身攻擊技能附加對手300點固定傷害，若對手受到此傷害後體力未減少則額外附加對手300點真實傷害\n下2次自身攻擊技能造成傷害提升150%",
        effectType: "custom",
        effectDetail: "shenyuan_ningshi"
      },
      {
        name: "幽幕折返",
        type: "無",
        category: "屬性",
        power: 0,
        pp: 5,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中\n令自身免疫並反彈下2次異常狀態\n使自身全屬性+1，對手不為神靈系時強化效果翻倍\n5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍\n對手下2次攻擊技能無效\n下3次自身使用所有技能先制+2\n下3次自身使用特殊攻擊技能忽略對手特防值60%",
        effectType: "custom",
        effectDetail: "youmu_zhefan"
      },
      {
        name: "懼噬.虛實逆寫",
        type: "混沌·暗影",
        category: "特殊",
        power: 130,
        pp: 12,
        priority: 1,
        accuracy: 100,
        isSureHit: true,
        description: "必中\n當回合自身處於能力下降狀態時先制+3並視為同等級能力提升狀態\n反轉自身能力下降，反轉成功則100%令對手害怕，未觸發則附加對手等同於自身能力上升狀態的能力下降狀態\n自身每有1種能力等級與對手不相同則吸取對手120點體力，每有一種能力值等級(無論是否為上升狀態或能力下降狀態)相同則造成傷害提升12%\n下次擊敗對手則令對手下隻出戰精靈首回合進入害怕狀態",
        effectType: "custom",
        effectDetail: "jushi_xushi_nixie"
      },
      {
        name: "劫數.萬念歸墟",
        type: "混沌·暗影",
        category: "特殊",
        power: 180,
        pp: 5,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中\n消除對手回合類效果，消除成功則100%令對手害怕，未觸發則當回合造成攻擊傷害提升150%\n吸取對手最大體力⅓，未觸發則100%令對手害怕\n命中後100%令對手害怕，未觸發或對手已處於害怕狀態則30%秒殺對手\n令自身抵擋下次受到攻擊傷害，觸發成功則下次攻擊自身附加等同於抵擋攻擊傷害量真實傷害",
        effectType: "custom",
        effectDetail: "jieshu_wannian_guixu"
      }
    ]
  },
  {
    id: "5026",
    name: "無序.墜星",
    type: "光.超能",
    level: 100,
    isAlienElf: true,
    trait: { name: "亂舞", description: "攻擊/特攻提升 12% 且造成技能傷害時隨機選擇對方任意場下精靈/額外精靈作為增加一個攻擊目標", effectType: "none", effectValue: 0 },
    inscriptions: [{ id: "liuren_qianghua", name: "強化", description: "無序六刃專屬刻印『強化』，所有屬性提升，專為突破極限而生。", stats: { hp: 120, atk: 50, def: 40, spatk: 50, spdef: 40, speed: 30 } }],
    category: "異能精靈",
    height: 195,
    weight: 156,
    gender: "雄性",
    baseStats: { hp: 170, atk: 70, def: 105, spatk: 165, spdef: 105, speed: 130 },
    alienTraits: {
      gen2Trait: {
        name: "豪邁 / 投石者",
        description: "【豪邁】自身攻擊時忽略對手50%雙防值。\n【投石者】戰鬥中被視為異能精靈；技能位可攜帶4種不同屬性的技能石且使用任意技能石時轉化為使用同屬系的SS級技能石，威力變為240(無法裝備重複屬性)；若自身攜帶4個技能石技能則在戰鬥中擁有神話(免疫異常狀態、能力下降狀態、PP值無限)且造成攻擊傷害提升50%，受到攻擊傷害降低50%且戰鬥階段結束時恢復自身最大體力25%；裝備的技能石擁有本系加乘且PP值上限+10；若該技能石為完美技能石則機率效果觸發概率提升為100%；每次使用技能石時令對手背包內所有精靈受到傷害值25%*該技能石對受到傷害精靈當前克制倍數的真實傷害；遭受致死傷害時保留1點體力。"
      },
      exclusiveTrait: {
        name: "無序星魂使徒",
        description: "對異能精靈造成傷害翻倍且擊敗後令其消逝"
      }
    },
    soulMark: {
      name: "專屬特性",
      badgeChar: "墜",
      description: "自身使用攻擊技能後:\n>令對手2回合內屬性技能無效\n>自身恢復造成傷害100%的體力值\n>2回合內自身免疫控制類異常狀態\n>附加對手已損失體力50%的百分比傷害\n>恢復自身所有技能2點PP值\n對手受到技能傷害時:\n>若背包內每有一隻精靈體力不為滿，則自身下次攻擊技能威力額外提升25%",
      effectType: "custom",
      effectValue: 0,
      trait_wuxu_apostle: true,
      trait_stone_thrower: true,
    },
    skills: [
      {
        name: "電石之力-S",
        type: "電",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率令對手麻痹",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_electric_para",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_electric_para"
      },
      {
        name: "神秘石之力-S",
        type: "神秘",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率令對方疲憊",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_mystery_fatigue",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_mystery_fatigue"
      },
      {
        name: "超能石之力-S",
        type: "超能",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時15%機率令對手混亂（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_psychic_conf",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_psychic_conf"
      },
      {
        name: "自然石之力-S",
        type: "自然",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率恢復自己所有技能PP值1點（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_nature_pp",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_nature_pp"
      },
      {
        name: "四象崩壞砲",
        type: "光.超能",
        category: "特殊",
        power: 160,
        pp: 5,
        priority: 0,
        accuracy: 100,
        isSureHit: true,
        description: "必中\n使自身全屬性+1\n消除對手回合類效果，消除成功則雙方命中+1\n消除對手能力提升狀態，消除成功則自身3回合內受到攻擊傷害不超過3\n2回合內對手攻擊技能無效",
        effectType: "custom",
        effectDetail: "sixiang_benghuaipao",
        isFifthSkill: true
      }
    ],
    skillPool: [
      {
        name: "草石之力-S",
        type: "草",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時15%機率令對手中毒（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_grass_poison",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_grass_poison"
      },
      {
        name: "水石之力-S",
        type: "水",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時15%機率令對手凍傷（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_water_frost",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_water_frost"
      },
      {
        name: "火石之力-S",
        type: "火",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時15%機率令對手燒傷（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_fire_burn",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_fire_burn"
      },
      {
        name: "飛行石之力-S",
        type: "飛行",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時15%機率令對手速度屬性-1（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_flying_speed",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_flying_speed"
      },
      {
        name: "電石之力-S",
        type: "電",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率令對手麻痹（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_electric_para",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_electric_para"
      },
      {
        name: "機械石之力-S",
        type: "機械",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時15%機率令對手雙防-1（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_mech_def",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_mech_def"
      },
      {
        name: "地面石之力-S",
        type: "地面",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時15%機率令對手命中-1（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_ground_acc",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_ground_acc"
      },
      {
        name: "普通石之力-S",
        type: "普通",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時5%機率威力翻倍（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_normal_double",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_normal_double"
      },
      {
        name: "冰石之力-S",
        type: "冰",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時15%機率令對手凍傷（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_ice_frost",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_ice_frost"
      },
      {
        name: "超能石之力-S",
        type: "超能",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時15%機率令對手混亂（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_psychic_conf",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_psychic_conf"
      },
      {
        name: "戰鬥石之力-S",
        type: "戰鬥",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時100%機率下回合致命一擊提升（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_fight_crit",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_fight_crit"
      },
      {
        name: "光石之力-S",
        type: "光",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率令對手睡眠（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_light_sleep",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_light_sleep"
      },
      {
        name: "暗影石之力-S",
        type: "暗影",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率令對手害怕（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_shadow_fear",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_shadow_fear"
      },
      {
        name: "神秘石之力-S",
        type: "神秘",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率令對方疲憊（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_mystery_fatigue",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_mystery_fatigue"
      },
      {
        name: "龍石之力-S",
        type: "龍",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時5%機率附加200點真實傷害（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_dragon_dmg",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_dragon_dmg"
      },
      {
        name: "聖靈石之力-S",
        type: "聖靈",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率一回合受到傷害減半（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_holy_half",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_holy_half"
      },
      {
        name: "次元石之力-S",
        type: "次元",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率令對手癱瘓（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_dim_para",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_dim_para"
      },
      {
        name: "遠古石之力-S",
        type: "遠古",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率令對手流血（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_ancient_bleed",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_ancient_bleed"
      },
      {
        name: "邪靈石之力-S",
        type: "邪靈",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率先制+1（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_evil_prio",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_evil_prio"
      },
      {
        name: "自然石之力-S",
        type: "自然",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率恢復自己所有技能PP值1點（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_nature_pp",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_nature_pp"
      },
      {
        name: "蟲石之力-S",
        type: "蟲",
        category: "特殊",
        power: 160,
        pp: 12,
        accuracy: 100,
        description: "造成特殊攻擊傷害；使用時10%機率降低對手所有技能PP值1點，若因此對手PP值歸0則對手當回合無法行動（裝備於投石者時轉化為同屬系SS級威力240且機率100%）",
        priority: 0,
        effectType: "skill_stone_perfect",
        effectDetail: "attr_bug_pp",
        isSkillStone: true,
        skillStoneGrade: "S",
        isPerfectSkillStone: true,
        skillStoneEffect: "attr_bug_pp"
      }
    ]
  },
  {
    id: "5027",
    name: "蓓麗安特",
    type: "聖靈.神秘",
    level: 100,
    height: 178,
    weight: 53,
    gender: "雌性",
    baseStats: { hp: 169, atk: 70, def: 115, spatk: 152, spdef: 115, speed: 139 },
    soulMark: {
      name: "蓓",
      description: "戰鬥開始時己方獲得星執：記錄蓓麗安特的異常抗性的所有最高項，己方所有精靈進入上述記錄的異常狀態時轉化為3回合星賜但失去全免抗性\n蓓麗安特被擊敗/死亡時解放星執，消逝自身並化身為星執者，星執者的初始擁有等同於蓓麗安特本次登場時最大體力的能量，己方其他精靈被擊敗時，星執者額外獲得300點能量，失去所有能量後星執者消失\n星賜：附屬類異常狀態，此狀態下的精靈造成的攻擊傷害提升30%，每回合結束後恢復2點PP值\n星執者：己方在場精靈進入異常狀態後立刻轉化為3回合星賜;\n己方精靈每次使用技能後星執者消耗15%的能量以附加給對手等量真實傷害，每回合結束後星執者消耗15%的能量以恢復在場存活精靈等量體力，每次消耗的能量至少為150點且每次消耗能量令己方下次執行異常轉化時獲得150點能力並恢復己方在場存活精靈等量體力",
      effectType: "custom",
      effectValue: 0
    },
    skills: [
      createRefSkill('beliente', '曙天', '聖靈.神秘', '特殊', 90, 20),
      createRefSkill('beliente', '星垂穹儀', '無屬性', '屬性', 0, 5),
      createRefSkill('beliente', '星河入眸', '無屬性', '屬性', 0, 5),
      createRefSkill('beliente', '星祈·繞指星瀾', '聖靈.神秘', '特殊', 150, 5, 0, { isSureHit: true }),
      createRefSkill('beliente', '星執·浩邃星幕', '聖靈.神秘', '特殊', 160, 5, 0, { isFifthSkill: true })
    ]
  },
  {
    id: "5028",
    name: "怒濤·滄嵐",
    type: "水",
    level: 100,
    height: 170,
    weight: 58,
    gender: "雌性",
    baseStats: { hp: 182, atk: 80, def: 120, spatk: 153, spdef: 120, speed: 135 },
    soulMark: {
      name: "瀾",
      description: "登場時為自身附加600點護盾，若登場前場上精靈存在護盾則額外複製雙方護盾總和並附加給自身；\n\n回合開始時場上精靈中存在擁有護盾者則當回合自身所有技能先制+1且雙方每存在100點護盾則直到下回合結束時每次受到固定傷害、百分比傷害額外減半一次且減半後傷害無法超過雙方當前護盾值總和的1/3(下場後保留)；雙方護盾值每次發生變化時，每達到100則附加給1道對手千秋一淚；自身使用攻擊技能時附加給自身1道永恆之水，若場上存在擁有護盾者則額外附加給自身1道永恆之水，場上存在不擁有護盾者則自身使用技能不受PP值限制、不消耗技能PP值且當回合技能使用後附加給對手1道千秋一淚；\n\n自身受到技能傷害減半，且每次受到技能傷害後恢復自身最大體力1/3並使自身抵擋下次受到的技能傷害；回合結束時若自身未受到技能傷害則吸取對手最大體力1/3且下回合開始時解除自身所處的異常狀態；\n\n永恆之水:持有者執行異常狀態附加效果時若低於100%者提升至100%且每次護盾減少時額外至少保留當前護盾值30%；每有1道則造成攻擊傷害提升40%；每存在2道時若對方存在1道千秋一淚則死亡時消耗對應的道數令自身重生並解除所有異常狀態；最多8道，下場後保留\n\n千秋一淚:\n1道:持有者體力恢復量下降25%，每有1道則額外體力恢復量下降25%\n2道:持有者減少、降低技能傷害效果比例衰減50%，每有2道則減少、降低技能傷害效果比例衰減50%\n3道:持有者護盾與護罩所有附帶效果失效\n4道:持有者抵擋、免疫、轉化技能傷害效果失效\n(上限4道，下場後保留)",
      effectType: "custom",
      effectValue: 0
    },
    skills: [
      createRefSkill('canglan', '滄海永存', '水', '屬性', 0, 5, 0, { isSureHit: true, fallbackDesc: '命中後80%使對手冰封，未觸發則下2回合攻擊有100%機率使對手束縛；恢復自身最大體力的1/1，自身體力低於1/2時造成等量百分比傷害；使自身獲得一個可以吸收400點傷害的護盾（相同來源不可疊加），護盾消失時對對手造成400點固定傷害且有100%的機率使對手束縛' }),
      createRefSkill('canglan', '弱水三千', '水', '特殊', 90, 20, 3, { isSureHit: true, fallbackDesc: '吸取並反轉對手能力提升狀態；令對手全屬性-1，未觸發則令對手冰封；附加等同於對方最大體力值40%百分比傷害並恢復自身體力，自身體力低於最大體力1/2時效果翻倍；3回合內對手屬性技能無效' }),
      createRefSkill('canglan', '永恆誓約', '水', '屬性', 0, 5, 0, { isSureHit: true, fallbackDesc: '令自身特攻、防禦、特防、速度、命中+1，擁有護盾時強化效果翻倍；5回合內免疫並反彈所有異常狀態，技能無效時改為使自身免疫並反彈下2次異常狀態；下2回合攻擊傷害提升150%，技能無效時改為抵擋下次攻擊並附加500點護盾；獲得1道永恆之水，若對手千秋一淚滴數高於自身永恆之水時額外獲得等同於差值的永恆之水，若道數為滿則令對手束縛，技能無效時獲得永恆之水道數翻倍且令對手進入束縛效果取消觸發條件；下2回合自身所有技能先制+3，技能無效時改為自身下回合無視對手正先制效果' }),
      createRefSkill('canglan', '王·洛浦凌波', '水', '特殊', 150, 5, 0, { isSureHit: true, fallbackDesc: '若自身處於能力下降狀態時先制+3；將自身能力下降狀態視為同等級能力提升狀態；反轉自身能力下降狀態，反轉成功則附加給對手等量能力下降狀態；消耗敵我雙方全部護盾與護罩以令對手下次技能無效，每消耗1點則本次技能威力提升1點，並附加對手等同於雙方消耗量70%的百分比傷害' }),
      createRefSkill('canglan', '王·深海之吻', '水', '特殊', 160, 5, 0, { isSureHit: true, isFifthSkill: true, fallbackDesc: '攻擊時造成的傷害不會出現微弱(克制關係為微弱時轉變為普通)；無視對手傷害限制效果；無視對手攻擊免疫效果；消除對手回合類效果，消除成功100%依序令對手束縛、凍傷、冰封，若均觸發或任意一項未觸發、對手不存在回合類效果或回合類效果無法消除時令自身免疫下2次異常狀態；將對手所處的異常狀態轉化為冰封，若對手不處於異常狀態則改為100%令對手冰封；附加對手自身最大體力值40%的百分比傷害並附加自身等量護盾(可疊加)，自身存在永恆之水時比例改為60%且額外恢復自身等量體力，對手存在千秋一淚時則吸取前額外汲取對手等同於自身最大體力25%的體力' })
    ]
  },
  OTHERWORLD_REY_SEED,
  HOLY_MILES_SEED,
  ...STAGED_ARENA_ELVES
];

import { getNumericElfId } from './elfRegistry';

/** 套用 elf_source_files 的標準描述與數值（elfSourceText.json，由 txt 匯入；txt 為準） */
type SourceSkill = { d: string; f?: Partial<Skill> };
type SourceEntry = { soulMark?: string; destiny?: string; skills: Record<string, SourceSkill>; add?: Skill[]; ss?: Record<string, string> };
export const SOURCE_SS_TEXT: Record<string, string> = Object.assign({}, ...Object.values(SOURCE_TEXT as Record<string, SourceEntry>).map(e => e.ss || {}));
function applySourceText(item: Elf): Elf {
  const st = (SOURCE_TEXT as Record<string, SourceEntry>)[String(item.id)];
  // 屬性技能的屬性欄誤填「屬性」→「無屬性」
  const fixType = (sk: Skill): Skill => (sk.type === "屬性" ? { ...sk, type: "無屬性" } : sk);
  if (!st) return { ...item, skills: item.skills?.map(fixType) || item.skills, skillPool: item.skillPool?.map(fixType) };
  const apply = (sk: Skill): Skill => {
    const src = st.skills[sk.name];
    return src ? { ...sk, ...(src.f || {}), description: src.d } : sk;
  };
  const withDesc = (list?: Skill[]) => list?.map(fixType).map(apply);
  let soulMark = item.soulMark;
  if (soulMark && (st.soulMark || st.destiny)) {
    const [oldMain, ...rest] = (soulMark.description || "").split("【命運之輪");
    const oldDestiny = rest.length ? "【命運之輪" + rest.join("【命運之輪") : "";
    const main = st.soulMark || oldMain.trim();
    const destiny = st.destiny || oldDestiny.trim();
    soulMark = { ...soulMark, description: destiny ? `${main}\n\n${destiny}` : main };
  }
  const skills = withDesc(item.skills) || item.skills;
  let skillPool = withDesc(item.skillPool);
  // txt 有、app 沒有的技能 → 加入技能庫
  const have = new Set([...(skills || []), ...(skillPool || [])].map(x => x.name));
  const added = (st.add || []).filter(x => !have.has(x.name));
  if (added.length) skillPool = [...(skillPool || []), ...added];
  return { ...item, soulMark, skills, skillPool };
}

export const DEFAULT_ELVES: Elf[] = SEED_ELVES.map(applySourceText).map((item, index) => {
  const inscriptions = getEffectiveInscriptions(item.inscriptions);
  const calculated = calculateElfStats(item.baseStats, item.level, item.ivs, item.evs, item.natureModifiers, inscriptions);
  return {
    ...item,
    id: getNumericElfId(item.id || `default_${index}`, item.name),
    inscriptions,
    calculatedStats: calculated,
    currentHp: calculated.hp,
    maxHp: calculated.hp
  };
});
