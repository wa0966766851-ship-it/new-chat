// 5016 變革·馬爾修斯 魂印「械」通用件（DSH 20261019 第二十六批，最後一份 legacyWrapped）。
// 缺口：
//   ① mech_combo{mech}：設定目前組合的機甲（堅壁／極速／毀滅），以 registry 鍵記錄。
//   ② mech_combo_switch{from, to}：使用第五技能後切換組合（極速↔毀滅）。
//   ③ charge_consume_all_to_damage{perUnit, boostRatio}：消耗該技能所有充能值並依倍率汲取／提升傷害。
//   ④ archive_status_until_battle_end{}：解析並記錄受到的異常，直到戰鬥結束免疫該異常。
//   ⑤ consume_opponent_skill_charge{count}：消耗對手指定技能 1 點充能值。
import type { BattleEventContext } from '../../effects/types';
import { queueHpDrain } from '../../battle/hpDrain';
import {skillSlot} from '../../battle/skillSlot';
import type {RunState} from '../runtime';
import {canonicalStatusName} from '../../effects/statusIdentity';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');

export const MECH_ACTION_FIELDS: Record<string, readonly string[]> = {
  mech_combo: ['mech'],
  mech_combo_switch: ['from', 'to'],
  charge_consume_all_to_damage: ['perUnit', 'boostRatio'],
  archive_status_until_battle_end: [],
  archived_status_guard: [],
  archived_status_charge: [],
  consume_opponent_skill_charge: ['count', 'side'],
};

export function mechActionIssue(op: string, p: any): string | null {
  if (op === 'mech_combo') {
    if (!['堅壁', '極速', '毀滅'].includes(p.mech)) return '機甲組合需為堅壁／極速／毀滅';
    return null;
  }
  if (op === 'mech_combo_switch') {
    if (!['堅壁', '極速', '毀滅'].includes(p.from) || !['堅壁', '極速', '毀滅'].includes(p.to)) return '機甲切換需指定來源與目標機甲';
    return null;
  }
  if (op === 'charge_consume_all_to_damage') {
    if (!(p.perUnit > 0)) return '充能轉傷需正倍率';
    if (p.boostRatio !== undefined && !(p.boostRatio >= 0 && p.boostRatio <= 5)) return '充能轉傷的增傷比例需0至500%';
    return null;
  }
  if (op === 'archive_status_until_battle_end') return null;
  if (op === 'consume_opponent_skill_charge') {
    if (!Number.isInteger(p.count) || p.count < 1 || p.count > 10) return '消耗對手充能需1至10點';
    if(p.side!==undefined&&!['self','opp'].includes(p.side))return '所選充能消耗目標需自身或對手';
    return null;
  }
  return null;
}

export function mechOperations(helpers: { liveElf: (ctx: BattleEventContext, side: S) => any; runAct:(ctx:BattleEventContext,act:any,st:RunState)=>boolean }) {
  return {
    mech_combo: (ctx: BattleEventContext, p: any): boolean => {
      // 同時寫入 UI 契約鍵 marsMechaMode（既有狀態托盤讀取端依賴它顯示機甲名稱）。
      const modeKey = p.mech === '極速' ? 'speed' : p.mech === '毀滅' ? 'destroy' : 'wall';
      (ctx as any).setPlayerState?.('mechCombo', p.mech);
      (ctx as any).setPlayerState?.('marsMechaMode', modeKey);
      (ctx as any).addLog?.('⚙️ 機甲組合：' + p.mech, 'effect');
      return true;
    },
    mech_combo_switch: (ctx: BattleEventContext, p: any): boolean => {
      const cur = (ctx as any).getPlayerState?.('mechCombo');
      if (cur !== p.from) return false;
      const modeKey = p.to === '極速' ? 'speed' : p.to === '毀滅' ? 'destroy' : 'wall';
      (ctx as any).setPlayerState?.('mechCombo', p.to);
      (ctx as any).setPlayerState?.('marsMechaMode', modeKey);
      (ctx as any).addLog?.('⚙️ 機甲切換：' + p.from + ' → ' + p.to, 'effect');
      return true;
    },
    charge_consume_all_to_damage: (ctx: BattleEventContext, p: any,st:RunState): boolean => {
      const elf = helpers.liveElf(ctx, ctx.actor);
      if (!elf || !Array.isArray(elf.skills)) return false;
      if(!ctx.skill||ctx.skill.category==='屬性')return false;
      const slot=skillSlot(elf,ctx.skill);
      const sk=elf.skills[slot];
      if (!sk) return false;
      const used = Math.max(0, Number(sk.charge) || 0);
      if (used <= 0) return false;
      // 消耗該技能所有充能值
      (ctx as any).updateAnyElf?.(ctx.actor, idOf(elf), {
        skills: (elf.skills || []).map((s: any,index:number) => index === slot ? { ...s, charge: 0 } : s),
      });
      ctx.skill.charge=0;
      // 汲取對手等同於 perUnit×消耗值 的體力（以真實傷害結算後回復等量）
      const amount = Math.floor(used * p.perUnit);
      if (amount > 0) {
        // 走結算隊列（同舊 handler 的 queueHpDrain 路徑）：回執會產生 ON_DAMAGED receipt，
        // 且以「真實傷害」分類穿盾罩；等量恢復以實際結算量為準。
        queueHpDrain(ctx, ctx.targetSide, amount, 'true', '充能極限打擊');
      }
      if (p.boostRatio) {
        helpers.runAct(ctx,{ op: 'dmg_mod_turns', p: { side: 'self', dir: 'out', kind: '攻擊', boost: p.boostRatio, turns: 1 }, label: '充能增傷' },st);
      }
      return true;
    },
    // 第一種新異常每回合只解析一次；已解析異常的免疫不依賴新的解析額度。
    archive_status_until_battle_end: (ctx: BattleEventContext): boolean => {
      const data=(ctx as any).effectEventData;
      if(!data?.status||data.targetSide!==ctx.actor||data.prevented)return false;
      const status=canonicalStatusName(data.status),prev:string[]=[...(ctx.getPlayerState('mechArchivedStatuses')||[])];
      if(!prev.includes(status)){
        if(ctx.getPlayerState('statusArchiveRound')===ctx.roundNumber)return false;
        prev.push(status);ctx.setPlayerState('mechArchivedStatuses',[...prev]);
        ctx.setPlayerState('statusArchiveRound',ctx.roundNumber);
      }
      data.prevented=true;data.immunized=true;
      ctx.setMark({
        id: 'mechArchivedMark', name: '堅壁解析', displayChar: '析', unit: '道',
        scope:'elf',ownerBattleId:idOf(ctx.self),persistsOffField:true,clearable:false,
        count: prev.length, maxCount: 99, description: '已解析並記錄的異常：' + prev.join('、'),
      },ctx.actor);
      return true;
    },
    archived_status_guard:(ctx:BattleEventContext):boolean=>{
      const active=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2,data=(ctx as any).effectEventData;
      if(!data?.status||data.targetSide!==ctx.actor||data.prevented||idOf(active)===idOf(ctx.self))return false;
      const record:string[]=ctx.getPlayerState('mechArchivedStatuses')||[];
      if(!record.includes(canonicalStatusName(data.status)))return false;
      data.prevented=true;data.immunized=true;return true;
    },
    archived_status_charge:(ctx:BattleEventContext):boolean=>{
      const count=(ctx.getPlayerState('mechArchivedStatuses')||[]).length;
      const elf=ctx.getFullTeam(ctx.actor).find(e=>idOf(e)===idOf(ctx.self));
      if(!count||!elf)return false;
      ctx.updateAnyElf(ctx.actor,idOf(elf),{skills:elf.skills.map(s=>({...s,charge:Math.max(0,Number(s.charge)||0)+count}))});return true;
    },
    // 「消耗該技能1點充能值」預設消耗**自身**技能；side:'opp' 才是消耗對手。
    consume_opponent_skill_charge: (ctx: BattleEventContext, p: any): boolean => {
      const side: S = p.side === 'opp' ? ctx.targetSide : ctx.actor;
      const elf = helpers.liveElf(ctx, side);
      if (!elf || !Array.isArray(elf.skills)) return false;
      const selected=side===ctx.actor?ctx.skill:ctx.opponentSkill,slot=skillSlot(elf,selected);
      if(slot<0||!(Number(elf.skills[slot].charge)>=p.count))return false;
      const next=elf.skills.map((s:any,i:number)=>i===slot?{...s,charge:Number(s.charge)-p.count}:s);
      (ctx as any).updateAnyElf?.(side, idOf(elf), { skills: next });
      if(selected)selected.charge=next[slot].charge;
      return true;
    },
  };
}
