import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Elf } from '../../src/types';
import { effectDefinitionEntries } from '../../src/battle/effectSources';
import { defaultEffectKit } from '../../src/effects/effectPresets';
import { effectValueLeaves } from '../../src/effects/effectVisualTree';
import { EffectParameterTree } from '../../src/components/EffectParameterTree';

export function auditEffectVisualization(elves: Elf[]) {
  const snapshot = JSON.stringify(elves);
  const rows = elves.flatMap(elf=>{
    const definitions = [
      ...effectDefinitionEntries(elf).map(definition=>({definition:definition.soul ? {...definition,kit:definition.kit ?? elf.kit}:definition,kind:'soul' as const,category:definition.kind})),
      ...[...elf.skills,...(elf.skillPool || [])].filter((s,i,all)=>all.findIndex(t=>t.name===s.name&&t.description===s.description)===i)
        .map(definition=>({definition,kind:'skill' as const,category:'技能'})),
    ];
    return definitions.map(({definition,kind,category})=>{
      const draft = defaultEffectKit(definition,kind);
      const fields = effectValueLeaves(draft.kit).length;
      const html = renderToStaticMarkup(<EffectParameterTree value={draft.kit}/>);
      const visibleFields = (html.match(/data-effect-value=/g)||[]).length;
      return {elfId:elf.id,elfName:elf.name,name:definition.name,category,entries:draft.kit.length,fields,visibleFields,
        complete:draft.complete,issues:draft.issues.map(issue=>issue.reason),allFieldsVisible:fields===visibleFields};
    });
  });
  if(JSON.stringify(elves)!==snapshot)throw new Error('可視化稽核改動了精靈來源');
  return {summary:{elves:elves.length,definitions:rows.length,kitEntries:rows.reduce((n,row)=>n+row.entries,0),
    parameterFields:rows.reduce((n,row)=>n+row.fields,0),allFieldsVisible:rows.every(row=>row.allFieldsVisible),
    incompleteDefinitions:rows.filter(row=>!row.complete).length,
    semanticAccuracy:null,scope:'參數樹呈現覆蓋；不等於戰鬥語意正確率或人工前台驗收'},rows};
}
