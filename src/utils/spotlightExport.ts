import type { Elf } from '../types';

export type SpotlightExportFormat = 'png' | 'pdf';

export interface SpotlightExportSnapshot {
  elf: Elf;
  textSize: number;
  fieldSizes: Record<string, number>;
}

export async function downloadSpotlight(snapshot: SpotlightExportSnapshot, format: SpotlightExportFormat) {
  const response = await fetch('/api/spotlight-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...snapshot, format }),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new Error(details?.error || (response.status === 413 ? '這份精靈資料太大，無法匯出。' : '匯出失敗，請稍後再試。'));
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `${snapshot.elf.name}.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
