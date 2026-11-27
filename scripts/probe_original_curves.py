import concurrent.futures,json,pathlib,urllib.request
out=pathlib.Path('.seer-cache/training-reference');out.mkdir(parents=True,exist_ok=True)
paths=['manifest.json','version.json','main.min.js','js/main.min.js','libs/modules/core/core.min.js','resource/config/exp.json','resource/config/exp.xml']
def get(p):
 try:
  with urllib.request.urlopen('https://seerh5.61.com/'+p,timeout=10) as r:b=r.read()
  (out/p.replace('/','_')).write_bytes(b)
  return [p,len(b),b[:80].decode('utf-8',errors='replace')]
 except Exception as e:return[p,str(e)]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:print(json.dumps(list(pool.map(get,paths)),ensure_ascii=True))
