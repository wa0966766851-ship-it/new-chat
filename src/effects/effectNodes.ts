/** 編輯器、分詞檢視與正式事件派發共用的節點合約；衍生／直接節點不偽造枚舉事件。 */
import { EffectTiming } from './types';
import type { Node } from './effectSystem.schema';
import type { Trigger } from '../blocks/model';

type Phase = '開局' | '選擇與出手' | '傷害結算' | '行動收尾' | '回合收尾' | '切換與陣亡' | '事件監控';
interface NodeContract { label: string; phase: Phase; trigger: Trigger; event?: EffectTiming; derived?: string; help: string }
export const EFFECT_NODES: Record<Node, NodeContract> = {
  on_status_ended:{label:'自身異常結束／解除',phase:'事件監控',trigger:'status_end',event:EffectTiming.ON_STATUS_ENDED,help:'期限結束、解除或轉化移除的實際異常名稱；下場清除不觸發。'},
  on_status_received:{label:'自身異常附加成功',phase:'事件監控',trigger:'status_received',event:EffectTiming.SELF_STATUS_APPLIED,help:'真正附加成功後，免疫失敗不會收到。'},
  on_status_immunized:{label:'自身免疫異常成功',phase:'事件監控',trigger:'status_immune',event:EffectTiming.ON_STATUS_IMMUNIZED,help:'真正免疫成功後，反彈不當作免疫；不靠頭上有免疫图示猜。'},
  before_status_tick:{label:'自身異常扣減前',phase:'事件監控',trigger:'status_tick',event:EffectTiming.BEFORE_STATUS_TICK,help:'修改本次異常扣減請求，不重設999回合。'},
  before_status_apply:{label:'異常附加前',phase:'事件監控',trigger:'before_status',event:EffectTiming.BEFORE_STATUS_APPLY,help:'受方異常防護查詢，修改同一附加請求；不是每回合補999回合免疫。'},
  opponent_entered:{label:'對手切換登場（自身場下）',phase:'切換與陣亡',trigger:'bench',derived:'對手ON_ENTRANCE通知存活的場下持有者',help:'僅對手換人後觸發，首發登場不算。使用場下持有者上下文，不改在場己方。'},
  battle_start:{label:'戰鬥開始',phase:'開局',trigger:'battle_start',derived:'首發登場的battleStart通知',help:'首發第一次登場時觸發，重新登場不重播。'},
  on_entered:{label:'登場',phase:'開局',trigger:'entrance',event:EffectTiming.ON_ENTRANCE,help:'每次登場，不能同時訂閱ELF_ENTERED造成重複。'},
  modify_priority:{label:'先制判定',phase:'選擇與出手',trigger:'custom',event:EffectTiming.MODIFY_PRIORITY,help:'尚未決定出手順序，先制原子僅在此讀取。'},
  before_action:{label:'出手流程前',phase:'選擇與出手',trigger:'custom',event:EffectTiming.BEFORE_ACTION,help:'行動方出手流程開始，不代表已命中。'},
  on_attacked:{label:'對手出手流程前',phase:'選擇與出手',trigger:'opp_skill',event:EffectTiming.OPPONENT_ACTION,help:'通知非行動方；持有者仍為ctx.actor，不能改成行動方。'},
  before_skill:{label:'使用技能前',phase:'選擇與出手',trigger:'custom',event:EffectTiming.BEFORE_SKILL,help:'自身本次技能的前置時點，不等於傷害後。'},
  on_skill_use:{label:'技能使用',phase:'選擇與出手',trigger:'use',derived:'技能runner／emitSkillUse',help:'技能runner處理本次使用槽，其他槽僅攜帶效果監控，不能重播兩次。'},
  before_damage:{label:'傷害計算',phase:'傷害結算',trigger:'custom',event:EffectTiming.BEFORE_DAMAGE,help:'修改本次damageComp；受到方與造成方以isIncoming區分。'},
  passive_always:{label:'常駐傷害修正',phase:'傷害結算',trigger:'passive',derived:'BEFORE_DAMAGE衍生',help:'只代表傷害計算查詢，不是每個戰鬥事件都執行。'},
  on_damaged:{label:'受到傷害後',phase:'傷害結算',trigger:'damaged',event:EffectTiming.ON_DAMAGED,help:'HP結算後通知受方，含各傷害分類；不再同時訂閱同義AFTER_DAMAGE。'},
  on_hit:{label:'命中／主傷害結算後',phase:'傷害結算',trigger:'after_hit',event:EffectTiming.ON_SKILL_HIT,help:'使用槽由技能after_hit分支執行；魂印與其他攜帶槽監控正式命中事件。'},
  on_invalid:{label:'技能無效／未命中',phase:'行動收尾',trigger:'on_invalid',event:EffectTiming.ACTION_FAILED,help:'未成功出手方的收尾，不能同時訂閱SKILL_INVALID而重播。'},
  after_action:{label:'成功行動結束',phase:'行動收尾',trigger:'self_after_skill',event:EffectTiming.AFTER_ACTION,help:'成功出手才觸發；失敗走ACTION_FAILED。'},
  opponent_after_action:{label:'對手行動後',phase:'行動收尾',trigger:'opp_after_skill',event:EffectTiming.OPPONENT_AFTER_ACTION,help:'非行動方收到含成功／失敗結果的通知。'},
  extra_action_start:{label:'額外行動開始',phase:'行動收尾',trigger:'extra_action_start',event:EffectTiming.EXTRA_ACTION_START,help:'獨立額外行動節點，不等同連擊或重用技能。'},
  extra_action_end:{label:'額外行動結束',phase:'行動收尾',trigger:'extra_action_end',event:EffectTiming.EXTRA_ACTION_END,help:'每次額外行動的完整收尾，不用動畫次數推斷。'},
  battle_phase_end:{label:'戰鬥階段結束',phase:'回合收尾',trigger:'phase_end',event:EffectTiming.BATTLE_PHASE_END,help:'與回合結束是不同結算節點。'},
  round_start:{label:'回合開始',phase:'選擇與出手',trigger:'round_start',event:EffectTiming.ROUND_START,help:'每回合開始的正式派發，不是假定所有技能此時執行。'},
  round_end:{label:'回合結束',phase:'回合收尾',trigger:'round_end',event:EffectTiming.ROUND_END,help:'回合結束正式派發；期限與下N回合須另外設定。'},
  on_kill:{label:'擊敗對手',phase:'切換與陣亡',trigger:'kill',event:EffectTiming.ON_KILL,help:'正式擊敗事件，不靠HP<=0猜測特殊存活精靈。'},
  self_fatal:{label:'致命抵擋判定',phase:'切換與陣亡',trigger:'fatal',event:EffectTiming.FATAL_RESIST,help:'致命抵擋時點，不等於已死亡。'},
  cthyaat_death:{label:'死亡節點一',phase:'切換與陣亡',trigger:'defeated',event:EffectTiming.DEATH_NODE_1,help:'只選第一個正式死亡節點，不重播DEATH_NODE_2。'},
  before_switch_out:{label:'主動切換前',phase:'切換與陣亡',trigger:'custom',event:EffectTiming.BEFORE_SWITCH_OUT,help:'主動切換的前置通知，不當成所有死亡強制切換的通知。'},
  on_switch_out:{label:'下場',phase:'切換與陣亡',trigger:'switch_out',event:EffectTiming.ON_SWITCH_OUT,help:'操作下場持有者；下場保留不代表傳給下一隻。'},
  pp_consumed:{label:'本技能槽PP被消耗',phase:'事件監控',trigger:'pp_consumed',event:EffectTiming.ON_PP_CONSUME,help:'出招及削PP皆按實際消耗槽通知；只執行攜帶效果，同一連鎖每槽一次，恢復PP不觸發。'},
  battle_end:{label:'戰鬥結束',phase:'回合收尾',trigger:'custom',event:EffectTiming.BATTLE_END,help:'整場結束，不是每回合結束。'},
  any_battle_node:{label:'所有已接通事件',phase:'事件監控',trigger:'custom',derived:'上述正式事件的監控',help:'只監控此合約列出的事件；沒有列出的枚舉不是已接通入口。'},
};

export const EFFECT_NODE_LABELS: Record<string,string> = Object.fromEntries(Object.entries(EFFECT_NODES).map(([key,value])=>[key,value.label]));
const EVENT_NODE_MAP = new Map(Object.entries(EFFECT_NODES).filter(([,value])=>value.event).map(([key,value])=>[value.event!,key as Node]));
export function eventEffectNode(event: EffectTiming): Node | undefined {return EVENT_NODE_MAP.get(event);}
