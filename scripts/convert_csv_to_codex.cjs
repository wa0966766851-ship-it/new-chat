const fs = require('fs');
const path = require('path');

// We will parse codex CSV text and format into src/data/codex.json
const rawCsvPath = path.join(process.cwd(), 'codex.csv');
let csvContent = "";

if (fs.existsSync(rawCsvPath)) {
  csvContent = fs.readFileSync(rawCsvPath, 'utf8');
}

console.log("CSV content length:", csvContent.length);
