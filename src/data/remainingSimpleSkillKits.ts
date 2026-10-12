import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
const hit = (raw: string, body: any[], order: number): KitEntry => ({ codeId: 'effect_sequence', source: 'skill', role: 'attached', node: 'on_hit', order, customText: raw,
  params: { clause: { raw, trig: 'after_hit', parsed: true, body } } });
export const REMAINING_SIMPLE_SKILL_KITS: ReviewedSequenceSkill[] = [
  ...['閃擊','水流噴射'].map(name => ({ elfIds: ['5010'], name, description: '先制+1', kit: [property('先制+1','base_priority',1,0)] })),
  ...[['5010','玩水'],['5010','龍之牙'],['5011','撞擊'],['5011','疾風刃']].map(([id,name]) => ({ elfIds: [id],name,description:'（無特殊效果）',kit:[sequence('（無特殊效果）',[{acts:[action('noop',{})]}],0)] })),
  ...[{id:'5010',name:'虛張聲勢',stat:'防禦',v:2,text:'必中；技能使用成功時，100% 改變自身防禦等級+2'},
    {id:'5010',name:'劍舞',stat:'攻擊',v:2,text:'必中；技能使用成功時，100% 改變自身攻擊等級+2'},
    {id:'5011',name:'縮頭',stat:'防禦',v:1,text:'必中；技能使用成功時，100%改變自身防禦等級+1。'}].map(({id,name,stat,v,text})=>({elfIds:[id],name,description:text,kit:[property('必中','sure_hit',true,0),hit(text,[{acts:[action('stat',{side:'self',stats:[stat],v,chance:100})]}],1)]})),
  { elfIds:['5010'],name:'星光·劍舞',description:'技能使用成功時，100% 改變自身攻擊等級+2；技能使用成功時，100% 改變自身速度等級+2；技能使用成功時，100% 改變自身命中等級+2',kit:[
    hit('技能使用成功時，100% 改變自身攻擊等級+2；技能使用成功時，100% 改變自身速度等級+2；技能使用成功時，100% 改變自身命中等級+2',[{acts:[action('stat',{side:'self',stats:['攻擊','速度','命中'],v:2,chance:100})]}],0),
  ] },
  { elfIds:['5010'],name:'星光·驚濤駭浪',description:'解除自身所處的異常狀態，解除成功令對手冰封',kit:[sequence('解除自身所處的異常狀態，解除成功令對手冰封',[
    {acts:[action('cure_status',{side:'self'})]}, {chain:'success',acts:[action('status',{side:'opp',status:'冰封',chance:100,turns:3})]},
  ],0)] },
  { elfIds:['5011'],name:'詛咒',description:'必中；技能使用成功時，100%改變自身攻擊等級+1；技能使用成功時，100%改變自身防禦等級+1；技能使用成功時，100%改變自身速度等級-1。',kit:[
    property('必中','sure_hit',true,0),hit('技能使用成功時，100%改變自身攻擊等級+1；技能使用成功時，100%改變自身防禦等級+1；技能使用成功時，100%改變自身速度等級-1。',[{acts:[
      action('stat',{side:'self',stats:['攻擊','防禦'],v:1,chance:100}),action('stat',{side:'self',stats:['速度'],v:-1,chance:100}),
    ]}],1),
  ] },
  {elfIds:['5006'],name:'灰燼',description:'連續使用每次威力增加20，最高威力150。',kit:[sequence('連續使用每次威力增加20，最高威力150。',[{acts:[action('power_streak',{step:20,cap:150})]}],0)]},
];
