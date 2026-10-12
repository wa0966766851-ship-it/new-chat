/** 可編輯的條件／結果連鎖合約。只放已知結算動作，不接受專屬 handler、腳本或文字 fallback。 */
import type { Clause } from '../blocks/model';
import type { KitEntry } from './effectSystem.schema';
import { DAMAGE_BASE_CHOICES } from './damageBases';
import { CLOSURE_ACTION_FIELDS, closureActionIssue } from './sequenceClosureContract';
import { MARK_PROGRAM_FIELDS, markProgramIssue } from './markProgram';
export const SEQUENCE_ACTION_FIELDS: Record<string, readonly string[]> = {
  ...CLOSURE_ACTION_FIELDS,
  mark_program: MARK_PROGRAM_FIELDS,
  status: ['side','status','turns','chance'], status_seq: ['list','chance'],
  cure_status: ['side'],
  convert_status: ['side','status','turns'],
  stat: ['side','stats','v','chance','stats2','side2','v2'],
  stat_clear: ['side','kind'], stat_reverse: ['side','kind'], stat_steal: ['mode','double'],
  heal: ['side','ratio'], heal_flat: ['amount'],
  pp_op: ['side','mode','amount','stopIfEmpty'],
  dmg: ['flat','both','type','elem','base','of','ratio'], drain: ['flat','cur','ratioCur','ratio','true'],
  shield: ['flat','ratio'], clear_shield: ['side','kind'], clear_turn: ['side'],
  invalid_turns: ['kind','turns','next'], invalid_next: ['kind','uses'],
  no_heal: ['turns','next','scope'], no_switch: ['turns','next'],
  timed: ['turns','from','trig','body','label','initial'],
  dmg_mod: ['dir','kind','boost','reduce'],
  dmg_mod_turns: ['side','dir','kind','boost','reduce','chance','turns','next','lateCompensation'],
  boost: ['mult','power','kind','chance','add','per'], ignore: ['what'], no_resist: [],
  heal_equal: [], dmg_equal: ['type'], dmg_from_last: ['ratio','type','elem'],
  maxhp: ['side','ratio'],
  // P2：已實作且有讀取端的先制／免疫 op，補上參數合約後放行。
  prio_turns: ['turns','v','attackOnly','side','per'],
  noop: ['tag'],
  immune_status_turns: ['turns','reflect','cls'], immune_status_count: ['count','reflect'],
  immune_statdown_turns: ['turns'], immune_attack_count: ['count'],
  // P2 第二批（2026-10-12）：已實作且有讀取端
  vampire: ['ratio','kind'],
  pp_zero: ['kind'],
  dmg_cap_turns: ['turns','cap'],
  at_round_end: ['body','text'],
  // 機率先制／致命等獨立回合效果：有讀取端（damage 公式 critChanceBonus）的通用 op
  crit_bonus_turns: ['turns','bonus','next'],
  // 目標精靈準備（2026-10-12）
  watch: ['trig','body','text'], stat_protect_turns: ['turns'], ignore_next: ['what'], heal_reduce_turns: ['turns','ratio'],
  next_entry_status:['status','turns'],
  stop_status_tick:[],
  heal_overflow: ['unit','reduce','shield','kind'], battle_boost: ['inc','cap','kind'],
};
export const SEQUENCE_CONDITION_FIELDS: Record<string, readonly string[]> = {
  first: [], last: [], success: [], triggered: [], fail: [],
  has_status: ['side','status','neg'], abnormal: ['side','neg'], stage: ['side','kind','neg'],
  hp_ratio: ['side','op','ratio'], hp_cmp: ['side','op'], hp_full: ['side'], shield: ['side','neg'],
  invalid: [], weak: [], type_is: ['side','type','neg'], enemy: [], self_enemy: [],
  // P2 第二批：結果類條件只在傷害結算後的事件可用（見 AFTER_RESULT_TRIGS）；印記層數任何時點可查
  kill: [], nokill: [], crit: [], last_no_dmg: [], has_mark: ['side','name'], stab: [], dmg_cmp: ['op','v'],
  // 「N%機率」：偽隨機（PRD），使用技能時擲一次
  chance: ['pct'],
  event_status:['statuses'],
};
/** 「擊敗／未擊敗／致命一擊／對手體力未減少」只在結算後才有意義；在使用技能時判斷會讀到出手前的狀態。 */
const AFTER_RESULT_CONDS = new Set(['kill','nokill','crit','dmg_cmp']);
const AFTER_RESULT_TRIGS = new Set(['after_hit','kill','self_after_skill','self_after_attack','self_after_status','self_after_physical','self_after_special']);
export const SEQUENCE_TRIGGERS: Record<string,string> = {
  pp_consumed:'pp_consumed',
  status_end:'on_status_ended',status_received:'on_status_received',status_immune:'on_status_immunized',status_tick:'before_status_tick',
  fatal:'self_fatal',before_status:'before_status_apply',bench:'opponent_entered',team_round_start:'round_start',
  use:'on_skill_use', after_hit:'on_hit', on_invalid:'on_invalid', entrance:'on_entered',
  battle_start:'battle_start', round_start:'round_start', round_end:'round_end', phase_end:'battle_phase_end',
  kill:'on_kill', defeated:'cthyaat_death', switch_out:'on_switch_out', damaged:'on_damaged',
  self_skill:'on_skill_use', opp_skill:'on_attacked', opp_after_skill:'opponent_after_action',
  self_after_use:'after_action', self_after_skill:'after_action', passive:'passive_always', incoming:'before_damage',
  self_attack:'on_skill_use', self_status:'on_skill_use',
  self_after_attack:'after_action',self_after_status:'after_action',self_after_physical:'after_action',self_after_special:'after_action',
  opp_attack:'on_attacked',opp_status:'on_attacked',opp_after_attack:'opponent_after_action',opp_after_status:'opponent_after_action',
  damaged_skill:'on_damaged',damaged_attack:'on_damaged',damaged_true:'on_damaged',damaged_fixed:'on_damaged',damaged_percent:'on_damaged',damaged_nontrue:'on_damaged',
  incoming_skill:'before_damage', incoming_attack:'before_damage', incoming_nontrue:'before_damage',
  outgoing:'before_damage', outgoing_skill:'before_damage', outgoing_attack:'before_damage',
  extra_action_start:'extra_action_start', extra_action_end:'extra_action_end',
};
const object = (v: any): v is Record<string,any> => !!v && typeof v === 'object' && !Array.isArray(v);
const sides = ['self','opp','both','auto','any'];
const compare = ['低於','小於','高於','大於','不低於','不小於','不高於','不大於'];
const timerTriggers=['round_start','round_end','phase_end','self_skill','self_attack','self_status','self_after_skill','self_after_attack','self_after_status','self_after_physical','self_after_special','opp_skill','opp_attack','opp_status','opp_after_skill','opp_after_attack','opp_after_status','damaged','damaged_attack','damaged_skill','damaged_true','damaged_fixed','damaged_percent','damaged_nontrue','incoming','incoming_attack','incoming_skill','incoming_nontrue','outgoing','outgoing_attack','outgoing_skill','switch_out','kill','defeated','extra_action_start','extra_action_end'];
function paramsIssue(value: unknown, fields: readonly string[], path: string): string | null {
  if (!object(value)) return `${path}需為參數物件`;
  for (const [key,v] of Object.entries(value)) {
    if (!fields.includes(key)) return `${path}.${key}尚無已核對的參數合約`;
    if (v === undefined) continue;
    if (typeof v === 'number' && (!Number.isFinite(v) || Math.abs(v)>1e6)) return `${path}.${key}需為有限數值`;
    if (['side','side2','of'].includes(key) && !sides.includes(v)) return `${path}.${key}目標不明`;
    if (['turns','uses','count','chance','ratio','ratioCur','flat','amount','boost','reduce','mult','cap','rampInc','rampCap','bonus','pct'].includes(key) && (typeof v !== 'number' || v<0)) return `${path}.${key}需為非負數值`;
    if (key === 'chance' && v>100) return `${path}.chance超過100`;
    if (['turns','uses','count'].includes(key) && (!Number.isInteger(v)||v>10000)) return `${path}.${key}需為有限整數期限`;
    if (['v','v2'].includes(key) && path !== 'condition' && (typeof v !== 'number'||!Number.isInteger(v)||Math.abs(v)>6)) return `${path}.${key}需為-6至6能力等級`;
    if (['neg','both','cur','true','double','next','now','power','attackOnly','reflect','rampStreak','stopIfEmpty','initial','persistsOffField','perStack','consume','lateCompensation'].includes(key) && typeof v !== 'boolean') return `${path}.${key}需為布林值`;
    if (['stats','stats2','list','statuses'].includes(key) && (!Array.isArray(v)||!v.length||v.length>30||v.some(x=>typeof x!=='string'||x.length>200))) return `${path}.${key}需為有限名稱陣列`;
    if (key==='cls' && (typeof v!=='string'||!['','控制類','弱化類','非附屬類'].includes(v))) return `${path}.cls異常分類不明`;
    if (['label','text'].includes(key) && (typeof v!=='string'||v.length>100000)) return `${path}.${key}需為有限文字`;
    if (typeof v === 'object' && !['stats','stats2','list','statuses','body','rules'].includes(key)) return `${path}.${key}不接受程式或巢狀行為`;
  }
  return null;
}
/** 包含嚴格的動作白名單，防止舊死鍵/no-op被當作可用積木。 */
export function sequenceIssue(value: unknown, node?: string, depth=0, inMark=false): string | null {
  if(depth>8)return '持續連鎖超過8層';
  if (!object(value)) return '連鎖需為子句物件';
  if (Object.keys(value).some(k=>!['raw','marker','trig','cond','body','parsed'].includes(k))) return '連鎖包含未支援的子句欄位';
  if (value.parsed !== true || !SEQUENCE_TRIGGERS[value.trig] || (node && SEQUENCE_TRIGGERS[value.trig]!==node)) return '連鎖觸發尚無等價事件或與節點不符';
  if (typeof value.raw !== 'string'||value.raw.length>100000) return '連鎖原文格式不符';
  if(value.marker!==undefined&&!['■','🎯','◇','>','>>'].includes(value.marker))return '連鎖分類標記不明';
  const conds = (list: any): string | null => {
    if (!Array.isArray(list)||list.length>30) return '條件過多或格式不符';
    for(const c of list) {
      if(!object(c)||Object.keys(c).some(k=>!['c','p','label','neg'].includes(k))||!SEQUENCE_CONDITION_FIELDS[c.c]) return '條件尚無等價查詢';
      // 既有條件引擎只對p.neg作反向；不把未實作的頂層neg吞掉。
      if(c.neg !== undefined && c.neg !== false) return '頂層反向條件尚未接通';
      if(c.label !== undefined && typeof c.label !== 'string')return '條件名稱需為文字';
      const issue=paramsIssue(c.p || {},SEQUENCE_CONDITION_FIELDS[c.c],'condition');if(issue)return issue;
      const conditionSides=c.c==='has_status'?['self','opp','both']:c.c==='abnormal'?['self','opp','any']:['self','opp'];
      if(SEQUENCE_CONDITION_FIELDS[c.c].includes('side')&&!conditionSides.includes(c.p?.side))return '條件缺少明確持有者';
      if(c.c.startsWith('hp') && c.p?.op && !compare.includes(c.p.op)) return '體力比較運算不明';
      if(['hp_ratio','hp_cmp'].includes(c.c) && (!['self','opp'].includes(c.p?.side)||!compare.includes(c.p?.op)))return '體力比較缺少目標或運算';
      if(c.c==='hp_ratio'&&typeof c.p?.ratio!=='number')return '體力比較缺少比例';
      if(c.c==='stage'&&!['up','down'].includes(c.p?.kind))return '能力等級條件方向不明';
      if(['has_status','type_is'].includes(c.c) && typeof c.p?.[c.c==='has_status'?'status':'type']!=='string') return '條件缺少名稱';
      if(AFTER_RESULT_CONDS.has(c.c) && !AFTER_RESULT_TRIGS.has(value.trig) && !(value.trig==='phase_end'&&['kill','nokill'].includes(c.c))) return '擊敗／致命一擊條件需在傷害結算後的事件判斷';
      if(c.c==='has_mark' && (typeof c.p?.name!=='string'||!c.p.name)) return '印記條件缺少名稱';
      if(c.c==='dmg_cmp' && (!compare.includes(c.p?.op)||typeof c.p?.v!=='number')) return '傷害比較缺少運算或數值';
      if(c.c==='chance' && !(typeof c.p?.pct==='number'&&c.p.pct>0&&c.p.pct<=100)) return '機率條件需為大於0、不超過100的百分比';
      if(c.c==='event_status'&&(!['before_status','status_end','status_received','status_immune','status_tick'].includes(value.trig)||!Array.isArray(c.p?.statuses)))return '本次異常查詢需正式異常事件及明確名稱';
    }
    return null;
  };
  const header=conds(value.cond || []);if(header)return header;
  if(!Array.isArray(value.body)||!value.body.length||value.body.length>100)return '連鎖需有1至100個分支';
  for(const stmt of value.body) {
    if(!object(stmt)||Object.keys(stmt).some(k=>!['acts','elseActs','cond','chain','live','pre'].includes(k)))return '延遲命中分支需獨立事件入口';
    if(stmt.chain!==undefined&&!['success','fail','any_fail'].includes(stmt.chain))return '未知的結果連鎖';
    if(stmt.live!==undefined&&typeof stmt.live!=='boolean')return '即時條件需為布林值';
    if(stmt.pre!==undefined&&typeof stmt.pre!=='boolean')return '前置快照需為布林值';
    const issue=conds(stmt.cond || []);if(issue)return issue;
    if(!Array.isArray(stmt.acts)||!stmt.acts.length||stmt.acts.length>100)return '連鎖分支需有明確動作';
    if(stmt.elseActs!==undefined&&(!Array.isArray(stmt.elseActs)||stmt.elseActs.length>100))return '否則分支格式不符';
    for(const act of [...stmt.acts,...(stmt.elseActs||[])]) {
      if(!object(act)||Object.keys(act).some(k=>!['op','p','label'].includes(k))||!SEQUENCE_ACTION_FIELDS[act.op])return `動作${act?.op || ''}尚無已核對的可編輯合約`;
      if(act.label !== undefined && typeof act.label !== 'string')return '動作名稱需為文字';
      if(!object(act.p))return '動作需為參數物件';
      const fields=[...SEQUENCE_ACTION_FIELDS[act.op],...(['stat','heal','heal_flat','dmg','drain','shield','boost','dmg_mod'].includes(act.op)?['x2If']:[]),
        // 「每次使用額外+N（最高M）」：runAct 依使用次數遞增數值欄位
        ...(['heal','heal_flat','dmg','drain','shield','boost'].includes(act.op)?['rampInc','rampCap','rampStreak','rampReset']:[])];
      const {x2If,...basicParams}=act.p || {};
      const issue=paramsIssue(basicParams,fields,'action');if(issue)return issue;
      const closureIssue=closureActionIssue(act.op,act.p);if(closureIssue)return closureIssue;
      if(act.op==='block_damage'&&!['incoming','incoming_skill','incoming_attack','incoming_nontrue'].includes(value.trig))return '抵擋只能在受到傷害前登記';
      if(act.op==='status_replace'&&value.trig!=='before_status')return '替換本次異常只能在附加前執行';
      if(inMark && !['hp_adjust','heal','heal_flat','stat','stat_clear','stat_reverse','cure_status','status','status_seq','convert_status','dmg','drain','dmg_mod','pp_op','pp_zero','pp_zero_random','clear_shield','clear_turn','stat_mirror','pp_lost_damage','heal_equal','dmg_equal','dmg_from_last','noop'].includes(act.op))return '印記規則只能使用同步結算動作，不能留下脫離印記的計時／額外行動';
      if(act.p.perStack && !inMark)return '按印記層數結算只能存在於持有者印記程式內';
      if(act.op==='mark_program') {
        if(inMark)return '印記規則不能遞迴產生印記程式';
        const issue=markProgramIssue(act.p);if(issue)return issue;
        for(const rule of act.p.rules){const issue=sequenceIssue(rule,undefined,depth+1,true);if(issue)return `印記規則：${issue}`;}
      }
      if(act.op==='status_guard'&&value.trig!=='before_status')return '常駐異常防護必須在附加前查詢';
      if(act.op==='stop_status_tick'&&value.trig!=='status_tick')return '阻止異常扣減只能修改本次扣減前請求';
      if(act.op==='survive'&&value.trig!=='fatal')return '致死存活只能在致死節點執行';
      if(act.op==='once') {
        const issue=sequenceIssue({raw:'一次性容器',trig:value.trig,parsed:true,body:act.p.body},undefined,depth+1,inMark);
        if(issue)return `一次性容器：${issue}`;
      }
      if(x2If!==undefined) {
        if(!fields.includes('x2If'))return '此動作尚無效果翻倍的完整定義';
        const issue=conds([x2If]);if(issue)return `翻倍條件：${issue}`;
      }
      if(['heal','stat_reverse','maxhp'].includes(act.op)&&!['self','opp'].includes(act.p.side))return '此動作需單一明確目標';
      if(act.op==='pp_op'&&(!['self','opp'].includes(act.p.side)||!['add','reduce','zero','recover','drain'].includes(act.p.mode)))return 'PP操作目標或模式不明';
      if(act.op==='pp_op'&&['add','reduce','drain'].includes(act.p.mode)&&(!Number.isInteger(act.p.amount)||act.p.amount<0))return 'PP操作需非負整數點數';
      if(['status','cure_status','clear_shield','stat_clear','clear_turn'].includes(act.op)&&!['self','opp','both'].includes(act.p.side))return '此動作目標不明';
      if(act.op==='clear_shield' && !['shield','barrier','both'].includes(act.p.kind ?? 'shield'))return '清除護盾／護罩範圍不明';
      if(act.op==='convert_status'&&(!['self','opp'].includes(act.p.side)||typeof act.p.status!=='string'||!act.p.status||!(act.p.turns>0)))return '異常轉化需單一目標、名稱與期限';
      if(act.op==='stat'&&!['self','opp','both','auto'].includes(act.p.side))return '能力變化目標不明';
      if(act.op==='timed') {
        if(act.p.initial && (act.p.from==='next'||!['self_skill','self_attack','self_status'].includes(act.p.trig)))return '初次觸發只適用於當回合起的自身使用監控';
        if(!(act.p.turns>0)||!(timerTriggers.includes(act.p.trig)||act.p.trig==='self_after_use')||!['now','next'].includes(act.p.from??'now'))return '持續連鎖的期限／起算／事件不明';
        if(inMark)return '印記規則的期限由印記持有者管理，不能建立脱離印記的計時器';
        const issue=sequenceIssue({raw:'持續連鎖',trig:act.p.trig,parsed:true,body:act.p.body},undefined,depth+1);
        if(issue)return `持續連鎖：${issue}`;
      }
      if(['status','status_seq'].includes(act.op) && !(act.op==='status'?typeof act.p.status==='string':Array.isArray(act.p.list)))return '異常動作缺少名稱';
      if(act.op==='stat' && (!Array.isArray(act.p.stats)||typeof act.p.v!=='number'||!act.p.side))return '能力變化缺少目標／數值';
      if(act.op==='stat'&&[...(act.p.stats||[]),...(act.p.stats2||[])].some(s=>!['全屬性','全能力','所有能力','雙攻','雙防','攻擊','防禦','特攻','特防','速度','命中'].includes(s)))return '能力名稱不明';
      if(act.op==='stat'&&act.p.stats2 && (!act.p.side2||typeof act.p.v2!=='number'))return '第二組能力變化缺少目標／數值';
      if(['stat_clear','stat_reverse'].includes(act.op)&&!['up','down','all'].includes(act.p.kind))return '能力狀態方向不明';
      if(act.op==='stat_steal'&&!['吸取','複製'].includes(act.p.mode))return '能力複製／吸取模式不明';
      if(act.op==='ignore'&&!['傷害限制','護盾','能力提升','攻擊免疫','免疫攻擊','免疫'].includes(act.p.what))return '指定無視尚無正式讀取端';
      if(act.op==='boost'&&(typeof act.p.mult!=='number'||act.p.mult<0 || !['use','self_skill','incoming','incoming_skill','incoming_attack','incoming_nontrue','outgoing','outgoing_skill','outgoing_attack','passive'].includes(value.trig)))return '增傷／威力需要公式前入口';
      if(act.op==='boost'&&act.p.power&&value.trig!=='use'&&value.trig!=='self_skill')return '威力倍率不能在公式後執行';
      if(act.op==='boost'&&!['攻擊','技能','非真實','固定','百分比','真實',''].includes(act.p.kind??''))return '增傷範圍不明';
      if(['ignore','no_resist'].includes(act.op)&&!['use','self_skill'].includes(value.trig))return '本次攻擊旗標需在技能使用時設定';
      if(['dmg_equal','dmg_from_last'].includes(act.op)&&!['固定','百分比','真實'].includes(act.p.type)&&!(act.op==='dmg_from_last'&&act.p.type==='技能'&&typeof act.p.elem==='string'&&act.p.elem))return '等量傷害類型不明';
      if(act.op==='dmg_from_last'&&!(act.p.ratio>0))return '轉化傷害缺少比例';
      if(['dmg','drain','heal','shield'].includes(act.op) && act.p.flat===undefined&&act.p.amount===undefined&&act.p.ratio===undefined&&act.p.ratioCur===undefined)return '動作缺少確切數值';
      if(act.op==='dmg'&&!['固定','百分比','真實','技能'].includes(act.p.type))return '傷害類型不明';
      if(act.op==='dmg'&&act.p.type==='技能'&&!act.p.elem)return '技能傷害缺少屬性';
      if(act.op==='dmg'&&act.p.base!==undefined&&!DAMAGE_BASE_CHOICES.includes(act.p.base))return '傷害基數未接通';
      if(act.op==='dmg'&&act.p.flat===undefined&&(!act.p.base||!['self','opp'].includes(act.p.of)||typeof act.p.ratio!=='number'))return '比例傷害需基數、持有者與比例';
      if(act.op==='dmg'&&act.p.both&&act.p.flat===undefined)return '雙方比例傷害尚無雙目標結算';
      if(act.op==='drain'&&act.p.cur&&typeof act.p.ratioCur!=='number')return '當前體力吸取缺少比例';
      if(act.op.startsWith('dmg_mod')&&!['攻擊','技能','非真實','固定','百分比','真實',''].includes(act.p.kind??''))return '增減傷範圍不明';
      if(act.op.startsWith('dmg_mod')&&!['in','in_boost','out','out_reduce','taken'].includes(act.p.dir))return '增減傷方向不明';
      if(act.op==='dmg_mod'&&act.p.dir==='taken')return '即時受到增傷需選in_boost；taken只用於持續效果';
      if(act.op==='dmg_mod_turns'&&(!['in','out','taken','out_reduce'].includes(act.p.dir)||!Number.isInteger(act.p.turns)||act.p.turns<=0))return '持續增減傷方向或期限不明';
      if(act.op==='dmg_mod_turns'&&act.p.dir==='out_reduce'&&!(act.p.reduce>0&&act.p.reduce<=1))return '持續輸出減傷需大於0、不超過100%';
      if(act.op==='dmg_mod_turns'&&act.p.lateCompensation&&(act.p.next||!['in','taken'].includes(act.p.dir)||act.p.side==='opp'))return '後手受傷補償僅限自身當回合起的受傷修正';
      if(['invalid_turns','invalid_next'].includes(act.op)&&!['攻擊','屬性','all',''].includes(act.p.kind??''))return '技能無效範圍不明';
      if(['invalid_turns','no_heal','no_switch'].includes(act.op)&&!(act.p.turns>0))return '持續效果缺少期限';
      if(act.op==='no_heal'&&act.p.scope!==undefined&&!['all','own_skill'].includes(act.p.scope))return '禁療範圍需全部回復或自身技能回復';
      if(act.op==='invalid_next'&&!(act.p.uses>0))return '次數型無效缺少次數';
      if(act.op==='noop'&&act.p.tag!==undefined&&!/^[（(]?無特殊效果[）)]?$/.test(String(act.p.tag)))return '空動作只允許「無特殊效果」；必中／先制等技能屬性不能用空動作冒充';
      if(act.op==='prio_turns'&&(!(act.p.turns>0)||!Number.isInteger(act.p.v)||act.p.v===0||(act.p.side!==undefined&&act.p.side!=='opp')))return '先制回合效果需有期限、非零整數與明確對象';
      if(['immune_status_turns','immune_statdown_turns'].includes(act.op)&&!(act.p.turns>0))return '免疫效果缺少期限';
      if(['immune_status_count','immune_attack_count'].includes(act.op)&&!(act.p.count>0))return '次數型免疫缺少次數';
      if(act.p.per!==undefined&&!['self_up_kinds','sides_priority_zero'].includes(act.p.per))return '計數來源不明';
      if(act.op==='boost'&&act.p.add!==undefined&&(!act.p.power||!Number.isInteger(act.p.add)||act.p.add<=0||act.p.add>1000))return '威力加值需為威力且為正整數';
      if(act.op==='vampire'&&(!(act.p.ratio>0)||!['攻擊','技能'].includes(act.p.kind)))return '吸血需比例與傷害範圍（攻擊／技能）';
      if(act.op==='pp_op'&&act.p.stopIfEmpty&&(act.p.side!=='opp'||!['reduce','zero','drain'].includes(act.p.mode)))return '「歸0則無法行動」只適用於對手的PP扣除／清空';
      if(act.op==='crit_bonus_turns'&&(!(act.p.turns>0)||!(act.p.bonus>0&&act.p.bonus<=1)))return '致命機率加成需期限與0～1的加成值';
      if(act.op==='pp_zero'&&!['','攻擊','屬性'].includes(act.p.kind??''))return 'PP歸零範圍不明';
      if(act.op==='dmg_cap_turns'&&(!(act.p.turns>0)||!(act.p.cap>=0)))return '受傷上限需期限與上限值';
      if(act.op==='watch') {
        if(!['shield_broken','kill','phase_end','self_skill'].includes(act.p.trig))return '監看事件尚未開放';
        const issue=sequenceIssue({raw:'事件監看',trig:act.p.trig==='shield_broken'?'round_end':act.p.trig,parsed:true,body:act.p.body},undefined,depth+1);
        if(issue)return `事件監看：${issue}`;
      }
      if(act.op==='next_entry_status'&&(value.trig!=='kill'||typeof act.p.status!=='string'||!act.p.status||!(act.p.turns>0)))return '對手下隻登場異常只能由擊敗後節點設定並明確指定期限';
      if(act.op==='stat_protect_turns'&&!(act.p.turns>0))return '保護效果缺少期限';
      if(act.op==='heal_overflow'&&(!(act.p.unit>0)||(act.p.reduce===undefined&&act.p.shield===undefined)||(act.p.reduce!==undefined&&!(act.p.reduce>0&&act.p.reduce<=1))||(act.p.kind!==undefined&&act.p.kind!=='攻擊')))return '溢出換算需單位、減傷比例或護盾';
      if(act.op==='battle_boost'&&(!(act.p.inc>0)||(act.p.cap!==undefined&&!(act.p.cap>=act.p.inc))||(act.p.kind??'攻擊')!=='攻擊'))return '本場累積增傷需每次增量與上限（目前只限攻擊傷害）';
      if(act.op==='ignore_next'&&act.p.what!=='攻擊免疫')return '下次無視範圍不明';
      if(act.op==='heal_reduce_turns'&&(!(act.p.turns>0)||!(act.p.ratio>0&&act.p.ratio<=1)))return '恢復減少需期限與0至100%';
      if(act.op==='at_round_end') {
        const issue=sequenceIssue({raw:'回合結束時',trig:'round_end',parsed:true,body:act.p.body},undefined,depth+1);
        if(issue)return `回合結束時：${issue}`;
      }
      if(act.p.rampInc!==undefined&&(act.p.rampCap!==undefined&&act.p.rampCap<0))return '遞增上限需非負';
      if(act.p.rampCap!==undefined&&act.p.rampInc===undefined)return '遞增上限缺少每次增量';
      if(act.p.rampReset!==undefined&&(act.p.rampReset!=='switch'||act.p.rampInc===undefined))return '遞增計數重置只接受下場重置，且需有每次增量';
      if(value.trig==='passive'&&act.op!=='dmg_mod')return '常駐動作需查詢入口，不能每次傷害重播';
    }
  }
  return null;
}
export function sequenceClause(clause: Clause): Clause {
  const clean=(v:any):any=>Array.isArray(v)?v.map(clean):object(v)?Object.fromEntries(Object.entries(v).filter(([,value])=>value!==undefined).map(([key,value])=>[key,clean(value)])):v;
  // 只移除未填欄位；NaN／未知參數仍交由嚴格合約拒絕，不洗成合法的0。
  return clean({raw:clause.raw,marker:clause.marker,trig:clause.trig,cond:clause.cond,body:clause.body,parsed:true});
}

/** 純資料檢查，編輯／首頁不必為了驗證而載入戰鬥執行器。 */
export function skillPropertyIssue(entry: KitEntry): string | null {
  const {property,value,conditions=[]}=entry.params;
  if(property==='conditional_sure_hit') {
    if(entry.source!=='skill'||entry.role!=='attached'||entry.node!=='before_skill'||value!==true||!conditions.length)return '條件必中需為技能附加、命中前條件查詢';
    return skillPropertyIssue({...entry,role:'innate',params:{...entry.params,property:'sure_hit'}});
  }
  if(property==='conditional_priority') {
    if(entry.source!=='skill'||entry.role!=='attached'||entry.node!=='modify_priority')return '條件先制需為技能附加查詢';
    if(!Number.isInteger(value)||value===0||Math.abs(value)>100)return '條件先制需非零整數';
    if(!conditions.length)return '條件先制需明確條件';
    if(Object.keys(entry.params).some(k=>!['property','value','conditions'].includes(k)))return '條件先制包含未知參數';
    return skillPropertyIssue({...entry,role:'innate',params:{property:'base_priority',value,conditions}});
  }
  // 機率先制是附加效果（🎯，可被附加效果失效封印），不是固有屬性；機率由 pct 表示，不接受條件。
  if(property==='chance_priority') {
    if(entry.source!=='skill'||entry.role!=='attached'||entry.node!=='modify_priority')return '機率先制只能是技能的附加效果，且在先制判定節點';
    if(!Number.isInteger(value)||value<1||value>100)return '機率先制需為1至100整數';
    if(!(entry.params.pct>0&&entry.params.pct<=100))return '機率先制的機率需大於0、不超過100';
    if(conditions.length)return '機率先制不接受其他條件';
    if(Object.keys(entry.params).some(k=>!['property','value','conditions','pct'].includes(k)))return '機率先制包含未支援參數';
    return null;
  }
  if(property==='stage_view') {
    if(entry.source!=='skill'||entry.role!=='innate'||entry.node!=='before_damage'||conditions.length)return '能力視為需為技能固有、公式前無條件查詢';
    if(!['opp_up_as_down','self_down_as_opp_down','self_down_as_up'].includes(value))return '能力視為方向未接通';
    if(Object.keys(entry.params).some(k=>!['property','value','conditions'].includes(k)))return '能力視為含未知參數';
    return null;
  }
  if(!['sure_hit','base_priority','base_accuracy'].includes(property))return '未知技能本體屬性';
  if(entry.source!=='skill'||entry.role!=='innate')return '技能本體屬性只能是技能固有';
  if(entry.node!==(property==='base_priority'?'modify_priority':'before_skill'))return '技能本體屬性查詢節點不符';
  if(property==='sure_hit'&&value!==true)return '必中屬性需為true';
  if(property==='base_accuracy'&&(!Number.isInteger(value)||value<0||value>100))return '固有命中率需為0至100整數';
  if(property==='base_priority'&&(!Number.isInteger(value)||Math.abs(value)>100))return '基礎先制需為-100至100整數';
  if(!Array.isArray(conditions)||conditions.some(c=>!['has_status','abnormal','stage','hp_ratio','hp_cmp','hp_full','shield','type_is','enemy','self_enemy'].includes(c?.c)))return '技能本體查詢不能引用尚未發生的出手／成敗結果';
  return sequenceIssue({raw:'技能本體查詢',trig:'use',parsed:true,cond:conditions,body:[{acts:[{op:'heal_flat',p:{amount:0},label:''}]}]});
}
