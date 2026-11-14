import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DetailSheet } from '../../src/components/destiny/DestinyWheelB/DetailSheet';
import css from '../../src/components/destiny/DestinyWheelB/dwbCss';
import { DEFAULT_ELVES } from '../../src/data/defaultElvesLoaded';
function Preview() {
  const [open, setOpen] = useState(true);
  const elf = { ...DEFAULT_ELVES.find(e => String(e.id) === '5033')!, instanceId: 'preview-5033', destinyRank: 'B' } as any;
  return <div className="dwb"><style>{css}</style><button onClick={() => setOpen(true)}>開啟詳情</button>
    {open && <DetailSheet elf={elf} owner="p1" mode="PVE" blueprint={false} onClose={() => setOpen(false)} />}</div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
