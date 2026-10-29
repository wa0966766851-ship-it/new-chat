// 公開驗收欄位，不把本機快取路徑打包到瀏覽器。
import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync(new URL('../docs/audits/pet-animation-inventory-20261025.json',import.meta.url),'utf8'));
const items=source.items.map(({owner,name,animation:a})=>({owner,name,nativeId:a.id,bytes:a.bytes,textures:(a.native?.textures||[]).map(t=>({width:t.width,height:t.height})),local:a.local}));
items.push({owner:'5036',name:'九青',nativeId:4543,bytes:2472749,textures:[{width:2048,height:2048}],local:true});
fs.writeFileSync(new URL('../tests/fixtures/native-animation/queue.json',import.meta.url),JSON.stringify({indexVersion:source.indexVersion,items},null,2)+'\n');
console.log('動畫驗收佇列：'+items.length+' 隻');

