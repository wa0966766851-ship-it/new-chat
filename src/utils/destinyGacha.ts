import { Elf, BaseStats, Skill } from "../types";
import { calculateElfStats } from "./statCalculator";

export type DestinyRank = 'S' | 'A' | 'B' | 'C';

export interface DestinyInterceptorEffect {
  id: string;
  name: string;
  description: string;
  type: 'on_enter' | 'on_death';
  triggerLog: string;
}

export interface DestinyElfInstance extends Elf {
  destinyRank: DestinyRank;
  interceptorEffect?: DestinyInterceptorEffect;
  isBanned?: boolean;
  isPicked?: boolean;
  isStarter?: boolean;
  instanceId: string;
}

// 5大 C級專屬命運攔截特效
export const INTERCEPTOR_EFFECTS: Record<string, DestinyInterceptorEffect> = {
  block_attack: {
    id: "block_attack",
    name: "封技攔截",
    description: "登場時，釋放強大命運磁場，使對手當前精靈下 1 回合無法使用攻擊技能！",
    type: "on_enter",
    triggerLog: "🎡【命運攔截·封技】：強大的命運磁場籠罩戰場，封鎖了對手下回合的攻擊技！"
  },
  pp_chain: {
    id: "pp_chain",
    name: "時空枷鎖",
    description: "登場首回合，消耗對手所有技能 2 點 PP 上限與當前 PP！",
    type: "on_enter",
    triggerLog: "🎡【命運攔截·時空枷鎖】：時空扭曲！對手全體技能 PP 上限與當前值減少了 2 點！"
  },
  dirge_shield: {
    id: "dirge_shield",
    name: "悲歌護盾",
    description: "陣亡時，為我方下一隻出場精靈賦予等同於自身最大體力 80% 的精靈護罩，並免疫異常 2 回合！",
    type: "on_death",
    triggerLog: "🎡【命運攔截·悲歌護盾】：將餘暉化為精靈護罩！我方下一隻出戰精靈獲得巨額護罩與 2 回合不滅免控！"
  },
  soul_reaper: {
    id: "soul_reaper",
    name: "索魂同歸",
    description: "陣亡時，對擊殺自身的敵方精靈造成其最大體力 35% 的真實傷害，並使其先制-2 持續 3 回合！",
    type: "on_death",
    triggerLog: "🎡【命運攔截·索魂同歸】：與敵同歸！對敵方精靈造成最大體力 35% 的真實傷害並大幅扣減其先制！"
  },
  hero_blessing: {
    id: "hero_blessing",
    name: "英靈祝福",
    description: "陣亡時，化作英靈庇護，使我方全體存活精靈全屬性等級 +1，並恢復 30% 體力！",
    type: "on_death",
    triggerLog: "🎡【命運攔截·英靈祝福】：英靈不滅！我方隊伍全體存活精靈全屬性提升並恢復體力！"
  }
};

// 專門為命運之輪模式擴展的 C 級經典攔截卡（如果圖鑑中沒有，會作為抽卡補充包加入池中）
export const CLASSIC_INTERCEPTORS: Partial<Elf>[] = [
  {
    name: "六界神王",
    type: "光·次元",
    level: 100,
    baseStats: { hp: 175, atk: 135, def: 115, spatk: 70, spdef: 113, speed: 137 },
    soulMark: {
      name: "界",
      badgeChar: "界",
      description: "【光·次元】界神王魂印：回合開始若自身處於能力提升則免疫異常且攻擊傷害提升50%，否則戰鬥階段結束全屬性+1且下回合先制+2；攻擊時100%反饋當次傷害。每回合結束隨機領悟六大秘法：地葬(200護盾/護罩)、瀚海(200固傷/回血)、混沌(2技能PP歸零)、幻境(下回合必暴)、天玄(下回免疫>400傷害)、時空(下回先制+1)；領悟效果下場重置自身狀態與PP並清除對手技能記錄。被擊敗消除對手回合類效果並反轉強化為下降，同時令對手受等量致命傷真實傷害（場下生效）。",
      effectType: "none",
      effectValue: 0
    },
    skills: [
      { name: "界・裁決之劍", type: "光·次元", category: "物理", power: 85, pp: 20, priority: 3, description: "若自身能力下降則先制+1且必中；消強/消回合成功分別令對手失明/疲憊；反轉自身下降恢復1/3體力", effectType: "none", effectDetail: "" },
      { name: "禁靈領域", type: "無屬性", category: "屬性", power: 0, pp: 5, priority: 0, isSureHit: true, description: "全屬性+1(強化時翻倍)；4回合1/3回血固傷(低於1/2翻倍)；3回強化被消/吸則對手2回屬性失效", effectType: "none", effectDetail: "" },
      { name: "升臨恩澤", type: "無屬性", category: "屬性", power: 0, pp: 5, priority: 0, isSureHit: true, description: "5回合彈控；3回合200固傷(低於對手翻倍)；免疫下1次攻擊；下2回合先制+3", effectType: "none", effectDetail: "" },
      { name: "超界審判", type: "光·次元", category: "物理", power: 150, pp: 5, priority: 0, isSureHit: true, description: "下降狀態先制+3並反轉；對手2技能PP歸零；傷害+50%(強化時翻倍)", effectType: "none", effectDetail: "" },
      { name: "界·六神歸一", type: "光·次元", category: "物理", power: 160, pp: 5, priority: 0, isSureHit: true, isFifthSkill: true, description: "無視護盾效果；消回合成功疲憊(否則麻痺)；300護盾(後手翻倍)；300固傷(先手+100並回血)", effectType: "none", effectDetail: "" }
    ],
    path: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80"
  }
];

/**
 * 判定精靈在命運之輪模式中的稀有度等級 (S / A / B / C)
 */
export function getElfDestinyRank(elf: Elf): DestinyRank {
  if (elf.destinyRank) return elf.destinyRank;
  const name = elf.name || "";
  
  // S級·真神天花板
  const sRankNames = [
    "聖靈譜尼", "人皇·帝辛", "眾神之父·奧丁", "治癒.龍魂再臨 次元龍", 
    "混濁海妖.布林克克", "柯爾霍德", "聖光斯嘉麗", "變革·馬爾修斯",
    "次元龍", "星皇", "混沌魔君索倫森", "湮滅之主・咤克斯"
  ];
  if (sRankNames.some(n => name.includes(n))) return 'S';

  // A級·巔峰主力
  const aRankNames = [
    "鎮魂.巴弗洛", "冰魄·柯爾德", "混沌·布萊克", "蟲后·奧佩婭", 
    "誑獅魔軀.魔獅迪露", "星光·魯斯王", "星光·魔焰猩猩", "星光·麗莎布布", 
    "譜尼", "王·雷伊", "王·卡修斯", "王·布萊克", "王·蓋亞", "王·繆斯"
  ];
  if (aRankNames.some(n => name.includes(n))) return 'A';

  // 判斷 C 級攔截或經典老精靈
  const cRankNames = [
    "皮皮", "帝皇之盾", "天蓬元帥", "六界神王", "索比斯", "表哥", "八戒"
  ];
  if (cRankNames.some(n => name.includes(n))) return 'C';

  // 自訂或未記錄精靈根據屬性總值與權重判定
  const stats = elf.baseStats || { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 };
  const totalStats = stats.hp + stats.atk + stats.def + stats.spatk + stats.spdef + stats.speed;
  
  if (totalStats >= 730 || (elf.skills && elf.skills.length >= 6)) return 'S';
  if (totalStats >= 680 || (elf.skills && elf.skills.some(s => s.isFifthSkill))) return 'A';
  if (totalStats <= 600 || name === "雷伊" || name === "蓋亞" || name === "卡修斯" || name === "布萊克") return 'B';

  return 'B';
}

/**
 * 創建完整命運之輪卡池（包含所有傳入精靈 + 經典C級攔截卡）
 */
export function buildDestinyPool(allElves: Elf[], rng: () => number = Math.random): DestinyElfInstance[] {
  const pool: DestinyElfInstance[] = [];
  const safeElves = (allElves && Array.isArray(allElves)) ? allElves : [];

  // 將現有精靈轉換為 DestinyElfInstance
  safeElves.forEach((elf, idx) => {
    const rank = getElfDestinyRank(elf);
    const instance: DestinyElfInstance = {
      ...elf,
      destinyRank: rank,
      instanceId: `pool_${elf.id || idx}_${rng().toString(36).substring(2, 7)}`
    };

    // 如果是 C 級，為其綁定專屬命運攔截特效
    if (rank === 'C' && !instance.interceptorEffect) {
      const keys = Object.keys(INTERCEPTOR_EFFECTS);
      const randomKey = keys[Math.floor(rng() * keys.length)];
      instance.interceptorEffect = INTERCEPTOR_EFFECTS[randomKey];
    }

    pool.push(instance);
  });

  // 如果池子裡 C 級數量不足（例如不到 4 隻），自動補齊經典 C 級攔截卡
  const cCount = pool.filter(e => e.destinyRank === 'C').length;
  if (cCount < 6) {
    CLASSIC_INTERCEPTORS.forEach((classic, idx) => {
      const fullElf: Elf = {
        id: `classic_c_${idx}`,
        name: classic.name || "神秘攔截者",
        type: classic.type || "普通",
        level: 100,
        baseStats: classic.baseStats || { hp: 130, atk: 80, def: 110, spatk: 80, spdef: 110, speed: 90 },
        calculatedStats: classic.baseStats || { hp: 130, atk: 80, def: 110, spatk: 80, spdef: 110, speed: 90 },
        currentHp: classic.baseStats?.hp || 130,
        maxHp: classic.baseStats?.hp || 130,
        soulMark: classic.soulMark || { name: "截", description: "C級攔截", effectType: "none", effectValue: 0, badgeChar: "截" },
        skills: (classic.skills as Skill[]) || [],
        path: classic.path
      };
      
      const stats = calculateElfStats(fullElf.baseStats, 100);
      fullElf.calculatedStats = stats;
      fullElf.maxHp = stats.hp;
      fullElf.currentHp = stats.hp;

      const keys = Object.keys(INTERCEPTOR_EFFECTS);
      const effectKey = keys[idx % keys.length];

      pool.push({
        ...fullElf,
        destinyRank: 'C',
        interceptorEffect: INTERCEPTOR_EFFECTS[effectKey],
        instanceId: `classic_${idx}_${rng().toString(36).substring(2, 7)}`
      });
    });
  }

  // 如果 B 級較少，將部分雷伊蓋亞卡修斯強制設為 B 或 C 級攔截
  return pool;
}

/**
 * 執行 12 連抽（保底至少1隻S，3隻A，2隻C，其餘混合）
 */
export function shuffleDestiny<T>(items: T[], rng:()=>number = Math.random): T[] {
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
/** 至少1S＋3A＋2C，其餘混合；不足階級或不足12個不同精靈資料時不開局。 */
export function perform12Pull(allElves: Elf[], rng:()=>number = Math.random): DestinyElfInstance[] {
  return pullFromDestinyPool(buildDestinyPool(allElves,rng),rng);
}
/** 預覽與雙方抽卡共用已生成的模式效果；每方牌面仍有獨立實例身份。 */
export function pullFromDestinyPool(candidates: DestinyElfInstance[], rng:()=>number = Math.random, prefix='draw'): DestinyElfInstance[] {
  const pool=[...new Map(candidates.map(e=>[e.id||e.name,e])).values()];
  const selected: DestinyElfInstance[]=[]; const used=new Set<string>();
  for(const [rank,count] of [['S',1],['A',3],['C',2]] as const){
    const available=shuffleDestiny(pool.filter(e=>e.destinyRank===rank&&!used.has(e.id||e.name)),rng);
    if(available.length<count) throw new Error('卡池不足：需要至少1隻S、3隻A、2隻C及12隻不同精靈。');
    for(const elf of available.slice(0,count)){selected.push(elf);used.add(elf.id||elf.name);}
  }
  const rest=shuffleDestiny(pool.filter(e=>!used.has(e.id||e.name)),rng);
  if(rest.length<6) throw new Error('卡池不足12隻不同精靈，請擴充卡池後再試。');
  return shuffleDestiny([...selected,...rest.slice(0,6)],rng).map((elf,i)=>({...elf,instanceId:`${prefix}_${i}_${elf.instanceId}`}));
}

/**
 * 模擬 AI Ban 掉對手的 3 隻精靈
 * AI 策略：優先 Ban 掉對手的 S 級，其次 Ban 掉極度噁心的 C 級攔截（例如封技或索魂），再來是 A 級
 */
export function simulateAiBan(playerPool: DestinyElfInstance[], count: number = 3): string[] {
  const sortedForBan = [...playerPool].sort((a, b) => {
    // 權重估算
    const getBanWeight = (e: DestinyElfInstance) => {
      if (e.destinyRank === 'S') return 100 + (e.calculatedStats.hp || 0) * 0.1;
      // C 級封技與悲歌護盾在巔峰戰術威脅極大
      if (e.destinyRank === 'C' && e.interceptorEffect) {
        if (e.interceptorEffect.id === 'block_attack' || e.interceptorEffect.id === 'dirge_shield') return 85;
        return 65;
      }
      if (e.destinyRank === 'A') return 70;
      return 50;
    };
    return getBanWeight(b) - getBanWeight(a);
  });

  return sortedForBan.slice(0, count).map(e => e.instanceId);
}

/**
 * 模擬 AI 從剩下的 9 隻中，挑選 6 隻出戰陣容並決定首發
 */
export function simulateAiPick(aiPool: DestinyElfInstance[]): { pickedIds: string[]; starterId: string } {
  const available = aiPool.filter(e => !e.isBanned);
  
  // 優先挑選 S 級、強力 A 級與戰術 C 級
  const sortedForPick = [...available].sort((a, b) => {
    const getPickWeight = (e: DestinyElfInstance) => {
      if (e.destinyRank === 'S') return 100;
      if (e.destinyRank === 'C' && e.interceptorEffect) return 80; // AI 也愛用攔截卡！
      if (e.destinyRank === 'A') return 75;
      return 50;
    };
    return getPickWeight(b) - getPickWeight(a);
  });

  const picked = sortedForPick.slice(0, 6);
  const pickedIds = picked.map(e => e.instanceId);
  
  // AI 首發邏輯：喜歡把帶有【時空枷鎖】或【封技攔截】的 C 級攔截卡設為首發，或是直接出 S 級主神壓場！
  let starter = picked.find(e => e.destinyRank === 'C' && (e.interceptorEffect?.id === 'pp_chain' || e.interceptorEffect?.id === 'block_attack'));
  if (!starter) {
    starter = picked.find(e => e.destinyRank === 'S') || picked[0];
  }

  return {
    pickedIds,
    starterId: starter ? starter.instanceId : (pickedIds[0] || "")
  };
}
