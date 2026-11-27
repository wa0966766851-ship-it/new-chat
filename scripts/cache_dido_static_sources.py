import pathlib,urllib.request,json,hashlib,concurrent.futures
root=pathlib.Path(__file__).resolve().parent.parent
def download(pair):
 kind,resource=pair
 url=f'https://raw.githubusercontent.com/SeerAPI/seer-unity-assets/main/newseer/assets/art/ui/assets/pet/{kind}/{resource}.png'
 target=root/f'.seer-cache/{kind}/{resource}.png';target.parent.mkdir(parents=True,exist_ok=True)
 data=urllib.request.urlopen(url,timeout=45).read()
 if not data.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('Not a PNG '+url)
 if not target.exists():target.write_bytes(data)
 return {'kind':kind,'resource':resource,'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(download,[(k,i) for i in [4377,1400473,1400467,1400748,1400887] for k in ['head','body']]))
(root/'docs/data/seerapi/2026-11-26-dido/static-sources.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf8')
print('Verified PNG sources:',len(rows))
# The gender endpoint embeds an unrelated list of thousands of pets. Keep only the requested value.
p=root/'docs/data/seerapi/2026-11-26-dido/gender.json'
d=json.loads(p.read_text(encoding='utf8'));d['data'].pop('pet',None);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
