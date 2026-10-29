import { EffectConnectionInspector } from './EffectConnectionInspector';
import { getSoulMarkRegistry, hasSkillHandler } from '../effects/battleEventRegistry';
import type { EffectDefinition, EffectExecutionMode } from '../effects/effectConnection';
import { describeExecution } from '../blocks/audit';
import type { Elf, Skill } from '../types';

/** 按需載入完整核對入口，避免首頁／未展開的編輯卡片載入戰鬥註冊表。 */
export default function EffectConnectionControls({ definition, kind, elfName, elf, onModeChange, onKitChange }: {
  definition: EffectDefinition; kind: 'skill' | 'soul'; elfName?: string; elf?: Elf;
  onModeChange: (mode: EffectExecutionMode) => void;
  onKitChange?: (kit: NonNullable<EffectDefinition['kit']>) => void;
}) {
  const hasHandler = kind === 'skill' ? hasSkillHandler(definition.name) : !!getSoulMarkRegistry()[elfName || ''];
  const legacyExecution = elf ? describeExecution(kind === 'skill' ? { elf, skill: definition as Skill } : {
    elf: { ...elf, soulMark: { ...elf.soulMark!, ...definition }, kit: definition.kit },
  }) : undefined;
  return <EffectConnectionInspector definition={definition} kind={kind} hasHandler={hasHandler} legacyExecution={legacyExecution} onModeChange={onModeChange} onKitChange={onKitChange} />;
}
