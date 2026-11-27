// v4（2026-11-27）：加入對戰同步（隊伍交換、開戰種子、逐步選擇、每回合戰況摘要）。
export const P2P_RULES_VERSION = 'seer-room-1v1-v4';
export const P2P_CODE = /^[A-Za-z0-9_-]{16}$/;
export const P2P_SDP_LIMIT = 14_000;
export type PeerSeat = 'host' | 'guest';
export type RoomSignal = { type: 'offer' | 'answer'; sdp: string };
export type RoomSignalState = { guestJoined: boolean; remote: RoomSignal | null; peerKey?: string };
export interface RoomAdmission {
  code: string;
  token: string;
  seat: PeerSeat;
  rtc: RTCConfiguration;
  mode?: 'peak' | 'destiny';
}
export type RoomMessage =
  | { kind: 'hello'; version: string; proof: string }
  | { kind: 'ready'; elfId: string }
  | {kind:'player-info';name:string}
  | { kind: 'unready' | 'confirm-opponent' | 'withdraw-opponent' }
  | { kind: 'ping' | 'pong'; id: number }
  /** 戰前隊伍（JSON 切片傳送，見 lockstep.encodeLoadout）。 */
  | { kind: 'loadout-part'; i: number; n: number; data: string }
  /** 房主決定開戰種子。 */
  | { kind: 'start'; seed: number }
  /** 對戰中的一步選擇（內容由 lockstep.validSelection 再驗證）。 */
  | { kind: 'action'; sel: Record<string, unknown> }
  /** 每回合開始的戰況摘要。 */
  | { kind: 'sync'; turn: number; hash: string }
  | { kind: 'resign' };

export function validRoomMessage(value: unknown): value is RoomMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  if (['unready','confirm-opponent','withdraw-opponent','resign'].includes(String(message.kind))) return Object.keys(message).length === 1;
  if (message.kind === 'loadout-part') return Object.keys(message).length === 4 && Number.isSafeInteger(message.i) && Number.isSafeInteger(message.n)
    && Number(message.n) >= 1 && Number(message.n) <= 40 && Number(message.i) >= 0 && Number(message.i) < Number(message.n) && typeof message.data === 'string' && message.data.length <= 24_000;
  if (message.kind === 'sync') return Object.keys(message).length === 3 && Number.isSafeInteger(message.turn) && Number(message.turn) >= 0 && typeof message.hash === 'string' && /^[0-9a-f]{16}$/.test(message.hash);
  if (message.kind === 'hello') return Object.keys(message).length === 3 && typeof message.version === 'string' && message.version.length <= 64 && typeof message.proof === 'string' && /^[A-Za-z0-9_-]{86}$/.test(message.proof);
  if (Object.keys(message).length !== 2) return false;
  if(message.kind==='player-info')return typeof message.name==='string'&&message.name.trim().length>0&&message.name.length<=24&&!/[\p{C}]/u.test(message.name);
  if (message.kind === 'ready') return typeof message.elfId === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(message.elfId);
  if (message.kind === 'start') return Number.isSafeInteger(message.seed) && Number(message.seed) > 0 && Number(message.seed) <= 0x7fffffff;
  if (message.kind === 'action') return !!message.sel && typeof message.sel === 'object' && !Array.isArray(message.sel) && JSON.stringify(message.sel).length <= 400;
  return (message.kind === 'ping' || message.kind === 'pong')
    && Number.isSafeInteger(message.id) && Number(message.id) >= 0 && Number(message.id) <= 0x7fffffff;
}
