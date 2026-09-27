// src/tests/goldenScenarios.ts

export interface GoldenScenario {
  id: string;
  name: string;
  p1ElfName: string;
  p2ElfName: string;
  seed: number;
  maxTurns: number;
  p1Script: number[]; // 技能 index 序列
  p2Script: number[];
}

export const GOLDEN_SCENARIOS: GoldenScenario[] = [
  {
    id: "dimensional_dragon",
    name: "次元龍 vs 人皇·帝辛 (詩章/龍魂/死亡吸取)",
    p1ElfName: "治癒.龍魂再臨 次元龍",
    p2ElfName: "人皇·帝辛",
    seed: 10001,
    maxTurns: 10,
    p1Script: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
    p2Script: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
  },
  {
    id: "emperor_dixin",
    name: "人皇·帝辛 vs 誑獅魔軀 (八荒層數/誅魔天陣/九鼎)",
    p1ElfName: "人皇·帝辛",
    p2ElfName: "誑獅魔軀.魔獅迪露",
    seed: 10002,
    maxTurns: 10,
    p1Script: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2],
    p2Script: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
  },
  {
    id: "magic_lion",
    name: "誑獅魔軀 vs 聖靈譜尼 (必中系與保底傷害)",
    p1ElfName: "誑獅魔軀.魔獅迪露",
    p2ElfName: "聖靈譜尼",
    seed: 10003,
    maxTurns: 10,
    p1Script: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
    p2Script: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
  },
  {
    id: "holy_spirit",
    name: "聖靈譜尼 vs 聖光斯嘉麗 (輪迴重生、珀妮協同)",
    p1ElfName: "聖靈譜尼",
    p2ElfName: "聖光斯嘉麗",
    seed: 10004,
    maxTurns: 10,
    p1Script: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
    p2Script: [1, 2, 3, 0, 1, 2, 3, 0, 1, 2],
  },
  {
    id: "standard_long",
    name: "雷伊 vs 蓋亞 (基礎傷害/命中/切換長對局)",
    p1ElfName: "雷伊",
    p2ElfName: "蓋亞",
    seed: 10005,
    maxTurns: 10,
    p1Script: [0, 1, 0, 2, 0, 3, 0, 1, 0, 2],
    p2Script: [0, 1, 0, 2, 0, 3, 0, 1, 0, 2],
  },
];
