const fs = require('fs');
const path = require('path');

// Read the prompt codex data if available or write structured entries
const targetPath = path.join(__dirname, '..', 'src', 'data', 'codex.json');

// Let's create the default codex.json file
if (!fs.existsSync(targetPath)) {
  fs.writeFileSync(targetPath, '[]');
}
console.log("src/data/codex.json initialized successfully.");
