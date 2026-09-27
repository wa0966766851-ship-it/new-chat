const fs = require('fs');
const path = require('path');

const BATTLE_SCREEN_PATH = path.join(process.cwd(), 'src', 'components', 'BattleScreen.tsx');

function extractMetadata() {
  const content = fs.readFileSync(BATTLE_SCREEN_PATH, 'utf8');
  
  // Find the start and end of getP1EffectsMetadata
  const startMarker = 'const getP1EffectsMetadata = (): TurnEffectMetadata[] => [';
  const endMarker = '  ];';
  
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    console.error('Could not find getP1EffectsMetadata start marker');
    return;
  }
  
  const contentAfterStart = content.substring(startIndex + startMarker.length);
  const endIndex = contentAfterStart.indexOf(endMarker);
  
  if (endIndex === -1) {
    console.error('Could not find getP1EffectsMetadata end marker');
    return;
  }
  
  const metadataBlock = contentAfterStart.substring(0, endIndex);
  
  // Parse lines
  const lines = metadataBlock.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
  
  const effects = lines.map(line => {
    // Basic regex extraction for key, name, isTurnBased
    const keyMatch = line.match(/key: "([^"]+)"/);
    const nameMatch = line.match(/name: "([^"]+)"/);
    const isTurnBasedMatch = line.match(/isTurnBased: (true|false)/);
    
    return {
      key: keyMatch ? keyMatch[1] : null,
      name: nameMatch ? nameMatch[1] : null,
      isTurnBased: isTurnBasedMatch ? isTurnBasedMatch[1] === 'true' : false,
      raw: line
    };
  }).filter(e => e.key);

  console.log(`Found ${effects.length} effects in getP1EffectsMetadata`);
  
  const output = {
    timestamp: new Date().toISOString(),
    count: effects.length,
    effects: effects
  };
  
  fs.writeFileSync('turn_effects_metadata.json', JSON.stringify(output, null, 2));
  console.log('Saved to turn_effects_metadata.json');
}

extractMetadata();
