import type { Act } from '../blocks/model';
/** 只處理顯示：不改儲存label、PRD鍵或執行參數。已有人工名稱完整保留。 */
export function sequenceActionLabel(a: Act, triggerLabels: Record<string, string> = {}): string {
  if (a.label && a.label !== a.op) return a.label;
  const p = a.p || {}, side = p.side === 'opp' ? '對手' : p.side === 'both' ? '雙方' : '自身';
  const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;
  const amount = p.flat ?? p.amount;
  const base = String(p.base || '最大體力').replace(/^stat:/, '');
  switch (a.op) {
    case 'no_heal':return `${p.next?'下':'當回合起'}${p.turns}回合對手${p.scope==='own_skill'?'無法通過自身技能回復（不封藥劑／魂印）':'無法回復體力'}`;
    case 'stop_status_tick': return '只阻止本次指定異常的回合扣減（不改寫期限）';
    case 'next_entry_status': return `令對手下隻登場精靈附加${p.status}${p.turns}回合（登場時經免疫判定）`;
    case 'watch': return `下一次${p.trig==='kill'?'擊敗對手':triggerLabels[p.trig]||p.trig}時，執行一次子流程`;
    case 'dmg_mod_turns': return `${p.side==='opp'?'對手':'自身'}${p.next?'下':'當回合起'}${p.turns}回合${p.dir==='in'||p.dir==='taken'?'受到':'造成'}${p.kind||'全部'}傷害${p.reduce!==undefined?`減少${pct(p.reduce)}`:`提升${pct(p.boost)}`}${p.lateCompensation?'（後手已錯過受傷收益時補償1回合）':''}`;
    case 'status_replace': return `本次附加的異常轉化為${p.status}，保留本次期限`;
    case 'block_damage': return `抵擋受到的${p.kind}傷害；結算後抵擋量累加至「${p.key}」`;
    case 'damage_from_counter': return `「${p.key}」累積量×${pct(p.ratio)}造成${p.type}傷害（${p.consume?'消耗':'保留'}計數）`;
    case 'stat_steal_random': return `隨機吸取對手${p.count}項不同能力${p.v}級（免疫／下限後實際下降量）`;
    case 'shield_from_last': return `上一結算量的${pct(p.ratio)}轉化為自身護盾`;
    case 'mark_program': return `${side}${p.mode==='add'?'增加':'設定'}${p.count}${p.unit}「${p.name}」（上限${p.maxCount}；${p.scope==='team'?'陣營':'持有者'}；${p.persistsOffField?'下場保留':'下場消失'}）`;
    case 'once': return `本場戰鬥僅限一次（${p.key}）`;
    case 'survive': return '致死時保留1點體力（不是對手手下留情）';
    case 'status_guard': return `在異常附加前免疫${p.cls || '所有'}異常`;
    case 'crit_uses': return `${p.scope==='team'?'己方':'自身'}下${p.uses}次攻擊必定致命一擊`;
    case 'block_attack': return `抵擋下${p.count}次攻擊傷害`;
    case 'immune_attack_turns': return `${p.turns}回合內免疫攻擊傷害`;
    case 'evade_turns': return `${p.turns}回合內${p.chance}%閃避${p.kind || '所有'}技能（必中除外）`;
    case 'survive_turns': return `${p.turns}回合內致死時保留1點體力`;
    case 'pp_zero_random': return `隨機${p.count}個不同對手技能槽PP歸零`;
    case 'pp_cost_mult': return `${p.turns}回合內對手${p.kind || '所有'}技能PP消耗×${p.mult}`;
    case 'no_pos_prio_turns': return `${p.next?'下':'當回合起'}${p.turns}回合對手正先制失效`;
    case 'power_streak': return `連續使用每次威力+${p.step}（最高${p.cap}）`;
    case 'hp_adjust': return `${side}體力調整${p.delta!==undefined?`${p.delta>=0?'+':''}${p.delta}`:`${p.direction==='subtract'?'-':'+'}${p.base}×${pct(p.ratio)}`}${p.perStack?'×印記層數':''}`;
    case 'rebirth_once': return '自身下次死亡時重生（僅1次）';
    case 'stat_mirror': return `將${p.side==='opp'?'自身':'對手'}能力提升附加為${side}等量${p.kind==='down'?'下降':'提升'}`;
    case 'pp_lost_damage': return `對手受到已損失PP总量×${p.mult}點${p.type}傷害`;
    case 'clear_shield': return `消除${side}${p.kind==='both'?'護盾與護罩':p.kind==='barrier'?'護罩':'護盾'}`;
    case 'status': return `${side}附加${p.status}（${p.turns !== undefined ? `${p.turns}回合` : '依異常預設期限'}，${p.chance ?? 100}%）`;
    case 'convert_status': return `${side}現有異常轉化為${p.status}（${p.turns}回合）`;
    case 'immune_status_turns': return `${p.turns}回合內免疫${p.reflect ? '並反彈' : ''}${p.cls || '所有'}異常`;
    case 'immune_statdown_turns': return `${p.turns}回合內免疫能力下降`;
    case 'clear_turn': return `消除${side}回合類效果`;
    case 'stat_clear': return `消除${side}能力${p.kind === 'up' ? '提升' : p.kind === 'down' ? '下降' : '變化'}狀態`;
    case 'stat': return `${side}${(p.stats || []).join('／')}${p.v >= 0 ? '+' : ''}${p.v}`;
    case 'heal': return `${side}恢復最大體力${pct(p.ratio)}`;
    case 'heal_flat': return `自身恢復${p.amount}點體力`;
    case 'dmg': return `對手受到${amount !== undefined ? `${amount}點` : `${p.of === 'self' ? '自身' : '對手'}${base}×${pct(p.ratio)}`}的${p.type}傷害`;
    case 'drain': return `吸取對手${p.flat !== undefined ? `${p.flat}點體力` : `${p.cur ? '當前' : '最大'}體力${pct(p.cur ? p.ratioCur : p.ratio)}`}${p.rampInc !== undefined ? `；每次使用+${p.rampInc}%，最高${p.rampCap}%` : ''}（${p.true ? '真實' : p.flat !== undefined ? '固定' : '百分比'}傷害）`;
    case 'boost': return p.power && p.add !== undefined ? `技能威力+${p.add}${p.per === 'self_up_kinds' ? '（每項自身能力提升）' : ''}`
      : `${p.power ? '技能威力' : `${p.kind || '攻擊'}傷害`}提升${pct(p.mult - 1)}`;
    case 'timed': return `${p.from === 'next' ? '下' : '當回合起'}${p.turns}回合：${triggerLabels[p.trig] || p.trig}`;
    case 'noop': return '無特殊效果';
    default: return a.label || a.op;
  }
}
