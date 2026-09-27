/**
 * Effect Migration Assistant Script
 * This script scans the codebase for legacy turn-based effect patterns
 * and suggests how to migrate them to the new unified BattleEffect system.
 */

const fs = require('fs');
const path = require('path');

const BATTLE_SCREEN_PATH = path.join(__dirname, '../src/components/BattleScreen.tsx');

function scanForLegacyEffects() {
  if (!fs.existsSync(BATTLE_SCREEN_PATH)) {
    console.error('BattleScreen.tsx not found!');
    return;
  }

  const content = fs.readFileSync(BATTLE_SCREEN_PATH, 'utf8');
  
  // Pattern 1: find p1...Turns and p2...Turns states
  const stateRegex = /const \[p([12])([a-zA-Z0-9]+)Turns, set/g;
  const legacyStates = [];
  let match;
  
  while ((match = stateRegex.exec(content)) !== null) {
    legacyStates.push({
      side: 'p' + match[1],
      name: match[2],
      original: `p${match[1]}${match[2]}Turns`
    });
  }

  console.log('--- Found Legacy Turn States ---');
  legacyStates.slice(0, 20).forEach(s => {
    console.log(`Side: ${s.side}, Effect: ${s.name} (Variable: ${s.original})`);
  });
  if (legacyStates.length > 20) console.log(`... and ${legacyStates.length - 20} more.`);

  console.log('\n--- Migration Suggestion Example ---');
  const example = legacyStates[0];
  if (example) {
    console.log(`To migrate ${example.original}:`);
    console.log(`1. Replace all set${example.side.toUpperCase()}${example.name}Turns(n) with:`);
    console.log(`   addBattleEffect("${example.side}", { id: "${example.name.toLowerCase()}", name: "${example.name}", duration: n, isClearable: true, source: 'skill' });`);
    console.log(`\n2. Replace usages of ${example.original} with:`);
    console.log(`   getBattleEffectValue(${example.side}Elf, "${example.name.toLowerCase()}")`);
  }
}

scanForLegacyEffects();
