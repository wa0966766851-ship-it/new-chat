/** 編輯器、分詞檢視與正式事件派發共用的節點合約；衍生／直接節點不偽造枚舉事件。 */
import { EffectTiming } from './types';
import type { Node } from './effectSystem.schema';
import type { Trigger } from '../blocks/model';

type Phase = '開局' | '選擇與出手' | '傷害結算' | '行動收尾' | '回合收尾' | '切換與陣亡' | '事件監控';
interface NodeContract { label: string; phase: Phase; trigger: Trigger; event?: EffectTiming; derived?: string; help: string }
export const EFFECT_NODES: Record<Node, NodeContract> = {
  on_opponent_damaged:{label:'對手受到技能傷害後',phase:'傷害結算',trigger:'opp_damaged_skill',derived:'ON_DAMAGED通知對手側在場觀察者',help:'正式技能傷害結算後通知另一側在場的積木持有者；不重播自身受傷節點，不包含固定／百分比／真傷。'},
  on_skill_selected:{label:'合法選擇技能後',phase:'選擇與出手',trigger:'skill_selected',event:EffectTiming.SKILL_SELECTED,help:'通過選招合法性後立即通知一次，先於另一方選招、排序與行動受控；重複提交不重播。'},
  on_resource_changed:{label:'資源層數改變後',phase:'事件監控',trigger:'resource_changed',event:EffectTiming.RESOURCE_CHANGED,help:'資源積木確實改變層數後，通知原持有者；含場下，封頂沒有變動不重播。'},
  before_instant_kill:{label:'秒殺修正前',phase:'事件監控',trigger:'before_instant_kill',event:EffectTiming.BEFORE_INSTANT_KILL,help:'同一正式請求通知在場與存活背包持有者；可攔截或擴展目標，體力快照先於修正。'},
  before_stat_change:{label:'能力等級變更前',phase:'事件監控',trigger:'before_stat_change',event:EffectTiming.BEFORE_STAT_CHANGE,help:'他方即將改變自身能力等級前通知原持有者；可移除本次變更（回寫 data.changes）或阻止（data.prevented）。'},
  on_stat_boost_cleared:{label:'自身能力提升被消除／吸取',phase:'事件監控',trigger:'stat_boost_cleared',event:EffectTiming.STAT_BOOST_CLEARED,help:'他方真正移除自身正能力等級後通知原持有者；免疫阻止、普通弱化、自身清除與換人不算。'},
  on_turn_effects_cleared:{label:'自身回合效果被消除',phase:'事件監控',trigger:'turn_effects_cleared',event:EffectTiming.TURN_EFFECTS_CLEARED,help:'實際消除後通知原持有者；含監控本身被清除，使用消除前快照，不含到期或換人。'},
  on_status_ended:{label:'自身異常結束／解除',phase:'事件監控',trigger:'status_end',event:EffectTiming.ON_STATUS_ENDED,help:'期限結束、解除或轉化移除的實際異常名稱；下場清除不觸發。'},
  on_status_received:{label:'自身異常附加成功',phase:'事件監控',trigger:'status_received',event:EffectTiming.SELF_STATUS_APPLIED,help:'真正附加成功後，免疫失敗不會收到。'},
  on_status_immunized:{label:'自身免疫異常成功',phase:'事件監控',trigger:'status_immune',event:EffectTiming.ON_STATUS_IMMUNIZED,help:'真正免疫成功後，反彈不當作免疫；不靠頭上有免疫图示猜。'},
  before_status_tick:{label:'自身異常扣減前',phase:'事件監控',trigger:'status_tick',event:EffectTiming.BEFORE_STATUS_TICK,help:'修改本次異常扣減請求，不重設999回合。'},
  before_status_apply:{label:'異常附加前',phase:'事件監控',trigger:'before_status',event:EffectTiming.BEFORE_STATUS_APPLY,help:'受方異常防護查詢，修改同一附加請求；不是每回合補999回合免疫。'},
  opponent_entered:{label:'對手切換登場（自身場下）',phase:'切換與陣亡',trigger:'bench',derived:'對手ON_ENTRANCE通知存活的場下持有者',help:'僅對手換人後觸發，首發登場不算。使用場下持有者上下文，不改在場己方。'},
  battle_start:{label:'戰鬥開始',phase:'開局',trigger:'battle_start',event:EffectTiming.BATTLE_START,help:'開局1.1通知雙方所有存活背包持有者，先於首發登場；換人不重播。'},
  on_entered:{label:'登場',phase:'開局',trigger:'entrance',event:EffectTiming.ON_ENTRANCE,help:'每次登場，不能同時訂閱ELF_ENTERED造成重複。'},
  modify_priority:{label:'先制判定',phase:'選擇與出手',trigger:'custom',event:EffectTiming.MODIFY_PRIORITY,help:'尚未決定出手順序，先制原子僅在此讀取。'},
  modify_power:{label:'攻擊威力計算',phase:'傷害結算',trigger:'outgoing_power',event:EffectTiming.MODIFY_POWER,help:'命中效果結算後、傷害公式前讀取當下印記與威力；攻方與受方分流，並非傷害倍率。'},
  before_action:{label:'出手流程前',phase:'選擇與出手',trigger:'before_action',event:EffectTiming.BEFORE_ACTION,help:'行動方出手流程開始，不代表已命中。'},
  on_attacked:{label:'對手出手流程前',phase:'選擇與出手',trigger:'opp_skill',event:EffectTiming.OPPONENT_ACTION,help:'通知非行動方；持有者仍為ctx.actor，不能改成行動方。'},
  before_skill:{label:'使用技能前',phase:'選擇與出手',trigger:'before_skill',event:EffectTiming.BEFORE_SKILL,help:'自身本次技能的前置時點，不等於傷害後。'},
  on_skill_use:{label:'技能使用',phase:'選擇與出手',trigger:'use',derived:'技能runner／emitSkillUse',help:'技能runner處理本次使用槽，其他槽僅攜帶效果監控，不能重播兩次。'},
  before_damage:{label:'傷害計算',phase:'傷害結算',trigger:'custom',event:EffectTiming.BEFORE_DAMAGE,help:'修改本次damageComp；受到方與造成方以isIncoming區分。'},
  passive_always:{label:'常駐傷害修正',phase:'傷害結算',trigger:'passive',derived:'BEFORE_DAMAGE衍生',help:'只代表傷害計算查詢，不是每個戰鬥事件都執行。'},
  on_damaged:{label:'受到傷害後',phase:'傷害結算',trigger:'damaged',event:EffectTiming.ON_DAMAGED,help:'HP結算後通知受方，含各傷害分類；不再同時訂閱同義AFTER_DAMAGE。'},
  on_hit:{label:'命中／主傷害結算後',phase:'傷害結算',trigger:'after_hit',event:EffectTiming.ON_SKILL_HIT,help:'使用槽由技能after_hit分支執行；魂印與其他攜帶槽監控正式命中事件。'},
  after_attack_hit:{label:'每次攻擊命中後',phase:'傷害結算',trigger:'attack_hit',event:EffectTiming.AFTER_ATTACK_HIT,help:'每次實際命中分別派發；連擊5次便判定5次，不把整次技能當一擊，也不虛構每擊HP傷害。'},
  on_invalid:{label:'技能無效／未命中',phase:'行動收尾',trigger:'on_invalid',event:EffectTiming.ACTION_FAILED,help:'未成功出手方的收尾，不能同時訂閱SKILL_INVALID而重播。'},
  after_action:{label:'成功行動結束',phase:'行動收尾',trigger:'self_after_skill',event:EffectTiming.AFTER_ACTION,help:'成功出手才觸發；失敗走ACTION_FAILED。'},
  opponent_after_action:{label:'對手行動後',phase:'行動收尾',trigger:'opp_after_skill',event:EffectTiming.OPPONENT_AFTER_ACTION,help:'非行動方收到含成功／失敗結果的通知。'},
  extra_action_start:{label:'額外行動開始',phase:'行動收尾',trigger:'extra_action_start',event:EffectTiming.EXTRA_ACTION_START,help:'獨立額外行動節點，不等同連擊或重用技能。'},
  extra_action_end:{label:'額外行動結束',phase:'行動收尾',trigger:'extra_action_end',event:EffectTiming.EXTRA_ACTION_END,help:'每次額外行動的完整收尾，不用動畫次數推斷。'},
  battle_phase_end:{label:'戰鬥階段結束',phase:'回合收尾',trigger:'phase_end',event:EffectTiming.BATTLE_PHASE_END,help:'與回合結束是不同結算節點。'},
  round_start:{label:'回合開始',phase:'選擇與出手',trigger:'round_start',event:EffectTiming.ROUND_START,help:'每回合開始的正式派發，不是假定所有技能此時執行。'},
  round_end:{label:'回合結束',phase:'回合收尾',trigger:'round_end',event:EffectTiming.ROUND_END,help:'回合結束正式派發；期限與下N回合須另外設定。'},
  on_kill:{label:'擊敗對手',phase:'切換與陣亡',trigger:'kill',event:EffectTiming.ON_KILL,help:'正式擊敗事件，不靠HP<=0猜測特殊存活精靈。'},
  on_not_killed:{label:'出手流程末未擊敗對手',phase:'切換與陣亡',trigger:'not_killed',event:EffectTiming.NOT_KILLED,help:'正式死亡節點一確認出手含額外行動後仍未擊敗，不在使用時預判。'},
  self_fatal:{label:'致命抵擋判定',phase:'切換與陣亡',trigger:'fatal',event:EffectTiming.FATAL_RESIST,help:'致命抵擋時點，不等於已死亡。'},
  cthyaat_death:{label:'被擊敗時',phase:'切換與陣亡',trigger:'defeated',event:EffectTiming.DEATH_NODE_1,help:'正式被擊敗事件涵蓋三個死亡節點，以data.node讀取1、2、3；同一次陣亡僅結算一次。'},
  before_switch_out:{label:'主動切換前',phase:'切換與陣亡',trigger:'custom',event:EffectTiming.BEFORE_SWITCH_OUT,help:'主動切換的前置通知，不當成所有死亡強制切換的通知。'},
  on_switch_out:{label:'下場',phase:'切換與陣亡',trigger:'switch_out',event:EffectTiming.ON_SWITCH_OUT,help:'操作下場持有者；下場保留不代表傳給下一隻。'},
  pp_consumed:{label:'本技能槽PP被消耗',phase:'事件監控',trigger:'pp_consumed',event:EffectTiming.ON_PP_CONSUME,help:'出招及削PP皆按實際消耗槽通知；只執行攜帶效果，同一連鎖每槽一次，恢復PP不觸發。'},
  pp_cleared:{label:'自身PP被清除',phase:'事件監控',trigger:'pp_cleared',derived:'PP_CHANGED的clear原因與實際歸零槽',help:'只有清除令正PP歸零才觸發原持有者；普通消耗、削PP、恢復與原本0PP不觸發。'},
  battle_end:{label:'戰鬥結束',phase:'回合收尾',trigger:'custom',event:EffectTiming.BATTLE_END,help:'整場結束，不是每回合結束。'},
  any_battle_node:{label:'所有已接通事件',phase:'事件監控',trigger:'custom',derived:'上述正式事件的監控',help:'只監控此合約列出的事件；沒有列出的枚舉不是已接通入口。'},
};

export const EFFECT_NODE_LABELS: Record<string,string> = Object.fromEntries(Object.entries(EFFECT_NODES).map(([key,value])=>[key,value.label]));
const EVENT_NODE_MAP = new Map(Object.entries(EFFECT_NODES).filter(([,value])=>value.event).map(([key,value])=>[value.event!,key as Node]));
export function eventEffectNode(event: EffectTiming): Node | undefined {return EVENT_NODE_MAP.get(event);}
