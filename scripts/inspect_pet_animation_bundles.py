"""選定候選包的唯讀 metadata 檢查。先執行 pet_animation_inventory.mjs --write。
需 UnityPy；SEER_UNITYPY_PATH 可指向獨立安裝位置。絕不修改／複製 U 端來源。
"""
import os,sys,json,pathlib
if os.environ.get('SEER_UNITYPY_PATH'):sys.path.insert(0,os.environ['SEER_UNITYPY_PATH'])
import UnityPy
source=pathlib.Path('docs/audits/pet-animation-inventory-20261025.json')
report=json.loads(source.read_text(encoding='utf-8'))
seen={}
for item in report['items']:
 for kind in ['animation','small']:
  a=item[kind]
  if not a or not a['local']:continue
  h=a['hash']
  if h not in seen:
   textures=[];clips=[]
   for o in UnityPy.load(a['localFile']).objects:
    if o.type.name=='Texture2D':
     d=o.read();textures.append({'name':d.m_Name,'width':d.m_Width,'height':d.m_Height,'rgbaBytes':d.m_Width*d.m_Height*4})
    elif o.type.name=='MonoBehaviour':
     d=o.read_typetree()
     if 'Sequences' in d:clips.append({'name':d['m_Name'],'fps':d['FrameRate'],'sequences':[{'name':s['Name'],'frames':len(s['Frames']),'hits':[i for i,f in enumerate(s['Frames']) if 'action_hit' in f['Labels']]} for s in d['Sequences']]})
   seen[h]={'textures':textures,'clips':clips,'usable':bool(textures and clips)}
  a['native']=seen[h]
  if not seen[h]['usable']:item['binding']='拒絕啟用：空包或缺少動畫／圖集'
if '--write' in sys.argv:source.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'bundlesInspected':len(seen),'emptyBundles':[h for h,v in seen.items() if not v['usable']],'largestAtlasMiB':max(t['rgbaBytes']/1048576 for v in seen.values() for t in v['textures'])},ensure_ascii=False))
