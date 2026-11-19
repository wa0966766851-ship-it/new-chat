import { randomUUID } from 'node:crypto';
import express, { type Express, type Request } from 'express';
import { renderProfileExport } from '../encyclopedia/server/export';
import type { SpotlightExportSnapshot } from '../src/utils/spotlightExport';

const endpoint = '/api/spotlight-export';
const loopback = (req: Request) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');

export function registerSpotlightExport(app: Express) {
  let active: { id: string; snapshot: SpotlightExportSnapshot } | undefined;

  app.get(`${endpoint}/:id`, (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!loopback(req) || !active || req.params.id !== active.id) return res.sendStatus(404);
    return res.json(active.snapshot);
  });

  app.post(endpoint, express.json({ limit: '8mb' }), async (req, res) => {
    const origin = req.get('Origin');
    const host = req.get('Host');
    if (!loopback(req) || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host ?? '')
      || (origin && origin !== `${req.protocol}://${host}`)) {
      return res.status(403).json({ error: '請在這台電腦的模擬器中使用匯出功能。' });
    }
    const { elf, textSize, fieldSizes, format } = req.body ?? {};
    const validSize = (size: unknown) => typeof size === 'number' && Number.isFinite(size) && size >= 80 && size <= 160;
    if ((format !== 'png' && format !== 'pdf') || typeof elf?.id !== 'string' || typeof elf.name !== 'string'
      || typeof elf.type !== 'string' || !Array.isArray(elf.skills) || !validSize(textSize)
      || !fieldSizes || typeof fieldSizes !== 'object' || Array.isArray(fieldSizes)
      || !Object.values(fieldSizes).every(validSize)) {
      return res.status(400).json({ error: '精靈資料或字級設定有誤，請重新開啟介紹頁。' });
    }
    if (active) return res.status(409).json({ error: '正在匯出另一份介紹，請稍候再試。' });

    const id = randomUUID();
    const address = req.socket.localAddress === '::1' ? '[::1]' : '127.0.0.1';
    const url = new URL('/', `http://${address}:${req.socket.localPort}`);
    url.searchParams.set('spotlightExport', id);
    active = { id, snapshot: { elf, textSize, fieldSizes } };
    try {
      const file = await renderProfileExport(url, format, '.spotlight-export', '.spotlight-export-page');
      res.set('Cache-Control', 'no-store').type(format === 'png' ? 'image/png' : 'application/pdf').send(file);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : '無法產生匯出檔案。' });
    } finally {
      active = undefined;
    }
  });
}
