import { registerBattleRule } from '../../engine/battleRules';
import { checkElfDead } from '../../battle/elfAlive';
import { getMark, setMark, clearMark, markAppliesToElf } from '../../battle/marks';

export interface SnapshotResourceRule {
  id: string; name: string; displayChar: string; snapshotKey: string;
  perRound: number; receiverKey: string;
}
const idOf = (e: any) => String(e?.battleId || e?.id || '');
const owners = (state: any) => [...state.p1Team, ...state.p2Team].filter((e: any) => e && !checkElfDead(e) && e.snapshotResourceRules);
const appendSnapshots = (elf: any, cfg: SnapshotResourceRule, incoming: number[]) => {
  const old = getMark((elf.marks || []).filter((mark: any) => markAppliesToElf(mark, elf)), cfg.id);
  const snapshots = [...(old?.effects?.[cfg.snapshotKey] || []), ...incoming];
  elf.marks = setMark(elf.marks || [], { id: cfg.id, name: cfg.name, displayChar: cfg.displayChar, unit: '篇', count: snapshots.length,
    ownerBattleId: idOf(elf), scope: 'elf', clearable: false, persistsOffField: true, source: cfg.name,
    description: '每份獨立記錄取得時體力上限；死亡時轉交存活接收者。', effects: { ...old?.effects, [cfg.snapshotKey]: snapshots } });
};
const sync = (api: any, state: any, side: 'p1' | 'p2', elf: any) => {
  api.dispatch({ type: 'UPDATE_ELF', side, targetId: idOf(elf), elf: { marks: elf.marks || [] } });
  const active = state[side + 'Team'][state[side + 'ActiveIndex']];
  if (idOf(active) === idOf(elf)) { state[side + 'Marks'] = elf.marks || []; api.dispatch({ type: 'SET_MARKS', side, marks: elf.marks || [] }); }
};
// 所有規則均由有效Kit安裝的參數驅動，未安裝者不因名稱或原文自動取得能力。
registerBattleRule({
  id: 'generic:snapshot-resources',
  roundStart(api, state) {
    const round = state.turnNumber;
    for (const source of owners(state)) for (const cfg of Object.values(source.snapshotResourceRules) as SnapshotResourceRule[]) {
      const stamp = cfg.id + ':' + round;
      source.snapshotResourceRoundStamps ||= {};
      if (source.snapshotResourceRoundStamps[cfg.id] === stamp) continue;
      source.snapshotResourceRoundStamps[cfg.id] = stamp;
      const ownerSide = state.p1Team.some((e:any)=>idOf(e)===idOf(source)) ? 'p1' : 'p2';
      api.dispatch({type:'UPDATE_ELF',side:ownerSide,targetId:idOf(source),elf:{snapshotResourceRoundStamps:{...source.snapshotResourceRoundStamps}}});
      for (const side of ['p1', 'p2'] as const) for (const elf of state[side + 'Team']) {
        if (!elf || checkElfDead(elf)) continue;
        appendSnapshots(elf, cfg, Array.from({ length: cfg.perRound }, () => elf.maxHp));
        sync(api, state, side, elf);
      }
    }
  },
  faint(api, state) {
    const sources = owners(state);
    const configs = new Map<string, SnapshotResourceRule>();
    for (const source of sources) for (const cfg of Object.values(source.snapshotResourceRules) as SnapshotResourceRule[]) configs.set(cfg.id, cfg);
    for (const cfg of configs.values()) {
      const receivers = sources.filter((e: any) => e.snapshotResourceRules?.[cfg.id]?.receiverKey === cfg.receiverKey);
      for (const side of ['p1', 'p2'] as const) for (const elf of state[side + 'Team']) {
        // 2026-10-28 修正：死亡精靈必須能「轉出」詩章（原本被 checkElfDead 跳過，體力上限吸收永遠不生效）。
        if (!elf) continue;
        const dead = checkElfDead(elf);
        const mark = getMark(elf.marks || [], cfg.id);
        const snapshots = mark?.effects?.[cfg.snapshotKey];
        if (!Array.isArray(snapshots) || !snapshots.length || (mark.ownerBattleId && mark.ownerBattleId !== idOf(elf))) continue;
        const total = snapshots.reduce((sum: number, hp: number) => sum + Math.max(0, Number(hp) || 0), 0);
        // 先消耗原持有者，避免死亡節點重播時重複轉交。
        elf.marks = clearMark(elf.marks || [], cfg.id, idOf(elf));
        sync(api, state, side, elf);
        for (const receiver of receivers) {
          appendSnapshots(receiver, cfg, snapshots);
          receiver.maxHp += total;
          if (receiver.calculatedStats) receiver.calculatedStats = { ...receiver.calculatedStats, hp: receiver.maxHp };
          const receiverSide = state.p1Team.some((e:any)=>idOf(e)===idOf(receiver)) ? 'p1' : 'p2';
          api.dispatch({type:'UPDATE_ELF',side:receiverSide,targetId:idOf(receiver),elf:{maxHp:receiver.maxHp,calculatedStats:receiver.calculatedStats}});
          sync(api, state, receiverSide, receiver);
        }
      }
    }
  },
});
