import type {Elf} from '../types';
type Owner=Pick<Elf,'id'|'battleId'|'name'|'skinId'>;
const key=(side:string,elf:Owner)=>`${side}:${elf.battleId||elf.id}:${elf.name}:${elf.skinId||''}`;
const transitions=new Map<string,{pending:Promise<void>;release:()=>void}>();
/** 僅播放器真的切換外觀時登記；靜態模式與隱匿不會建立等待。 */
export function beginPetFormTransition(side:string,elf:Owner){
 const id=key(side,elf);transitions.get(id)?.release();let finish!:()=>void;
 const pending=new Promise<void>(r=>{finish=r;});
 let ended=false;
 const release=()=>{if(ended)return;ended=true;clearTimeout(timer);if(transitions.get(id)?.pending===pending)transitions.delete(id);finish();};
 // 與播放器載入上限一致並留過場餘裕；卸載或失敗會提早解除。
 const timer=setTimeout(release,48000);timer.unref?.();transitions.set(id,{pending,release});
 return release;
}
/** React 提交後才會掛載新播放器；短暫等待登記，缺圖／靜態不會阻塞戰鬥。 */
export async function waitPetFormTransition(side:string,elf:Owner){
 const id=key(side,elf),deadline=performance.now()+200;
 do {const pending=transitions.get(id);if(pending){await pending.pending;return;}await new Promise(r=>setTimeout(r,16));}while(performance.now()<deadline);
}
