/** 播放層只保存已結算的紀錄，永遠不寫回 BattleState。 */
import { DEFAULT_BATTLE_ANIMATION, type BattleAnimationSettings } from './animationSettings';
import { damagePopupLabel } from './damagePopupStyle';
export type PresentationKind = 'skill' | 'fixed' | 'percent' | 'heal' | 'true' | 'adjust_up' | 'adjust_down' | 'notice';
export interface PresentationEvent {
  side: 'p1' | 'p2'; elfId: string; type: PresentationKind;
  amount: number; delta: number; before: number; after: number; maxHp: number;
  label?: string; text?: string; isCrit?: boolean; immediate?: boolean;
  /** 0／負體力仍存活的事件不應視為陣亡播放邊界。 */
  alive?: boolean;
  /** 播放通道（由播放層填入）：決定受哪個動畫開關控制。 */
  channel?: PresentationChannel;
  /** 攻擊傷害的克制標示（原廠：克制／微弱／普通／無效） */
  effectiveness?: Effectiveness;
  /** 攻擊方與技能名（技能名顯示在攻擊方本體上） */
  sourceSide?: 'p1' | 'p2'; skillName?: string;
}
export type Effectiveness = '克制' | '微弱' | '普通' | '無效';
export function effectivenessLabel(typeMultiplier: unknown): Effectiveness | undefined {
  if (typeof typeMultiplier !== 'number' || !Number.isFinite(typeMultiplier)) return undefined;
  return typeMultiplier <= 0 ? '無效' : typeMultiplier > 1 ? '克制' : typeMultiplier < 1 ? '微弱' : '普通';
}
/** 彈出數字停留時間（毫秒）：技能紅字 1.3 秒，其餘 1 秒。 */
export const POPUP_HOLD_MS = { skill: 1300, other: 1000, exit: 340 };
export type PresentationChannel = 'damage' | 'extra' | 'potion' | 'roundEnd';
export class BattlePresentation {
  turnNumber = 1;
  hp = new Map<string, number>();
  popups: any[] = [];
  private deferred: PresentationEvent[] = [];
  private dead = new Set<string>();
  /** 已排入播放（含尚未播完）的預定體力；用於對帳直接改體力的效果。 */
  private planned = new Map<string, number>();
  private tail = Promise.resolve();
  private active = true;
  private sequence = 0;
  private cancelWait?: () => void;
  /** 額外行動節點中的技能傷害：先收集，節點結束只播一次。 */
  private extraDepth = 0;
  /** 是否在某隻精靈的出手流程中。出手外（回合開始／結束等節點）的技能傷害不即時播，留到回合末或致死時。 */
  private inAction = true;
  /** 出手中致死的非紅字（真傷、粉傷等）：先讓出招與紅字播完，出手結束（或陣亡判定）時再結算。 */
  private fatalPending = false;
  setInAction(v: boolean) {
    this.inAction = v;
    if (this.fatalPending) { this.fatalPending = false; void this.flush(); }
  }
  private extraPending: PresentationEvent[] = [];
  constructor(private notify: () => void, private fast: () => boolean,
    private settings: () => BattleAnimationSettings = () => DEFAULT_BATTLE_ANIMATION) {}
  private visible(e: PresentationEvent) {
    const s = this.settings();
    return e.channel === 'extra' ? s.extra : e.channel === 'potion' ? s.potion : e.channel === 'roundEnd' ? s.roundEnd : s.damage;
  }
  /** 開始額外行動節點；期間的紅字合併成一筆，不論額外行動幾次。 */
  beginExtra() { this.extraDepth++; }
  /** 結束額外行動節點：紅字播完後多播一次（合併）。 */
  endExtra(): Promise<void> {
    if (this.extraDepth > 0) this.extraDepth--;
    if (this.extraDepth > 0) return this.tail;
    return this.enqueue(this.mergeExtra());
  }
  private mergeExtra(): PresentationEvent[] {
    const pending = this.extraPending.splice(0);
    const merged = new Map<string, PresentationEvent>();
    for (const e of pending) {
      const key = this.key(e);
      const previous = merged.get(key);
      merged.set(key, previous ? { ...previous, amount: previous.amount + e.amount, delta: previous.delta + e.delta,
        after: e.after, maxHp: e.maxHp, isCrit: previous.isCrit || e.isCrit, alive: e.alive } : { ...e });
    }
    return [...merged.values()].map(e => ({ ...e, type: 'skill' as const, channel: 'extra' as const, label: '額外行動', skillName: e.skillName || '額外行動' }));
  }
  private key(e: Pick<PresentationEvent, 'side' | 'elfId'>) { return `${e.side}:${e.elfId}`; }
  /**
   * 播放規則（依原廠）：
   * - 出手：（藥劑綠字）→ 出招 → 紅字技能傷害（克制標示、實際傷害值）→ 額外行動合併紅字。
   * - 技能傷害＝受屬性克制影響的傷害，發生當下即播（含回合開始等節點，不另外重排）。
   * - 固定／百分比／回血／體力調整：延到回合結束，依精靈合併為「體力淨變化」一筆；正→綠字黃框、負→粉字、0 不播。
   * - 真實傷害：收尾合併白字，與同一收尾節點的粉／綠字同步展示，不重排效果結算。
   * - 陣亡不再把累積的延後紀錄提前插播；只在延後紀錄本身致命時，先把延後紀錄依上述規則結算。
   */
  record(e: PresentationEvent): Promise<void> {
    if (!this.active) return Promise.resolve();
    if (!this.hp.has(this.key(e))) this.hp.set(this.key(e), e.before);
    const instant = (e.type === 'skill' && this.inAction) || e.type === 'notice' || e.immediate;
    const extra = this.extraDepth > 0 && e.type === 'skill';
    const fatal = e.alive !== true && e.after <= 0 && e.delta < 0;
    if (extra) {
      this.extraPending.push(e);
      // 額外行動中擊倒：立即播出合併的額外行動紅字
      return fatal ? this.enqueue(this.mergeExtra()) : Promise.resolve();
    }
    if (instant) return this.enqueue([{ ...e, channel: e.immediate && e.type === 'heal' ? 'potion' : 'damage' }]);
    this.deferred.push(e);
    if (fatal && this.inAction) { this.fatalPending = true; return Promise.resolve(); }
    return fatal ? this.flush() : Promise.resolve();
  }
  /** 同一收尾節點的體力淨變化（綠／粉）與真實傷害（白）同步播；不重排戰鬥結算。 */
  flush(_chronological = false): Promise<void> {
    this.fatalPending = false;
    const events = this.deferred.splice(0);
    // 出手外的技能傷害（回合開始等）：紅字先播（保留克制標示），再播體力淨變化與真傷
    const skills = events.filter(e => e.type === 'skill');
    const rest = events.filter(e => e.type !== 'skill');
    const net = new Map<string, PresentationEvent & { n: number }>();
    const trueDmg = new Map<string, PresentationEvent & { n: number }>();
    for (const e of rest) {
      const k = this.key(e);
      const bucket = e.type === 'true' ? trueDmg : net;
      const prev = bucket.get(k);
      if (e.type === 'true') {
        bucket.set(k, prev ? { ...prev, amount: prev.amount + e.amount, delta: prev.delta + e.delta, after: e.after, maxHp: e.maxHp, alive: e.alive, n: prev.n + 1 }
          : { ...e, n: 1 });
      } else {
        bucket.set(k, prev ? { ...prev, delta: prev.delta + e.delta, after: e.after, maxHp: e.maxHp, alive: e.alive, n: prev.n + 1 }
          : { ...e, n: 1 });
      }
    }
    const out: PresentationEvent[] = skills.map(e => ({ ...e }));
    for (const g of net.values()) {
      const { n: _n, ...e } = g;
      if (e.delta === 0) { out.push({ ...e, type: 'adjust_up', amount: 0, label: undefined, silent: true } as any); continue; }
      out.push({ ...e, type: e.delta > 0 ? 'heal' : 'fixed', amount: Math.abs(e.delta), label: undefined, isCrit: false, effectiveness: undefined });
    }
    for (const g of trueDmg.values()) {
      const { n, ...e } = g;
      out.push({ ...e, type: 'true', label: n > 1 ? `真實傷害（${n}筆）` : e.label });
    }
    return this.enqueue(out.map(e => ({ ...e, channel: 'roundEnd' as const })), true);
  }
  wait() { return this.tail; }
  /**
   * 回合末對帳：有些效果直接改體力而沒有留下紀錄（例如部分魂印回血）。
   * 預定體力（已排入＋待播）與實際不符時，差額補成一筆體力調整，併入回合末淨變化。
   */
  reconcile(side: 'p1' | 'p2', elf: { id: string; battleId?: string; currentHp: number; maxHp: number }) {
    if (!this.active) return;
    const key = `${side}:${elf.battleId || elf.id}`;
    if (this.dead.has(key) || !this.hp.has(key) && !this.planned.has(key)) return;
    const base = this.planned.get(key) ?? this.hp.get(key)!;
    const pending = [...this.deferred, ...this.extraPending].filter(e => this.key(e) === key).reduce((n, e) => n + e.delta, 0);
    const expected = base + pending;
    const diff = elf.currentHp - expected;
    if (!diff) return;
    this.deferred.push({ side, elfId: elf.battleId || elf.id, type: diff > 0 ? 'adjust_up' : 'adjust_down', amount: Math.abs(diff), delta: diff,
      before: expected, after: elf.currentHp, maxHp: elf.maxHp, alive: true });
  }
  private enqueue(events: PresentationEvent[], simultaneous = false): Promise<void> {
    for (const e of events) {
      const k = this.key(e);
      const cur = this.planned.get(k) ?? this.hp.get(k) ?? e.before;
      this.planned.set(k, e.alive !== true && e.after <= 0 ? e.after : cur + e.delta);
    }
    const play = async () => {
      const frames = simultaneous ? [events] : events.map(e => [e]);
      for (const frame of frames) {
        if (!this.active) return;
        const alreadyDead = new Set(this.dead);
        const popups: any[] = [];
        for (const e of frame) {
          const key = this.key(e);
          // 同一畫面中先記錄致死粉字，不得吞掉一起播放的白字。
          if (alreadyDead.has(key) && e.type !== 'skill') continue;
          const cur = this.hp.get(key) ?? e.before;
          const fatal = e.alive !== true && e.after <= 0;
          // 致命：直接顯示真實結果；非致命：相對變化，不製造假陣亡。
          this.hp.set(key, fatal ? e.after : e.after > 0 ? Math.min(e.maxHp, Math.max(1, cur + e.delta)) : cur + e.delta);
          if (fatal) this.dead.add(key);
          if ((e as any).silent || !this.visible(e)) continue;
          const id = `presentation_${++this.sequence}`;
          popups.push({ ...e, label: damagePopupLabel(e.label), id,
            text: e.text ?? `${e.type === 'heal' || e.type === 'adjust_up' ? '+' : '-'}${e.amount}` });
        }
        this.popups = popups;
        this.notify();
        if (!popups.length) continue;
        if (!this.fast()) await this.pause(popups.some(e => e.type === 'skill') ? POPUP_HOLD_MS.skill : POPUP_HOLD_MS.other);
        if (!this.active) return;
        this.popups = [];
        this.notify();
        // 等待退場完成才放行下一筆與下一回合，避免 AnimatePresence 殘留交疊。
        if (!this.fast()) await this.pause(POPUP_HOLD_MS.exit);
      }
    };
    this.tail = this.tail.then(play);
    return this.tail;
  }
  private pause(ms: number) {
    return new Promise<void>(resolve => {
      const timer = setTimeout(() => { this.cancelWait = undefined; resolve(); }, ms);
      this.cancelWait = () => { clearTimeout(timer); resolve(); };
    });
  }
  align(side: 'p1' | 'p2', elf: { id: string; battleId?: string; currentHp: number }) {
    if (!this.active) return;
    const key = `${side}:${elf.battleId || elf.id}`;
    this.hp.set(key, elf.currentHp);
    this.planned.set(key, elf.currentHp);
    if (elf.currentHp > 0) this.dead.delete(key);
    this.notify();
  }
  dispose() {
    this.active = false;
    this.deferred = [];
    this.extraPending = [];
    this.extraDepth = 0;
    this.popups = [];
    this.hp.clear();
    this.dead.clear();
    this.planned.clear();
    this.cancelWait?.();
  }
}
