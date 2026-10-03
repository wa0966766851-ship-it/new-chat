/** 播放層只保存已結算的紀錄，永遠不寫回 BattleState。 */
import { DEFAULT_BATTLE_ANIMATION, type BattleAnimationSettings } from './animationSettings';
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
  private tail = Promise.resolve();
  private active = true;
  private sequence = 0;
  private cancelWait?: () => void;
  /** 額外行動節點中的技能傷害：先收集，節點結束只播一次。 */
  private extraDepth = 0;
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
    return [...merged.values()].map(e => ({ ...e, type: 'skill' as const, channel: 'extra' as const, label: '額外行動' }));
  }
  private key(e: Pick<PresentationEvent, 'side' | 'elfId'>) { return `${e.side}:${e.elfId}`; }
  record(e: PresentationEvent): Promise<void> {
    if (!this.active) return Promise.resolve();
    if (!this.hp.has(this.key(e))) this.hp.set(this.key(e), e.before);
    // 致命事件是呈現邊界；此時不能按顏色重排，否則會看成先死再回血。
    const instant = e.type === 'skill' || e.type === 'notice' || e.immediate;
    const extra = this.extraDepth > 0 && e.type === 'skill';
    if (e.alive !== true && e.after <= 0 && e.delta < 0) {
      // 致命：先播已收集的額外行動紅字，再依原序播放累積的非紅傷，最後是致命這筆。
      if (extra) this.extraPending.push(e);
      const head = this.extraDepth > 0 ? this.mergeExtra() : [];
      const prior = this.deferred.splice(0).map(p => ({ ...p, channel: 'roundEnd' as const }));
      const last = extra ? [] : [{ ...e, channel: instant ? (e.immediate && e.type === 'heal' ? 'potion' as const : 'damage' as const) : 'roundEnd' as const }];
      return this.enqueue([...head, ...prior, ...last]);
    }
    if (extra) { this.extraPending.push(e); return Promise.resolve(); }
    if (instant) return this.enqueue([{ ...e, channel: e.immediate && e.type === 'heal' ? 'potion' : 'damage' }]);
    this.deferred.push(e);
    return Promise.resolve();
  }
  flush(chronological = false): Promise<void> {
    const events: PresentationEvent[] = this.deferred.splice(0).map(e => ({ ...e, channel: 'roundEnd' as const }));
    if (!chronological) {
      const rank = (e: PresentationEvent) => e.type === 'fixed' || e.type === 'percent' ? 0 : e.type === 'heal' || e.type === 'adjust_up' ? 1 : 2;
      // 只排序播放紀錄；同組保持原順序，不遺漏任何一筆真傷。
      events.sort((a, b) => rank(a) - rank(b));
      const groups = new Map<string, PresentationEvent>();
      const counts = new Map<string, number>();
      for (const e of events) {
        const kind = e.type === 'percent' ? 'fixed' : e.type === 'adjust_up' ? 'heal' : e.type;
        const key = `${this.key(e)}:${kind}`;
        const previous = groups.get(key);
        groups.set(key, previous ? { ...previous, amount: previous.amount + e.amount,
          delta: previous.delta + e.delta, after: e.after, maxHp: e.maxHp } : { ...e, type: kind });
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      events.splice(0, events.length, ...[...groups].map(([key, e]) => ({ ...e,
        label: (counts.get(key) || 0) > 1 ? `${e.type === 'fixed' ? '粉傷' : e.type === 'heal' ? '回血' : e.type === 'true' ? '真實傷害' : '體力調整'}（${counts.get(key)}筆）` : e.label })));
    }
    return this.enqueue(events);
  }
  wait() { return this.tail; }
  private enqueue(events: PresentationEvent[]): Promise<void> {
    const play = async () => {
      for (const e of events) {
        if (!this.active) return;
        const key = this.key(e);
        const hp = (this.hp.get(key) ?? e.before) + e.delta;
        // 非致命紀錄的分組播放不製造假陣亡；最後對齊真實快照。
        this.hp.set(key, e.after > 0 ? Math.min(e.maxHp, Math.max(1, hp)) : hp);
        if (!this.visible(e)) { this.notify(); continue; }
        const id = `presentation_${++this.sequence}`;
        this.popups = [{ ...e, id, text: e.text ?? `${e.type === 'heal' || e.type === 'adjust_up' ? '+' : '-'}${e.amount}` }];
        this.notify();
        if (!this.fast()) await this.pause(e.type === 'skill' ? POPUP_HOLD_MS.skill : POPUP_HOLD_MS.other);
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
    this.hp.set(`${side}:${elf.battleId || elf.id}`, elf.currentHp);
    this.notify();
  }
  dispose() {
    this.active = false;
    this.deferred = [];
    this.extraPending = [];
    this.extraDepth = 0;
    this.popups = [];
    this.hp.clear();
    this.cancelWait?.();
  }
}
