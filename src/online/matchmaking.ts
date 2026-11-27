import {P2P_RULES_VERSION,type RoomAdmission} from './protocol';
export type MatchMode='peak'|'destiny';
type Request=<T>(path:string,options?:{token?:string;body?:object;method?:string;closing?:boolean})=>Promise<T>;
export async function waitForMatch(request:Request,mode:MatchMode,signal:AbortSignal,onWait?:(seconds:number)=>void){
 const ticket=await request<{id:string;token:string;expires:number;serverTime:number}>('/match',{body:{version:P2P_RULES_VERSION,mode}});
 let claimed=false;
 const path='/match/'+ticket.id;
 try{
  while(!signal.aborted){
   const state=await request<{state:string;expires:number;serverTime:number;admission?:RoomAdmission}>(path,{token:ticket.token});
   onWait?.(Math.max(0,Math.ceil((state.expires-state.serverTime)/1000)));
   if(state.state==='matched'&&state.admission){
    await request(path+'/claim',{token:ticket.token,body:{}});claimed=true;
    return state.admission;
   }
   await new Promise<void>((resolve,reject)=>{
    const done=()=>{signal.removeEventListener('abort',cancel);resolve();};
    const timer=setTimeout(done,1500);
    const cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(signal.reason);};
    signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
   });
  }
  throw signal.reason||Error('配對已取消');
 }finally{if(!claimed)void request(path,{token:ticket.token,method:'DELETE',closing:true}).catch(()=>{});}
}
