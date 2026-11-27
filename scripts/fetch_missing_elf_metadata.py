"""Fetch only missing physical metadata; keep explicit project overrides and provenance."""
import json, pathlib, urllib.request, concurrent.futures,time
root=pathlib.Path(__file__).resolve().parent.parent
report=json.loads((root/'docs/audits/2026-11-26-skin-animation-metadata.json').read_text(encoding='utf-8'))
measure_path=root/'src/data/elfPhysicalMeasurements.json'
existing=json.loads(measure_path.read_text(encoding='utf-8'))
rows={m['id']:m for m in existing}
def get(url):
 for attempt in range(3):
  try:
   with urllib.request.urlopen(url,timeout=35) as response:return json.load(response)
  except Exception:
   if attempt==2:raise
   time.sleep(1)
def fetch(elf):
 if not elf.get('sourceId') or '譜尼' in elf['name']:return None
 if elf.get('height') and elf.get('weight') and elf.get('gender'):return None
 source=int(elf['sourceId'])
 # A skin resource is not a pet ID. Resolve its explicit pet owner via the skin table.
 try:
  skin_url=None
  if source>=1400000:
   skin_url=f'https://api.seerapi.com/v1/pet_skin/{source-1400000}'
   source=get(skin_url)['pet']['id']
  pet_url=f'https://api.seerapi.com/v1/pet/{source}'
  pet=get(pet_url)
  entry_url=pet.get('encyclopedia_entry',{}).get('url')
  try:entry=get(entry_url) if entry_url else {}
  except Exception:entry={}
  gender_url=pet.get('gender',{}).get('url')
  gender=get(gender_url).get('description') if gender_url else None
  values={'id':elf['id'],'name':elf['name'],'seerId':source,'height':entry.get('height'),'weight':entry.get('weight'),'gender':gender,
   'sources':[pet_url,*([entry_url] if entry_url and entry else []),*([gender_url] if gender_url else []),*([skin_url] if skin_url else [])]}
  return values
 except Exception as error:return {'id':elf['id'],'error':str(error)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(fetch,report['rows']))
results=[r for r in results if r]
for item in results:
 if 'name' not in item:continue
 old=rows.get(item['id'],{'id':item['id'],'name':item['name'],'seerId':item['seerId']})
 for key in ['height','weight','gender']:
  if item.get(key) and not old.get(key):old[key]=item[key]
 rows[item['id']]=old
measure_path.write_text(json.dumps(list(rows.values()),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'docs/data/seerapi/2026-11-26-dido/missing-metadata.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
