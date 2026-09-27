const fs = require('fs');
const path = require('path');

const METADATA_PATH = path.join(process.cwd(), 'turn_effects_metadata.json');
const REGISTRY_PATH = path.join(process.cwd(), 'src', 'effects', 'unifiedRegistry.ts');

const POSITIVE_KEYWORDS = ["提升", "免疫", "守護", "吸血", "真傷", "護衛", "不朽", "恢復", "先制", "不死", "免彈", "雙倍", "巡視", "視為", "增幅", "跳過", "豁免"];
const NEGATIVE_KEYWORDS = ["弱化", "封鎖", "失效", "弱點", "蝕言", "束縛", "無法", "負面", "減傷", "印記", "疲憊", "麻痺", "害怕", "癱瘓", "鎖魂", "無法切換", "凝滯", "減少"];
const NEUTRAL_KEYWORDS = ["印記", "星軌", "朝歌", "巡視", "星海", "星牙", "黯痕"];

function classify() {
  if (!fs.existsSync(METADATA_PATH)) {
    console.error('Metadata not found. Run extract_effects_metadata.cjs first.');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
  const effects = data.effects;
  
  const seenKeys = new Set();
  const registryEntries = effects.map(eff => {
    if (seenKeys.has(eff.key)) return null;
    seenKeys.add(eff.key);
    
    let polarity = 'NEUTRAL';
    const name = eff.name || "";
    
    // Simple heuristic
    if (POSITIVE_KEYWORDS.some(k => name.includes(k))) polarity = 'POSITIVE';
    if (NEGATIVE_KEYWORDS.some(k => name.includes(k))) polarity = 'NEGATIVE';

    const source = eff.isTurnBased ? 'skill' : 'soulmark';
    const isClearable = eff.isTurnBased;
    
    return `  "${eff.key}": {
    key: "${eff.key}",
    name: "${eff.name}",
    source: "${source}",
    isClearable: ${isClearable},
    polarity: "${polarity}",
    tickOnActionEnd: ${eff.raw.includes('tickOnActionEnd: true')},
    tickOnRoundEnd: ${eff.raw.includes('tickOnRoundEnd: true')}
  }`;
  }).filter(e => e !== null);

  const content = `import { EffectPolarity } from "./types";

export type EffectSource = 'skill' | 'soulmark' | 'mechanic' | 'item';

export interface UnifiedTurnEffect {
  key: string;
  name: string;
  source: EffectSource;
  isClearable: boolean;
  polarity: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  tickOnActionEnd: boolean;
  tickOnRoundEnd: boolean;
  description?: string;
}

export const TURN_EFFECT_REGISTRY: Record<string, UnifiedTurnEffect> = {
${registryEntries.join(',\n')}
};

export const getEffectMetadata = (key: string): UnifiedTurnEffect | undefined => {
  return TURN_EFFECT_REGISTRY[key];
};
`;

  fs.writeFileSync(REGISTRY_PATH, content);
  console.log(`Generated registry with ${effects.length} entries in ${REGISTRY_PATH}`);
}

classify();
