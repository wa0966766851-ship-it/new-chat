import {TIANXIE_SOURCE} from './tianxieSource';
import {operation as a,actions as act} from './authoredKitTools';
export const TIANXIE_MARK_ID='dragonWarrant';
const description=TIANXIE_SOURCE.split(/\r?\n/).find(s=>s.startsWith('邪龍緝令:'))!;
export const tianxieMark=()=>a('mark_program',{id:TIANXIE_MARK_ID,name:'邪龍緝令',side:'opp',mode:'add',count:1,maxCount:3,scope:'elf',persistsOffField:true,displayChar:'緝',unit:'道',description,
 priorityBonus:-1,priorityPerStack:true,
 rules:[{raw:description,trig:'damaged_skill',parsed:true,body:[act(a('drain_to_opponent',{flat:300,perLayer:true}))]}],
});
