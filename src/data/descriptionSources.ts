import compressed from './descriptions.compressed.json';
import { gunzipSync, strFromU8 } from 'fflate';

// 僅還原建置時產生的可信資料一次。原始 JSON/TXT 照常編輯並保留；不是加密。
if (compressed.schemaVersion !== 1) throw new Error('描述資料版本不相容');
const bytes = Uint8Array.from(atob(compressed.gzip), char => char.charCodeAt(0));
const sources: Record<string, any> = JSON.parse(strFromU8(gunzipSync(bytes)));
export const SOURCE_TEXT = sources.elfSourceText;
export const SKILL_REFERENCES = sources['skillReferences.generated'];
export const NEW_ELF_SOURCES = sources.newElfSources;
