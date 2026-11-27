import express from 'express';
import {randomBytes} from 'node:crypto';
import {P2P_RULES_VERSION,type RoomAdmission} from '../src/online/protocol';

type Mode='peak'|'destiny';
type Ticket={token:string;mode:Mode;expires:number;admission?:RoomAdmission;opponent?:string};
/** Queue owns no player saves, API credentials or battle engine state. */
export function matchmakingRouter(createPair:(mode:Mode)=>[RoomAdmission,RoomAdmission]|undefined,closeRoom:(code:string)=>void,now=Date.now){
 const router=express.Router(),tickets=new Map<string,Ticket>();
 const sweep=()=>{for(const [id,t]of tickets)if(now()>=t.expires){if(t.admission)closeRoom(t.admission.code);tickets.delete(id);}};
 const access=(req:express.Request)=>{
  const id=String(req.params.id),ticket=tickets.get(id);
  return ticket&&req.get('authorization')==='Bearer '+ticket.token?ticket:undefined;
 };
 router.use((_req,_res,next)=>{sweep();next();});
 router.post('/',(req,res)=>{
  if(req.body?.version!==P2P_RULES_VERSION){res.status(409).json({error:'配對規則版本不同'});return;}
  if(!['peak','destiny'].includes(req.body?.mode)||Object.keys(req.body).length!==2){res.status(400).json({error:'請選擇巔峰或命運之輪'});return;}
  if(tickets.size>=256){res.status(503).json({error:'配對佇列已滿'});return;}
  const id=randomBytes(12).toString('base64url'),token=randomBytes(32).toString('base64url');
  const ticket:Ticket={token,mode:req.body.mode,expires:now()+120000};
  const waiting=[...tickets].find(([,t])=>t.mode===ticket.mode&&!t.admission);
  if(waiting){
   const pair=createPair(ticket.mode);
   if(!pair){res.status(503).json({error:'目前無法建立配對房間'});return;}
   const [otherId,other]=waiting;
   other.admission=pair[0];other.opponent=id;other.expires=now()+60000;
   ticket.admission=pair[1];ticket.opponent=otherId;ticket.expires=other.expires;
  }
  tickets.set(id,ticket);
  res.json({id,token,expires:ticket.expires,serverTime:now()});
 });
 router.get('/:id',(req,res)=>{
  const ticket=access(req);if(!ticket){res.status(404).json({error:'配對已過期或憑證無效'});return;}
  res.json({state:ticket.admission?'matched':'waiting',expires:ticket.expires,serverTime:now(),admission:ticket.admission});
 });
 router.delete('/:id',(req,res)=>{
  const ticket=access(req);if(!ticket){res.status(404).json({error:'配對已過期或憑證無效'});return;}
  if(ticket.admission)closeRoom(ticket.admission.code);
  if(ticket.opponent)tickets.delete(ticket.opponent);
  tickets.delete(String(req.params.id));res.status(204).end();
 });
 // Claim a matched ticket once the client has installed its room credentials.
 router.post('/:id/claim',(req,res)=>{
  const ticket=access(req);if(!ticket||!ticket.admission){res.status(404).end();return;}
  const other=ticket.opponent&&tickets.get(ticket.opponent);
  if(other)other.opponent=undefined;
  tickets.delete(String(req.params.id));res.status(204).end();
 });
 return router;
}
