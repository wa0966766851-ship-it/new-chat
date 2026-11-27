import assert from 'node:assert/strict';
import {createSessionIdentity,verifySessionIdentity} from '../src/online/sessionIdentity';
import {P2P_RULES_VERSION,validRoomMessage} from '../src/online/protocol';
const a=await createSessionIdentity(),b=await createSessionIdentity();
const proof=await a.prove('0123456789abcdef','host',P2P_RULES_VERSION);
assert.equal(await verifySessionIdentity(a.publicKey,proof,'0123456789abcdef','host',P2P_RULES_VERSION),true);
assert.equal(await verifySessionIdentity(b.publicKey,proof,'0123456789abcdef','host',P2P_RULES_VERSION),false);
assert.equal(await verifySessionIdentity(a.publicKey,proof,'fedcba9876543210','host',P2P_RULES_VERSION),false);
assert.equal(await verifySessionIdentity(a.publicKey,proof,'0123456789abcdef','guest',P2P_RULES_VERSION),false);
assert.equal(await verifySessionIdentity(a.publicKey,proof,'0123456789abcdef','host','old'),false);
assert.equal(await verifySessionIdentity('A'.repeat(87),proof,'0123456789abcdef','host',P2P_RULES_VERSION),false);
assert.equal(validRoomMessage({kind:'hello',version:P2P_RULES_VERSION}),false);
assert.equal(validRoomMessage({kind:'hello',version:P2P_RULES_VERSION,proof,privateKey:'no'}),false);
assert.equal(validRoomMessage({kind:'hello',version:P2P_RULES_VERSION,proof}),true);
console.log('房間簽章驗證、不同房間/座位/版本重放拒絕、冒名與錯誤公鑰拒絕通過');

assert.equal(validRoomMessage({kind:"player-info",name:"同名測試玩家"}),true);
assert.equal(validRoomMessage({kind:"player-info",name:"bad\u0000name"}),false);
assert.equal(validRoomMessage({kind:"confirm-opponent",ready:true}),false);

const peakProof=await a.prove("0123456789abcdef","host",P2P_RULES_VERSION+":peak");
assert.equal(await verifySessionIdentity(a.publicKey,peakProof,"0123456789abcdef","host",P2P_RULES_VERSION+":destiny"),false);
