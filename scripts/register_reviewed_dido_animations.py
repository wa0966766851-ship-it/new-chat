"""Register only the five source bundles visually reviewed with the native SwfPlayer."""
import pathlib,json
root=pathlib.Path(__file__).resolve().parent.parent
rows=json.loads((root/'docs/audits/2026-11-26-animation-candidates.json').read_text(encoding='utf8'))
review={4377:('didoOriginal','蒂朵','right'),1400467:('didoSummer','汐風微涼·蒂朵','right'),1400473:('didoDetective','剖玄析微·蒂小朵','right'),1400748:('zhaoyunCanglang','滄浪龍吟','right'),1400887:('zhaoyunShengguan','聖貫宙合','left')}
lines=[]
for row in rows:
 key,name,facing=review[row['id']]
 value={'name':name,'body':f"/seer/body/{row['id']}.png",**row['parsed'],'physicalMotion':'approach','stablePhysicalImpact':True,'facing':facing,'facingVerified':True,'hash':row['path'],'size':row['fileSize'],'sha256':row['sha256'],'source':row['source']}
 lines.append(' '+key+': '+json.dumps(value,ensure_ascii=False,separators=(',',':'))+',')
p=root/'src/battle/petAnimationAssets.ts';text=p.read_text(encoding='utf8');anchor='} as const satisfies Record<string, PetAnimationAsset>;'
if ' didoDetective:' in text:raise ValueError('Already registered; inspect before modifying')
p.write_text(text.replace(anchor,'\n // Native source facing reviewed on 2026-11-26; evidence: .seer-cache/dido-review/.\n'+'\n'.join(lines)+'\n'+anchor),encoding='utf8')
p=root/'src/data/elfSkins.ts';text=p.read_text(encoding='utf8')
text=text.replace("{id:'dido-detective',name:'剖玄析微·蒂小朵',resource:1400473}","{id:'dido-detective',name:'剖玄析微·蒂小朵',resource:1400473,animationAssetId:'didoDetective' as const}")
text=text.replace("{id:'dido-original',name:'蒂朵',resource:4377}","{id:'dido-original',name:'蒂朵',resource:4377,animationAssetId:'didoOriginal' as const}")
text=text.replace("{id:'dido-summer',name:'汐風微涼·蒂朵',resource:1400467}","{id:'dido-summer',name:'汐風微涼·蒂朵',resource:1400467,animationAssetId:'didoSummer' as const}")
text=text.replace("head:`/seer/head/${s.resource}.png`}","head:`/seer/head/${s.resource}.png`,animationAssetId:s.animationAssetId}")
text=text.replace("body:'/seer/body/1400748.png',head:'/seer/head/1400748.png'","body:'/seer/body/1400748.png',head:'/seer/head/1400748.png',animationAssetId:'zhaoyunCanglang'")
text=text.replace("body:'/seer/body/1400887.png',head:'/seer/head/1400887.png'","body:'/seer/body/1400887.png',head:'/seer/head/1400887.png',animationAssetId:'zhaoyunShengguan'")
text=text.replace('滄浪龍吟、聖貫宙合為官方皮膚靜態圖（無原生動作）','滄浪龍吟、聖貫宙合已核對官方原生動畫；各自登記來源與原始朝向')
p.write_text(text,encoding='utf8')
