#!/usr/bin/env node
/** 唯讀盤點：不下載整庫、不改綁定。--write 才寫報告。候選 ID 必須人工核對，不能從自製 ID 猜。 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const candidates=[
 ['5001','悲歌.索比拉特',343],['5002','帝皇之盾',3404],['5003','天蓬元帥八戒',1536],['5004','皮特薩拉羅',3098],['5005','布萊克',875],['300','譜尼',300],['5006','星光·魔焰猩猩',4649],['5007','混濁海妖.布林克克',359],['5008','鎮魂.巴弗洛',177],['5009','誑獅魔軀.魔獅迪露',187],['5000','聖靈譜尼',5000],['5010','星光·魯斯王',4648],['5011','星光·麗莎布布',4647],['5012','冰魄·柯爾德',3886],['5013','柯爾霍德',3432],['5014','聖光斯嘉麗',3456],['5015','混沌·布萊克',3539],['5016','變革·馬爾修斯',3393],['5018','蟲后·奧佩婭',3626],['5019','眾神之父·奧丁',2647],['5020','皮皮',10],['5021','治癒.龍魂再臨 次元龍',4586],['5024','湮滅之主・咤克斯',4762],['5025','恐懼的化身·咤克斯',15010],['5027','蓓麗安特',4643],['5028','怒濤·滄嵐',3740],['5029','異境神霆·雷伊',70],['5030','聖靈邁爾斯',1204],['5031','六界神王',3045],['5032','星核寰宇·艾斯菲亞',79],['5033','星軌重構·艾斯菲格',418],['5034','邪靈主宰·摩哥斯',3561],['5035','御天龍神·哈莫',3809],['7070','魔化.雷伊',70],['707070','墜霆.雷伊',70],['arena12','無為龍者',4661],['arena13','龍錄天鋒',4903],['arena14','無極聖武',4800],['arena15','命運龍輪 莫伊萊',4275],['wiki4937','星光·雷納多',4937],
];
const sourceRoot=process.env.SEER_PET_CACHE_ROOT||JSON.parse(fs.readFileSync('launcher/animation-source.local.json','utf8')).cacheRoot;
const indexUrl='https://pet-anim-viewer.seerapi.com/pet-anim-index.json';
const index=await(await fetch(indexUrl,{signal:AbortSignal.timeout(20000)})).json();
const inspect=e=>{const file=e&&path.join(sourceRoot,e.path.slice(0,2),e.path,'__data');if(!e)return null;const present=fs.existsSync(file);return {id:e.id,name:e.name,hash:e.path,bytes:e.fileSize,url:'https://newseer.61.com/Assets/StandaloneWindows64/PetAnimPackage/'+e.path,local:present&&fs.statSync(file).size===e.fileSize,localFile:file,sha256:present?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null};};
const items=candidates.map(([owner,name,id])=>({owner,name,animation:inspect(index.entries.find(e=>e.name===`ppets_${id}`)),small:inspect(index.entries.find(e=>e.name===`ppets_${id}_small`)),binding:id===70?'指定普通雷伊皮膚':id===15010?'已接入／留在原地物攻':'待逐一視覺校準，未自動啟用'}));
const unique=new Map(items.flatMap(i=>i.animation?[[i.animation.hash,i.animation]]:[]));
const report={checkedAt:new Date().toISOString(),indexUrl,indexVersion:index.version,sourceRoot,totalIndexBytes:[...new Map([...index.entries,...index.sharedBundles].map(e=>[e.path,e.fileSize])).values()].reduce((a,b)=>a+b,0),owners:items.length,uniqueAssets:unique.size,subsetBytes:[...unique.values()].reduce((a,b)=>a+b.bytes,0),items,customUnbound:['5017 人皇·帝辛','5022 無序.六刃','5023 無序·蝕言','5026 無序.墜星','5036 九青（4543為原版候選，未驗證當前自製外觀）','arena16 鎮世龍魂・龍之治癒']};
if(process.argv.includes('--write')){fs.mkdirSync('docs/audits',{recursive:true});fs.writeFileSync('docs/audits/pet-animation-inventory-20261025.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({owners:report.owners,uniqueAssets:report.uniqueAssets,subsetBytes:report.subsetBytes,totalIndexBytes:report.totalIndexBytes,missingLocal:items.filter(i=>!i.animation?.local).map(i=>i.name)},null,2));

