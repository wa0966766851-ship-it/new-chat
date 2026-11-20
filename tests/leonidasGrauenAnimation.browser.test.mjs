import { closePetTestBrowser, findPetTestBrowser, petTestProfile, launchPetTestBrowser } from './helpers/petBrowserProcess.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const browser = findPetTestBrowser();
assert.ok(browser, '需要 Edge 或 Chrome 驗證真實接觸位置');
const output = path.resolve(process.env.PET_TEST_OUT || '.seer-cache/leonidas-grauen');
fs.mkdirSync(output, { recursive: true });
const port = 9730 + Math.floor(Math.random() * 100);
const profile = petTestProfile();
const processHandle = launchPetTestBrowser(browser, port, profile);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let page;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      page = await (await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', { method: 'PUT' })).json();
      break;
    } catch { await wait(150); }
  }
  assert.ok(page);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const history = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const handler = pending.get(message.id);
      pending.delete(message.id);
      if (handler) (message.error ? handler.reject : handler.resolve)(message.error || message.result);
    } else if (message.method === 'Runtime.exceptionThrown') history.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  const until = async (expression, timeout = 60000) => {
    for (const end = Date.now() + timeout; Date.now() < end;) {
      const value = await evaluate(expression);
      if (value) return value;
      await wait(100);
    }
    const diagnostics = await evaluate(`({id:window.petBattle?.getState().p1.id,phase:window.petBattle?.getState().phase,preview:window.petVisualAudit?.diagnostics(),players:[...document.querySelectorAll('[data-pet-source]')].map(node=>({...node.dataset}))})`);
    throw Error('等待動畫驗收逾時 ' + expression + '\n' + JSON.stringify(diagnostics) + '\n' + history.slice(-8).join('\n'));
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  const base = process.env.PET_TEST_URL || 'http://127.0.0.1:3026/tests/fixtures/petBattlePreview.html';
  const evidence = [];
  for (const [left, right] of [['5050', '5049'], ['5049', '5050']]) {
    const url = new URL(base);
    url.searchParams.set('elf', left);
    url.searchParams.set('opponent', right);
    url.searchParams.set('tools', '0');
    await send('Page.navigate', { url: url.href });
    await until(`window.petBattle?.getState().p1.id==='preview-${left}'`);
    const startup = await evaluate(`({
      prefs:localStorage.getItem('battleAnimationSettings'),
      roster:window.petVisualAudit?.roster().filter(x=>x.id==='5049'||x.id==='5050'),
      sprites:document.querySelectorAll('[data-sprite-side]').length,
      players:document.querySelectorAll('[data-pet-source]').length
    })`);
    console.log(JSON.stringify({ left, right, startup }));
    await until(`document.querySelectorAll('[data-pet-ready="true"]').length===2`);
    const expectedSources = left === '5050' ? ['leonidas', 'grauen'] : ['grauen', 'leonidas'];
    const actualSources = await evaluate(`['p1','p2'].map(side=>document.querySelector('[data-sprite-side="'+side+'"] [data-pet-ready="true"]')?.dataset.petSource)`);
    assert.deepEqual(actualSources, expectedSources, '兩方都要使用對應的原廠播放器');
    const standby = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(output, left + '-vs-' + right + '-standby.png'), Buffer.from(standby.data, 'base64'));
    await evaluate(`window.contactFrames={};window.skillSequences={};window.physicalPlacement={p1:{},p2:{}};(function sample(){
      for(const node of document.querySelectorAll('[data-pet-sequence="cp"]')){
        if(!node.dataset.petMarker?.includes('action_hit'))continue;
        const side=node.closest('[data-sprite-side]')?.dataset.spriteSide;
        window.skillSequences[side]??=node.dataset.petMarker;
      }
      for(const node of document.querySelectorAll('[data-pet-sequence="attack"]')){
        const side=node.closest('[data-sprite-side]')?.dataset.spriteSide;
        if(!side)continue;
        const data=node.dataset;
        window.physicalPlacement[side][data.petFrame]=Number(data.petPlacementX);
        const marker=data.petMarker||''; if(!marker.includes('action_hit'))continue;
        window.contactFrames[side]??={side,frame:Number(data.petFrame),target:Number(data.petTarget),contact:Number(data.petContactPoint),x:Number(data.petBodyX),marker};
      }
      requestAnimationFrame(sample);
    })()`);
    await until(`window.petBattle.getState().phase==='p1_select' && !window.petBattle.isPresenting()`);
    await evaluate(`window.petBattle.onSkillSelect('p1',window.petBattle.getState().p1.skills[0])`);
    await until(`window.petBattle.getState().phase==='p2_select'`);
    await evaluate(`window.petBattle.onSkillSelect('p2',window.petBattle.getState().p2.skills[0])`);
    const contacts = await until(`window.contactFrames.p1 && window.contactFrames.p2 && window.contactFrames`, 45000);
    evidence.push({ left, right, contacts });
    console.log(JSON.stringify({ left, right, contacts }));
    for (const contact of Object.values(contacts)) {
      assert.ok(contact.marker.includes('action_hit'), JSON.stringify(contact));
      assert.ok(Math.abs(contact.contact - contact.target) <= 32, JSON.stringify(contact));
    }
    await until(`window.petBattle.getState().phase==='p1_select' && !window.petBattle.isPresenting()`);
    const track = await evaluate('window.physicalPlacement');
    for (const [side, samples] of Object.entries(track)) {
      const frames = Object.entries(samples).map(([frame, x]) => [Number(frame), x]).sort((a, b) => a[0] - b[0]);
      assert.ok(frames.length > 10, side + ' 要量到完整動作而非單幀');
      const maxStep = Math.max(...frames.slice(1).map(([i,x], n) => Math.abs(x - frames[n][1]) / (i - frames[n][0])));
      assert.ok(maxStep < 80, side + ' 對位不應在單幀拉扯 ' + maxStep);
      (evidence.at(-1).placement ??= {})[side] = Math.round(maxStep);
    }
    await evaluate(`window.petBattle.onSkillSelect('p1',window.petBattle.getState().p1.skills[2])`);
    await until(`window.petBattle.getState().phase==='p2_select'`);
    await evaluate(`window.petBattle.onSkillSelect('p2',window.petBattle.getState().p2.skills[2])`);
    evidence.at(-1).attribute = await until(`window.skillSequences.p1 && window.skillSequences.p2 && window.skillSequences`, 45000);
  }
  fs.writeFileSync(path.join(output, 'impact-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  socket?.close();
  closePetTestBrowser(processHandle, profile);
}

