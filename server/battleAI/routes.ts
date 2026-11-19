import type { Express, Request } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createSecretStore } from './secretStore';
import { geminiDecision, type ModelInput } from './geminiDecision';
import {validDecisionKey} from './keyFormat';
import {registerBattleRecords} from './recordRoutes';

export function isLocalDecisionRequest(req: Pick<Request,'headers'|'socket'>): boolean {
  const address = req.socket.remoteAddress;
  if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address || '')) return false;
  const host = req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return false;
  return !req.headers.origin || req.headers.origin === `http://${host}`;
}
export function validModelInput(value: any): value is ModelInput {
  return !!value && value.context && Array.isArray(value.candidates) && value.candidates.length >= 1 && value.candidates.length <= 8
    && new Set(value.candidates.map((c:any) => c?.id)).size === value.candidates.length
    && value.candidates.every((c:any) => /^a[0-7]$/.test(c?.id) && typeof c.label === 'string' && c.label.length <= 300 && Number.isFinite(c.score));
}
export function registerBattleAI(app: Express, root: string) {
  const store = createSecretStore(root), token = randomBytes(32).toString('hex');
  let busy = false, lastRequest = 0;
  const authorized = (req: Request) => {
    const supplied = String(req.headers['x-seer-ai-session'] || '');
    return isLocalDecisionRequest(req) && req.headers.origin === `http://${req.headers.host}` && req.is('application/json')
      && supplied.length === token.length && timingSafeEqual(Buffer.from(supplied),Buffer.from(token));
  };
  app.use('/api/battle-ai', (req,res,next) => { res.setHeader('Cache-Control','no-store');
    if (!isLocalDecisionRequest(req)) return res.status(403).json({error:'LOCAL_ONLY'});
    next();
  });
  app.get('/api/battle-ai/status', async (_req,res) => res.json({supported:true,...await store.status(),session:token}));
  registerBattleRecords(app,root,authorized);
  app.post('/api/battle-ai/key', async (req,res) => {
    if (!authorized(req)) return res.status(403).json({error:'LOCAL_ONLY'});
    const key = req.body?.key;
    if (typeof key !== 'string' || (key && !validDecisionKey(key)) || typeof req.body.remember !== 'boolean') return res.status(400).json({error:'INVALID_KEY'});
    try { await store.set(key || undefined,req.body.remember); res.json(await store.status()); }
    catch { res.status(500).json({error:'VAULT_FAILED'}); }
  });
  app.post('/api/battle-ai/decide', async (req,res) => {
    if (!authorized(req)) return res.status(403).json({error:'LOCAL_ONLY'});
    if (!validModelInput(req.body?.input) || JSON.stringify(req.body).length > 48000) return res.status(400).json({error:'INVALID_INPUT'});
    const timeoutMs = req.body.timeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) return res.status(400).json({error:'INVALID_TIMEOUT'});
    if (busy || Date.now()-lastRequest < 500) return res.status(429).json({error:'BUSY'});
    const key = await store.get(); if (!key) return res.status(503).json({error:'KEY_MISSING'});
    busy = true; lastRequest = Date.now();
    const abort = new AbortController(); res.once('close', () => abort.abort());
    try { const answer = await geminiDecision(key,req.body.input,timeoutMs,abort.signal); if (!res.destroyed) res.json(answer); }
    catch (error) { if (!res.destroyed) res.status(502).json({error:/^PROVIDER_\d+$/.test(error?.message) ? error.message : 'MODEL_UNAVAILABLE'}); }
    finally { busy = false; }
  });
}
