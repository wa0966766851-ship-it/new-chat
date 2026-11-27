import json,pathlib,sys
root=pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'.seer-cache/python-tools'))
try:
 from opencc import OpenCC
except ImportError:
 raise SystemExit('請先安裝開發用轉換工具：python -m pip --isolated install --no-user --target .seer-cache/python-tools opencc-python-reimplemented==0.1.7')
converter=OpenCC('s2twp')
traditional=lambda text:converter.convert(text).replace('概率','機率').replace('幾率','機率')
sys.stdout.reconfigure(encoding='utf-8')
data=json.loads((root/'docs/data/seerapi/2026-11-27-training/gems.json').read_text(encoding='utf-8'))
rows=[x for x in data['results'] if x['level']==(10 if x['generation_id']==1 else 5)]
out=[dict(id=str(x['id']),name=traditional(x['name']),level=x['level'],generation=x['generation_id'],source=f"https://api.seerapi.com/v1/gem/{x['id']}",effects=[dict(id=e['effect']['id'],args=e['args'],description=traditional(e['info'])) for e in x['effect']],triggerChance=100,inlayChance=100) for x in rows]
target=root/'src/training/gems.json';target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print(f'{len(out)}種寶石，保留原始效果參數；概率與嵌入率均100%')
marks=json.loads((root/'docs/data/seerapi/2026-11-27-training/mintmark.json').read_text(encoding='utf-8'))['mint_marks']['mint_mark']
skins=[{'id':str(m['id']),'name':traditional(m['des'])} for m in marks if m['id']>=40000 and not m.get('hide')]
(root/'src/training/inscriptionSkins.json').write_text(json.dumps(skins,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
