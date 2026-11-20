import type {BattleState} from '../../components/BattleManager';
import type {DamageLedger} from '../damageLedger';
import type {DecisionReport} from '../ai/types';
import {actionKey} from '../ai/types';
import {providerStatus} from '../ai/providerApi';
import {battleRecordSnapshot} from './snapshot';
import {cleanRecordData,recordingEnabled,type BattleRecordEvent} from './schema';

export const RECORD_STATUS_EVENT='seer-battle-record-status';
let message='';
export const recordingMessage=()=>message;
function notify(value:string){message=value;if(typeof window!=='undefined')window.dispatchEvent(new window.Event(RECORD_STATUS_EVENT));}
export function createRecordTransport(){
  let session:Promise<string>|undefined;
  let sequence=0;
  return async(id:string,events:BattleRecordEvent[],create:boolean)=>{
    if(typeof location!=='undefined'&&!['localhost','127.0.0.1','[::1]','::1'].includes(location.hostname))throw Error('對戰 TXT 僅支援本機服務。');
    const body=JSON.stringify({id,events,create,batch:++sequence});
    for(let attempt=0;attempt<3;attempt++){
      let response:Response;
      try{
        session ??= providerStatus(AbortSignal.timeout(5000)).then(s=>s.session);
        const token=await session;
        response=await fetch('/api/battle-ai/records',{method:'POST',
          headers:{'Content-Type':'application/json','x-seer-ai-session':token},body,
          keepalive:attempt===0&&new TextEncoder().encode(body).length<48000,signal:AbortSignal.timeout(5000)});
      }catch(error){
        session=undefined;
        if(attempt<2){await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));continue;}
        throw Error('對戰 TXT 連線失敗，記錄未完整保存。');
      }
      if(response.ok)return;
      if((response.status===403||response.status>=500)&&attempt<2){
        session=undefined;await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));continue;
      }
      const detail=await response.json().catch(()=>null);
      throw Error(response.status===410?'記錄已刪除或超過保留上限，本場停止寫入。':
        detail?.error==='RECORD_SIZE_LIMIT'?'本場 TXT 已達容量上限，後續記錄未寫入。':
        `對戰 TXT 未寫入（${response.status} ${detail?.error ?? ''}）。`);
    }
  };
}
export function createBattleRecorder(metadata:Record<string,unknown>,send=createRecordTransport(),enabled=recordingEnabled){
  const id=`${Date.now()}-${crypto.randomUUID()}`;
  let begun=false,created=false,stopped=false,closed=false,ended=false,timer:ReturnType<typeof setTimeout>|undefined,chain=Promise.resolve();
  const actions={p1:0,p2:0};
  let pending:BattleRecordEvent[]=[],anchor:unknown,lastLogLength=0,key='',damageCount=0,healCount=0,wasEnabled=false;
  const event=(kind:BattleRecordEvent['kind'],data:Record<string,unknown>)=>{pending.push({kind,at:new Date().toISOString(),data:cleanRecordData(data)});};
  const begin=()=>{if(!begun){begun=true;event('start',{...metadata,note:'此記錄僅保存在本機；預設最多10場。'});}};
  const flush=()=>{clearTimeout(timer);timer=undefined;if(stopped||!pending.length)return chain;
    const events=pending;pending=[];
    chain=chain.then(async()=>{if(stopped)return;
      // keepalive 有瀏覽器總大小限制，拆成小批且保持順序。
      let batch:BattleRecordEvent[]=[],bytes=0;
      const write=async()=>{if(!batch.length)return;await send(id,batch,!created);created=true;batch=[];bytes=0;};
      const encoder=new TextEncoder();
      for(const entry of events){const size=encoder.encode(JSON.stringify(entry)).length;if(batch.length&&(bytes+size>34000||batch.length>=40))await write();batch.push(entry);bytes+=size;}await write();notify('最近對戰已寫入本機 TXT。');
    }).catch(error=>{stopped=true;notify(error?.message || '對戰記錄寫入失敗；戰鬥仍可繼續。');});return chain;
  };
  const later=()=>{if(!timer&&pending.length)timer=setTimeout(()=>void flush(),1000);};
  return {id,
    observe(state:BattleState,ledger?:DamageLedger){
      if(closed||stopped)return;
      const on=enabled();
      const logs=state.logs || [];
      const tail=logs.at(-1), unchanged=tail===anchor&&logs.length===lastLogLength;
      const previousAnchor=anchor;
      anchor=tail;
      lastLogLength=logs.length;
      if(!on){wasEnabled=false;damageCount=ledger?.entries.length||0;healCount=ledger?.heals.length||0;return;}
      begin();
      const next=[state.turnNumber,state.p1.battleId,state.p2.battleId,state.winner].join('|');
      if(!wasEnabled||key!==next){event('state',{...battleRecordSnapshot(state,!wasEnabled),recordingResumed:!wasEnabled,initialLogMayBeTruncated:!wasEnabled&&logs.length>=400});key=next;}wasEnabled=true;
      if(!unchanged){
        const index=previousAnchor?logs.lastIndexOf(previousAnchor as any):-1;
        for(let i=index+1;i<logs.length;i+=20)event('logs',{rows:logs.slice(i,i+20).map(l=>({turn:l.turn,type:l.type,text:l.text?.slice(0,1300)}))});
      }
      if(ledger&&(damageCount!==ledger.entries.length||healCount!==ledger.heals.length)){
        const count=Math.max(ledger.entries.length-damageCount,ledger.heals.length-healCount);
        for(let i=0;i<count;i+=20)event('ledger',{
          damage:ledger.entries.slice(damageCount+i,damageCount+i+20),heals:ledger.heals.slice(healCount+i,healCount+i+20),
        });
        damageCount=ledger.entries.length;healCount=ledger.heals.length;
      }
      if(state.winner&&!ended){ended=true;event('end',{winner:state.winner,turn:state.turnNumber,reason:'正式戰鬥結束',actions});void flush();}else later();
    },
    action(data:Record<string,unknown>) {
      if(closed||stopped||!enabled())return;
      begin();
      if((data.stage==='selected'||data.stage==='forced')&&(data.side==='p1'||data.side==='p2'))actions[data.side]++;
      event('action',data);
      later();
    },
    decision(report:DecisionReport){if(closed||stopped||!enabled())return;begin();event('decision',{...report,stage:'決策結果；實際執行以對戰訊息與選招快照為準',label:report.candidates.find(c=>actionKey(c.action)===actionKey(report.action))?.label,candidates:report.candidates.slice(0,8)});void flush();},
    finish(state:BattleState,ledger?:DamageLedger){if(closed)return;this.observe(state,ledger);closed=true;if(!ended&&(created||pending.length)){event('end',{winner:state.winner || null,turn:state.turnNumber,reason:'離開戰鬥；未必分出勝負',actions});}void flush();},
    flush,
  };
}
