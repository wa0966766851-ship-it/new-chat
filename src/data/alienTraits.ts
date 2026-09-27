export interface AlienTrait {
  name: string;
  description: string;
}

export const ALIEN_TRAITS: Record<string, AlienTrait> = {
  重傷: { name: "重傷", description: "30% 機率攻擊技能造成傷害翻倍" },
  絕命: { name: "絕命", description: "1% 機率附加 對方500 點固定傷害" },
  切割: { name: "切割", description: "3% 機率令對手 3 回合內每回合受到 50 點真實傷害" },
  守護: { name: "守護", description: "3% 機率受到技能傷害減半" },
  偷襲: { name: "偷襲", description: "3% 機率令本次攻擊先制 +1" },
  抵擋: { name: "抵擋", description: "3% 機率抵擋本次攻擊" },
  灼熱: { name: "灼熱", description: "對手處於燒傷狀態時，5% 機率威力翻倍" },
  霜襲: { name: "霜襲", description: "對手處於凍傷狀態時，5% 機率威力翻倍" },
  毒攻: { name: "毒攻", description: "對手處於中毒狀態時，5% 機率威力翻倍" },
  殘忍: { name: "殘忍", description: "對手處於麻痺狀態時，5% 機率威力翻倍" },
  恐懼: { name: "恐懼", description: "對手處於害怕狀態時，5% 機率威力翻倍" },
  困頓: { name: "困頓", description: "對手處於睡眠狀態時，5% 機率威力翻倍" },
  操控: { name: "操控", description: "對手處於疲憊狀態時，5% 機率威力翻倍" },
  落石: { name: "落石", description: "對手處於石化狀態時，5% 機率威力翻倍" },
  淨化: { name: "淨化", description: "對手受到非真實傷害時消除對方能力提升狀態" },
  灼燒: { name: "灼燒", description: "致命一擊時，5% 機率令對手進入燒傷狀態" },
  霜凍: { name: "霜凍", description: "致命一擊時，5% 機率令對手進入凍傷狀態" },
  毒傷: { name: "毒傷", description: "致命一擊時，5% 機率令對手進入中毒狀態" },
  麻痺: { name: "麻痺", description: "致命一擊時，5% 機率令對手進入麻痺狀態" },
  膽怯: { name: "膽怯", description: "致命一擊時，5% 機率令對手進入害怕狀態" },
  睡意: { name: "睡意", description: "致命一擊時，5% 機率令對手進入睡眠狀態" },
  疲憊: { name: "疲憊", description: "致命一擊時，5% 機率令對手進入疲憊狀態" },
  石化: { name: "石化", description: "致命一擊時，5% 機率令對手進入石化狀態" },
  強化: { name: "強化", description: "技能傷害提升 20%" },
};
