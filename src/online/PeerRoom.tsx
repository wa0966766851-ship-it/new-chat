import type {OnlinePreparation} from './preparation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Link2, Network, X } from 'lucide-react';
import { readBattleGameSkin } from '../components/battle/gameHud';
import { DEFAULT_ELVES } from '../data/defaultElves';
import { connectRoom,normalizeSignalOrigin, type RoomConnection } from './roomConnection';
import type {MatchMode} from './matchmaking';
import { chunks, decodeLoadout, encodeLoadout, type OnlineLoadout } from './lockstep';
import { OnlineBattle, type BattleWire, type OnlineMatch } from './OnlineBattle';
import './peerRoom.css';

type Stage = 'idle' | 'opening' | 'waiting' | 'negotiating' | 'connected' | 'disconnected';
const LABEL: Record<Stage, string> = {
  idle: '', opening: '正在聯絡信令服務', waiting: '等待對手加入', negotiating: '正在建立資料通道',
  connected: '已連線', disconnected: '連線已中斷',
};
const candidates = DEFAULT_ELVES.filter(elf => !elf.isExtra && !elf.isCustom);
/** 精靈名單在載入完成後才齊全：每次取用時重新篩選。 */
const catalog = () => DEFAULT_ELVES.filter(elf => !elf.isExtra && !elf.isCustom);
const NO_EQUIPMENT = { suit: '', eyewear: '', title: '', flame: '' };

export default function PeerRoom({ starterId, onClose, prepared,autoMatch=false }: { starterId?: string; onClose: () => void;prepared?:OnlinePreparation;autoMatch?:boolean }) {
  const [origin, setOrigin] = useState(() => (import.meta as ImportMeta & { env: { VITE_SEER_P2P_ORIGIN?: string } }).env.VITE_SEER_P2P_ORIGIN || localStorage.getItem('seer_online_signal_origin') || location.origin);
  const [playerName,setPlayerName]=useState('玩家');
  const [peerName,setPeerName]=useState('');
  const [matchMode,setMatchMode]=useState<MatchMode>(prepared?.mode||'peak');
  const [matchSeconds,setMatchSeconds]=useState<number>();
  const [invite, setInvite] = useState('');
  const [allowDirect, setAllowDirect] = useState(()=>localStorage.getItem('seer_online_allow_direct')==='true');
  const [stage, setStage] = useState<Stage>('idle');
  const [ownCode, setOwnCode] = useState('');
  const [role, setRole] = useState<'host' | 'guest'>();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [elfId, setElfId] = useState(() => prepared?.starterId || candidates.find(elf => elf.id === starterId)?.id || candidates[0]?.id || '');
  const [latency, setLatency] = useState<number | null>(null);
  const [readyDeadline,setReadyDeadline]=useState<number>();
  const [readySeconds,setReadySeconds]=useState<number>();
  const [confirmed,setConfirmed]=useState(false);
  const [peerConfirmed,setPeerConfirmed]=useState(false);
  const confirmations=useRef({self:false,peer:false});
  const [ready, setReady] = useState(false);
  const [peerElf, setPeerElf] = useState<string | null>(null);
  // 對戰同步：雙方隊伍、開戰資訊、對戰中訊息的轉交。
  const [peerLoadout, setPeerLoadout] = useState<{ team: import('../types').Elf[]; loadout: OnlineLoadout } | null>(null);
  const peerLoadoutRef = useRef<typeof peerLoadout>(null);
  const parts = useRef<string[]>([]);
  const myLoadout = useRef<OnlineLoadout | null>(null);
  const [match, setMatch] = useState<OnlineMatch | null>(null);
  const matchRef = useRef<OnlineMatch | null>(null);
  const battleInbox = useRef<((message: BattleWire) => void) | null>(null);
  const peerNameRef = useRef('');
  const abort = useRef<AbortController | null>(null);
  const transport = useRef<RoomConnection | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    return () => { abort.current?.abort(); transport.current?.close(); };
  }, []);

  useEffect(()=>{if(autoMatch)void open(false,true);},[]);

  /** 清掉雙方就緒與隊伍（重新準備、離開房間、對戰結束時）。 */
  function resetMatchState() {
    parts.current = []; myLoadout.current = null; peerLoadoutRef.current = null; setPeerLoadout(null);
    matchRef.current = null; setMatch(null);
  }
  /** 本機要送出的隊伍：大廳已鎖定的 6 隻隊伍，或房間裡選的單隻精靈。 */
  function buildLoadout(): OnlineLoadout {
    const list = catalog();
    if (prepared) return encodeLoadout(prepared.team, prepared.starterId, prepared.equipment, list);
    const elf = list.find(e => e.id === elfId);
    if (!elf) throw Error('請先選擇出戰精靈');
    return encodeLoadout([structuredClone(elf)], elf.id, NO_EQUIPMENT, list);
  }
  /** 隊伍切片後依序送出（每片間隔，避免超過對方的訊息頻率上限），最後才送就緒。 */
  async function sendReady(): Promise<boolean> {
    const loadout = buildLoadout();
    const pieces = chunks(JSON.stringify(loadout));
    if (pieces.length > 40) { setError('隊伍資料過大，無法傳送'); return false; }
    for (let i = 0; i < pieces.length; i++) {
      if (!transport.current?.send({ kind: 'loadout-part', i, n: pieces.length, data: pieces[i] })) return false;
      if (pieces.length > 1) await new Promise(done => setTimeout(done, 120));
    }
    myLoadout.current = loadout;
    return !!transport.current?.send({ kind: 'ready', elfId: loadout.starterId });
  }
  function takeLoadoutPart(data: { i: number; n: number; data: string }) {
    if (data.i === 0) parts.current = [];
    parts.current[data.i] = data.data;
    if (parts.current.filter(x => typeof x === 'string').length !== data.n) return;
    const text = parts.current.join(''); parts.current = [];
    try {
      const size = prepared ? prepared.team.length : 1;
      const decoded = decodeLoadout(JSON.parse(text), catalog(), size);
      peerLoadoutRef.current = decoded; setPeerLoadout(decoded);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '對手隊伍無法讀取'); }
  }
  /** 雙方隊伍都到齊後開戰：P1＝房主、P2＝加入者，兩邊引擎方向一致。 */
  function beginMatch(seed: number) {
    const mine = myLoadout.current, theirs = peerLoadoutRef.current, seat = transport.current?.seat;
    if (!mine || !theirs || !seat || matchRef.current) return false;
    const own = { team: decodeLoadout(mine, catalog()).team, loadout: mine, name: playerName.trim() || '玩家' };
    const other = { team: theirs.team, loadout: theirs.loadout, name: peerNameRef.current || '對手' };
    const next: OnlineMatch = seat === 'host' ? { seed, localSide: 'p1', p1: own, p2: other } : { seed, localSide: 'p2', p1: other, p2: own };
    matchRef.current = next; setMatch(next);
    return true;
  }

  async function open(join: boolean, random=false) {
    abort.current?.abort();
    transport.current?.close();
    transport.current = null;
    const work = new AbortController();
    abort.current = work;
    setStage('opening');
    setMatchSeconds(random?120:undefined);
    setLatency(null);
    setError('');
    setStatus('');
    setReady(false);
    confirmations.current={self:false,peer:false};setConfirmed(false);setPeerConfirmed(false);
    setPeerElf(null);resetMatchState();
    setOwnCode('');setPeerName('');
    setRole(undefined);
    try {
      const actualOrigin=normalizeSignalOrigin(origin);
      localStorage.setItem('seer_online_signal_origin',actualOrigin);
      const room = await connectRoom(actualOrigin, join ? invite.trim() : null, allowDirect, work.signal, {
        onMatchWait:seconds=>{if(!work.signal.aborted)setMatchSeconds(seconds);},
        onLatency: milliseconds => { if (!work.signal.aborted) setLatency(milliseconds); },
        onStatus: next => { if (!work.signal.aborted){setStage(next);if(next==='connected')transport.current?.send({kind:'player-info',name:playerName.trim()||'玩家'});} },
        onError: message => { if (!work.signal.aborted) setError(message); },
        onMessage: message => {
          if (!message || typeof message !== 'object' || work.signal.aborted) return;
          const data = message as { kind?: unknown; elfId?: unknown;name?:unknown };
          if(data.kind==='player-info'&&typeof data.name==='string'){setPeerName(data.name);peerNameRef.current=data.name;}
          // 對戰中的訊息交給對戰畫面
          if(data.kind==='action'||data.kind==='sync'||data.kind==='resign'){battleInbox.current?.(message as BattleWire);return;}
          if(data.kind==='loadout-part'){takeLoadoutPart(message as {i:number;n:number;data:string});return;}
          if(data.kind==='start'){
            const seed=(message as {seed:number}).seed;
            if(transport.current?.seat!=='guest'||!beginMatch(seed))setError('對手已開戰，但雙方隊伍尚未交換完成，請重新就緒');
            return;
          }
          if(data.kind==='confirm-opponent'){confirmations.current.peer=true;setPeerConfirmed(true);}
          if(data.kind==='withdraw-opponent'){confirmations.current.peer=false;setPeerConfirmed(false);setReady(false);setPeerElf(null);resetMatchState();}
          if (data.kind === 'unready') {setPeerElf(null);peerLoadoutRef.current=null;setPeerLoadout(null);}
          if (confirmations.current.self&&confirmations.current.peer&&data.kind === 'ready' && typeof data.elfId === 'string' && data.elfId.length <= 32 && catalog().some(elf => elf.id === data.elfId)) {
            setPeerElf(data.elfId);
          }
        },
      },random?matchMode:undefined,matchMode);
      setMatchSeconds(undefined);
      if (work.signal.aborted) { room.close(); return; }
      transport.current = room;
      setOwnCode(room.code);
      setRole(room.seat);
      setMatchMode(room.mode);
    } catch (cause) {
      if (work.signal.aborted) return;
      setStage('idle');
      setError(cause instanceof Error ? cause.message : '建立房間失敗');
    }
  }

  function leave() {
    abort.current?.abort();
    transport.current?.close();
    transport.current = null;
    setReady(false);
    setMatchSeconds(undefined);
    confirmations.current={self:false,peer:false};setConfirmed(false);setPeerConfirmed(false);
    setPeerElf(null);resetMatchState();
    setOwnCode('');setPeerName('');
    setRole(undefined);
    setError('');
    setStatus('');
    setStage('idle');
  }

  const lobby = stage === 'idle';
  const active = stage === 'connected';
  const opponent = catalog().find(elf => elf.id === peerElf);
  const bothConfirmed=confirmed&&peerConfirmed;
  useEffect(()=>{setReadyDeadline(active&&bothConfirmed&&!ready?Date.now()+30000:undefined);},[active,ready,bothConfirmed]);
  useEffect(()=>{
    if(!readyDeadline||!active||!bothConfirmed||ready){setReadySeconds(undefined);return;}
    let sent=false;
    const tick=()=>{
      const remaining=Math.max(0,Math.ceil((readyDeadline-Date.now())/1000));setReadySeconds(remaining);
      if(!remaining&&!sent&&confirmations.current.self&&confirmations.current.peer&&(!!prepared||catalog().some(e=>e.id===elfId))){
        sent=true;void sendReady().then(ok=>{if(ok){setReady(true);setStatus('準備時間結束，已自動選擇目前精靈');}else setError('目前無法送出房間狀態');});
      }
    };
    tick();const timer=window.setInterval(tick,250);return()=>clearInterval(timer);
  },[active,ready,readyDeadline,elfId,bothConfirmed]);

  // 房主：雙方就緒且對手隊伍已驗證 → 決定種子並開戰。
  useEffect(()=>{
    if(!active||!ready||!peerElf||!peerLoadout||match||role!=='host')return;
    const seed=1+(crypto.getRandomValues(new Uint32Array(1))[0]%0x7ffffffe);
    if(transport.current?.send({kind:'start',seed}))beginMatch(seed);else setError('無法送出開戰訊息');
  },[active,ready,peerElf,peerLoadout,match,role]);

  if (match) return createPortal(<OnlineBattle match={match} connected={active} inbox={battleInbox}
    send={message => !!transport.current?.send(message)}
    onLeave={() => { resetMatchState(); setReady(false); setPeerElf(null); setStatus('對戰結束，可重新就緒再戰'); }} />, document.body);

  return createPortal(
    <div className="peer-room-overlay" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
      <section className="peer-room" data-layout="game" data-gskin={readBattleGameSkin()} role="dialog" aria-modal="true" aria-label="雙人連線">
        <header>
          <h2><Network size={22} aria-hidden="true" />雙人連線</h2>
          <button ref={closeButton} type="button" className="peer-button" aria-label="關閉連線房間" onClick={onClose}><X size={18} /></button>
        </header>
        <p className="my-3 text-xs" style={{ color: 'var(--g-muted)' }}>指定對手可分享邀請碼；隨機配對後雙方確認 · 雙方就緒後開戰</p>
        {lobby ? <div className="peer-room-fields">
          <label>玩家名稱<input maxLength={24} value={playerName} onChange={event=>setPlayerName(event.target.value.replace(/[\p{C}]/gu,''))} /></label>
          <label>對戰模式<select disabled={!!prepared} value={matchMode} onChange={event=>setMatchMode(event.target.value as MatchMode)}><option value="peak">巔峰</option><option value="destiny">命運之輪</option></select></label>
          <label>信令網址<input type="url" value={origin} onChange={event => setOrigin(event.target.value)} /></label>
          <details className="peer-remote-help"><summary>遠端玩家如何加入？</summary><p>雙方填入同一個公開 HTTPS 服務網址。隨機匹配會尋找同模式的玩家；指定對手則分享邀請碼。localhost 與 127.0.0.1 只連到自己的電腦，跨國連線需由服務端配置 TURN 中繼。</p></details>
          <button type="button" className="peer-button" data-primary onClick={() => void open(false)}>建立房間</button>
          <form onSubmit={event => { event.preventDefault(); void open(true); }}>
            <label>邀請碼<input maxLength={16} autoCapitalize="none" autoComplete="off" spellCheck={false}
              value={invite} onChange={event => setInvite(event.target.value)} /></label>
            <button type="submit" className="peer-button" disabled={!invite.trim()}>加入房間</button>
          </form>
          <button type="button" className="peer-button" onClick={()=>void open(false,true)}>隨機匹配</button>
          <label className="peer-direct"><input type="checkbox" checked={allowDirect}
            onChange={event => {setAllowDirect(event.target.checked);localStorage.setItem('seer_online_allow_direct',String(event.target.checked));}} />允許直連，對手可能看見連線 IP</label>
        </div> : <div className="peer-room-fields">
          <p className="peer-stage" role="status"><Link2 size={16} aria-hidden="true" />{matchSeconds!==undefined?'正在尋找對手 · '+matchSeconds+' 秒':LABEL[stage]}{active && latency !== null && ' · ' + latency + ' ms'}{active&&' · 加密及身分已驗證'}{role && ' · ' + (role === 'host' ? '房主' : '加入者')}</p>
          {ownCode && <div className="peer-invite">
            <output aria-label="邀請碼">{ownCode}</output>
            <button type="button" className="peer-button" aria-label="複製邀請碼" onClick={async () => {
              try { await navigator.clipboard.writeText(ownCode); setStatus('已複製邀請碼'); }
              catch { setStatus('請選取邀請碼複製'); }
            }}><Copy size={17} /></button>
          </div>}
          {active && <>
            <p title="玩家名稱由對方填寫；指定對手請核對分享的房間邀請碼">對手：{peerName||'正在取得玩家資料'} · 模式：{matchMode==='peak'?'巔峰':'命運之輪'} · 房間 {ownCode}</p>
            <p role="status">{bothConfirmed?'雙方已確認對手':confirmed?'已確認，等待對手確認':'請先確認此房間是要對戰的對手，再開始準備'}</p>
            <button type="button" className="peer-button" data-primary={!confirmed||undefined} disabled={!peerName} onClick={()=>{
              if(transport.current?.send({kind:confirmed?'withdraw-opponent':'confirm-opponent'})){
                confirmations.current.self=!confirmed;setConfirmed(!confirmed);setReady(false);setPeerElf(null);
              }else setError('目前無法送出確認');
            }}>{confirmed?'取消對手確認':'確認對手'}</button>
          </>}
          {prepared&&<section className="peer-prepared" aria-label="已鎖定的戰前配置"><b>本次隊伍與配置已鎖定</b><p>{prepared.team.map(e=>e.name).join("、")}</p><small>更改配置請先離開匹配</small></section>}
          {active && bothConfirmed && <>
            {readySeconds!==undefined&&<p role="status">準備倒數 {readySeconds} 秒 · 到時自動選擇目前精靈</p>}
            <label>出戰精靈<select value={elfId} disabled={ready||!!prepared} onChange={event => setElfId(event.target.value)}>
              {candidates.map(elf => <option key={elf.id} value={elf.id}>{elf.name}</option>)}
            </select></label>
            <p role="status">{matchMode==='destiny' ? '命運之輪的雙人抽取與禁選尚未開放，請改用巔峰模式' : ready && opponent ? (peerLoadout ? '雙方已就緒 · 即將開戰' : '雙方已就緒 · 正在接收對手隊伍') : opponent ? '對手已就緒 · ' + opponent.name : '對手準備中'}</p>
            <button type="button" className="peer-button" data-primary disabled={!elfId||matchMode==='destiny'} title={matchMode==='destiny'?'命運之輪的雙人抽取與禁選尚未開放':undefined} onClick={() => {
              if (ready) {
                if (transport.current?.send({ kind: 'unready' })) { setReady(false); myLoadout.current = null; setError(''); } else setError('目前無法送出房間狀態');
                return;
              }
              void sendReady().then(ok => { if (ok) { setReady(true); setError(''); } else setError('目前無法送出房間狀態'); }).catch(cause => setError(cause instanceof Error ? cause.message : '無法準備隊伍'));
            }}>{ready ? '取消就緒' : '就緒'}</button>
          </>}
          <button type="button" className="peer-button" onClick={leave}>離開房間</button>
        </div>}
        {status && <p role="status">{status}</p>}
        {error && <p className="peer-error" role="alert">{error}</p>}
      </section>
    </div>, document.body);
}
