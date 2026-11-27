"""Cache official client references. No runtime network dependency or player-save writes."""
import concurrent.futures,json,pathlib,urllib.request,sys
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path(__file__).resolve().parent.parent
out=root/'docs/data/seerapi/2026-11-27-training'
out.mkdir(parents=True,exist_ok=True)
sources={
 'monsters':'https://raw.githubusercontent.com/SeerAPI/config-sources/main/unity/monsters.json',
 'mintmark':'https://raw.githubusercontent.com/SeerAPI/config-sources/main/unity/mintmark.json',
 'mintmarkTemp':'https://raw.githubusercontent.com/SeerAPI/config-sources/main/unity/mintmarkTemp.json',
 'new_monster_level':'https://raw.githubusercontent.com/SeerAPI/config-sources/main/html5/json/new_monster_level.json',
 'gems':'https://api.seerapi.com/v1/gem/?limit=100&expand=true',
}
def fetch(item):
 name,url=item
 cached=out/(name+'.json')
 if cached.exists():value=json.loads(cached.read_text(encoding='utf-8'))
 else:
  with urllib.request.urlopen(url,timeout=60) as r:value=json.loads(r.read().decode('utf-8'))
 if name=='gems':
  next_url=value.get('next')
  while next_url:
   with urllib.request.urlopen(next_url,timeout=60) as r:page=json.loads(r.read().decode('utf-8'))
   value['results'].extend(page['results']);next_url=page.get('next')
  value['next']=None
 (out/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8')
 return {'name':name,'url':url,'keys':list(value)[:8] if isinstance(value,dict) else len(value)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 rows=list(pool.map(fetch,sources.items()))
(out/'sources.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(rows,ensure_ascii=False))
