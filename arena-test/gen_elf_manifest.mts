import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
const server = await createServer({ optimizeDeps:{noDiscovery:true,include:[]}, server:{middlewareMode:true,hmr:false,watch:null}, appType:'custom', logLevel:'silent' });
const runner:any = (server as any).environments?.ssr?.runner;
if(runner?.transport) runner.transport.timeout = 300000;
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
const quiet=console.error; console.error=(...a:any[])=>{const s=String(a[0]);if(s.includes('[onNode]')||s.includes('[blocks]'))return;quiet(...a);};
const all = DEFAULT_ELVES as any[];
const now = new Date().toISOString().slice(0,19).replace('T',' ');

const rows = all.map((e:any,i:number)=>{
  const soulKit = (e.soulMark?.kit?.length||0);
  const skillKit = (e.skills||[]).reduce((n:number,s:any)=>n+(s.kit?.length||0),0);
  return { i:i+1, id:String(e.id), name:e.name, soul:e.soulMark?.name||'', soulKit, skillKit,
    hp:e.calculatedStats?.hp||0, speed:e.calculatedStats?.speed||0,
    skills:(e.skills||[]).length };
});

const md:string[] = [];
md.push('# 精靈清單（權威事實源）');
md.push('');
md.push('> 自動產生：'+now);
md.push('> 資料來源：`src/data/defaultElves.ts` → `DEFAULT_ELVES`（執行期實際載入）');
md.push('> 交叉驗證：`docs/audits/block-migration.json` 的 `summary.elves`');
md.push('');
md.push('## 總數');
md.push('');
md.push('| 項目 | 數量 |');
md.push('|---|---:|');
md.push('| **精靈總數** | **'+all.length+'** |');
md.push('| 有魂印 kit | '+rows.filter(r=>r.soulKit>0).length+' |');
md.push('| 有技能 kit | '+rows.filter(r=>r.skillKit>0).length+' |');
md.push('');
md.push('> ⚠️ 若其他文件寫的數字不是 '+all.length+'，以本文件為準。');
md.push('> 歷史文件（如 `31隻總體檢.md`）反映當時的資料集，不代表現在。');
md.push('');
md.push('## 完整清單');
md.push('');
md.push('| # | ID | 名稱 | 魂印 | 魂印kit | 技能kit | HP | 速度 | 技能數 |');
md.push('|---:|---|---|---|---:|---:|---:|---:|---:|');
for(const r of rows){
  md.push(`| ${r.i} | ${r.id} | ${r.name} | ${r.soul} | ${r.soulKit} | ${r.skillKit} | ${r.hp} | ${r.speed} | ${r.skills} |`);
}
md.push('');
md.push('## 維護方式');
md.push('');
md.push('新增或刪除精靈後，執行：');
md.push('');
md.push('```powershell');
md.push('npx tsx arena-test/gen_elf_manifest.mts');
md.push('```');
md.push('');
md.push('本文件會自動重建。不要手動編輯。');

fs.writeFileSync('./docs/精靈清單_權威事實源.md', md.join('\n'), 'utf8');
fs.writeFileSync('./arena-test/out/elf-manifest.json', JSON.stringify({ generatedAt:now, total:all.length, elves:rows }, null, 1), 'utf8');
console.log('✅ 已產生 docs/精靈清單_權威事實源.md');
console.log('   精靈總數: '+all.length);
await server.close();
