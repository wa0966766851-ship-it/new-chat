import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { createHmac, randomBytes, ECDH } from 'node:crypto';
import { P2P_CODE, P2P_RULES_VERSION, P2P_SDP_LIMIT, type PeerSeat, type RoomSignal } from '../src/online/protocol';
import {matchmakingRouter} from './p2pMatchmaking';

interface Room {
  expires: number;
  mode?: 'peak' | 'destiny';
  host: string;
  guest?: string;
  offer?: RoomSignal;
  answer?: RoomSignal;
  keys?: Partial<Record<PeerSeat,string>>;
}
const ROOM_TTL = 30 * 60_000;
const MAX_ROOMS = 256;
const RATE_WINDOW = 60_000;

export function createP2PSignalRouter(env: NodeJS.ProcessEnv = process.env, sameOrigin?: (req: Request) => string | undefined) {
  const router = express.Router();
  const rooms = new Map<string, Room>();
  const rates = new Map<string, { count: number; expires: number }>();
  const origins = new Set((env.SEER_P2P_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
  const turn = (env.SEER_P2P_TURN_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  const stun = (env.SEER_P2P_STUN_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  const turnSecret = env.SEER_P2P_TURN_SECRET;
  const direct = env.SEER_P2P_ALLOW_DIRECT === '1';
  const configured = direct || (turn.length > 0 && !!turnSecret);
  const codePattern = P2P_CODE;

  router.use((req, res, next) => {
    const origin = req.get('origin');
    res.set('Cache-Control', 'no-store').vary('Origin');
    if (origin && origin !== sameOrigin?.(req) && !origins.has(origin)) {
      res.status(403).json({ error: '此網頁來源尚未允許連線' });
      return;
    }
    if (origin) res.set('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).end();
      return;
    }
    const now = Date.now();
    for (const [key, value] of rooms) if (now >= value.expires) rooms.delete(key);
    for (const [key, value] of rates) if (now >= value.expires) rates.delete(key);
    const ip = (req.ip || 'unknown') + (req.method === 'GET' ? ':read' : ':write');
    const rate = rates.get(ip);
    const limit = req.method === 'GET' ? 240 : 48;
    if ((rate && rate.count >= limit) || (!rate && rates.size >= 1024)) {
      res.status(429).json({ error: '請求過多，請稍後再試' });
      return;
    }
    if (rate) rate.count++;
    else rates.set(ip, { count: 1, expires: now + RATE_WINDOW });
    next();
  });
  router.use(express.json({ limit: '20kb' }));

  function admission(code: string, room: Room, seat: PeerSeat) {
    const token = room[seat]!;
    const iceServers: RTCIceServer[] = [];
    if (direct && stun.length) iceServers.push({ urls: stun });
    if (turn.length && turnSecret) {
      const username = `${Math.floor(room.expires / 1000)}:${code}-${seat}`;
      iceServers.push({ urls: turn, username, credential: createHmac('sha1', turnSecret).update(username).digest('base64') });
    }
    return { code, token, seat, mode:room.mode||'peak', rtc: { iceServers, iceTransportPolicy: (direct ? 'all' : 'relay') as RTCIceTransportPolicy } };
  }
  function versionMatches(req: Request, res: Response): boolean {
    if (req.body?.version === P2P_RULES_VERSION) return true;
    res.status(409).json({ error: '房間規則版本不同，請確認雙方版本' });
    return false;
  }
  function authorized(req: Request, res: Response) {
    const code = String(req.params.code ?? '');
    const room = codePattern.test(code) ? rooms.get(code) : undefined;
    const token = req.get('authorization')?.match(/^Bearer ([\w-]{43})$/)?.[1];
    const seat = room && token && (token === room.host ? 'host' : token === room.guest ? 'guest' : undefined);
    if (!room || !seat) { res.status(404).json({ error: '房間已關閉或憑證無效' }); return; }
    return { room, seat, code };
  }

  router.get('/status', (_req, res) => res.json({ available: configured, transport: direct ? 'direct' : 'relay' }));
  router.use('/match',matchmakingRouter((mode)=>{
    if(!configured||rooms.size>=MAX_ROOMS)return;
    const code=randomBytes(12).toString('base64url');
    const room:Room={mode,host:randomBytes(32).toString('base64url'),guest:randomBytes(32).toString('base64url'),expires:Date.now()+ROOM_TTL};
    rooms.set(code,room);
    return [admission(code,room,'host'),admission(code,room,'guest')];
  },code=>rooms.delete(code)));
  router.post('/rooms', (req, res) => {
    if (!versionMatches(req, res)) return;
    if (!configured) { res.status(503).json({ error: '信令已啟用，尚未配置 TURN 中繼' }); return; }
    if (rooms.size >= MAX_ROOMS) { res.status(503).json({ error: '目前房間已滿，請稍後再試' }); return; }
    if(req.body.mode!==undefined&&!['peak','destiny'].includes(req.body.mode)){res.status(400).json({error:'房間模式無效'});return;}
    const code = randomBytes(12).toString('base64url');
    const room:Room = { mode:req.body.mode||'peak', host: randomBytes(32).toString('base64url'), expires: Date.now() + ROOM_TTL };
    rooms.set(code, room);
    res.json(admission(code, room, 'host'));
  });
  router.post('/rooms/:code/join', (req, res) => {
    if (!versionMatches(req, res)) return;
    const room = codePattern.test(req.params.code) ? rooms.get(req.params.code) : undefined;
    if (!room) { res.status(404).json({ error: '找不到房間，或邀請已過期' }); return; }
    if (room.guest) { res.status(409).json({ error: '房間已有兩位玩家' }); return; }
    room.guest = randomBytes(32).toString('base64url');
    res.json(admission(req.params.code, room, 'guest'));
  });
  router.get('/rooms/:code', (req, res) => {
    const access = authorized(req, res);
    if (!access) return;
    const { room, seat } = access;
    res.json({ guestJoined: !!room.guest && !!room.keys?.guest, remote: (seat === 'host' ? room.answer : room.offer) ?? null, peerKey:room.keys?.[seat==='host'?'guest':'host'] });
  });
  router.post('/rooms/:code/identity',(req,res)=>{
    const access=authorized(req,res);if(!access)return;
    const key=req.body?.publicKey;
    try{
      if(Object.keys(req.body).length!==1||typeof key!=='string'||!/^[A-Za-z0-9_-]{87}$/.test(key))throw Error();
      const bytes=Buffer.from(key,'base64url');
      if(bytes.length!==65||bytes[0]!==4||bytes.toString('base64url')!==key)throw Error();
      ECDH.convertKey(bytes,'prime256v1');
    }catch{res.status(400).json({error:'房間身分公鑰無效'});return;}
    const {room,seat}=access;
    room.keys??={};
    if(room.keys[seat]&&room.keys[seat]!==key){res.status(409).json({error:'房間身分已綁定，請重新建房'});return;}
    room.keys[seat]=key;res.status(204).end();
  });
  router.post('/rooms/:code/signal', (req, res) => {
    const access = authorized(req, res);
    if (!access) return;
    const { room, seat } = access;
    const type = seat === 'host' ? 'offer' : 'answer';
    const sdp: unknown = req.body?.sdp;
    if (!room.keys?.host || !room.keys?.guest || !room.guest || (seat === 'guest' && !room.offer) || req.body?.type !== type ||
      typeof sdp !== 'string' || Buffer.byteLength(sdp) > P2P_SDP_LIMIT || !sdp.startsWith('v=0') ||
      (sdp.match(/^m=/gm) || []).length !== 1 || !/^m=application /m.test(sdp) ||
      (!direct && sdp.split(/\r?\n/).some(line => line.startsWith('a=candidate:') && !/ typ relay(?: |$)/.test(line)))) {
      res.status(400).json({ error: '信令格式不符或中繼候選不合法' });
      return;
    }
    if (room[type] && room[type]?.sdp !== sdp) { res.status(409).json({ error: '此房間已交換信令，請重新建房' }); return; }
    room[type] = { type, sdp };
    res.status(204).end();
  });
  router.delete('/rooms/:code', (req, res) => {
    const access = authorized(req, res);
    if (!access) return;
    rooms.delete(access.code);
    res.status(204).end();
  });
  const invalid: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) { next(error); return; }
    res.status(error.status === 413 ? 413 : 400).json({ error: '信令請求格式不符或容量超過上限' });
  };
  router.use(invalid);
  return router;
}
