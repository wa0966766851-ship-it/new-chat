import { aiBan, aiPick } from './destinyDraftAi';
import { Elf } from "../types";
import { getElfDisplayRank } from "./elfDisplayRank";

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


/**
 * 判定精靈在命運之輪模式中的稀有度等級 (S / A / B / C)
 */
export function getElfDestinyRank(elf: Elf): DestinyRank {
  // 2026-10-18 使用者裁定後重構：分級唯一事實源＝getElfDisplayRank（此前兩版分叉——本版殘留
  // 「種族值≥730 或技能≥6 自動升 S」舊規則，導致悲歌.索比拉特／皮特薩拉羅（總和 735）被誤升 S、
  // 且缺「命運之輪 C 級專屬攔截→C」文本檢查，被 AI 反覆復原成錯誤結果。委託後兩版永遠一致，
  // 命運之輪卡池的 S/A/B/C 標籤與一般圖鑑同源。
  return getElfDisplayRank(elf);
}

/**
 * 創建完整命運之輪卡池（所有傳入精靈；不補入重複的經典卡）
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

  // 2026-10-31：不再補入舊版 classic_c_0（六界神王）。圖鑑已有 5031 六界神王，補卡 id 不同、
  // 去重（id||name）擋不住，12 連抽會出現兩張同名精靈。C 級不足時允許不足，由 pullFromDestinyPool 的
  // 「至少 2 隻 C」檢查擋下並提示，不以重複精靈湊數。

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
 * 模擬 AI Ban 掉對手的 3 隻精靈：威脅＝實戰價值（勝率資料＋等級先驗＋攔截）＋對 AI 池子的屬性剋制。
 */
export function simulateAiBan(playerPool: DestinyElfInstance[], count: number = 3, aiPool: DestinyElfInstance[] = []): string[] {
  // 2026-11-07：改為依實戰分數＋屬性對位（見 destinyDraftAi.ts）；傳入 AI 自己的池子時會禁掉最剋我方的精靈。
  return aiBan(playerPool, aiPool, count);
}

/**
 * 模擬 AI 從剩下的 9 隻中，挑選 6 隻出戰陣容並決定首發
 */
export function simulateAiPick(aiPool: DestinyElfInstance[], opponentPool: DestinyElfInstance[] = []): { pickedIds: string[]; starterId: string } {
  // 2026-11-07：改為依實戰分數、對對方剩餘精靈的剋制面、屬性多樣性挑選（見 destinyDraftAi.ts）。
  return aiPick(aiPool, opponentPool, 6);
}
