import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Elf } from '../types';
import { DEFAULT_ELVES } from '../data/defaultElves';
import { applySavedSkillCorrections } from '../data/savedSkillCorrections';
import { resetElfStateForBattle } from '../utils/statCalculator';
import { battleChecksum, createRemoteQueue, validSelection, type LockstepSelection, type OnlineSide } from './lockstep';
import type { OnlineLoadout } from './lockstep';

const BattleScreen = lazy(() => import('../components/BattleScreen'));

export interface OnlineMatch {
  seed: number;
  localSide: OnlineSide;
  p1: { team: Elf[]; loadout: OnlineLoadout; name: string };
  p2: { team: Elf[]; loadout: OnlineLoadout; name: string };
}
/** 連線層傳進來的對戰訊息（已通過 validRoomMessage）。 */
export type BattleWire = { kind: 'action'; sel: unknown } | { kind: 'sync'; turn: number; hash: string } | { kind: 'resign' };

/**
 * 雙人連線對戰畫面：雙方各跑同種子引擎，只交換選擇與每回合戰況摘要（見 lockstep.ts）。
 * 摘要不一致、對手離線或投降時結束對戰並顯示原因。
 */
export function OnlineBattle({ match, send, inbox, connected, onLeave }: {
  match: OnlineMatch;
  send: (message: object) => boolean;
  /** 由連線層把對戰訊息推進來。 */
  inbox: React.MutableRefObject<((message: BattleWire) => void) | null>;
  connected: boolean;
  onLeave: () => void;
}) {
  const remoteSide: OnlineSide = match.localSide === 'p1' ? 'p2' : 'p1';
  const [ended, setEnded] = useState<{ title: string; detail: string } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const driverRef = useRef<any>(null);
  const queueRef = useRef(createRemoteQueue(selection => driverRef.current?.applyRemoteSelection(selection) ?? false));
  const hashes = useRef({ local: new Map<number, string>(), remote: new Map<number, string>() });
  const lastSynced = useRef(0);

  const teams = useMemo(() => {
    const prepare = (team: Elf[], loadout: OnlineLoadout) => team.map(saved => {
      const elf = applySavedSkillCorrections(structuredClone(saved), DEFAULT_ELVES);
      return resetElfStateForBattle(elf, elf.id === loadout.starterId, loadout.equipment.suit || undefined);
    });
    return { p1: prepare(match.p1.team, match.p1.loadout), p2: prepare(match.p2.team, match.p2.loadout) };
  }, [match]);

  const finish = (title: string, detail: string) => setEnded(previous => previous ?? { title, detail });
  const compare = (turn: number) => {
    const mine = hashes.current.local.get(turn), theirs = hashes.current.remote.get(turn);
    if (mine && theirs && mine !== theirs) {
      finish('雙方戰況不同步', `第 ${turn} 回合雙方的戰況不一致，為避免各打各的已停止對戰。請確認雙方是同一個遊戲版本後重新開房。`);
      send({ kind: 'resign' });
    }
  };

  useEffect(() => {
    inbox.current = message => {
      if (message.kind === 'action') {
        if (!validSelection(message.sel, remoteSide)) { finish('收到無效操作', '對手送來不合法的操作，已停止對戰。'); return; }
        queueRef.current.push(message.sel as LockstepSelection);
        setWaiting(false);
      } else if (message.kind === 'sync') {
        hashes.current.remote.set(message.turn, message.hash);
        compare(message.turn);
      } else if (message.kind === 'resign') finish('對手已離開對戰', '對手投降或離開，對戰結束。');
    };
    return () => { inbox.current = null; };
  }, []);
  useEffect(() => { if (!connected) finish('連線已中斷', '與對手的連線中斷，對戰結束。'); }, [connected]);

  const lockstep = useMemo(() => ({
    localSide: match.localSide,
    onLocalSelection: (selection: LockstepSelection) => {
      if (!send({ kind: 'action', sel: selection })) finish('無法送出操作', '連線暫時無法送出操作，對戰結束。');
      setWaiting(true);
    },
  }), [match.localSide]);

  const onState = (state: any) => {
    queueRef.current.flush();
    // 每回合開始（雙方都回到選擇階段的同一刻）交換戰況摘要。
    if (state?.phase === 'p1_select' && state.turnNumber > lastSynced.current) {
      lastSynced.current = state.turnNumber;
      const hash = battleChecksum(state);
      hashes.current.local.set(state.turnNumber, hash);
      send({ kind: 'sync', turn: state.turnNumber, hash });
      compare(state.turnNumber);
    }
    const remoteTurn = state?.phase === `${remoteSide}_select` || state?.phase === `forced_switch_${remoteSide}` || state?.phase === 'forced_switch_both';
    setWaiting(!!remoteTurn && !state?.winner);
  };

  const name = (side: OnlineSide) => (side === match.localSide ? '你' : '對手') + '：' + match[side].name;
  return <div className="online-battle" role="region" aria-label="雙人連線對戰" style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#05080f' }}>
    <Suspense fallback={<p role="status" style={{ color: '#cbd5e1', padding: 24 }}>正在載入對戰…</p>}>
      <BattleScreen
        initialP1Team={teams.p1} initialP2Team={teams.p2}
        p1StarterId={match.p1.loadout.starterId} p2StarterId={match.p2.loadout.starterId}
        p1Suit={match.p1.loadout.equipment.suit} p1Eyewear={match.p1.loadout.equipment.eyewear} p1Title={match.p1.loadout.equipment.title}
        p2Suit={match.p2.loadout.equipment.suit} p2Eyewear={match.p2.loadout.equipment.eyewear} p2Title={match.p2.loadout.equipment.title}
        battleFlames={{ p1: match.p1.loadout.equipment.flame || undefined, p2: match.p2.loadout.equipment.flame || undefined }}
        battleMode="PVP" preparedTeams randomSeed={match.seed}
        battleFormat={teams.p1.length === 1 ? 'solo_1v1' : 'peak_6v6'}
        lockstep={lockstep}
        onDriverInit={driver => { driverRef.current = driver; queueRef.current.flush(); }}
        onStateChange={onState}
        onBattleEnd={winner => {
          if (winner === 'exit') { send({ kind: 'resign' }); finish('你已離開對戰', '已通知對手。'); return; }
          finish(winner === 'draw' ? '平手' : winner === match.localSide ? '勝利' : '落敗', '對戰結束。');
        }}
        onBackToMenu={() => { if (!ended) send({ kind: 'resign' }); onLeave(); }}
        onRestartBattle={() => {}}
      />
    </Suspense>
    <p role="status" title={name('p1') + ' · ' + name('p2')} style={{ position: 'fixed', left: 12, top: 8, zIndex: 61, margin: 0, padding: '2px 10px', borderRadius: 999, background: '#0f172acc', color: '#cbd5e1', fontSize: 12, pointerEvents: 'none' }}>
      雙人連線 · 你是 {match.localSide === 'p1' ? 'P1（左）' : 'P2（右）'}{waiting && !ended ? ' · 等待對手' : ''}
    </p>
    {ended && <div role="alertdialog" aria-label={ended.title} style={{ position: 'fixed', inset: 0, zIndex: 62, display: 'grid', placeItems: 'center', background: '#000a' }}>
      <section style={{ background: '#0f172a', color: '#e2e8f0', padding: 24, borderRadius: 12, maxWidth: 420, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{ended.title}</h2>
        <p style={{ margin: 0 }}>{ended.detail}</p>
        <button type="button" className="peer-button" data-primary onClick={onLeave}>返回房間</button>
      </section>
    </div>}
  </div>;
}
