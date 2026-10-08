import type { Elf, Skill } from '../types';

// 對照 elf_source_files/elf_files/5029_異境神霆雷伊.txt；原文與規則裁定分開保存。
export const OTHERWORLD_REY_TEXT = {
  "soul": "【回合開始時】\n\n複製對手能力提升狀態。\n\n複製成功則令自身麻痺。\n若對手不處於能力提升狀態，則令自身攻擊、速度、命中+2，當回合自身所有技能先制+1。\n\n【觸發效果】\n\n自身將對手能力提升狀態視為同等級2倍能力下降狀態。\n自身回合類效果無法被消除。\n對手每次回合類效果開始時變為1回合。\n\n觸發成功則當回合令自身麻痺。\n每減少1回合令自身麻痺回合數+1。\n自身能力提升/下降等級狀態被改變時，令雙方100%麻痺，麻痺狀態增加7回合。\n\n【自身處於異常狀態時】\n\n當回合戰鬥階段結束時恢復所有技能7點PP值。\n若處於麻痺異常狀態，則額外令自身所處的異常狀態效果附帶效果失效（仍然處於異常），改為造成技能傷害提升70%。\n\n【使用攻擊技能時】\n\n吸取對手雙方能力等級總和*70的體力值。\n\n吸取前若自身處於異常狀態，則汲取對手等同於自身當前重量的體力值，且上述吸取體力改為汲取體力。",
  "gen2": "攻擊威力提升70%。\n使用技能後令對手進入麻痺狀態。\n對手使用攻擊技能時令對手最終攻擊/特攻值變為面板原始值的70%。",
  "god": "戰鬥中被視為異能精靈。\n自身存活條件不受當前體力限制。\n自身當前體力歸0時進入「神降」。",
  "thunder": "【自身為滿體力時】\n\n登場異能值消耗降低70%（特殊模式生效）。\n\n【自身不為滿體力時】\n\n若當前處於麻痺狀態且不小於7回合時自身使用技能不受PP值限制。\n體力每降低1%則雙攻值與雙防值在雙方計算傷害時額外提升1%，當回合戰鬥階段結束時失去該加成，最高70%。\n體力每降低1%則自身造成非真實傷害提升1%，最高70%。\n使用攻擊技能會以雙攻值總和視為當前攻擊/特攻值計算傷害。\n\n物理攻擊時恢復己方至少70點體力值，自身每增加1點體力，己方不在場精靈額外恢復1體力。\n特殊攻擊時令對手先制-1。\n\n【神降效果】\n\n令自身死亡時的體力下限不再為0，改為70乘以（-自身體力上限）為體力下限。\n自身恢復體力量降低100%，改為每次執行恢復體力效果時令自身增加等同於自身最大體力的70%。\n自身每次受到非真實傷害時免疫此傷害，並令扣除自身體力上限70%的體力值。\n自身每次受到真實傷害時，正常結算傷害。\n回合結束時若當回合未受到非真實傷害，則增加自身最大體力7%的體力值。\n並開始觸發上列效果，直到自身體力恢復為正數時結束神降。\n神降狀態下場後保留。",
  "skills": {
    "空墟赫星": "■ 先制+4\n■ 必中\n🎯 令對手全屬性+1，對手處於能力提升狀態則額外令對手全屬性+1\n🎯 吸取對手等同於自身本次造成技能傷害提升70%的體力值，先出手時效果翻倍，任一方處於能力提升狀態時變為3倍\n🎯 令對手7回合內攻擊技能威力為1/70（綁定對手）\n🎯 2回合內對手攻擊技能無效",
    "異境神霆": "■ 必中\n🎯 令對手全屬性+1，對手處於能力提升狀態則額外令對手全屬性+1\n🎯 1回合內對手受到技能傷害不小於300×電系/神秘系/電神秘系中克制倍數最高的值\n🎯 5回合內吸取對手最大體力½，吸取後未擊敗對手則回合結束時吸取對手最大體力⅓，前述效果造成百分比傷害時對手體力未減少/自身體力未增加則額外附加對手210點真實傷害\n🎯 令自身下2回合造成非真實傷害提升210%\n🎯 下2回合自身所有技能先制+3",
    "同塵祭": "■ 必中\n🎯 調整自身能力等級，令自身能力等級不會小於對手\n🎯 令自身體力歸1\n🎯 7回合內對手PP值消耗量為7倍\n🎯 對手每有1點重量，則失去1點體力上限與1點相應異能值，最多70",
    "天雷誅殺": "■ 先制+4\n■ 必中\n🎯 令對手全屬性+1，對手處於能力提升狀態則額外令對手全屬性+1\n🎯 出手時令對手本次受到非真實傷害提升70%，先出手時效果翻倍，處於能力提升狀態時變為3倍\n🎯 吸取對手70點體力\n🎯 2回合對手屬性技能無效",
    "霆·禁雷敕令": "■ 自身體力低於210則必定先手\n■ 自身處於麻痺狀態時轉化為威力210的攻擊技能且無視對手免疫效果，對手每擁有70點重量則攻擊威力額外提升70，攻擊類型為雙攻中較高者，兩者相同則效果失效，轉化技能屬性取電系/神秘系/神秘電系中克制倍數最高的值\n🎯 附加對手自身已損失體力70%的真實傷害，附加時若體力低於0則改為附加自身體力上限70%的真實傷害\n🎯 消除對手回合類效果，消除成功則下2回合受到傷害翻倍\n🎯 自身體力低於最大體力⅓時則造成技能傷害提升3倍\n🎯 未擊敗對手則下2回合自身所有技能先制+2"
  },
  "rulings": "1. 「雙方能力等級總和」取雙方全部能力等級的絕對值後相加。\n2. 「吸取對手等同於自身本次造成技能傷害提升70%的體力值」之基礎值為本次實際技能傷害的70%。\n3. 物理攻擊的自身恢復與場下隊友恢復同時執行。\n4. 依重量換算的數值一律捨去小數。\n5. 神降所述增加／扣除均為體力調整；包含體力增加在內，皆不屬於體力上限變更、恢復體力或傷害。\n6. 第五技能未轉化時，原屬性技能不會造成攻擊傷害，但附加效果仍生效；只有技能無效會使整個技能不生效，附加效果失效只阻止附加效果。轉化失敗分為「未滿足條件」及「固有效果失效」。轉化實作比照窒息異常將技能轉為撞擊的邏輯：建立一個物理及一個特殊的同效果隱藏技能，滿足條件時改為使用對應技能。"
} as const;

/** 只同步內建雷伊文字；保留配裝、能力值、技能槽、PP與自訂精靈。 */
export function syncOtherworldReyDescriptions<T extends Partial<Elf>>(elf: T): T {
  if (elf.isCustom || String(elf.id).startsWith('custom_') || String(elf.id) !== '5029') return elf;
  const syncSkills = (skills?: Skill[]) => skills?.map(s => {
    const description = OTHERWORLD_REY_TEXT.skills[s.name as keyof typeof OTHERWORLD_REY_TEXT.skills];
    return description ? { ...s, description } : s;
  });
  const original = elf.alienTraits || {};
  const exclusive = original.exclusiveTraits || [];
  const descriptions: Record<string, string> = { 神明: OTHERWORLD_REY_TEXT.god, 雷神: OTHERWORLD_REY_TEXT.thunder };
  return {
    ...elf,
    soulMark: { ...elf.soulMark, name: '異', effectType: elf.soulMark?.effectType || 'custom',
      effectValue: elf.soulMark?.effectValue ?? 0, description: OTHERWORLD_REY_TEXT.soul },
    alienTraits: {
      ...original,
      gen2Trait: { ...original.gen2Trait, name: '電氣纏繞', description: OTHERWORLD_REY_TEXT.gen2 },
      exclusiveTrait: original.exclusiveTrait && !/神明|雷神/.test(original.exclusiveTrait.name) ? original.exclusiveTrait : undefined,
      exclusiveTraits: [
        ...exclusive.filter(t => !descriptions[t.name]),
        ...Object.entries(descriptions).map(([name, description]) => ({ name, description })),
      ],
    },
    skills: syncSkills(elf.skills),
    skillPool: syncSkills(elf.skillPool),
  };
}
