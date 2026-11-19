import { createRoot } from 'react-dom/client';
import { ElfSpotlight } from './ElfSpotlight';
import { loadSeerIndex } from '../battle/seerAssets';
import type { SpotlightExportSnapshot } from '../utils/spotlightExport';

export async function showSpotlightExport(id: string) {
  const root = createRoot(document.getElementById('root')!);
  try {
    const response = await fetch(`/api/spotlight-export/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('無法讀取這份精靈介紹。');
    const snapshot: SpotlightExportSnapshot = await response.json();
    await loadSeerIndex().catch(() => undefined);
    root.render(
      <div className="spotlight-export" data-export-ready="true">
        <div className="spotlight-export-page">
          <ElfSpotlight elves={[]} selectedElf={snapshot.elf} embedded exportSettings={snapshot} onClose={() => {}} />
        </div>
      </div>,
    );
  } catch (error) {
    root.render(<p role="alert">{error instanceof Error ? error.message : '無法讀取這份精靈介紹。'}</p>);
  }
}
