// 5019 眾神之父·奧丁 魂印「ᛏ」通用件（DSH 20261018 第二十五批）。
// 缺口：
//   ① duel_start{}：與對手當前在場精靈發起決鬥（直到任一方被擊敗前，雙方無法附加控制類異常與主動切換）。
//   ② rune_activate{slot, rune, effects}：選擇技能階段激活該技能的符文直到下場。
//   ③ rune_strip_reward{hpRatio, ppMode}：剝離激活符文時的獎勵（自身恢復全部PP＋增20%體力／對手失PP＋受20%真傷）。
//   ④ next_skill_prio{side, v, dmgMod}：下次所有技能先制±N並造成技能傷害±50%。
//   ⑤ pp_max_zero_highest{}：致死時保留1點但PP上限最高的技能PP上限歸0。
import type { BattleEventContext } from '../../effects/types';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');

export const ODIN_ACTION_FIELDS: Record<string, readonly string[]> = {
  rune_attach: ['side','slot','rune','withinRounds'],
  duel_start: [],
  rune_activate: ['slot', 'rune'],
  rune_strip_reward: ['hpRatio', 'ppMode'],
  next_skill_prio: ['side', 'v', 'dmgMod'],
  pp_max_zero_highest: [],
};

export function odinActionIssue(op: string, p: any): string | null {
  if(op==='rune_attach'){
    if(!['self','opp'].includes(p.side)||!Number.isInteger(p.slot)||p.slot<0||p.slot>4||typeof p.rune!=='string'||!p.rune||!Number.isInteger(p.withinRounds)||p.withinRounds<1)return '附加符文需敵我目標、0至4技能槽、符文及在場回合限制';
    return null;
  }
  if (op === 'duel_start') return null;
  if (op === 'rune_activate') {
    if (!Number.isInteger(p.slot) || p.slot < 0 || p.slot > 5) return '符文激活需0至5的技能位序';
    if (typeof p.rune !== 'string' || !p.rune) return '符文激活需符文名稱';
    return null;
  }
  if (op === 'rune_strip_reward') {
    if (!(p.hpRatio > 0 && p.hpRatio <= 1)) return '符文剝離獎勵需0至100%體力比例';
    if (!['restore', 'lose'].includes(p.ppMode)) return '符文剝離PP需指定恢復或失去';
    return null;
  }
  if (op === 'next_skill_prio') {
    if (!['self', 'opp'].includes(p.side)) return '下次技能先制需指定對象';
    if (!Number.isInteger(p.v) || p.v === 0) return '下次技能先制需非零整數';
    if (p.dmgMod !== undefined && !(p.dmgMod >= -1 && p.dmgMod <= 2)) return '下次技能傷害修正需-100%至200%';
    return null;
  }
  if (op === 'pp_max_zero_highest') return null;
  return null;
}

export function odinOperations(helpers: { liveElf: (ctx: BattleEventContext, side: S) => any }) {
  return {
    rune_attach:(ctx:BattleEventContext,p:any):boolean=>{
      const side:S=p.side==='opp'?ctx.targetSide:ctx.actor;
      const elf=helpers.liveElf(ctx,side);
      const holderCtx=side===ctx.actor?ctx:ctx.contextForElf?.(side,elf);
      const rounds=Number(holderCtx?.getPlayerState(`${side}_turnsInBattle`)??1);
      if(rounds>p.withinRounds||!elf?.skills?.[p.slot])return false;
      const sk=elf.skills[p.slot];
      if(sk.skillRune||sk.portableSkillMark||sk.specialBadge?.text?.includes('ᛏ'))return false;
      // 附加不等於激活；保留既有符文，不覆蓋另一來源的槽位。
      ctx.updateAnyElf(side,idOf(elf),{skills:elf.skills.map((s:any,i:number)=>i===p.slot?{...s,skillRune:p.rune,isRuneActive:false,specialBadge:{id:`slot_mark_${p.rune}`,text:p.rune,description:`【未激活】選擇該技能時激活 ${p.rune}`}}:s)});
      return true;
    },
    duel_start: (ctx: BattleEventContext): boolean => {
      (ctx as any).setPlayerState?.('duelActive', true);
      (ctx as any).setOpponentState?.('duelActive', true);
      (ctx as any).addLog?.('⚔️ 決鬥開始：任一方被擊敗前雙方無法附加控制類異常與主動切換', 'effect');
      return true;
    },
    rune_activate: (ctx: BattleEventContext, p: any): boolean => {
      const elf = helpers.liveElf(ctx, ctx.actor);
      if (!elf || !Array.isArray(elf.skills)) return false;
      const sk = elf.skills[p.slot];
      if (!sk) return false;
      (ctx as any).updateAnyElf?.(ctx.actor, idOf(elf), {
        skills: elf.skills.map((s: any, i: number) => i === p.slot ? { ...s, skillRune: p.rune, isRuneActive: true } : s),
      });
      return true;
    },
    rune_strip_reward: (ctx: BattleEventContext, p: any): boolean => {
      const isSelf = p.ppMode === 'restore';
      const side: S = isSelf ? ctx.actor : ctx.targetSide;
      const elf = helpers.liveElf(ctx, side);
      if (!elf) return false;
      if (isSelf) {
        (ctx as any).runAct?.({ op: 'pp_op', p: { side: 'self', mode: 'recover', amount: 99 }, label: '符文剝離·PP恢復' });
        const heal = Math.floor((Number(elf.maxHp) || 0) * p.hpRatio);
        if (heal > 0) (ctx as any).applyHeal?.(side, heal);
      } else {
        (ctx as any).runAct?.({ op: 'pp_op', p: { side: 'opp', mode: 'zero', amount: 0 }, label: '符文剝離·PP失去' });
        const dmg = Math.floor((Number(elf.maxHp) || 0) * p.hpRatio);
        if (dmg > 0) (ctx as any).applyTrueDamage?.(side, dmg, '符文剝離·真實傷害');
      }
      return true;
    },
    next_skill_prio: (ctx: BattleEventContext, p: any): boolean => {
      const side: S = p.side === 'self' ? ctx.actor : ctx.targetSide;
      (ctx as any).addTimerTo?.(side, {
        id: `next_skill_modifiers:${side}`, name: '下次技能先制' + (p.v > 0 ? '+' : '') + p.v,
        kind: 'use_counter', remaining: 1, tickAt: 'never', scope: 'elf', source: 'soulmark',
        // 使用後共同消耗，讓一次技能的每一段技能傷害都能讀到同一筆修正。
        // 減傷使用正式減傷欄位，不能以負的 increasePercent 代替。
        payload: { block: { prio: p.v,kind:'技能',
          ...(p.dmgMod>0?{dmgOut:p.dmgMod}:p.dmgMod<0?{dmgOutReduce:-p.dmgMod}:{}),
          trig:'self_after_use',once:true,body:[],sourceKind:'soul' } },
      }, false);
      return true;
    },
    pp_max_zero_highest: (ctx: BattleEventContext): boolean => {
      const elf = helpers.liveElf(ctx, ctx.targetSide);
      if (!elf || !Array.isArray(elf.skills)) return false;
      let best = -1, bestIdx = -1;
      elf.skills.forEach((s: any, i: number) => { const mx = Number(s.maxPp) || 0; if (mx > best) { best = mx; bestIdx = i; } });
      if (bestIdx < 0) return false;
      (ctx as any).updateAnyElf?.(ctx.targetSide, idOf(elf), {
        skills: elf.skills.map((s: any, i: number) => i === bestIdx ? { ...s, maxPp: 0 } : s),
      });
      return true;
    },
  };
}
