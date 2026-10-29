import type {BattleEventContext} from '../effects/types';
type Side='p1'|'p2';
export interface InstantKillTarget {side:Side;id:string;hpSnapshot:number}
/** 秒殺前同一可變請求；不依賴註冊表，避免執行器初始化循環。 */
export interface InstantKillRequest {
  sourceSide:Side;sourceBattleId:string;targetSide:Side;targetBattleId:string;
  targets:InstantKillTarget[];blocked:boolean;
}
export function instantKillRequest(ctx:BattleEventContext):InstantKillRequest|undefined {
  const data=(ctx as any).effectEventData;
  return data?.targets&&typeof data.blocked==='boolean'?data:undefined;
}
