import type {Elf,Skill} from '../../src/types';
import {petAnimationBinding} from '../../src/battle/petAnimationRegistry';
import {PET_ANIMATION_ASSETS} from '../../src/battle/petAnimationAssets';
export type WorkbenchSelection={id:string;skinId:string};
export const REY_OWNERS=['5029','7070','707070'];
/** 視覺場景隔離數值及效果；場地與時間軸仍由正式 BattleScreen 處理。 */
export function workbenchElf(roster:readonly Elf[],selection:WorkbenchSelection,side:'p1'|'p2',attacker:'p1'|'p2',visual=true,keepSoul=false):Elf{
 const seed=roster.find(e=>String(e.id)===selection.id);
 if(!seed)throw Error('驗收名冊缺少 '+selection.id);
 const elf=structuredClone({...seed,skinId:selection.skinId||undefined,battleId:'animation-'+side});
 const binding=petAnimationBinding(elf),asset=binding&&PET_ANIMATION_ASSETS[binding];
 if(!visual)return elf;
 const stats={hp:10000,atk:200,def:200,spatk:200,spdef:200,speed:side===attacker?200:100};
 const categories=['物理','特殊','屬性','屬性','物理'] as const;
 const skills=categories.map((category,i)=>({name:'動畫驗收'+(i+1)+'・'+category,category,type:category==='屬性'?'無':seed.type,power:category==='屬性'?0:30,pp:99,maxPp:99,accuracy:100,isSureHit:true,priority:0,isFifthSkill:i===4,description:'僅測正式對戰演出；不驗收原技能效果。',effectMode:'kit',kit:[]} as Skill));
 // 正常屬性技能排入真實額外行動佇列，由引擎的 extraWindow 發出演出；不是虛構 extra 技能分類。
 skills[3].name='動畫驗收・額外行動';
 (skills[3] as any).category='屬性';
 (skills[3] as any).type='無';
 (skills[3] as any).power=0;
 skills[3].kit=[{codeId:'effect_sequence',source:'skill',role:'attached',node:'on_skill_use',order:0,customText:'驗收額外行動',params:{clause:{raw:'驗收額外行動',trig:'use',parsed:true,body:[{acts:[{op:'queue_extra_action',p:{label:'驗收額外行動',damageRatio:0.01,elem:'普通',body:[{acts:[{op:'heal',p:{side:'self',ratio:0.0001}}]}]}}]}]}}}];
 // 視覺場景也隔離 ID／名稱註冊表；只有清空魂印文本仍會觸發舊的隱匿處理。機制場景保留真實身分。
 return {...elf,...(keepSoul?{}:{id:"preview-"+elf.id,name:asset&&'custom' in asset?'演出測試':elf.name,isConcealed:false,...(asset&&'custom' in asset&&'body' in asset?{path:asset.body}:{})}),baseStats:stats,calculatedStats:stats,currentHp:10000,maxHp:10000,critValue:16,skills,trait:undefined,traits:[],alienTraits:keepSoul?elf.alienTraits:undefined,soulMark:keepSoul?elf.soulMark:{name:'',description:'',effectType:'none',effectValue:0,effectMode:'kit',kit:[]}} as Elf;
}

