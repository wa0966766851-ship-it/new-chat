import type { Elf, Skill } from "../types";
import { useState } from 'react';
import { BlockProgramView } from "./BlockProgramView";
import { describeExecution } from '../blocks/audit';
import { EffectConnectionInspector } from './EffectConnectionInspector';
import { usesAuthoredSkill, usesAuthoredSoul, soulDefinition } from '../effects/connectedEffects';
import { hasSkillHandler, getSoulMarkRegistry } from '../effects/battleEventRegistry';
import type { EffectDefinition } from '../effects/effectConnection';
import { defaultEffectKit } from '../effects/effectPresets';
import { DefaultEffectBlocks } from './DefaultEffectBlocks';
import { EffectDescription } from './EffectDescription';

/** 首頁切到積木詳情才載入解析器及戰鬥登記表。 */
function ExecutionView(props: { elf?: Elf; skill?: Skill; trait?: EffectDefinition }) {
  if (props.skill && usesAuthoredSkill(props.skill, hasSkillHandler(props.skill.name), props.elf)) return <EffectConnectionInspector definition={props.skill} kind="skill" hasHandler={hasSkillHandler(props.skill.name)} />;
  if (props.trait?.effectMode === 'kit' || props.trait?.effectMode === 'description') return <EffectConnectionInspector definition={props.trait} kind="soul" />;
  if (!props.skill && !props.trait && props.elf && usesAuthoredSoul(props.elf, !!getSoulMarkRegistry()[props.elf.name])) return <EffectConnectionInspector definition={soulDefinition(props.elf)} kind="soul" hasHandler={!!getSoulMarkRegistry()[props.elf.name]} />;
  const { program, source } = describeExecution(props);
  return <BlockProgramView program={program} source={source} />;
}
export default function LazyBlockProgramView(props: { elf?: Elf; skill?: Skill; trait?: EffectDefinition }) {
  const [inspect, setInspect] = useState(false);
  const definition = props.skill || props.trait || (props.elf && soulDefinition(props.elf));
  return <div className="space-y-3">{definition && <>
    <details className="rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-sm text-slate-300">原文階層與補充說明</summary>
      <EffectDescription description={definition.description} className="mt-3 text-slate-200" />
    </details>
    <DefaultEffectBlocks draft={defaultEffectKit(definition,props.skill?'skill':'soul')} />
  </>}
    <details onToggle={event=>setInspect(event.currentTarget.open)}><summary className="cursor-pointer text-xs text-slate-400">原執行來源與逐句核對</summary>{inspect && <ExecutionView {...props} />}</details></div>;
}
