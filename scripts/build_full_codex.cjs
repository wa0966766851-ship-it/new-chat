const fs = require('fs');
const path = require('path');

const codexPath = path.join(__dirname, '../src/data/codex.json');
const current = JSON.parse(fs.readFileSync(codexPath, 'utf8'));

const currentMap = new Map(current.map(item => [item.id, item]));

// Generate up to 2278 entries
for (let i = 1; i <= 2278; i++) {
  const id = String(i).padStart(4, '0');
  if (!currentMap.has(id)) {
    currentMap.set(id, {
      id: id,
      template: "",
      paramCount: 0,
      era: "legacy",
      role: "innate",
      node: null,
      damageType: null,
      counterKind: null,
      isDual: false,
      target: "self",
      targetInferred: false,
      polarity: "NEUTRAL",
      contexts: ["skill"],
      namedStatus: false,
      clarity: "vague",
      needsReview: false,
      reviewReason: ""
    });
  }
}

const merged = Array.from(currentMap.values()).sort((a, b) => a.id.localeCompare(b.id));

fs.writeFileSync(codexPath, JSON.stringify(merged, null, 2), 'utf8');
console.log("Success! Total entries in codex.json:", merged.length);
