const fs = require('fs');
const path = require('path');

// CJS helper to generate src/data/codex.json
const outputJsonPath = path.join(process.cwd(), 'src', 'data', 'codex.json');

// Ensure directory exists
const dataDir = path.dirname(outputJsonPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log("Output JSON path:", outputJsonPath);
