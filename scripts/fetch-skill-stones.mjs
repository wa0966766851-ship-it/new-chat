// 官方原始資料與圖片快照；只寫獨立 skill-stones 目錄，不覆蓋其他素材。
import { mkdir, writeFile } from 'node:fs/promises';
const api = 'https://api.seerapi.com/v1/skill_stone?limit=105&expand=true';
const result = await fetch(api, { signal: AbortSignal.timeout(30000) });
if (!result.ok) throw new Error(`SeerAPI ${result.status}`);
const data = await result.json();
if (data.count !== 105 || data.results.length !== 105) throw new Error('技能石列表不完整');
await mkdir('docs/data', { recursive: true });
await writeFile('docs/data/skill-stones-seerapi.json', JSON.stringify({ source: api, fetchedAt: new Date().toISOString(),
  stones: data.results.map(s => ({ id: s.id, name: s.name, rank: s.rank, power: s.power, max_pp: s.max_pp,
    accuracy: s.accuracy, itemId: s.item.id, effects: s.effect.map(e => ({ inner_id: e.inner_id, acquisitionProbability: e.prob,
      effects: e.effect.map(a => ({ info: a.info, args: a.args, effectTypeId: a.effect.id })) })) })) }, null, 2) + '\n');
await mkdir('public/seer/skill-stones', { recursive: true });
let downloaded = 0, bytes = 0;
for (let i = 0; i < data.results.length; i += 5) {
  await Promise.all(data.results.slice(i, i + 5).map(async s => {
    const url = `https://raw.githubusercontent.com/SeerAPI/seer-unity-assets/main/newseer/assets/art/ui/assets/item/skillstone/icon/${s.item.id}.png`;
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`${s.item.id}: ${r.status}`);
    const b = Buffer.from(await r.arrayBuffer());
    if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('不是 PNG');
    await writeFile(`public/seer/skill-stones/${s.item.id}.png`, b);
    downloaded++; bytes += b.length;
  }));
}
console.log(`SeerAPI：105 筆資料、${downloaded} 張 PNG、${bytes} bytes`);
