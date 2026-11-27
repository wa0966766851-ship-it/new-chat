import {createSessionIdentity} from '../src/online/sessionIdentity';
import assert from 'node:assert/strict';
import express from 'express';
import { createHmac } from 'node:crypto';
import { createP2PSignalRouter } from '../server/p2pSignal';
import { P2P_RULES_VERSION } from '../src/online/protocol';

async function fixture(env: NodeJS.ProcessEnv) {
  const app = express();
  app.use('/api/p2p', createP2PSignalRouter(env, req => `http://${req.get('host')}`));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(done => server.once('listening', done));
  const origin = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
  const request = (path: string, body?: object, token?: string, method?: string) =>
    fetch(origin + '/api/p2p' + path, { method: method || (body ? 'POST' : 'GET'),
      headers: { Origin: origin, ...(body ? {'Content-Type':'application/json'} : {}), ...(token ? {Authorization:'Bearer ' + token} : {}) },
      body: body ? JSON.stringify(body) : undefined });
  return { origin, request, close: async () => {
    server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
  }};
}
const version = {version: P2P_RULES_VERSION};
let checks = 0;
const relay = await fixture({ SEER_P2P_TURN_URLS: 'turn:relay.example:3478', SEER_P2P_TURN_SECRET: 'test-secret' });
try {
  const { request, origin } = relay;
  assert.deepEqual(await (await request('/status')).json(), {available:true,transport:'relay'});
  assert.equal((await request('/rooms', {version:'old'})).status, 409);
  const host = await (await request('/rooms', {...version,mode:'destiny'})).json();
  const room = '/rooms/' + host.code;
  assert.equal(host.rtc.iceTransportPolicy, 'relay');
  const credential = host.rtc.iceServers[0];
  assert.equal(credential.credential, createHmac('sha1','test-secret').update(credential.username).digest('base64'));
  assert.equal(JSON.stringify(host).includes('test-secret'), false);
  assert.equal((await request(room)).status, 404);
  const guest = await (await request(room + '/join', version)).json();
  assert.notEqual(host.token, guest.token);
  assert.equal(host.mode,'destiny');assert.equal(guest.mode,'destiny','指定房間沿用房主選擇的模式');
  assert.equal((await request(room + '/join', version)).status, 409);
  assert.equal((await request(room, undefined, guest.token)).status, 200);
  const hostIdentity=await createSessionIdentity(),guestIdentity=await createSessionIdentity();
  assert.equal((await request(room+'/identity',{publicKey:hostIdentity.publicKey},host.token)).status,204);
  assert.equal((await request(room+'/identity',{publicKey:guestIdentity.publicKey},guest.token)).status,204);
  assert.equal((await request(room+'/identity',{publicKey:guestIdentity.publicKey},host.token)).status,409);
  assert.equal((await request(room+'/identity',{publicKey:'A'.repeat(87)},host.token)).status,400);
  assert.equal((await request(room+'/identity',{publicKey:hostIdentity.publicKey})).status,404);
  assert.equal((await (await request(room,undefined,host.token)).json()).peerKey,guestIdentity.publicKey);
  checks += 14;
  const sdp = (kind: 'relay'|'host') => 'v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=candidate:1 1 UDP 1 127.0.0.1 1234 typ ' + kind + '\r\n';
  assert.equal((await request(room + '/signal', {type:'offer',sdp:sdp('host')}, host.token)).status, 400);
  assert.equal((await request(room + '/signal', {type:'offer',sdp:sdp('relay')}, guest.token)).status, 400);
  assert.equal((await request(room + '/signal', {type:'offer',sdp:sdp('relay')}, host.token)).status, 204);
  assert.deepEqual((await (await request(room, undefined, guest.token)).json()).remote, {type:'offer',sdp:sdp('relay')});
  assert.equal((await request(room + '/signal', {type:'answer',sdp:sdp('relay')}, guest.token)).status, 204);
  assert.equal((await request(room + '/signal', {type:'answer',sdp:sdp('relay')+'a=other\r\n'}, guest.token)).status, 409);
  assert.equal((await request(room + '/signal', {type:'answer',sdp:'v=0'+'x'.repeat(21_000)}, guest.token)).status, 413);
  assert.equal((await fetch(origin + '/api/p2p/status',{headers:{Origin:'https://untrusted.example'}})).status, 403);
  const malformed = await fetch(origin + '/api/p2p/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{'});
  assert.equal(malformed.status,400);
  assert.equal((await request(room,undefined,host.token,'DELETE')).status,204);
  assert.equal((await request(room,undefined,guest.token)).status,404);
  checks += 11;
} finally { await relay.close(); }
const off = await fixture({});
try { assert.equal((await off.request('/rooms',version)).status,503);checks++; }
finally { await off.close(); }
const limited = await fixture({SEER_P2P_ALLOW_DIRECT:'1'});
try {
  let result = 0;
  for(let i=0;i<49;i++) result=(await limited.request('/rooms',{version:'old'})).status;
  assert.equal(result,429);
  checks++;
} finally { await limited.close(); }
console.log(`P2P 信令 HTTP 實測 ${checks} 項通過，涵蓋權杖、版本、中繼限制、訊息大小、離房與限流`);
