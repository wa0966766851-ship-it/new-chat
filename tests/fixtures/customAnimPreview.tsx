import React from 'react';
import {createRoot} from 'react-dom/client';
import {loadCustomClip} from '../../src/battle/customPetClip';

/** 自製動作素材的播放器驗收頁：真實 SwfPlayer + 真實圖集，逐序列播到指定影格截圖。 */
const IDS = ['wuxu_zhuixing', 'wuxu_shiyan', 'emperor_dixin', 'wuxu_liuren'];

function Harness() {
  const host = React.useRef<HTMLDivElement>(null);
  const player = React.useRef<any>(null);
  const [log, setLog] = React.useState<string>('準備中');

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const id = new URLSearchParams(location.search).get('id') || IDS[0];
      const {SwfPlayer} = await import('@seer-pet-anim/swf-renderer');
      const clip = await loadCustomClip('/elf-anim/' + id);
      if (!alive || !host.current) return;
      const p = new SwfPlayer();
      await p.mount(host.current, clip, {transparent: true, mode: 'fixed', clock: 'manual', backgroundColor: 0x0b0f19});
      // 對位：把本體框的底邊對齊畫布底部中央，與正式戰鬥的 fit 邏輯同方向。
      const seqs = p.getSequences();
      const standby = clip.sequences.find((s) => s.name === 'standby')!;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const f of standby.frames) {
        const pos = f.mesh.positions;
        for (let i = 0; i < pos.length; i += 2) {
          minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
          minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]);
        }
      }
      const host_ = host.current!;
      const W = host_.clientWidth, H = host_.clientHeight;
      const scale = (H * 0.72) / (maxY - minY);
      p.setFixedTransform({x: W / 2 - ((minX + maxX) / 2) * scale, y: H * 0.92 + minY * scale}, {x: scale, y: -scale});
      p.playSequence('standby', {loop: true});
      p.advance(0.4);
      p.draw();
      player.current = p;
      (window as any).__pet = {
        sequences: seqs.map((s: any) => s.name + ':' + p.getSequenceFrameCount(s.name)),
        frameCount(name: string) { return p.getSequenceFrameCount(name); },
        seek(seq: string, frame: number) {
          const r = p.playSequence(seq, {loop: false});
          if (!r?.ok) return -1;
          // 從頭推進到目標影格：advance 是累加的，先歸零再走。
          p.seek(0);
          p.advance(frame / clip.frameRate + 1e-6);
          p.draw();
          return p.getFrameIndex();
        },
        info: {fps: clip.frameRate, atlas: [clip.atlasWidth, clip.atlasHeight], seqs: seqs.length},
      };
      host_.setAttribute('data-ready', 'true');
      setLog('就緒 ' + id + ' · ' + seqs.length + ' 段');
    })().catch((e) => setLog('失敗：' + (e as Error).message));
    return () => { alive = false; player.current?.destroy?.(); };
  }, []);

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div ref={host} id="stage" style={{position: 'absolute', inset: 0}} />
      <div data-status style={{position: 'absolute', left: 12, top: 12, color: '#7dd3fc', font: '14px monospace'}}>{log}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
