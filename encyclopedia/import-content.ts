import fs from 'node:fs';
import {parseAtlasContent} from './content';
const [input,flag,output]=process.argv.slice(2);if(!input)throw Error('用法：node --import tsx encyclopedia/import-content.ts 輸入.json [--out 已驗證.json]');
const value=parseAtlasContent(JSON.parse(fs.readFileSync(input,'utf8')));
if(flag==='--out'&&output)fs.writeFileSync(output,JSON.stringify(value,null,2));
console.log(JSON.stringify({valid:true,books:value.books.map(b=>({name:b.name,elves:b.custom.map(e=>e.name)}))},null,2));
