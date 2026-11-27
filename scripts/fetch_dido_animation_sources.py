"""Cache verified source-index candidates, never replace the installed game's files."""
import pathlib,json,urllib.request,hashlib,concurrent.futures
root=pathlib.Path(__file__).resolve().parent.parent
source=json.loads((root/'docs/data/seerapi/2026-11-26-dido/animation-index.json').read_text(encoding='utf8'))
cache=json.loads((root/'launcher/animation-source.local.json').read_text(encoding='utf8'))['cacheRoot']
out=root/'.seer-cache/pet-anim';out.mkdir(parents=True,exist_ok=True)
def fetch(entry):
 if entry.get('variant')=='small':return None
 h=entry['path'];target=out/(h+'.bundle');local=pathlib.Path(cache)/h[:2]/h/'__data'
 url='https://newseer.61.com/Assets/StandaloneWindows64/PetAnimPackage/'+h
 data=local.read_bytes() if local.exists() else target.read_bytes() if target.exists() else urllib.request.urlopen(url,timeout=90).read()
 if len(data)!=entry['fileSize']:raise ValueError('Source size mismatch '+h)
 if not target.exists():target.write_bytes(data)
 return {**entry,'localFile':str(target),'sha256':hashlib.sha256(data).hexdigest(),'source':{'indexUrl':'https://pet-anim-viewer.seerapi.com/pet-anim-index.json','indexVersion':source['version'],'entry':entry['name'],'url':url}}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:rows=[r for r in pool.map(fetch,source['entries']) if r]
(root/'docs/audits/2026-11-26-animation-candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps([{'id':r['id'],'size':r['fileSize']} for r in rows]))
