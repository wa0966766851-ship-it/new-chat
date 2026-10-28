#!/usr/bin/env node
/**
 * ui_shot.mjs — 用真實裝置尺寸截圖（headless Edge + CDP）
 *
 * 為什麼需要它：
 *   Edge 的 `--window-size` 在 headless 下會加上視窗邊框，
 *   指定 390 實際得到 innerWidth≈492，截圖於是被裁掉右邊，
 *   看起來像「版面溢出」，其實是截圖工具的問題。
 *   這裡改用 CDP 的 Emulation.setDeviceMetricsOverride，寬度就是真正的 CSS px。
 *
 * 用法：
 *   node tools/ui_shot.mjs --url http://127.0.0.1:3000/ --out shots/ --preset mobile
 *   node tools/ui_shot.mjs --url ... --width 390 --height 844 --dpr 2
 *
 * 這是純前端驗收工具，不參與伺服器啟動與打包。
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PRESETS = {
  mobile: { width: 390, height: 844, dpr: 2, mobile: true },
  "mobile-small": { width: 360, height: 780, dpr: 2, mobile: true },
  "mobile-landscape": { width: 844, height: 390, dpr: 2, mobile: true },
  tablet: { width: 834, height: 1112, dpr: 2, mobile: true },
  desktop: { width: 1600, height: 900, dpr: 1, mobile: false },
  "desktop-wide": { width: 1920, height: 1080, dpr: 1, mobile: false },
};

const EDGE_CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];

function parseArgs(argv) {
  const out = { preset: "desktop", out: "shots", wait: 3500, url: "http://127.0.0.1:3000/" };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--url") { out.url = val; i++; }
    else if (key === "--out") { out.out = val; i++; }
    else if (key === "--preset") { out.preset = val; i++; }
    else if (key === "--width") { out.width = Number(val); i++; }
    else if (key === "--height") { out.height = Number(val); i++; }
    else if (key === "--dpr") { out.dpr = Number(val); i++; }
    else if (key === "--wait") { out.wait = Number(val); i++; }
    else if (key === "--name") { out.name = val; i++; }
    else if (key === "--pref") { out.pref = val; i++; }   // legacy | aegis | auto
    else if (key === "--click") { out.click = val; i++; } // 點擊文字包含此字串的按鈕
    else if (key === "--click-sel") { out.clickSel = val; i++; } // CSS 選擇器點擊（純圖示按鈕用）
    else if (key === "--ls") { out.ls = val; i++; }      // JSON：{"key":"value"}，navigate 前寫入
    else if (key === "--measure") { out.measure = val; i++; } // CSS 選擇器，回報尺寸
    else if (key === "--reduce-motion") { out.reduceMotion = true; }  // 模擬 prefers-reduced-motion
  }
  return out;
}

async function findBrowser() {
  const { existsSync } = await import("node:fs");
  for (const p of EDGE_CANDIDATES) if (existsSync(p)) return p;
  throw new Error("找不到 Edge/Chrome，請用 --browser 指定路徑");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const consoleLogs = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.consoleAPICalled") {
      const text = (msg.params.args || []).map(a => a.value ?? a.description ?? "").join(" ");
      if (text) consoleLogs.push(`[${msg.params.type}] ${text}`);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      consoleLogs.push(`[exception] ${d.exception?.description || d.text}`);
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  return { send, close: () => ws.close(), logs: consoleLogs };
}

const args = parseArgs(process.argv);
const preset = PRESETS[args.preset] ?? PRESETS.desktop;
const width = args.width ?? preset.width;
const height = args.height ?? preset.height;
const dpr = args.dpr ?? preset.dpr;
const mobile = preset.mobile ?? false;

const browser = await findBrowser();
const port = 9200 + Math.floor(Math.random() * 500);
const userDataDir = path.join(process.env.TEMP ?? ".", `ui-shot-${Date.now()}`);

const proc = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank",
], { stdio: "ignore" });

let version;
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (res.ok) { version = await res.json(); break; }
  } catch { /* 還沒起來 */ }
  await sleep(250);
}
if (!version) { proc.kill(); throw new Error("瀏覽器沒有在時限內啟動"); }

const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const { send, close, logs } = await cdp(target.webSocketDebuggerUrl);

await send("Page.enable");
await send("Runtime.enable");
// 一律明確設定，避免沿用上一輪的模擬狀態（否則正常模式也會是 reduce）
await send("Emulation.setEmulatedMedia", {
  features: [{
    name: "prefers-reduced-motion",
    value: args.reduceMotion ? "reduce" : "no-preference",
  }],
});
await send("Emulation.setDeviceMetricsOverride", {
  width, height, deviceScaleFactor: dpr, mobile,
});
await send("Emulation.setTouchEmulationEnabled", mobile
  ? { enabled: true, maxTouchPoints: 5 }
  : { enabled: false });
/**
 * 等 App 真的渲染出來。
 *
 * 為什麼需要：
 *   reload 之後 React 還沒掛載，此時截圖會得到全黑（約 6KB）。
 *   之前只靠固定 sleep(15000)，偶爾剛好拍到空白。
 *
 * 判定條件：
 *   #root 有子節點，且 body 文字長度 > 0（不是空白殼）。
 */
async function waitForAppReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await send("Runtime.evaluate", {
      expression: `(() => {
        const root = document.getElementById('root');
        const hasChildren = !!(root && root.childElementCount > 0);
        const text = (document.body.innerText || '').trim().length;
        return hasChildren && text > 0;
      })()`,
      returnByValue: true,
    });
    if (res.result.value) return true;
    await sleep(250);
  }
  console.warn('[ui_shot] waitForAppReady 逾時，仍繼續截圖');
  return false;
}

await send("Page.navigate", { url: args.url });
await sleep(Math.min(args.wait, 4000));

// 殼偏好（Aegis 桌面驗證需要強制指定，否則 auto 會落到 legacy）
const lsEntries = {};
if (args.pref) lsEntries["seer_shell_preference"] = args.pref;
if (args.ls) {
  try { Object.assign(lsEntries, JSON.parse(args.ls)); } catch { /* 忽略壞 JSON */ }
}
if (Object.keys(lsEntries).length) {
  const pairs = JSON.stringify(lsEntries);
  await send("Runtime.evaluate", {
    expression: `(() => { const o = ${pairs}; for (const k in o) localStorage.setItem(k, o[k]); return true; })()`,
  });
  await send("Page.reload", { ignoreCache: false });

  // 2026-10-22：reload 後必須等 React 真的掛載完成。
  // 之前只靠固定 sleep，偶爾會在「白畫面」時截圖（產生 6KB 全黑圖）。
  await waitForAppReady();
}

await sleep(args.wait);
await waitForAppReady();

// 支援多段點擊：--click "編成>背包"（用 > 分隔，逐段點）
if (args.click) {
  const steps = args.click.split(">").map(s => s.trim()).filter(Boolean);
  for (const step of steps) {
    const res = await send("Runtime.evaluate", {
      expression: `(() => {
        const el = [...document.querySelectorAll('button,a')]
          .find(b => (b.textContent || '').includes(${JSON.stringify(step)}));
        if (el) el.click();
        return !!el;
      })()`,
      returnByValue: true,
    });
    console.log(`[click] "${step}" → ${res.result.value ? "ok" : "NOT FOUND"}`);
    await sleep(2200);
  }
}

// 選擇器點擊：放在 --click 之後（可點「開戰後才出現」的元素，例如 SKIP）
if (args.clickSel) {
  // 支援 "sel@@等待ms" 格式
  const [sel, waitStr] = args.clickSel.split('@@');
  const extraWait = waitStr ? Number(waitStr) : 0;
  if (extraWait) await sleep(extraWait);
  const res = await send("Runtime.evaluate", {
    expression: `(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (el) el.click();
      return !!el;
    })()`,
    returnByValue: true,
  });
  console.log(`[click-sel] "${sel}" → ${res.result.value ? "ok" : "NOT FOUND"}`);
  await sleep(2200);
}

const metrics = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
  })`,
  returnByValue: true,
});

// 回報目前有哪些 scene 標記（data-scene / #aegis-shell）
const scenes = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    hasAegisShell: !!document.getElementById('aegis-shell'),
    hasLegacyShell: !!document.getElementById('app-wrapper'),
    scenes: [...document.querySelectorAll('[data-scene]')].map(e => e.getAttribute('data-scene')),
    hasBattleUI: !!document.querySelector('.bt-panel'),
    bodyText: (document.body.innerText || '').slice(0, 120),
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    scanLineAnim: (() => {
      const el = [...document.querySelectorAll('#aegis-shell *')].find(e => (e.getAttribute('style') || '').includes('aegisScan'));
      return el ? getComputedStyle(el).animationDuration + ' / ' + getComputedStyle(el).display : 'none';
    })(),
    ringAnim: (() => {
      const el = [...document.querySelectorAll('#aegis-shell svg *')].find(e => (e.getAttribute('style') || '').includes('aegisSpin'));
      return el ? getComputedStyle(el).animationDuration : 'none';
    })(),
    topStack: (() => {
      const back = document.querySelector('.shell-back-slot');
      const tb = document.querySelector('.workspace-toolbar');
      const h1 = tb ? tb.querySelector('h1') : null;
      const kicker = tb ? tb.querySelector('.workspace-kicker') : null;
      const g = (el) => el ? { y: Math.round(el.getBoundingClientRect().y), h: Math.round(el.getBoundingClientRect().height) } : null;
      return JSON.stringify({ back: g(back), toolbar: g(tb), kicker: g(kicker), h1: g(h1), vh: window.innerHeight });
    })(),
    findDragon: (() => {
      // 全 DOM 找「龍之治癒」的相關元素與圖
      const hits = [];
      document.querySelectorAll('#aegis-shell *').forEach(e => {
        const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
        if (own.includes('龍之治癒')) {
          const container = e.closest('[data-workspace-slot], .workspace-slot, li, div');
          const img = container ? container.querySelector('img') : null;
          hits.push({
            text: own.trim().slice(0, 24),
            cls: (e.className||'').toString().slice(0, 28),
            img: img ? img.src.slice(-40) : 'none',
            iw: img ? Math.round(img.getBoundingClientRect().width) : null,
            ih: img ? Math.round(img.getBoundingClientRect().height) : null,
            fit: img ? getComputedStyle(img).objectFit : null,
          });
        }
      });
      return JSON.stringify(hits.slice(0, 8));
    })(),
    elfImgs: (() => {
      // 量所有 ElfAvatar 渲染出來的 img：尺寸、object-fit、縱橫比
      const imgs = [...document.querySelectorAll('#aegis-shell img')].slice(0, 40);
      return JSON.stringify(imgs.map(im => {
        const r = im.getBoundingClientRect();
        const cs = getComputedStyle(im);
        const nw = im.naturalWidth, nh = im.naturalHeight;
        const box = im.parentElement ? im.parentElement.getBoundingClientRect() : null;
        return {
          src: im.src.slice(-22), w: Math.round(r.width), h: Math.round(r.height),
          fit: cs.objectFit, nw, nh,
          bw: box ? Math.round(box.width) : null, bh: box ? Math.round(box.height) : null,
        };
      }));
    })(),
    bigGlyphs: (() => {
      // 找出「單一漢字且字體很大」的元素（佔位徽記的特徵）
      const out = [];
      document.querySelectorAll('#aegis-shell *').forEach(e => {
        if (e.children.length > 0) return;
        const t = (e.textContent || '').trim();
        if (t.length !== 1) return;
        const cs = getComputedStyle(e);
        const fs = parseFloat(cs.fontSize);
        if (fs >= 28) {
          const r = e.getBoundingClientRect();
          out.push({ ch: t, fs, tag: e.tagName, cls: (e.className||'').toString().slice(0,26), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) });
        }
      });
      return JSON.stringify(out.slice(0, 12));
    })(),
    slotImgs: (() => {
      const all = [...document.querySelectorAll('[data-workspace-slot]')];
      const slots = all.filter(s => { const k = s.getAttribute('data-workspace-slot'); return k.startsWith('p2') && parseInt(k.split('-')[1]) >= 6; });
      return JSON.stringify(slots.map(sl => {
        const img = sl.querySelector('img');
        const sr = sl.getBoundingClientRect();
        const ir = img ? img.getBoundingClientRect() : null;
        return {
          slot: sl.getAttribute('data-workspace-slot'),
          sw: Math.round(sr.width), sh: Math.round(sr.height),
          hasImg: !!img,
          iw: ir ? Math.round(ir.width) : null, ih: ir ? Math.round(ir.height) : null,
          src: img ? img.src.slice(-32) : null,
        };
      }));
    })(),
    svgBadges: (() => {
      // 所有佔位 SVG（viewBox 0 0 100 100 是 fallback 的標記）
      const svgs = [...document.querySelectorAll('svg[viewBox="0 0 100 100"]')];
      return JSON.stringify(svgs.slice(0, 5).map(s => {
        const r = s.getBoundingClientRect();
        const slot = s.closest('.workspace-slot, td, li, div');
        const sr = slot ? slot.getBoundingClientRect() : null;
        const t = s.querySelector('text');
        return { sw: Math.round(r.width), sh: Math.round(r.height),
                 slotW: sr ? Math.round(sr.width) : null, slotH: sr ? Math.round(sr.height) : null,
                 ch: (t?.textContent || '').slice(0, 2), cls: (s.parentElement?.className || '').toString().slice(0, 30) };
      }));
    })(),
    floatOverlap: (() => {
      const all = [...document.querySelectorAll("button")];
      const floats = all.filter(b => { const r = b.getBoundingClientRect(); return r.y < 60 && r.x > 200; });
      const tops = all.filter(b => { const r = b.getBoundingClientRect(); return r.y < 60 && r.x > 100 && r.x <= 200; });
      const g = el => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.right), Math.round(r.bottom)]; };
      const fa = floats.map(b => ({ t: (b.title || b.textContent || String()).trim().slice(0, 8), box: g(b) }));
      const ta = tops.map(b => ({ t: (b.title || b.textContent || String()).trim().slice(0, 8), box: g(b) }));
      const ov = [];
      for (const f of floats) for (const t of tops) {
        const a = f.getBoundingClientRect();
        const b = t.getBoundingClientRect();
        const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (ox > 2 && oy > 2) ov.push({ a: (f.title || String()).slice(0, 8), b: (t.title || t.textContent || String()).trim().slice(0, 8) });
      }
      return JSON.stringify({ floats: fa, tops: ta, overlaps: ov });
    })(),
    topBarLayout: (() => {
      const back = document.querySelector('.shell-back-slot');
      const gear = document.querySelector('button[title="系統控制中心"]');
      const legacy = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim() === 'Legacy');
      const g = el => el ? [Math.round(el.getBoundingClientRect().x), Math.round(el.getBoundingClientRect().y), Math.round(el.getBoundingClientRect().right), Math.round(el.getBoundingClientRect().bottom)] : null;
      return JSON.stringify({ back: g(back), gear: g(gear), legacy: g(legacy), vh: window.innerHeight, vw: window.innerWidth });
    })(),
    hubChildren: (() => {
      const all = [...document.querySelectorAll('div')];
      const hub = all.find(d => (d.textContent||'').includes('控制中心') && d.getBoundingClientRect().width === 390);
      if (!hub) return 'no-hub';
      const kids = [...hub.children].slice(0, 5).map(k => ({
        tag: k.tagName,
        cls: (k.className||'').toString().slice(0, 50),
        txt: (k.textContent||'').trim().slice(0, 24),
        w: Math.round(k.getBoundingClientRect().width),
      }));
      return JSON.stringify(kids);
    })(),
    hubPanel: (() => {
      const panel = [...document.querySelectorAll('section')].find(s => (s.textContent||'').includes('控制中心') && s.getBoundingClientRect().width > 50);
      if (!panel) return 'no-panel';
      const r = panel.getBoundingClientRect();
      const cs = getComputedStyle(panel.parentElement);
      return JSON.stringify({
        cls: (panel.className||'').toString().slice(0,50),
        parentCls: (panel.parentElement?.className||'').toString().slice(0,60),
        w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y),
        pos: cs.position,
      });
    })(),
    hubDetail: (() => {
      const txts = ['主題', '背景', '音效', '戰鬥界面', 'HUD', '控制中心'];
      const found = {};
      for (const k of txts) {
        const el = [...document.querySelectorAll('button,h2,h3,span,div')].find(e => (e.textContent||'').trim() === k || ((e.textContent||'').trim().startsWith(k) && e.children.length === 0));
        if (el) { const r = el.getBoundingClientRect(); found[k] = { x: Math.round(r.x), y: Math.round(r.y), visible: r.width > 0 && r.height > 0 }; }
      }
      return JSON.stringify(found);
    })(),
    controlHub: (() => {
      const anyHub = [...document.querySelectorAll('div,section,aside')].find(d => (d.textContent||'').includes('控制中心') && d.getBoundingClientRect().width > 0);
      if (!anyHub) return 'no-hub';
      const r = anyHub.getBoundingClientRect();
      return JSON.stringify({ tag: anyHub.tagName, cls: (anyHub.className||'').toString().slice(0,40), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) });
    })(),
    backVsSettings: (() => {
      const back = document.querySelector('.shell-back-slot');
      const settings = document.querySelector('button[title="系統控制中心"]');
      if (!back || !settings) return 'missing:' + (!!back) + ',' + (!!settings);
      const a = back.getBoundingClientRect();
      const b = settings.getBoundingClientRect();
      const ox = Math.max(0, Math.min(a.right,b.right) - Math.max(a.left,b.left));
      const oy = Math.max(0, Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top));
      return JSON.stringify({ back: [Math.round(a.x), Math.round(a.y), Math.round(a.right)], settings: [Math.round(b.x), Math.round(b.y), Math.round(b.right)], ox: Math.round(ox), oy: Math.round(oy) });
    })(),
    mainScroll: (() => {
      const main = document.querySelector('#aegis-shell main');
      if (!main) return 'no-main';
      const bars = [...document.querySelectorAll('nav')];
      const bottomBar = bars.find(n => (n.textContent||'').includes('首頁'));
      const br = bottomBar ? bottomBar.getBoundingClientRect() : null;
      return JSON.stringify({ scrollH: main.scrollHeight, clientH: main.clientHeight, overflowY: getComputedStyle(main).overflowY, barTop: br ? Math.round(br.top) : null, barH: br ? Math.round(br.height) : null, vh: window.innerHeight });
    })(),
    uxIssues: (() => {
      const issues = [];
      const MIN = 40;
      const isTouch = window.innerWidth <= 767;
      document.querySelectorAll('button, a, [role=button], input, select').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none') return;
        const label = (el.textContent || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 16) || el.tagName;
        const inVp = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
        if (!inVp) return;
        if (isTouch && (r.width < MIN || r.height < MIN)) issues.push({ t: '小熱區', label, w: Math.round(r.width), h: Math.round(r.height) });
        const fullyInVp = r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
        if (!fullyInVp) return;
        const cx = r.x + r.width/2, cy = r.y + r.height/2;
        const top = document.elementFromPoint(cx, cy);
        if (top && top !== el && !el.contains(top) && !top.contains(el)) issues.push({ t: '被遮擋', label, by: (top.textContent||'').trim().slice(0,10) || top.tagName });
        const fs = parseFloat(st.fontSize);
        if (fs && fs < 9 && el.textContent && el.textContent.trim()) issues.push({ t: '字級過小', label, fs: Math.round(fs) });
      });
      // 重疊按鈕
      const btns = [...document.querySelectorAll('button, a')].map(el => ({ el, r: el.getBoundingClientRect() })).filter(b => b.r.width > 0 && b.r.height > 0);
      for (let i = 0; i < btns.length; i++) for (let j = i+1; j < btns.length; j++) {
        const a = btns[i].r, b = btns[j].r;
        if (btns[i].el.contains(btns[j].el) || btns[j].el.contains(btns[i].el)) continue;
        const ox = Math.max(0, Math.min(a.right,b.right) - Math.max(a.left,b.left));
        const oy = Math.max(0, Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top));
        const sm = Math.min(a.width*a.height, b.width*b.height);
        if (sm > 0 && ox*oy/sm > 0.5) issues.push({ t: '按鈕重疊', a: (btns[i].el.textContent||'').trim().slice(0,10), b: (btns[j].el.textContent||'').trim().slice(0,10) });
      }
      return JSON.stringify(issues);
    })(),
    dragonElf: (() => {
      const btns = [...document.querySelectorAll('[data-workspace-slot] button')];
      const hit = [];
      document.querySelectorAll('#aegis-shell *').forEach(e => {
        const t = (e.textContent || '');
        if (t.includes('龍之治癒') && t.length < 40) hit.push(t.trim().slice(0, 30));
      });
      return JSON.stringify(hit.slice(0, 6));
    })(),
    overlapCheck: (() => {
      const back = document.querySelector('.shell-back-slot');
      const h1 = document.querySelector('.workspace-toolbar h1');
      if (!back || !h1) return 'missing';
      const a = back.getBoundingClientRect();
      const b = h1.getBoundingClientRect();
      const overlap = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
      return JSON.stringify({
        back: { x: Math.round(a.x), y: Math.round(a.y), r: Math.round(a.right), b: Math.round(a.bottom) },
        h1: { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.right), b: Math.round(b.bottom) },
        overlap,
      });
    })(),
    toolbarPad: (() => {
      const el = document.querySelector('.workspace-toolbar');
      if (!el) return 'no-toolbar';
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const h1 = el.querySelector('h1');
      const hr = h1 ? h1.getBoundingClientRect() : null;
      return JSON.stringify({ pl: cs.paddingLeft, x: Math.round(r.x), h1x: hr ? Math.round(hr.x) : null });
    })(),
    backBtn: (() => {
      const el = document.querySelector('.shell-back-slot');
      if (!el) return 'no-back';
      const r = el.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
    })(),
    fallbackFonts: (() => {
      const els = [...document.querySelectorAll('.workspace-slot div[style*="container-type"]')];
      return JSON.stringify(els.slice(0, 3).map(e => {
        const cs = getComputedStyle(e);
        return { fs: cs.fontSize, w: Math.round(e.getBoundingClientRect().width), text: (e.textContent||'').trim().slice(0,4) };
      }));
    })(),
    sceneAnim: (() => {
      const el = document.querySelector('#aegis-shell .aegis-scene-enter');
      if (!el) return 'no-element';
      const cs = getComputedStyle(el);
      return cs.animationName + ' / ' + cs.animationDuration;
    })(),
    topStripColor: (() => {
      // 取 header 所在區域，看有哪些元素覆蓋
      const els = document.elementsFromPoint(window.innerWidth / 2, 26);
      return JSON.stringify(els.slice(0, 5).map(e => {
        const cs = getComputedStyle(e);
        return (e.className || e.tagName).toString().slice(0, 30) + ' | bg=' + cs.backgroundColor + ' | ' + cs.backgroundImage.slice(0, 40);
      }));
    })(),
    topbarBox: (() => {
      const el = document.querySelector('.shell-topbar');
      if (!el) return 'no-topbar';
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return JSON.stringify({ pos: cs.position, bg: cs.backgroundColor, h: Math.round(r.height), y: Math.round(r.y), w: Math.round(r.width) });
    })(),
    dialogButtons: (() => {
      const d = document.querySelector('[role="dialog"]');
      if (!d) return 'no-dialog';
      return JSON.stringify([...d.querySelectorAll('button')].map(b => (b.textContent || '').trim().slice(0, 24)));
    })(),
    shortcutTexts: (() => {
      const el = document.querySelector('.lobby-shortcuts');
      if (!el) return 'no-shortcuts';
      return JSON.stringify([...el.querySelectorAll('button')].map(b => (b.textContent || '').trim().slice(0, 30)));
    })(),
    heroBox: (() => {
      const el = document.querySelector('.hero-stage');
      if (!el) return null;
      const img = el.querySelector('img');
      if (!img) return 'no-img';
      const s = getComputedStyle(img);
      return JSON.stringify({
        src: img.src.slice(-40),
        w: img.naturalWidth, h: img.naturalHeight,
        bg: s.backgroundColor, mask: s.maskImage.slice(0, 30),
        mixBlend: s.mixBlendMode, filter: s.filter.slice(0, 50),
        rect: JSON.stringify(img.getBoundingClientRect()),
      });
    })(),
    fieldBox: (() => {
      // 找出「包住角色圖」的那個絕對定位容器
      const img = document.querySelector('[data-battle-root] img');
      if (!img) return null;
      let el = img;
      for (let i = 0; i < 6 && el; i++) {
        el = el.parentElement;
        if (!el) break;
        const cs = getComputedStyle(el);
        if (cs.position === 'absolute') {
          const r = el.getBoundingClientRect();
          return JSON.stringify({
            cls: (el.className || '').slice(0, 120),
            top: cs.top, bottom: cs.bottom, height: Math.round(r.height), y: Math.round(r.y)
          });
        }
      }
      return 'no-absolute-parent';
    })(),
    introPresent: (() => {
      // BattleIntro 有 SKIP 文字，用這個判斷它是否還掛著
      const all = [...document.querySelectorAll('[data-battle-root] *')];
      const skip = all.find(e => (e.textContent || '').trim() === 'SKIP');
      return skip ? 'present' : 'gone';
    })(),
    battlePanelCount: document.querySelectorAll('[data-battle-root] .bt-panel').length,
    manifestHref: (() => {
      const l = document.querySelector('link[rel="manifest"]');
      return l ? l.getAttribute('href') : 'none';
    })(),
    themeColor: (() => {
      const m = document.querySelector('meta[name="theme-color"]');
      return m ? m.getAttribute('content') : 'none';
    })(),
    standalone: (() => {
      try { return matchMedia('(display-mode: standalone)').matches; } catch { return null; }
    })()
  })`,
  returnByValue: true,
});

let measured;
if (args.measure) {
  const res = await send("Runtime.evaluate", {
    expression: `(() => {
      const el = document.querySelector(${JSON.stringify(args.measure)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
               scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,overflowY:el.scrollHeight>el.clientHeight+1, panels:[...el.querySelectorAll(".spot-prose,.spot-skill-list")].map(x=>({class:x.className,scrollHeight:x.scrollHeight,clientHeight:x.clientHeight,overflowY:x.scrollHeight>x.clientHeight+1})),display: cs.display, gridArea: cs.gridArea, maxHeight: cs.maxHeight, flex: cs.flex };
    })()`,
    returnByValue: true,
  });
  measured = res.result.value;
}

// 截圖前強制等兩帧：CSS 動畫層若還在合成，會拍到舊畫面
await send("Runtime.evaluate", {
  expression: `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`,
  awaitPromise: true,
  returnByValue: true,
});
await sleep(600);

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });

await mkdir(args.out, { recursive: true });
const name = args.name ?? `${args.preset}-${width}x${height}`;
const file = path.join(args.out, `${name}.png`);
await writeFile(file, Buffer.from(shot.data, "base64"));

close();
proc.kill();

const m = JSON.parse(metrics.result.value);
console.log(JSON.stringify({ file, ...m, scenes: JSON.parse(scenes.result.value), measured, consoleLogs: logs.slice(-25) }, null, 2));
if (m.overflowX) {
  console.error(`[警告] 文件水平溢出：scrollWidth=${m.docScrollWidth} > clientWidth=${m.docClientWidth}`);
  process.exitCode = 2;
}
