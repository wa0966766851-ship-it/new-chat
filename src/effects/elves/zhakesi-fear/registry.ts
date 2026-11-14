import {instantKillChance} from '../../../battle/instantKillChance';
import {recipientEffectChance} from '../../../battle/recipientEffectChance';
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from '../../types';

// 5025 魂印「懼」已遷移為真 Kit（src/data/migratedZhakesiFearSoulKit.ts；DSH 20261018 第十三批·第一波）——
// 舊 handler 整份空殼化（規則3.3：保留匯出名，函數體 return false）。
// 種下恐懼之種／層數成長與轉生為恐懼之花／滿體力害怕＋未觸發消除／每回合吸取全場體力上限／
// 戰鬥階段結束恢復與百分比反饋、全屬性-1／鎖切換分支，全部由 Kit 承擔：
//   maxhp_absorb_all／opp_active_swap／mark_program(fear_seed/fear_flower)／status／stat_clear／clear_turn／
//   heal{missingRatio}／pp_op／dmg_from_last／stat／no_switch；恐懼之種/花的讀取端在引擎
//   （traitsEngine 免疫害怕PP歸0、instantKillDisabled、contextBuilders 倍率、battleEngine 保底機率），
//   Kit 只負責寫印記（marks.effects）。
// 同檔 ZHAKESI_FEAR_SKILLS 四技已全部是 effectMode='kit' 的真 Kit（執行走 Kit，此處僅剩註冊表身分）；
// 本 handler 過去附帶的技能支援分支（skillFearTurns／nextAtkFixedDmgCount／damageBoostThisTurn／
// shieldBlockNextAtk／nextPriorityCount）自技能 Kit 化後即無任何寫入端，屬死碼，不隨魂印保留。
export const handleFearIncarnationSoulMark = (_ctx: any, _event: any, _extra?: any) => false;

export const ZHAKESI_FEAR_SKILLS: Record<string, BattleSkillHandler> = {
  "懼噬・恐源浸染": (ctx) => {
    const { self, actor, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const oppElf = ctx.target;
    addLog(`🦇 【懼噬・恐源浸染】：引爆恐怖源泉！`, "effect");

    const hasOppBuff = Object.values(oppElf.statStages || {}).some(v => (v as number) > 0);
    if (hasOppBuff) {
      addLog(`恢复自身全部體力！`, "heal");
      ctx.applyHeal(actor, self.maxHp);

      const oppStages = { ...oppElf.statStages };
      let inverted = false;
      for (const [k, v] of Object.entries(oppStages)) {
        if ((v as number) > 0) {
          oppStages[k as any] = -(v as number);
          inverted = true;
        }
      }
      if (inverted) {
        ctx.updateElf(oppSide, { id: oppElf.id, statStages: oppStages });
      } else {
        ctx.clearTurnEffectsOf(oppSide);
      }
    } else {
      const oppStages = { ...oppElf.statStages };
      for (const [k, v] of Object.entries(oppStages)) {
        if ((v as number) > 0) oppStages[k as any] = 0;
      }
      ctx.updateElf(oppSide, { id: oppElf.id, statStages: oppStages });
    }

    ctx.setOpponentState(`${oppSide}_noHealTurns`, 3); // 帶方位前綴才會被遞減
    ctx.setOpponentState("utilitySkillAddEffectInvalidTurns", 3);
  },

  "深淵凝視": (ctx) => {
    const { actor, addLog } = ctx;
    addLog(`🦇 【深淵凝視】：凝視無盡的恐懼深淵！`, "effect");

    ctx.setPlayerState(`${actor}_immuneAndReflectStatusTurns`, 5);
    ctx.setPlayerState("skillFearTurns", 3);
    ctx.setPlayerState("nextAtkFixedDmgCount", 3);
    // 下2次自身攻擊技能造成傷害提升150%（引擎讀取 attackDamageBoostCharges）
    ctx.setPlayerState("attackDamageBoostCharges", 2);
    ctx.setPlayerState("attackDamageBoostChargeRate", 1.5);
  },

  "幽幕折返": (ctx) => {
    const { self, actor, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const oppElf = ctx.target;
    addLog(`🦇 【幽幕折返】：遁入幽幕之中！`, "effect");

    ctx.setPlayerState(`${actor}_immuneAndReflectStatusCount`, 2);
    const isShenling = oppElf.type?.includes("神靈");
    const boost = isShenling ? 1 : 2;
    ctx.applyStatChange(actor, { atk: boost, def: boost, spatk: boost, spdef: boost, speed: boost, accuracy: boost });

    ctx.setPlayerState("drainHpTurns", 5);
    ctx.setOpponentState("next2AtkInvalid", 2);
    ctx.setOpponentState("attackInvalidSource", "幽幕折返");
    ctx.setPlayerState("nextTurnPriority", 2);
    ctx.setPlayerState("nextPriorityCount", 3);
    ctx.setPlayerState("ignoreSpDefCount", 3);
    ctx.setPlayerState("ignoreSpDefPercent", 0.6);
    ctx.setPlayerState("ignoreSpDefSource", "幽幕折返");
  },

  "劫數.萬念歸墟": (ctx) => {
    const { self, actor, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    addLog(`🦇 【劫數.萬念歸墟】：大劫降臨，萬物皆歸於虛無！`, "effect");

    const tryInstantKill = (chance: number, reason: string): boolean => {
      if(!instantKillChance(ctx,'skill:萬念歸墟',chance*100))return false;
      return ctx.applyInstantKill?.(oppSide,reason)===true;
    };

    const cleared = ctx.clearTurnEffectsOf(oppSide);
    if (cleared) {
      addLog(`消除對手回合類效果成功！令對手害怕！`, "status");
      ctx.applyStatusWithImmunityCheck(oppSide, "害怕", 1);
    } else {
      ctx.setPlayerState("damageBoostThisTurn", 1.5);
    }

    const oppElf = ctx.target;
    const drain = Math.floor(oppElf.maxHp / 3);
    ctx.applyTrueDamage(oppSide, drain, "萬念歸墟吸血");
    ctx.applyHeal(actor, drain);

    const fearRes = ctx.applyStatusWithImmunityCheck(oppSide, "害怕", 1);
    const oppHasFear = oppElf.effects?.some(e => e.name === "害怕");
    if (!fearRes.success || oppHasFear) {
      tryInstantKill(0.30, "萬念歸墟 30% 秒殺機率");
    }

    ctx.setPlayerState("shieldBlockNextAtk", true);
  }
};

export { ZhakesiFearDeconstructedProfile } from "../../../data/elfProfiles/zhakesiFearRegistry";
