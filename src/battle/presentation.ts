/** 播放層只保存已結算的紀錄，永遠不寫回 BattleState。 */
export type PresentationKind = 'skill' | 'fixed' | 'percent' | 'heal' | 'true' | 'adjust_up' | 'adjust_down' | 'notice';
export interface PresentationEvent {
  side: 'p1' | 'p2'; elfId: string; type: PresentationKind;
  amount: number; delta: number; before: number; after: number; maxHp: number;
  label?: string; text?: string; isCrit?: boolean; immediate?: boolean;
  /** 0／負體力仍存活的事件不應視為陣亡播放邊界。 */
  alive?: boolean;
}
export class BattlePresentation {
  turnNumber = 1;
  hp = new Map<string, number>();
  popups: any[] = [];
  private deferred: PresentationEvent[] = [];
  private tail = Promise.resolve();
  private active = true;
  private sequence = 0;
  private cancelWait?: () => void;
  constructor(private notify: () => void, private fast: () => boolean) {}
  private key(e: Pick<PresentationEvent, 'side' | 'elfId'>) { return `${e.side}:${e.elfId}`; }
  record(e: PresentationEvent): Promise<void> {
    if (!this.active) return Promise.resolve();
    if (!this.hp.has(this.key(e))) this.hp.set(this.key(e), e.before);
    // 致命事件是呈現邊界；此時不能按顏色重排，否則會看成先死再回血。
    if (e.alive !== true && e.after <= 0 && e.delta < 0) {
      const prior = this.deferred.splice(0);
      return this.enqueue([...prior, e]);
    }
    if (e.type === 'skill' || e.type === 'notice' || e.immediate) return this.enqueue([e]);
    this.deferred.push(e);
    return Promise.resolve();
  }
  flush(chronological = false): Promise<void> {
    const events = this.deferred.splice(0);
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
        const id = `presentation_${++this.sequence}`;
        this.popups = [{ ...e, id, text: e.text ?? `${e.type === 'heal' || e.type === 'adjust_up' ? '+' : '-'}${e.amount}` }];
        this.notify();
        if (!this.fast()) await this.pause(520);
        if (!this.active) return;
        this.popups = [];
        this.notify();
        // 等待退場完成才放行下一筆與下一回合，避免 AnimatePresence 殘留交疊。
        if (!this.fast()) await this.pause(160);
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
    this.popups = [];
    this.hp.clear();
    this.cancelWait?.();
  }
}
