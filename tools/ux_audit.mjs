import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k.startsWith("--")) {
    const eq = k.indexOf("=");
    if (eq > 0) args[k.slice(2, eq)] = k.slice(eq + 1);
    else args[k.slice(2)] = true;
  }
}
const PRESETS = { mobile: { w: 390, h: 844, touch: true }, desktop: { w: 1600, h: 900, touch: false } };
const preset = PRESETS[args.preset || "mobile"];

const EDGE_CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];
const EDGE = EDGE_CANDIDATES.find(p => existsSync(p));
if (!EDGE) { console.error("no Edge"); process.exit(1); }

const port = 9700 + Math.floor(Math.random() * 200);
const userDataDir = path.join(process.env.TEMP || ".", "ux-audit-" + Date.now());
const proc = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=" + port,
  "--user-data-dir=" + userDataDir,
  "about:blank",
], { stdio: "ignore" });

const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  try { const res = await fetch("http://127.0.0.1:" + port + "/json/version"); if (res.ok) break; } catch {}
  await sleep(500);
}
const pagesRes = await fetch("http://127.0.0.1:" + port + "/json/list");
const pages = await pagesRes.json();
const wsUrl = pages[0].webSocketDebuggerUrl;
if (!wsUrl) { console.error("no ws url"); process.exit(1); }

const WebSocket = (await import("ws")).default;
const conn = new WebSocket(wsUrl);
await new Promise((res, rej) => { conn.on("open", res); conn.on("error", rej); });

let mid = 0;
const pending = new Map();
conn.on("message", raw => {
  const msg = JSON.parse(raw);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result ?? msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise(res => {
  const id = ++mid;
  pending.set(id, res);
  conn.send(JSON.stringify({ id, method, params }));
});

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: args.url });
await sleep(6000);
if (args.pref) {
  await send("Runtime.evaluate", {
    expression: "localStorage.setItem('seer_shell_preference', '" + args.pref + "')",
  });
  // 用帶新 query 的 navigate 代替 reload，避免 reload 的時序問題
  const sep = args.url.includes("?") ? "&" : "?";
  await send("Page.navigate", { url: args.url + sep + "shell=" + args.pref });
  await sleep(6000);
  // 等 React 真的掛載
  for (let i = 0; i < 80; i++) {
    const ready = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: "(() => { const r = document.getElementById('root'); return !!(r && r.childElementCount > 0 && (document.body.innerText||'').trim().length > 0); })()",
    });
    if (ready.value) break;
    await sleep(250);
  }
}
await sleep(Number(args.wait || 10000));
await send("Emulation.setDeviceMetricsOverride", { width: preset.w, height: preset.h, deviceScaleFactor: 2, mobile: preset.touch });
await sleep(3000);

const audit = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: "(() => { const issues = []; const MIN_TOUCH = 40; const IS_TOUCH = " + String(preset.touch) + ";" +
    "document.querySelectorAll('button, a, [role=button], input, select').forEach(el => {" +
    "  const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return;" +
    "  const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none') return;" +
    "  const label = (el.textContent || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 18) || el.tagName;" +
    "  const inVp = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;" +
    "  if (!inVp) return;" +
    "  if (IS_TOUCH && (r.width < MIN_TOUCH || r.height < MIN_TOUCH)) issues.push({ type: 'small-touch', label, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) });" +
    "  const cx = r.x + r.width/2, cy = r.y + r.height/2;" +
    "  const top = document.elementFromPoint(cx, cy);" +
    "  if (top && top !== el && !el.contains(top) && !top.contains(el)) issues.push({ type: 'covered', label, by: (top.textContent||'').trim().slice(0,12) || top.tagName, x: Math.round(cx), y: Math.round(cy) });" +
    "  if (r.right > window.innerWidth + 2 || r.bottom > window.innerHeight + 2) issues.push({ type: 'offscreen', label, x: Math.round(r.right), y: Math.round(r.bottom) });" +
    "  const fs = parseFloat(st.fontSize);" +
    "  if (fs && fs < 9 && el.textContent && el.textContent.trim()) issues.push({ type: 'tiny-font', label, fs, x: Math.round(r.x), y: Math.round(r.y) });" +
    "});" +
    "const btns = [...document.querySelectorAll('button, a')].map(el => ({ el, r: el.getBoundingClientRect() })).filter(b => b.r.width > 0);" +
    "for (let i = 0; i < btns.length; i++) for (let j = i+1; j < btns.length; j++) {" +
    "  const a = btns[i].r, b = btns[j].r;" +
    "  if (btns[i].el.contains(btns[j].el) || btns[j].el.contains(btns[i].el)) continue;" +
    "  const ox = Math.max(0, Math.min(a.right,b.right) - Math.max(a.left,b.left));" +
    "  const oy = Math.max(0, Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top));" +
    "  const ov = ox*oy, sm = Math.min(a.width*a.height, b.width*b.height);" +
    "  if (sm > 0 && ov/sm > 0.5) issues.push({ type: 'overlap', a: (btns[i].el.textContent||'').trim().slice(0,12), b: (btns[j].el.textContent||'').trim().slice(0,12) });" +
    "}" +
    "return JSON.stringify(issues); })()",
});

const issues = JSON.parse(audit.value || "[]");
const pageCheck = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: "JSON.stringify({ title: document.title.slice(0,30), aegis: !!document.getElementById('aegis-shell'), body: (document.body.innerText||'').trim().slice(0, 60) })",
});
console.log("[page-raw] " + JSON.stringify(pageCheck).slice(0, 300));
console.log("=== UX audit: " + issues.length + " issues ===");
const byType = {};
issues.forEach(i => { byType[i.type] = (byType[i.type] || 0) + 1; });
Object.entries(byType).forEach(([t, c]) => console.log(t + ": " + c));
console.log(JSON.stringify(issues, null, 1).slice(0, 3000));

const outDir = args.out || "shots";
await mkdir(outDir, { recursive: true });
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(path.join(outDir, "ux-audit.png"), Buffer.from(shot.data, "base64"));

conn.close();
proc.kill();
process.exit(0);