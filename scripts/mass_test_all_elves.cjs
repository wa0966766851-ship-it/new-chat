const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

// Setup JSDOM
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost:3000/?mass_test=1"
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage;
global.location = dom.window.location;
global.Element = dom.window.Element;
dom.window.Element.prototype.scrollIntoView = () => {};
dom.window.scrollTo = () => {};

// Mock matchMedia
global.window.matchMedia = global.window.matchMedia || function() {
    return {
        matches: false,
        addListener: function() {},
        removeListener: function() {}
    };
};

// Import React and App
// Note: Since we are using CJS here but App is ESM, we might need a wrapper or use tsx
console.log("🚀 Starting Mass Test for all Elves...");

// We'll use a child process to run the actual test via tsx to handle imports correctly
const { spawn } = require('child_process');

const testScript = `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/App";
import { DEFAULT_ELVES } from "./src/data/defaultElves";
import fs from "fs";

async function run() {
  console.log("Mass test script started inside tsx...");
  // This is a placeholder. Real implementation would involve 
  // triggering the MassTestModal logic programmatically.
  // For now, we verify we can load all elves.
  console.log("Total elves to test: " + DEFAULT_ELVES.length);
  
  // We can write a result file
  const results = DEFAULT_ELVES.map(e => ({ id: e.id, name: e.name, status: 'ready' }));
  fs.writeFileSync('mass_test_report.json', JSON.stringify(results, null, 2));
  console.log("Mass test report generated.");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
`;

fs.writeFileSync('scripts/mass_test_runner.tsx', testScript);

const child = spawn('npx', ['tsx', 'scripts/mass_test_runner.tsx'], { stdio: 'inherit' });

child.on('close', (code) => {
  console.log(`Mass test process exited with code ${code}`);
  process.exit(code);
});
