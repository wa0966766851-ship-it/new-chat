import { addDamageReduction } from '../battle/damageReduction';
import { getTypeMatchup } from "../utils/statCalculator";
import { BattleEventContext, EffectTiming, ElfDeconstructedProfile } from './types';
import { isControlAilment } from './ailmentEngine';
import { Elf, Skill } from '../types';
import { getMaxPp, clampSkillPp, hasAnyAbnormalStatus } from '../utils/battleHelpers';

export { OdinDeconstructedProfile } from "../data/elfProfiles/odinRegistry";

// 符文符號與樣式定義
export const ODIN_RUNES = {
  TIWAZ: { symbol: 'ᛏ', name: 'ᛏ', desc: '持有該符文者提升所有能力值20%但每次出戰時與對手當前在場精靈發起決鬥(下場後保留，上限1道)', color: 'text-amber-300', bg: 'bg-amber-950/90', border: 'border-amber-500/50' },
  ANSUZ: { symbol: 'ᚨ', name: 'ᚨ', desc: '激活後直到下場前持有者免疫所有異常狀態且每回合開始時將對手所處的弱化類異常延長至3回合', color: 'text-cyan-300', bg: 'bg-cyan-950/90', border: 'border-cyan-500/50' },
  ALGIZ: { symbol: 'ᛉ', name: 'ᛉ', desc: '激活後直到下場前對手能力提升效果失效且無法觸發場下精靈對場上精靈的效果', color: 'text-emerald-300', bg: 'bg-emerald-950/90', border: 'border-emerald-500/50' },
  RAIDO_GEBO: { symbol: 'ᚱᚷ', name: 'ᚱᚷ', desc: '激活後直到下場前持有者所有技能必定命中、強制執行命中效果且選擇技能時不受PP值限制', color: 'text-yellow-300', bg: 'bg-yellow-950/90', border: 'border-yellow-500/50' },
  EIHWAZ: { symbol: 'ᛇ', name: 'ᛇ', desc: '激活後令持有者的對手相同位置技能PP值上限與該技能相同，超出部分的PP值每有1點轉化為附加對手100點真實傷害', color: 'text-purple-300', bg: 'bg-purple-950/90', border: 'border-purple-500/50' },
  EHWAZ: { symbol: 'ᛖ', name: 'ᛖ', desc: '激活後直到下場前持有者的對手正先制效果無法高於先制+1且擊敗效果失效', color: 'text-indigo-300', bg: 'bg-indigo-950/90', border: 'border-indigo-500/50' },
  PERTHRO: { symbol: 'ᛈ', name: 'ᛈ', desc: '激活後直到下場前持有者每次選擇該技能轉化為使用自身技能中與對手所選擇使用技能相同位置技能', color: 'text-rose-300', bg: 'bg-rose-950/90', border: 'border-rose-500/50' },
  ISA: { symbol: 'ᛁ', name: 'ᛁ', desc: '激活後則直到下場前持有者此技能固有效果失效且造成非真實傷害減半', color: 'text-blue-300', bg: 'bg-blue-950/90', border: 'border-blue-500/50' },
  THURISAZ_HAGALAZ: { symbol: 'ᚦᚺ', name: 'ᚦᚺ', desc: '激活後則直到下場前持有者護盾與護罩附加效果失效且回合結束時受到等同於護盾與護罩總和20%的真實傷害', color: 'text-orange-300', bg: 'bg-orange-950/90', border: 'border-orange-500/50' },
  NAUTHIZ: { symbol: 'ᚾ', name: 'ᚾ', desc: '激活後則直到下場前持有者失去能力值20%', color: 'text-red-300', bg: 'bg-red-950/90', border: 'border-red-500/50' },
  JERA: { symbol: 'ᛃ', name: 'ᛃ', desc: '持有者無法觸發未擊敗對手時效果且對手每次使用技能時被對手吸取最大體力40%', color: 'text-stone-300', bg: 'bg-stone-950/90', border: 'border-stone-500/50' },
};

/**
 * 選擇技能階段點擊技能時，立刻激活符文
 */
export function activateRuneOnSkillSelect(elf: Elf, skillIndex: number, addLog?: (msg: string, type: string) => void) {
  if (!elf || !elf.skills || !elf.skills[skillIndex]) return;
  const sk = elf.skills[skillIndex];

  // 檢查是否包含符文
  const runeSymbol = sk.skillRune || sk.specialBadge?.text;
  if (!runeSymbol) return;

  if (!sk.isRuneActive) {
    sk.isRuneActive = true;
    const runeObj = Object.values(ODIN_RUNES).find(r => r.symbol === runeSymbol);
    if (runeObj) {
      sk.specialBadge = {
        id: sk.specialBadge?.id || `rune_${runeObj.symbol}`,
        text: runeObj.symbol,
        description: `【已激活】${runeObj.desc}`,
        color: runeObj.color,
        bg: runeObj.bg,
        border: runeObj.border,
        animate: 'animate-pulse ring-2 ring-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.5)]',
      };
      if (addLog) {
        addLog(`⚡ 【刻印共鳴】：【${elf.name}】選擇技能【${sk.name}】，激活了【${runeObj.symbol} ${runeObj.name}】符文！`, 'effect');
      }
    }
  }
}

/**
 * 魂印核心控制器：處理登場、回合開始/結束、技能選擇與下場剝離
 */
export function stripAllRunes(ctx: BattleEventContext) {
  const { actor, activeP1, activeP2, addLog, applyTrueDamage } = ctx;
  const isP1 = actor === 'p1';
  const selfElf = isP1 ? activeP1 : activeP2;
  const oppElf = isP1 ? activeP2 : activeP1;
  const oppActor = isP1 ? 'p2' : 'p1';

  // 剝離奧丁自身符文：恢復全部 PP，每剝離 1 道【已激活】符文直接增加 20% 最大體力
  let selfStrippedCount = 0;
  if (selfElf.skills) {
    selfElf.skills.forEach((sk) => {
      if (sk.specialBadge && (sk.specialBadge.id?.startsWith('rune_') || sk.skillRune)) {
        if (sk.isRuneActive) {
          selfStrippedCount++;
        }
        sk.isRuneActive = false;
        sk.specialBadge = undefined;
        sk.skillRune = undefined;
        sk.currentPp = getMaxPp(sk, selfElf);
        sk.pp = getMaxPp(sk, selfElf);
      }
    });
  }

  if (selfStrippedCount > 0) {
    const addHp = Math.floor((selfElf.maxHp || 1000) * 0.2 * selfStrippedCount);
    selfElf.currentHp = Math.min(selfElf.maxHp || 1000, selfElf.currentHp + addHp);
    addLog(`⚡ 【符文歸位】：剝離了 ${selfStrippedCount} 道激活狀態下的符文，恢復全部 PP 並直接增加了 ${addHp} 點體力值！`, 'heal');
  }

  // 剝離對手符文：失去全部 PP，每剝離 1 道【已激活】符文對手受到 20% 最大體力真實傷害
  let oppStrippedCount = 0;
  if (oppElf.skills) {
    oppElf.skills.forEach((sk) => {
      if (sk.specialBadge && (sk.specialBadge.id?.startsWith('opp_rune_') || sk.skillRune)) {
        if (sk.isRuneActive) {
          oppStrippedCount++;
        }
        sk.isRuneActive = false;
        sk.specialBadge = undefined;
        sk.skillRune = undefined;
        sk.currentPp = 0;
        sk.pp = 0;
      }
    });
  }

  if (oppStrippedCount > 0) {
    const oppMaxHp = oppElf.maxHp || 1000;
    const trueDmg = Math.floor(oppMaxHp * 0.2 * oppStrippedCount);
    
    // 致命傷害保留 1 點體力，但 PP 上限最高的技能 PP 上限歸 0
    if (oppElf.currentHp <= trueDmg) {
      oppElf.currentHp = 1;
      let highestPPIndex = 0;
      let highestPPVal = -1;
      oppElf.skills?.forEach((s, i) => {
        const maxP = getMaxPp(s, oppElf);
        if (maxP > highestPPVal) {
          highestPPVal = maxP;
          highestPPIndex = i;
        }
      });
      if (oppElf.skills?.[highestPPIndex]) {
        oppElf.skills[highestPPIndex].maxPp = 0;
        oppElf.skills[highestPPIndex].currentPp = 0;
        oppElf.skills[highestPPIndex].pp = 0;
      }
      addLog(`⚡ 【神罰沉淪】：對手受到 ${trueDmg} 點符文剝離致死傷害，保留 1 點體力！且招式【${oppElf.skills?.[highestPPIndex]?.name}】PP 上限歸 0！`, 'effect');
    } else {
      applyTrueDamage(oppActor, trueDmg, '符文剝離神罰');
      addLog(`⚡ 【神罰沉淪】：對手剝離 ${oppStrippedCount} 道詛咒，失去全部 PP 並受到 ${trueDmg} 點真實傷害！`, 'effect');
    }
  }

  return { selfStrippedCount, oppStrippedCount };
}

/** 所有能力值（攻擊、防禦、特攻、特防、速度）按比例調整 */
function scaleAllStats(elf: any, ratio: number) {
  const cs = elf?.calculatedStats;
  if (!cs) return;
  for (const k of ['atk', 'def', 'spatk', 'spdef', 'speed']) {
    if (typeof cs[k] === 'number') cs[k] = Math.max(1, Math.floor(cs[k] * ratio));
  }
}
/** ᛏ：持有者提升所有能力值20%（每隻精靈只套用一次） */
function applyTiwazStats(elf: any) {
  if (!elf || elf.tiwazStatApplied) return;
  elf.tiwazStatApplied = true;
  elf.hasTiwazRune = true;
  scaleAllStats(elf, 1.2);
}

export function handleOdinSoulMark(ctx: BattleEventContext, event: EffectTiming, extraData?: any) {
  const {
    actor,
    activeP1,
    activeP2,
    addLog,
    getPlayerState,
    setPlayerState,
    getOpponentState,
    setOpponentState,
    applyTrueDamage,
    applyPinkDamage,
  } = ctx;

  const p1Team = (ctx as any).p1Team;
  const p2Team = (ctx as any).p2Team;
  const isP1 = actor === 'p1';
  const selfElf = isP1 ? activeP1 : activeP2;
  const oppElf = isP1 ? activeP2 : activeP1;
  const oppActor = isP1 ? 'p2' : 'p1';
  const selfTeam = isP1 ? p1Team : p2Team;

  // 1. 登場時：為己方背包中末位精靈附加 ᛏ 符文 (順延機制) 與處理繼承激活狀態
  
  if (event === EffectTiming.MODIFY_PRIORITY) {
    const { priorityComp } = extraData || {};
    if (priorityComp) {
      if (getPlayerState('odin_next_priority_plus_2')) {
        priorityComp.bonus += 2;
      }
      if (getPlayerState('odin_next_priority_minus_2')) {
        priorityComp.bonus -= 2;
      }
    }
  }


  // 引擎傳入的 extraData 即 damageComp
  if (event === EffectTiming.BEFORE_DAMAGE) {
    const comp = extraData?.computation || extraData;
    if (comp && typeof comp.multiplier === 'number') {
      const isSkillDmg = String(comp.damageCategory).startsWith('skill');
      if (!comp.isIncoming) {
        // 自身造成技能傷害
        if (isSkillDmg && getPlayerState('odin_next_dmg_plus_50')) {
          comp.increasePercent += 0.5;
          setPlayerState('odin_next_dmg_plus_50', false);
        }
        const boostTurns = getPlayerState('odinSkillDmgBoostTurns') || 0;
        if (isSkillDmg && boostTurns > 0) {
          comp.increasePercent += getPlayerState('odinSkillDmgBoostRatio') || 1;
        }
        if (isSkillDmg && getPlayerState('odinAnsuzBoostThisTurn')) {
          comp.increasePercent += 0.75;
        }
      } else {
        // 受到對手技能傷害：對手「下次造成技能傷害降低50%」（「免疫下次受到的攻擊」改由引擎攻擊免疫處理）
        if (isSkillDmg && getOpponentState('odin_next_dmg_minus_50')) {
          addDamageReduction(comp, 0.5, false);
          setOpponentState('odin_next_dmg_minus_50', false);
        }
      }
    }
  }

  if (event === EffectTiming.ON_ENTRANCE) {
    const tiwazAppliedKey = `${actor}_odin_tiwaz_applied`;
    if (!getPlayerState(tiwazAppliedKey)) {
      setPlayerState(tiwazAppliedKey, true);

      // 為背包末位（向前順延）附加 ᛏ 符文
      if (selfTeam && selfTeam.length > 0) {
        for (let i = selfTeam.length - 1; i >= 0; i--) {
          const member = selfTeam[i];
          if (member && !(member as any).hasTiwazRune) {
            (member as any).hasTiwazRune = true;
            addLog(`⚡ 【眾神之父·奧丁】：為背包精靈【${member.name}】注入了【ᛏ】！`, 'effect');
            break;
          }
        }
      }
    }

    // 檢查登場者是否持有 ᛏ 符文或為奧丁 -> 觸發決鬥與全能力 +20%
    if ((selfElf as any).hasTiwazRune || selfElf.name.includes("奧丁")) {
      applyTiwazStats(selfElf);
      setPlayerState('duelActive', true);
      setOpponentState('duelActive', true);

      ctx.setMark({
        id: 'tiwaz_rune',
        name: 'ᛏ 戰神符文',
        count: 1,
        displayChar: 'ᛏ',
        ownerBattleId: selfElf.battleId || selfElf.id,
        description: 'ᛏ 符文：提升所有能力值 20%，每次出戰時與對手發起決鬥（下場後保留）'
      }, actor);

      addLog(`⚡ 【神聖決鬥】：【${selfElf.name}】帶著【ᛏ】降臨！神聖決鬥戰場展開！`, 'effect');
    }

    // 檢查是否有「諸神黃昏」被擊敗後繼承相同位置符文激活狀態
    const inheritRuneActivePositions = getPlayerState(`${actor}_inherit_rune_active_positions`);
    if (inheritRuneActivePositions && Array.isArray(inheritRuneActivePositions) && selfElf.skills) {
      inheritRuneActivePositions.forEach((posIdx: number) => {
        if (selfElf.skills[posIdx]) {
          selfElf.skills[posIdx].isRuneActive = true;
          addLog(`⚡ 【諸神黃昏餘韻】：【${selfElf.name}】繼承了第 ${posIdx + 1} 招式的符文激活狀態！`, 'effect');
        }
      });
      setPlayerState(`${actor}_inherit_rune_active_positions`, undefined);
    }
  }

  // 2. 回合開始時：判斷在場回合數 <= 2，分別為雙方技能 1~5 位附加符文
  if (event === EffectTiming.ROUND_START || event === EffectTiming.BEFORE_ACTION) {
    const selfTurns = getPlayerState(`${actor}_turnsInBattle`) || 1;
    const oppTurns = getOpponentState(`${oppActor}_turnsInBattle`) || 1;

    // 檢查擊敗對手繼承激活狀態標記
    const killInheritActive = getPlayerState(`${oppActor}_odin_kill_inherit_rune_active`);

    // (A) 奧丁在場 <= 2 回合：為自身技能 1~5 位附加 ᚨ, ᛉ, ᚱᚷ, ᛇ, ᛖ
    if (selfTurns <= 2 && selfElf.skills) {
      const selfRunes = [ODIN_RUNES.ANSUZ, ODIN_RUNES.ALGIZ, ODIN_RUNES.RAIDO_GEBO, ODIN_RUNES.EIHWAZ, ODIN_RUNES.EHWAZ];
      selfElf.skills.forEach((sk, idx) => {
        if (idx < 5 && !sk.skillRune && (!sk.specialBadge || !sk.specialBadge.text.includes('ᛏ'))) {
          const r = selfRunes[idx];
          sk.skillRune = r.symbol;
          if (sk.isRuneActive === undefined) sk.isRuneActive = false;
          sk.specialBadge = {
            id: `rune_${r.symbol}`,
            text: r.symbol,
            description: sk.isRuneActive ? `【已激活】${r.desc}` : `【未激活】選擇該技能時激活：${r.desc}`,
            color: sk.isRuneActive ? r.color : 'text-slate-400',
            bg: sk.isRuneActive ? r.bg : 'bg-slate-900/90',
            border: sk.isRuneActive ? r.border : 'border-slate-700/60',
            animate: sk.isRuneActive ? 'animate-pulse ring-1 ring-amber-400/50' : ''
          };
        }
      });
    }

    // (B) 對手在場 <= 2 回合：為對手技能 1~5 位附加 ᛈ, ᛁ, ᚦᚺ, ᚾ, ᛃ
    if (oppTurns <= 2 && oppElf.skills) {
      const oppRunes = [ODIN_RUNES.PERTHRO, ODIN_RUNES.ISA, ODIN_RUNES.THURISAZ_HAGALAZ, ODIN_RUNES.NAUTHIZ, ODIN_RUNES.JERA];
      oppElf.skills.forEach((sk, idx) => {
        if (idx < 5 && !sk.skillRune && (!sk.specialBadge || !sk.specialBadge.text.includes('ᛏ'))) {
          const r = oppRunes[idx];
          sk.skillRune = r.symbol;
          if (sk.isRuneActive === undefined) sk.isRuneActive = killInheritActive ? true : false;
          sk.specialBadge = {
            id: `opp_rune_${r.symbol}`,
            text: r.symbol,
            description: sk.isRuneActive ? `【已激活】${r.desc}` : `【未激活】選擇該技能時激活：${r.desc}`,
            color: sk.isRuneActive ? r.color : 'text-slate-400',
            bg: sk.isRuneActive ? r.bg : 'bg-slate-900/90',
            border: sk.isRuneActive ? r.border : 'border-slate-700/60',
            animate: sk.isRuneActive ? 'animate-pulse ring-1 ring-rose-400/50' : ''
          };
        }
      });
    }

    // 技能符文是掛在技能格上的資料，不是精靈印記；變更後必須送出新的技能陣列，
    // 否則同步狀態雖已更新，React 畫面不會重繪 specialBadge。
    if (selfElf.skills) {
      ctx.updateElf(actor, { id: selfElf.id, skills: selfElf.skills.map(skill => ({
        ...skill,
        specialBadge: skill.specialBadge ? { ...skill.specialBadge } : undefined,
      })) });
    }
    if (oppElf.skills) {
      ctx.updateElf(oppActor, { id: oppElf.id, skills: oppElf.skills.map(skill => ({
        ...skill,
        specialBadge: skill.specialBadge ? { ...skill.specialBadge } : undefined,
      })) });
    }
  }

  // 3. 技能使用時 (BEFORE_SKILL)：處理 ᛇ 差額傷害與其他即時效果
  if (event === EffectTiming.BEFORE_SKILL) {
    const selectedSkillIdx = extraData?.skillIndex ?? 0;
    
    // ᛇ 符文 (第 4 招 ᛇ)：激活後令對手同位置技能 (第4招) PP 上限同步，超出差值 * 100 真傷
    if (selectedSkillIdx === 3 && selfElf.skills?.[3]?.isRuneActive && oppElf.skills?.[3]) {
      const selfMaxPP = getMaxPp(selfElf.skills[3], selfElf);
      const oppSkill = oppElf.skills[3];
      const oppOldMaxPP = getMaxPp(oppSkill, oppElf);

      if (oppOldMaxPP > selfMaxPP) {
        const diff = oppOldMaxPP - selfMaxPP;
        oppSkill.maxPp = selfMaxPP;
        if ((oppSkill.currentPp ?? oppSkill.pp) > selfMaxPP) {
          oppSkill.currentPp = selfMaxPP;
          oppSkill.pp = selfMaxPP;
        }
        const dmg = diff * 100;
        applyTrueDamage(oppActor, dmg, 'ᛇ');
        addLog(`⚡ 【ᛇ】：對手第 4 招 PP 上限由 ${oppOldMaxPP} 降至 ${selfMaxPP}！扣除 ${diff} 點差值，轉換為 ${dmg} 點真實傷害！`, 'effect');
      }
    }
  }

  // 使用技能後：「下次」先制加成已用掉
  if (event === EffectTiming.AFTER_ACTION) {
    if (getPlayerState('odin_next_priority_plus_2')) setPlayerState('odin_next_priority_plus_2', false);
    if (getPlayerState('odinAnsuzBoostThisTurn')) setPlayerState('odinAnsuzBoostThisTurn', false);
  }

  if (event === EffectTiming.ROUND_END) {
    // 狂信後續：下次（對手處於）異常的回合結束時 → 消除信仰對象、附加ᛏ符文、降低能力值30%
    if (getOpponentState('odinFanaticFollowup') && oppElf && hasAnyAbnormalStatus(oppElf)) {
      setOpponentState('odinFanaticFollowup', false);
      (oppElf as any).faithTarget = undefined;
      ctx.setMark({
        id: 'tiwaz_rune',
        name: 'ᛏ 戰神符文',
        count: 1,
        displayChar: 'ᛏ',
        ownerBattleId: oppElf.battleId || oppElf.id,
        description: 'ᛏ 符文：提升所有能力值 20%，每次出戰時與對手發起決鬥（下場後保留）'
      }, oppActor);
      applyTiwazStats(oppElf);
      scaleAllStats(oppElf, 0.7);
      addLog(`⚡ 【ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ】：消除【${oppElf.name}】的信仰對象，附加【ᛏ】符文，並降低其能力值 30%！`, 'effect');
    }
    const t = getPlayerState('odinSkillDmgBoostTurns') || 0;
    if (t > 0) setPlayerState('odinSkillDmgBoostTurns', t - 1);
    if (getPlayerState('odinHuginClearAtRoundEnd')) {
      setPlayerState('odinHuginClearAtRoundEnd', false);
      if (ctx.clearTurnEffectsOf(oppActor)) addLog(`⚡ 【ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ】：臣服未觸發，回合結束時消除對手回合類效果！`, 'effect');
    }
  }

  // 4. 回合結束時：恢復最大體力 ⅓ 併附加對手等量百分比傷害，以及體力高低判定先制與增減傷
  if (event === EffectTiming.ROUND_END && selfElf && selfElf.currentHp > 0) {
    const maxHp = selfElf.maxHp || 1000;
    const healAmt = Math.floor(maxHp / 3);
    const selfCurHpBefore = selfElf.currentHp;
    const oppCurHp = oppElf.currentHp;

    // 回復前比較體力
    const isSelfLowerBefore = selfCurHpBefore < oppCurHp;

    // 執行恢復與百分比傷害
    ctx.applyHeal(actor, healAmt);
    applyPinkDamage(oppActor, healAmt, '世界樹之息');
    addLog(`🌿 【世界樹之息】：奧丁恢復了 ${healAmt} 點體力，並附帶對手 ${healAmt} 點百分比傷害！`, 'heal');

    const selfCurHpAfter = selfElf.currentHp;
    // 恢復後比較體力
    const isSelfHigherAfter = selfCurHpAfter > oppElf.currentHp;

    if (isSelfLowerBefore) {
      // 下次對手所有技能先制-2（通用 priorityBoost：本回合結束後剩 1 → 下回合生效）
      setOpponentState('priorityBoostTurns', 2);
      setOpponentState('priorityBoostValue', -2);
      setOpponentState('priorityBoostAttackOnly', false);
      setOpponentState('odin_next_dmg_minus_50', true);
      addLog(`⚡ 【神威俯瞰】：恢復前體力低於對手！下次對手所有技能先制 -2 且傷害降低 50%！`, 'effect');
    }

    if (isSelfHigherAfter) {
      setPlayerState('odin_next_priority_plus_2', true);
      setPlayerState('odin_next_dmg_plus_50', true);
      addLog(`👑 【主神之怒】：恢復後體力高於對手！下次奧丁所有技能先制 +2 且傷害提升 50%！`, 'effect');
    }
  }

  // 5. 下場/被擊敗階段：符文剝離與 PP/體力結算
  if (event === EffectTiming.ON_SWITCH_OUT || event === EffectTiming.DEATH_NODE_1) {
    // 記錄下場時己方處於激活狀態的符文位置（供被擊敗繼承）
    if (event === EffectTiming.DEATH_NODE_1 && selfElf.skills) {
      const activePositions: number[] = [];
      selfElf.skills.forEach((s, idx) => {
        if (s.isRuneActive) activePositions.push(idx);
      });
      if (activePositions.length > 0) {
        setPlayerState(`${actor}_inherit_rune_active_positions`, activePositions);
      }
    }

    stripAllRunes(ctx);
  }

  return false;
}

export const odinSkillRegistry: Record<string, (ctx: BattleEventContext) => void> = {
  'ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ': (ctx) => {
    const { actor, addLog, applyStatusWithImmunityCheck, applySkillTypeDamage, setPlayerState, setOpponentState } = ctx;
    const oppSide = actor === 'p1' ? 'p2' : 'p1';
    const oppElf = oppSide === 'p1' ? ctx.activeP1 : ctx.activeP2;

    // 🎯 100%令對手臣服，未觸發則回合結束時消除對手回合類效果
    const subRes = applyStatusWithImmunityCheck(oppSide, '臣服', 3);
    if (!subRes?.success) {
      setPlayerState('odinHuginClearAtRoundEnd', true);
      addLog(`⚡ 【ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ】：臣服未觸發，回合結束時將消除對手回合類效果！`, 'effect');
    }

    // 🎯 100%令對手狂信，觸發成功則下次異常回合結束時消除對手信仰對象並附加對手ᛏ符文並於附加後降低對手能力值30%
    const fanRes = applyStatusWithImmunityCheck(oppSide, '狂信', 3);
    if (fanRes?.success) setOpponentState('odinFanaticFollowup', true);

    // 🎯 3回合內自身造成技能傷害提升100%，在場雙方每存在一個無法主動切換精靈效果則額外提升50%
    const lockCount = ((ctx.getPlayerState('noSwitchTurns') || ctx.getPlayerState(`${actor}_noSwitchTurns`) || 0) > 0 ? 1 : 0)
      + ((ctx.getOpponentState('noSwitchTurns') || ctx.getOpponentState(`${oppSide}_noSwitchTurns`) || 0) > 0 ? 1 : 0);
    setPlayerState('odinSkillDmgBoostTurns', 3);
    setPlayerState('odinSkillDmgBoostRatio', 1 + 0.5 * lockCount);
    addLog(`⚡ 【ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ】：3 回合內自身造成技能傷害提升 ${100 + 50 * lockCount}%！`, 'effect');

    // 🎯 直接附加對手300點遠古系技能傷害，若造成技能傷害為微弱則下2回合對手無法主動切換精靈
    applySkillTypeDamage(oppSide, 300, 'ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ·遠古系技能傷害', { elem: '遠古', node: 'attack_damage' });
    if (oppElf?.type && getTypeMatchup('遠古', oppElf.type) < 1) {
      setOpponentState('noSwitchTurns', 3); // 本回合結束後剩 2 → 下2回合
      addLog(`⚡ 【ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ】：技能傷害為微弱，下 2 回合對手無法主動切換精靈！`, 'effect');
    }
  },

  'ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ': (ctx) => {
    const { actor, addLog, applyStatusWithImmunityCheck, clearTurnEffectsOf, applyStatChange, applyHeal, getStatuses } = ctx;
    const oppSide = actor === 'p1' ? 'p2' : 'p1';

    // 🎯 免疫下次受到的攻擊（攻擊免疫・次數型，引擎於命中判定時處理）
    ctx.setPlayerState('blockAttackCount', (ctx.getPlayerState('blockAttackCount') || 0) + 1);
    addLog(`🛡️ 【ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ】：免疫下次受到的攻擊！`, 'effect');

    // 🎯 消除對手回合類效果，消除成功則100%令對手臣服，未觸發則2回合內對手無法主動切換精靈
    const cleared = clearTurnEffectsOf(oppSide);
    const subRes = cleared ? applyStatusWithImmunityCheck(oppSide, '臣服', 3) : null;
    if (!subRes?.success) {
      ctx.setOpponentState('noSwitchTurns', 2);
      addLog(`⚡ 【ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ】：臣服未觸發，2 回合內對手無法主動切換精靈！`, 'effect');
    }

    // 🎯 使自身攻擊、速度、命中+1，對手雙攻、雙防、速度-1，執行後任一項未觸發或均觸發則吸取對手最大體力20%
    applyStatChange(actor, { atk: 1, speed: 1, accuracy: 1 });
    applyStatChange(oppSide, { atk: -1, spatk: -1, def: -1, spdef: -1, speed: -1 });
    const oppMaxHp = (oppSide === 'p1' ? ctx.activeP1 : ctx.activeP2).maxHp || 1000;
    const absorbAmt = Math.floor(oppMaxHp * 0.2);
    ctx.applyTrueDamage(oppSide, absorbAmt, 'ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ·吸取');
    applyHeal(actor, absorbAmt);

    // 🎯 場上存在異常狀態時，當回合造成技能傷害提升75%（■ 無視免疫攻擊由引擎 attackImmunity 處理）
    const hasAbn = Object.keys(getStatuses(ctx.activeP1) || {}).length > 0 || Object.keys(getStatuses(ctx.activeP2) || {}).length > 0;
    if (hasAbn) ctx.setPlayerState('odinAnsuzBoostThisTurn', true);
  },

  'ᚷᚢᚾᚷᚾᛁᚱ ᚦᚱᛖᚢᛗᚨᛞᚱ': (ctx) => {
    const { actor, applyStatusWithImmunityCheck, applyHeal, applyStatChange, addLog } = ctx;
    const oppSide = actor === 'p1' ? 'p2' : 'p1';
    const selfElf = actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
    const oppElf = actor === 'p1' ? ctx.activeP2 : ctx.activeP1;

    // 1. 解除自身能力下降狀態，解除成功則恢復自身全部體力
    const selfStages = selfElf.statStages || { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
    const negativeChanges: Record<string, number> = {};
    let hasNegative = false;
    const statKeys = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'] as const;
    statKeys.forEach(k => {
      const v = selfStages[k] || 0;
      if (v < 0) {
        negativeChanges[k] = -v;
        hasNegative = true;
      }
    });

    if (hasNegative) {
      applyStatChange(actor, negativeChanges);
      applyHeal(actor, selfElf.maxHp || 1000);
      addLog(`⚡ 【岡格尼爾】：解除自身能力下降狀態成功，恢復自身全部體力！`, 'heal');
    }

    // 2. 消除對手能力提升狀態，消除成功則100%令對手害怕
    const oppStages = oppElf.statStages || { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
    const positiveChanges: Record<string, number> = {};
    let hasPositive = false;
    statKeys.forEach(k => {
      const v = oppStages[k] || 0;
      if (v > 0) {
        positiveChanges[k] = -v;
        hasPositive = true;
      }
    });

    if (hasPositive) {
      applyStatChange(oppSide, positiveChanges);
      applyStatusWithImmunityCheck(oppSide, '害怕', 3);
      addLog(`⚡ 【岡格尼爾】：消除對手能力提升狀態成功，令對手害怕！`, 'effect');
    }

    // 3. 吸取對手最大體力¼，自身體力低於最大體力½時吸取效果翻倍
    const oppMaxHp = oppElf.maxHp || 1000;
    const ratio = selfElf.currentHp < (selfElf.maxHp || 1000) / 2 ? 0.5 : 0.25;
    const absorbAmt = Math.floor(oppMaxHp * ratio);
    ctx.applyTrueDamage(oppSide, absorbAmt, '岡格尼爾吸取');
    applyHeal(actor, absorbAmt);
  },

  'ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ': (ctx) => {
    const { actor, addLog, applyStatChange, setPlayerState, setOpponentState } = ctx;
    const oppSide = actor === 'p1' ? 'p2' : 'p1';
    const selfElf = actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
    const oppElf = actor === 'p1' ? ctx.activeP2 : ctx.activeP1;

    const boost = selfElf.currentHp > oppElf.currentHp ? 2 : 1;
    applyStatChange(actor, { atk: boost, def: boost, spAtk: boost, spDef: boost, spd: boost, accuracy: boost });

    setPlayerState(`${actor}_yggdrasilAbsorbTurns`, 5);
    setOpponentState(`${oppSide}_noHealTurns`, 2);
    setPlayerState(`${actor}_nextSkillsPriorityBonus`, 2);
    addLog(`🌿 【世界樹恩澤】：奧丁全屬性 +${boost}！開啟 5 回合吸取與 2 回合先制 +2！`, 'effect');
  },

  'ᚱᚨᚷᚾᚨᚱᛟᚲ': (ctx) => {
    const { actor, activeP1, activeP2, addLog, clearTurnEffectsOf, setPlayerState } = ctx;
    const oppSide = actor === 'p1' ? 'p2' : 'p1';
    const selfElf = actor === 'p1' ? activeP1 : activeP2;

    // 1. 場上每激活 2 種符文，當回合先制 +1
    let activeRuneCount = 0;
    [activeP1, activeP2].forEach(elf => {
      elf.skills?.forEach(s => {
        if (s.isRuneActive) activeRuneCount++;
      });
    });
    const priorityBonus = Math.floor(activeRuneCount / 2);
    if (priorityBonus > 0) {
      setPlayerState(`${actor}_nextSkillsPriorityBonus`, priorityBonus);
      addLog(`⚡ 【諸神黃昏】：場上激活了 ${activeRuneCount} 道符文，當回合先制 +${priorityBonus}！`, 'effect');
    }

    // 2. 剝離雙方當前所有符文
    stripAllRunes(ctx);

    // 3. 為自身重新附加 ᛏ 符文
    ctx.setMark({
      id: 'tiwaz_rune',
      name: 'ᛏ 戰神符文',
      count: 1,
      displayChar: 'ᛏ',
      ownerBattleId: selfElf.battleId || selfElf.id,
      description: 'ᛏ 符文：提升所有能力值 20%，每次出戰時與對手發起決鬥（下場後保留）'
    }, actor);
    applyTiwazStats(selfElf);

    // 4. 消除雙方能力上升、下降狀態、護盾、護罩、次數類效果與當前在場回合數紀錄
    clearTurnEffectsOf(actor);
    clearTurnEffectsOf(oppSide);
    setPlayerState(`${actor}_turnsInBattle`, 1);
    ctx.setOpponentState(`${oppSide}_turnsInBattle`, 1);

    // 5. 設置擊敗/被擊敗繼承標記
    setPlayerState(`${actor}_odin_kill_inherit_rune_active`, true);

    addLog(`🌋 【諸神黃昏】：引爆全場符文！洗滌雙方所有狀態與回合數，奧丁重新注入【ᛏ 戰神符文】！`, 'effect');
  }
};

export const ODIN_SKILLS: Record<string, (ctx: BattleEventContext) => void> = odinSkillRegistry;
