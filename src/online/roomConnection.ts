import {createSessionIdentity,verifySessionIdentity} from './sessionIdentity';
import {waitForMatch,type MatchMode} from './matchmaking';
import { P2P_CODE, P2P_RULES_VERSION, validRoomMessage, type PeerSeat, type RoomAdmission, type RoomSignal, type RoomSignalState } from './protocol';

type RoomRoutes = {
  onStatus: (status: 'waiting' | 'negotiating' | 'connected' | 'disconnected') => void;
  onMessage: (message: unknown) => void;
  onError: (message: string) => void;
  onLatency?: (milliseconds: number) => void;
  onMatchWait?: (seconds:number) => void;
};
export interface RoomConnection {
  code: string;
  seat: PeerSeat;
  mode: MatchMode;
  send: (message: object) => boolean;
  close: () => void;
}

const DATA_LIMIT = 48_000;
const encoder = new TextEncoder();
export function normalizeSignalOrigin(value: string): string {
  const url = new URL(value.trim());
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('請填寫 HTTPS 信令網址，本機可用 localhost 的 HTTP');
  }
  return url.origin;
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const done = () => { signal.removeEventListener('abort', cancel); resolve(); };
    const timer = setTimeout(done, ms);
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener('abort', cancel, { once: true });
  });
}

function completeIce(peer: RTCPeerConnection, signal: AbortSignal): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', onChange);
      signal.removeEventListener('abort', onAbort);
    };
    const onChange = () => {
      if (peer.iceGatheringState === 'complete') { cleanup(); resolve(); }
    };
    const onAbort = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('無法取得 WebRTC 連線路徑')); }, 15_000);
    peer.addEventListener('icegatheringstatechange', onChange);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort(); else onChange();
  });
}

export async function connectRoom(originInput: string, invite: string | null, directAllowed: boolean, signal: AbortSignal, handlers: RoomRoutes, matchMode?:MatchMode, inviteMode:MatchMode='peak'): Promise<RoomConnection> {
  const origin = normalizeSignalOrigin(originInput);
  if (invite !== null && !P2P_CODE.test(invite)) throw new Error('邀請碼格式錯誤');
  if (typeof RTCPeerConnection === 'undefined') throw new Error('此瀏覽器無法建立 WebRTC 連線');
  async function api<T>(path: string, options: { token?: string; body?: object; method?: string; closing?: boolean } = {}): Promise<T> {
    const timeout = AbortSignal.timeout(10_000);
    const response = await fetch(origin + '/api/p2p' + path, {
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: options.closing ? timeout : AbortSignal.any([timeout, signal]),
    });
    if (response.status === 204) return undefined as T;
    const json = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
    if (!response.ok || !json) throw new Error(json?.error || '找不到可用的信令服務');
    return json;
  }

  const status = await api<{ available: boolean; transport: string }>('/status');
  if (status.available !== true) throw new Error('信令服務尚未配置 TURN 中繼');
  if (status.transport !== 'relay' && !directAllowed) throw new Error('此信令服務允許直連。請先確認是否允許對手看到連線 IP。');
  const identity=await createSessionIdentity();
  const admission = matchMode?await waitForMatch(api,matchMode,signal,handlers.onMatchWait):await api<RoomAdmission>(invite ? `/rooms/${invite}/join` : '/rooms', { body: { version: P2P_RULES_VERSION,mode:inviteMode } });
  if (!P2P_CODE.test(admission.code) || !/^[\w-]{43}$/.test(admission.token) ||
      (matchMode?!['host','guest'].includes(admission.seat):admission.seat !== (invite ? 'guest' : 'host'))) throw new Error('信令服務回傳的房間資訊無效');

  const roomMode=admission.mode||'peak';
  if(!['peak','destiny'].includes(roomMode))throw Error('房間模式無效');
  const identityVersion=P2P_RULES_VERSION+':'+roomMode;
  const path = `/rooms/${admission.code}`;
  const token = admission.token;
  try{await api(path+'/identity',{token,body:{publicKey:identity.publicKey}});}catch(error){void api(path,{token,method:'DELETE',closing:true}).catch(()=>{});throw error;}
  let rtc: RTCPeerConnection;
  try {
    rtc = new RTCPeerConnection({ ...admission.rtc, iceTransportPolicy: directAllowed && status.transport === 'direct' ? 'all' : 'relay' });
  } catch (error) {
    void api(path, { token, method: 'DELETE', closing: true }).catch(() => {});
    throw error;
  }
  let channel: RTCDataChannel | undefined;
  let closing = false;
  let ready = false;
  let receiveChain=Promise.resolve();
  let queued=0;
  let peerIdentity:Promise<RoomSignalState>|undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lastMessageAt = performance.now();
  let pingId = 0;
  const pings = new Map<number, number>();
  const transmit = (message: object): boolean => {
    if (closing || channel?.readyState !== 'open' || channel.bufferedAmount > DATA_LIMIT * 2) return false;
    try {
      const payload = JSON.stringify(message);
      if (encoder.encode(payload).length > DATA_LIMIT) return false;
      channel.send(payload);
      return true;
    } catch { return false; }
  };
  let windowStart = Date.now(), count = 0;
  const close = () => {
    if (closing) return;
    closing = true;
    clearInterval(heartbeat);
    signal.removeEventListener('abort', close);
    channel?.close();
    rtc.close();
    void api(path, { token, method: 'DELETE', closing: true }).catch(() => {});
  };
  const fail = (message: string) => {
    if (closing) return;
    close();
    handlers.onError(message);
    handlers.onStatus('disconnected');
  };
  function wire(next: RTCDataChannel) {
    if (next.label !== 'seer-room-v1' || channel) { next.close(); return; }
    channel = next;
    let didOpen=false;
    const opened = () => {
      if (closing||didOpen) return;
      didOpen=true;
      peerIdentity=api<RoomSignalState>(path,{token});
      void peerIdentity.catch(()=>{});
      void identity.prove(admission.code,admission.seat,identityVersion).then(proof=>{
        if(!closing&&!transmit({kind:'hello',version:P2P_RULES_VERSION,proof}))fail('無法送出房間身分驗證');
      }).catch(()=>fail('無法建立房間身分證明'));
      heartbeat = setInterval(() => {
        const now = performance.now();
        if(!ready){if(now-lastMessageAt>15000)fail('房間身分驗證逾時');return;}
        if (now - lastMessageAt > 30_000) { fail('對手連線已逾時，請重新建房'); return; }
        for (const [id, sent] of pings) if (now - sent > 30_000) pings.delete(id);
        const id = pingId++ % 0x80000000;
        if (transmit({ kind: 'ping', id })) pings.set(id, now);
      }, 5000);
    };
    next.onopen = opened;
    if (next.readyState === 'open') opened();
    next.onclose = () => fail('對手已離開。可建立新房間重新連線。');
    next.onerror = () => fail('資料通道發生錯誤');
    next.onmessage = event => {
      if (closing) return;
      const now = Date.now();
      if (now - windowStart >= 1000) { windowStart = now; count = 0; }
      if (++count > 24 || typeof event.data !== 'string' || event.data.length > DATA_LIMIT ||
          encoder.encode(event.data).length > DATA_LIMIT) {
        fail('收到超過限制的房間訊息'); return;
      }
      let data: unknown;
      try { data = JSON.parse(event.data); }
      catch { fail('收到無效房間訊息'); return; }
      if (!validRoomMessage(data)) { fail('收到不支援的房間訊息'); return; }
      if(++queued>24){fail('待處理的房間訊息過多');return;}
      receiveChain=receiveChain.then(async()=>{
      queued--;if(closing)return;
      lastMessageAt = performance.now();
      if (data.kind === 'hello') {
        if (data.version !== P2P_RULES_VERSION) { fail('對手的連線規則版本不同'); return; }
        if(ready){fail('收到重複的房間身分證明');return;}
        const pinned=await peerIdentity;
        const peerSeat=admission.seat==='host'?'guest':'host';
        if(!pinned?.peerKey||!await verifySessionIdentity(pinned.peerKey,data.proof,admission.code,peerSeat,identityVersion)){
          fail('對手房間身分驗證失敗');return;
        }
        if(!closing){ready=true;handlers.onStatus('connected');}
        return;
      }
      if (!ready) { fail('對手尚未完成版本確認'); return; }
      if (data.kind === 'ping') { transmit({ kind: 'pong', id: data.id }); return; }
      if (data.kind === 'pong') {
        const sent = pings.get(data.id);
        if (sent !== undefined) { pings.delete(data.id); handlers.onLatency?.(Math.round(performance.now() - sent)); }
        return;
      }
      handlers.onMessage(data);
      }).catch(()=>fail('無法驗證或處理房間訊息'));
    };
  }
  signal.addEventListener('abort', close, { once: true });
  if (signal.aborted) close();
  rtc.onconnectionstatechange = () => {
    if (rtc.connectionState === 'failed') fail('WebRTC 無法建立資料通道');
    else if (rtc.connectionState === 'disconnected' && !closing) handlers.onStatus('disconnected');
    else if (rtc.connectionState === 'connected' && ready && !closing) handlers.onStatus('connected');
  };
  try {
    if (admission.seat === 'host') wire(rtc.createDataChannel('seer-room-v1'));
    else rtc.ondatachannel = event => wire(event.channel);
  } catch (error) { close(); throw error; }

  async function sendSignal(type: RoomSignal['type']) {
    await rtc.setLocalDescription(type === 'offer' ? await rtc.createOffer() : await rtc.createAnswer());
    await completeIce(rtc, signal);
    await api(path + '/signal', { token, body: { type, sdp: rtc.localDescription?.sdp } });
  }
  async function negotiate() {
    handlers.onStatus(admission.seat === 'host' ? 'waiting' : 'negotiating');
    let sentOffer = false;
    const deadline = Date.now() + (admission.seat === 'host' ? 4 : 1) * 60_000;
    while (!closing && !ready) {
      if (Date.now() >= deadline) throw new Error('等待對手連線逾時');
      const state = await api<RoomSignalState>(path, { token });
      if (admission.seat === 'host' && state.guestJoined && !sentOffer) {
        handlers.onStatus('negotiating');
        await sendSignal('offer');
        sentOffer = true;
      }
      if (state.remote) {
        const expected = admission.seat === 'host' ? 'answer' : 'offer';
        if (state.remote.type !== expected || typeof state.remote.sdp !== 'string') throw new Error('收到無效房間信令');
        await rtc.setRemoteDescription(state.remote);
        if (expected === 'offer') await sendSignal('answer');
        const channelDeadline = Date.now() + 25_000;
        while (!closing && !ready && Date.now() < channelDeadline) await abortableDelay(250, signal);
        if (!closing && !ready) throw new Error('資料通道連線逾時');
        return;
      }
      await abortableDelay(1250, signal);
    }
  }
  void negotiate().catch(error => { if (!closing && !signal.aborted) fail(error instanceof Error ? error.message : '無法完成連線'); });
  return {
    code: admission.code, seat: admission.seat, mode:roomMode, close,
    send(message) {
      return ready && validRoomMessage(message) && ['ready', 'unready','player-info','confirm-opponent','withdraw-opponent','loadout-part','start','action','sync','resign'].includes(message.kind) && transmit(message);
    },
  };
}
