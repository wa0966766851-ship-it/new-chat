/** 固定官方來源，以強連通群組及依賴拓樸分包，不改公開屬性名稱。
 * 預設只輸出相容原型。--vendor 才更新已驗收的隨專案模組。
 */
import { build } from 'esbuild';
import ts from 'typescript';
import { rollup } from 'rollup';
import { minify } from 'terser';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const source = resolve('node_modules/.cache/blockly-v13.2.1');
const root = resolve(source, 'packages/blockly');
const commit = '168fe103ac42294b845dcd88033e30698d0320b8';
if (execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim() !== commit) throw new Error('官方來源版本不符');
if (execFileSync('git',['status','--porcelain'],{cwd:source,encoding:'utf8'}).trim()) throw new Error('官方來源有未核對修改');
const facade = `export {inject,setLocale,defineBlocksWithJsonArray,Events,svgResize,Theme,Themes,Workspace,serialization} from '${resolve(root,'core/blockly.ts').replace(/\\/g,'/')}';`;
const measured = await build({stdin:{contents:facade,resolveDir:root,loader:'ts'},bundle:true,write:false,metafile:true,format:'esm',platform:'browser',target:'es2022'});
const inputs = measured.metafile!.inputs;
let sequence = 0;
const indices = new Map<string,number>(), low = new Map<string,number>(), active = new Set<string>(), stack:string[] = [], groups:string[][] = [];
function visit(id:string) {
  indices.set(id,sequence); low.set(id,sequence++); active.add(id); stack.push(id);
  for (const dep of inputs[id].imports) {
    if (!inputs[dep.path]) continue;
    if (!indices.has(dep.path)) { visit(dep.path); low.set(id,Math.min(low.get(id)!,low.get(dep.path)!)); }
    else if (active.has(dep.path)) low.set(id,Math.min(low.get(id)!,indices.get(dep.path)!));
  }
  if (indices.get(id) === low.get(id)) {
    const group:string[]=[]; let popped:string;
    do { popped=stack.pop()!;active.delete(popped);group.push(popped); } while(popped!==id);
    groups.push(group); // Tarjan 依賴群組先完成：跨包圖不會有反向循環。
  }
}
for(const id of Object.keys(inputs)) if(!indices.has(id)) visit(id);
const chunks=new Map<string,string>(); let bucket=0,size=0;
for(const group of groups) {
  const bytes=group.reduce((n,id)=>n+inputs[id].bytes,0);
  if (size && size+bytes>450000) {bucket++;size=0;}
  for(const id of group) if(id!=='<stdin>') chunks.set(resolve(id),`core-${String(bucket).padStart(2,'0')}`);
  size+=bytes;
}
let cycles=0;
// 原始碼含未標 import type 的歷史型別再匯出，必須由完整型別圖消去，
// 不能單檔 transpile 後讓 Rollup 以為介面也是執行期匯出。
const compiled=new Map<string,string>();
const program=ts.createProgram([...Object.keys(inputs).filter(id=>id.endsWith('.ts')).map(id=>resolve(id)),resolve(root,'core/any_aliases.ts')],{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,useDefineForClassFields:false,strict:true,skipLibCheck:true,types:[],noEmitOnError:false});
const diagnostics=ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error);
// 固定版本唯一已知型別問題：menuitem.getId() 的 DOM 屬性可能為 null。
// 保留上游行為，不改執行碼；任何其他編譯錯誤仍使生成失敗。
const known=(d:ts.Diagnostic)=>d.code===2322 && d.file?.fileName.replace(/\\/g,'/').endsWith('/core/menuitem.ts') && ts.flattenDiagnosticMessageText(d.messageText,' ').startsWith("Type 'string | null' is not assignable to type 'string'.");
const errors=diagnostics.filter(d=>!known(d));
if(errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
program.emit(undefined,(file,code,_,__,sources)=>{if(file.endsWith('.js') && sources?.[0])compiled.set(resolve(sources[0].fileName),code);});
const bundle=await rollup({input:'virtual:blockly-facade',onwarn(warning,warn){if(warning.code==='CIRCULAR_DEPENDENCY')cycles++;else warn(warning);},plugins:[{
  name:'fixed-blockly-ts',
  resolveId(id,importer) {
    if(id==='virtual:blockly-facade')return id;
    const candidate=id.startsWith('.') ? resolve(dirname(importer!),id) : id;
    if(candidate.endsWith('.js') && existsSync(candidate.slice(0,-3)+'.ts')) return candidate.slice(0,-3)+'.ts';
    if(existsSync(candidate))return candidate;
    return null;
  },
  load(id) {if(id==='virtual:blockly-facade')return facade; if(id.endsWith('.ts')) {const code=compiled.get(resolve(id));if(!code)throw new Error(`未編譯的來源 ${id}`);return code;}return null;},
  async renderChunk(code) {const result=await minify(code,{module:true,compress:{passes:2},mangle:true,format:{comments:'some'}});return {code:result.code!,map:null};},
  generateBundle(_,output) {
    // 生成後再檢查模組圖；原始碼內部循環只能留在同包，跨包不得形成循環。
    const visiting=new Set<string>(),finished=new Set<string>();
    function verify(file:string) {
      if(visiting.has(file))throw new Error(`產生跨模組循環 ${file}`);
      if(finished.has(file))return;
      visiting.add(file); const chunk=output[file];
      if(chunk?.type==='chunk')for(const dependency of chunk.imports)if(output[dependency])verify(dependency);
      visiting.delete(file);finished.add(file);
    }
    for(const file of Object.keys(output))verify(file);
    const files=Object.values(output).filter(item=>item.type==='chunk').map(item=>({file:item.fileName,bytes:Buffer.byteLength(item.code),sha256:createHash('sha256').update(item.code).digest('hex')}));
    if(files.some(file=>file.bytes>=500000))throw new Error('原型仍有超過 500 kB 的模組，不得套入');
    const report={version:'13.2.1',upstream:'https://github.com/RaspberryPiFoundation/blockly',commit,propertyMangling:false,upstreamTypeDiagnostics:diagnostics.map(d=>({code:d.code,file:'core/menuitem.ts',message:ts.flattenDiagnosticMessageText(d.messageText,' ')})),cycleGroups:groups.filter(g=>g.length>1).length,rollupCycles:cycles,files};
    this.emitFile({type:'asset',fileName:'build-info.json',source:JSON.stringify(report,null,2)});
    this.emitFile({type:'asset',fileName:'LICENSE.txt',source:readFileSync(resolve(source,'LICENSE'),'utf8')});
    console.log(JSON.stringify({...report,files:files.map(({file,bytes})=>({file,bytes}))},null,2));
  }
}]});
await bundle.write({dir:process.argv.includes('--vendor')?'src/vendor/blockly':'build/blockly-modular-prototype',format:'esm',entryFileNames:'index.js',chunkFileNames:'[name].js',onlyExplicitManualChunks:true,manualChunks:id=>chunks.get(id),banner:'/*! Blockly 13.2.1 — Copyright Google LLC; Apache-2.0. See LICENSE.txt and build-info.json. */'});
await bundle.close();
