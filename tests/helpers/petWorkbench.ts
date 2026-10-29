import type {Elf,Skill} from '../../src/types';
export type WorkbenchSelection={id:string;skinId:string};
export const REY_OWNERS=['5029','7070','707070'];
/** 視覺場景隔離數值及效果；場地與時間軸仍由正式 BattleScreen 處理。 */
export function workbenchElf(roster:readonly Elf[],selection:WorkbenchSelection,side:'p1'|'p2',attacker:'p1'|'p2',visual=true,keepSoul=false):Elf{
 const seed=roster.find(e=>String(e.id)===selection.id);
 if(!seed)throw Error('驗收名冊缺少 '+selection.id);
 const elf=structuredClone({...seed,skinId:selection.skinId||undefined,battleId:'animation-'+side});
 if(!visual)return elf;
 const stats={hp:10000,atk:200,def:200,spatk:200,spdef:200,speed:side===attacker?200:100};
 const categories=['物理','特殊','屬性','屬性','物理'] as const;
 const skills=categories.map((category,i)=>({name:'動畫驗收'+(i+1)+'・'+category,category,type:category==='屬性'?'無':seed.type,power:category==='屬性'?0:30,pp:99,maxPp:99,accuracy:100,isSureHit:true,priority:0,isFifthSkill:i===4,description:'僅測正式對戰演出；不驗收原技能效果。',effectMode:'kit',kit:[]} as Skill));
 // 2026-10-28：額外行動格必須是 extra 類別，否則引擎只會發 cp（屬性）動畫事件，永遠測不到 add1/add2。
 skills[3].name='動畫驗收・額外行動';
 (skills[3] as any).category='extra';
 (skills[3] as any).type='無';
 (skills[3] as any).power=0;
 skills[3].kit=[{codeId:'effect_sequence',source:'skill',role:'attached',node:'on_skill_use',order:0,customText:'驗收額外行動',params:{clause:{raw:'驗收額外行動',trig:'use',parsed:true,body:[{acts:[{op:'queue_extra_action',p:{label:'驗收額外行動',damageRatio:0.01,elem:'普通',body:[{acts:[{op:'heal',p:{side:'self',ratio:0.0001}}]}]}}]}]}}}];
 return {...elf,baseStats:stats,calculatedStats:stats,currentHp:10000,maxHp:10000,critValue:16,skills,trait:undefined,traits:[],soulMark:keepSoul?elf.soulMark:{name:'',description:'',effectType:'none',effectValue:0,effectMode:'kit',kit:[]}} as Elf;
}

