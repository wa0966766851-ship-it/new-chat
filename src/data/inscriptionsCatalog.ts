import { Inscription } from "../types";

export const DEFAULT_MAX_INSCRIPTIONS: Inscription[] = [
  {
    id: "default_max_insc_1",
    name: "巔峰·極限全能 I",
    description: "賽爾號頂配預設刻印數值，提供極限的全能加成（單顆體150/攻75/特75/防60/特防60/速45）。",
    stats: { hp: 150, atk: 75, def: 60, spatk: 75, spdef: 60, speed: 45 }
  },
  {
    id: "default_max_insc_2",
    name: "巔峰·極限全能 II",
    description: "賽爾號頂配預設刻印數值，提供極限的全能加成（單顆體150/攻75/特75/防60/特防60/速45）。",
    stats: { hp: 150, atk: 75, def: 60, spatk: 75, spdef: 60, speed: 45 }
  },
  {
    id: "default_max_insc_3",
    name: "巔峰·極限全能 III",
    description: "賽爾號頂配預設刻印數值，提供極限的全能加成（單顆體150/攻75/特75/防60/特防60/速45）。",
    stats: { hp: 150, atk: 75, def: 60, spatk: 75, spdef: 60, speed: 45 }
  }
];

export function getDefaultInscriptions(): Inscription[] {
  return DEFAULT_MAX_INSCRIPTIONS.map(insc => ({
    ...insc,
    stats: { ...insc.stats }
  }));
}

export function getEffectiveInscriptions(inscriptions?: (Inscription | undefined)[]): Inscription[] {
  const defaults = getDefaultInscriptions();
  if (!inscriptions || inscriptions.length === 0) {
    return defaults;
  }
  const hasValidInsc = inscriptions.some(insc => insc && (insc.name || Object.values(insc.stats || {}).some(v => v !== 0)));
  if (!hasValidInsc) {
    return defaults;
  }
  return [
    inscriptions[0] || defaults[0],
    inscriptions[1] || defaults[1],
    inscriptions[2] || defaults[2]
  ];
}

export const INSCRIPTION_PRESETS: Inscription[] = [
  {
    id: "dianfeng_jixian",
    name: "巔峰·極限全能",
    description: "當前賽爾號頂配刻印最高數值（單顆體150/攻75/特75/防60/特防60/速45）。",
    stats: { hp: 150, atk: 75, def: 60, spatk: 75, spdef: 60, speed: 45 }
  },
  {
    id: "yanyue_wushuang",
    name: "偃月·無雙",
    description: "泰坦無雙系列刻印，極限攻擊與速度加成，適合主攻爆發型精靈。",
    stats: { hp: 80, atk: 40, def: 25, spatk: 0, spdef: 25, speed: 24 }
  },
  {
    id: "shengling_zhuanwu",
    name: "聖靈·王冠",
    description: "聖靈王之專屬巔峰刻印，兼具全面雙防與超高體力。",
    stats: { hp: 90, atk: 45, def: 30, spatk: 0, spdef: 30, speed: 26 }
  },
  {
    id: "pojun_kuangzhan",
    name: "破軍·狂戰",
    description: "破軍狂戰系列，大幅提升特攻或物理傷害與體力上限。",
    stats: { hp: 85, atk: 42, def: 25, spatk: 0, spdef: 25, speed: 25 }
  },
  {
    id: "jifeng_huanying",
    name: "疾風·幻影",
    description: "極速幻影專屬，提供高達30點的速度加成，搶占先手專用。",
    stats: { hp: 75, atk: 35, def: 25, spatk: 0, spdef: 25, speed: 30 }
  },
  {
    id: "jianbi_taitan",
    name: "堅壁·泰坦",
    description: "極限雙防與體力刻印，專為防守肉盾與消耗型精靈調校。",
    stats: { hp: 100, atk: 0, def: 40, spatk: 0, spdef: 40, speed: 18 }
  },
  {
    id: "zhuoyue_quanneng",
    name: "卓越·全能",
    description: "全能力均衡提升的通用刻印，兼顧輸出、速度與生存。",
    stats: { hp: 70, atk: 30, def: 30, spatk: 30, spdef: 30, speed: 22 }
  },
  {
    id: "hunshang_mori",
    name: "混沌·末日",
    description: "混沌魔神專屬刻印，散發著恐怖的毀滅氣息，頂級特攻/攻擊加成。",
    stats: { hp: 95, atk: 48, def: 28, spatk: 48, spdef: 28, speed: 27 }
  },
  {
    id: "xinghuang_zhuanwu",
    name: "瀚海·星皇",
    description: "瀚海界神專屬刻印，擁有無與倫比的海洋庇護與超高特攻。",
    stats: { hp: 92, atk: 0, def: 32, spatk: 45, spdef: 32, speed: 26 }
  },
  {
    id: "taitan_lingyv",
    name: "泰坦·領域",
    description: "泰坦星際領域結晶，提供破百的極限體力與超強抗禦力。",
    stats: { hp: 105, atk: 35, def: 35, spatk: 35, spdef: 35, speed: 20 }
  },
  {
    id: "liuren_qianghua",
    name: "強化",
    description: "六刃專屬刻印：自身技能傷害提升20%。",
    stats: { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 }
  }
];
