/** 原生解碼結果共用：小圖短暫保溫，大圖只留卸載／掛載的緩衝；不持有整庫。 */
export function createPetClipPool<K,T>(options:{bytes:(id:K)=>number;load:(id:K,signal:AbortSignal,stage:(name:string)=>void)=>Promise<T>;dispose:(clip:T)=>void|Promise<void>;limitBytes:number;idleBytes:number;idleMs?:number;handoffMs?:number;now?:()=>number;schedule?:(fn:()=>void,ms:number)=>unknown;cancel?:(timer:unknown)=>void}){
 type Entry={id:K;users:number;bytes:number;abort:AbortController;promise:Promise<T>;state:'loading'|'ready'|'error';stage:string;start:number;loadMs?:number;timer?:unknown;last:number};
 const entries=new Map<K,Entry>(),history:{id:K;loadMs:number;result:'ready'|'error'}[]=[];
 const now=options.now??Date.now,schedule=options.schedule??setTimeout,cancel=options.cancel??(id=>clearTimeout(id as ReturnType<typeof setTimeout>));
 let loads=0,hits=0;
 function remove(e:Entry){if(entries.get(e.id)!==e)return;if(e.timer!==undefined)cancel(e.timer);entries.delete(e.id);e.abort.abort();void e.promise.then(clip=>options.dispose(clip),()=>{});}
 function trimIdle(){const idle=[...entries.values()].filter(e=>!e.users&&e.state==='ready'&&e.bytes<=options.idleBytes);let used=idle.reduce((n,e)=>n+e.bytes,0);for(const e of idle.sort((a,b)=>a.last-b.last)){if(used<=options.idleBytes)break;used-=e.bytes;remove(e);}}
 function releaseLater(e:Entry){if(e.timer!==undefined)cancel(e.timer);const ms=e.state==='ready'&&e.bytes<=options.idleBytes?(options.idleMs??15000):(options.handoffMs??250);e.timer=schedule(()=>{if(!e.users)remove(e);},ms);trimIdle();}
 return {
  acquire(id:K){
   let e=entries.get(id);
   if(e){hits++;if(e.timer!==undefined){cancel(e.timer);e.timer=undefined;}}
   else{
    const bytes=options.bytes(id);
    for(const idle of [...entries.values()].filter(v=>!v.users).sort((a,b)=>a.last-b.last)){if([...entries.values()].reduce((n,v)=>n+v.bytes,0)+bytes<=options.limitBytes)break;remove(idle);}
    if([...entries.values()].reduce((n,v)=>n+v.bytes,0)+bytes>options.limitBytes)return {clip:Promise.reject<T>(Error('動畫圖集超出同時使用預算')),release:()=>{}};
    const entry:Entry={id,users:0,bytes,abort:new AbortController(),promise:undefined!,state:'loading',stage:'準備',start:now(),last:now()};e=entry;entries.set(id,e);loads++;
    entry.promise=Promise.resolve().then(()=>options.load(id,entry.abort.signal,name=>{entry.stage=name;})).then(clip=>{
     entry.state='ready';entry.stage='就緒';entry.loadMs=now()-entry.start;history.push({id,loadMs:entry.loadMs,result:'ready'});if(history.length>20)history.shift();if(!entry.users&&entries.get(id)===entry)releaseLater(entry);return clip;
    },error=>{entry.state='error';history.push({id,loadMs:now()-entry.start,result:'error'});if(history.length>20)history.shift();if(entries.get(id)===entry){if(entry.timer!==undefined)cancel(entry.timer);entries.delete(id);}throw error;});
   }
   const current=e;current.users++;current.last=now();let released=false;
   return {clip:current.promise,release:()=>{if(released)return;released=true;current.users--;current.last=now();if(!current.users&&entries.get(id)===current)releaseLater(current);}};
  },
  snapshot:()=>[...entries.values()].map(e=>({id:e.id,users:e.users,rgbaBytes:e.bytes,stage:e.stage,loadMs:e.loadMs,elapsedMs:now()-e.start})),
  diagnostics:()=>({loads,hits,history:[...history]}),
 };
}
