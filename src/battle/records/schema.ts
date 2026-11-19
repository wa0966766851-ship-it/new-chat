/** 私人對戰記錄只保存 JSON 資料，沒有執行碼／憑證。 */
export interface BattleRecordEvent {kind:'start'|'state'|'action'|'logs'|'ledger'|'decision'|'end'|'import';at:string;data:Record<string,unknown>}
export const RECORDING_KEY='seer_battle_recording_v1',RECORDING_EVENT='seer-battle-recording';
let session=true,storageFailed=false;
export function recordingEnabled():boolean {if(storageFailed)return session;try{return localStorage.getItem(RECORDING_KEY)!=='false';}catch{return session;}}
export function setRecordingEnabled(value:boolean) {session=value;try{localStorage.setItem(RECORDING_KEY,String(value));storageFailed=false;}catch{storageFailed=true;}window.dispatchEvent(new CustomEvent(RECORDING_EVENT));}
export function redactRecordText(value:string):string {
  return value.replace(/(?:AIza|AQ)[A-Za-z0-9_.~-]{18,1022}/g,'[金鑰已隱去]').replace(/Bearer\s+[A-Za-z0-9_.~-]+/gi,'Bearer [已隱去]');
}
const forbidden=/api.?key|authorization|password|secret|session|^(token|accessToken|refreshToken)$|customCode|sourceCode|^kit$|^code$/i;
export function cleanRecordData(value:unknown,depth=0):any {
  if(depth>10)return '[層級上限]';
  if(typeof value==='string')return redactRecordText(value.slice(0,100000));
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value==='boolean'||value===null)return value;
  if(Array.isArray(value))return value.slice(0,1000).map(v=>cleanRecordData(v,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k,v])=>!forbidden.test(k)&&typeof v!=='function'&&v!==undefined).slice(0,150).map(([k,v])=>[redactRecordText(k),cleanRecordData(v,depth+1)]));
  return null;
}
export function validRecordEvents(value:unknown):value is BattleRecordEvent[] {
  return Array.isArray(value)&&value.length>0&&value.length<=100&&value.every(e=>e&&['start','state','action','logs','ledger','decision','end','import'].includes(e.kind)&&typeof e.at==='string'&&Number.isFinite(Date.parse(e.at))&&e.data&&typeof e.data==='object'&&!Array.isArray(e.data));
}
const titles={start:'戰鬥開始／設定',state:'對戰狀態',action:'雙方行動',logs:'對戰訊息',ledger:'傷害與恢復帳本',decision:'AI 決策',end:'戰鬥結束／離開',import:'補存舊戰報（可能不完整）'};
export function renderRecordEvent(event:BattleRecordEvent):string {
  const data=cleanRecordData(event.data);
  return `\n【${titles[event.kind]}】${new Date(event.at).toISOString()}\n${JSON.stringify(data,null,2)}\n`;
}
