import {BATTLE_ITEMS} from '../utils/battleHelpers';
import {soulDefinition} from './soulDefinitionSource';
import type {Elf} from '../types';
/** 僅有明確訂閱者才建立完整上下文；普通戰鬥不新增一輪全效果查詢。 */
export function hasBattleNodeObserver(elf:Elf,inventory:any):boolean{
 const defs=[soulDefinition(elf),elf.trait,elf.alienTraits?.gen2Trait,elf.alienTraits?.exclusiveTrait,...(elf.alienTraits?.exclusiveTraits||[]),elf.alienTraits?.alienTrait,elf.alienTraits?.generalTrait];
 return defs.some(def=>def?.effectMode==='kit'&&def.kit?.some(entry=>entry.node==='battle_node'))||BATTLE_ITEMS.some(item=>(inventory?.[item.id]?.left||0)>0&&item.heldKit?.some(entry=>entry.node==='battle_node'));
}
