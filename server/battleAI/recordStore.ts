import {promises as fs,constants} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {renderRecordEvent,type BattleRecordEvent} from '../../src/battle/records/schema';

export const validRecordId=(id:unknown):id is string=>typeof id==='string'&&/^\d{13}-[a-f0-9]{8}-[a-f0-9-]{27}$/.test(id);
export function battleRecordDirectory(root:string) {return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'.config'),'SeerBattle',createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0,20),'battle-records');}
export class BattleRecordStore {
  private queue:Promise<unknown>=Promise.resolve();
  private readonly lastBatch=new Map<string,number>();
  constructor(readonly directory:string) {this.directory=path.resolve(directory);}
  private file(id:string) {if(!validRecordId(id))throw Error('INVALID_ID');return path.join(this.directory,`battle-${id}.txt`);}
  private run<T>(action:()=>Promise<T>):Promise<T> {const next=this.queue.then(action);this.queue=next.catch(()=>{});return next;}
  private async files() {
    await fs.mkdir(this.directory,{recursive:true,mode:0o700});
    const rows=await Promise.all((await fs.readdir(this.directory)).filter(n=>n.startsWith('battle-')&&n.endsWith('.txt')&&validRecordId(n.slice(7,-4))).map(async name=>{const stat=await fs.lstat(path.join(this.directory,name));return stat.isFile()&&!stat.isSymbolicLink()?{id:name.slice(7,-4),name,bytes:stat.size}:null;}));
    return rows.filter(Boolean).sort((a,b)=>b.id.localeCompare(a.id));
  }
  list() {return this.run(()=>this.files());}
  append(id:string,events:BattleRecordEvent[],create=false,batch?:number) {return this.run(async()=>{
    await fs.mkdir(this.directory,{recursive:true,mode:0o700});
    const file=this.file(id),text=events.map(renderRecordEvent).join('');
    if(batch!==undefined&&batch<=(this.lastBatch.get(id)??0))return;
    if(create){await fs.writeFile(file,'賽爾號對戰與 AI 決策記錄\n未出現「戰鬥結束」時，表示未完整記錄結束；本檔不含模型思考鏈。\n'+text,{flag:'wx',mode:0o600});}
    else {
      const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('INVALID_FILE');
      if(stat.size+Buffer.byteLength(text)>8*1024*1024)throw Error('RECORD_SIZE_LIMIT');
      const handle=await fs.open(file,constants.O_WRONLY|constants.O_APPEND);try{await handle.writeFile(text);}finally{await handle.close();}
    }
    if(batch!==undefined)this.lastBatch.set(id,batch);
    const rows=await this.files();
    for(const old of rows.slice(10)){await fs.unlink(this.file(old.id));this.lastBatch.delete(old.id);}
    if(!rows.slice(0,10).some(row=>row.id===id))throw Error('RECORD_EXPIRED');
  });}
  read(id:string) {return this.run(async()=>{const file=this.file(id),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('INVALID_FILE');return fs.readFile(file,'utf8');});}
  delete(id?:string) {return this.run(async()=>{const rows=await this.files();for(const row of rows.filter(row=>!id||row.id===id)){await fs.unlink(this.file(row.id));this.lastBatch.delete(row.id);}});}
}
