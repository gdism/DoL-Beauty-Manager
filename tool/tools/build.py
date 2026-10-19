from pathlib import Path
import json,zipfile,io,base64,re,hashlib,sys,argparse
from dolhtml import Passages
parser=argparse.ArgumentParser();parser.add_argument("--fixture",action="store_true");parser.add_argument("--twee-entry",action="store_true");args=parser.parse_args()
P=Path(__file__).resolve().parents[1]
(P/'dist').mkdir(exist_ok=True)
def zipped(files):
 b=io.BytesIO()
 with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
  for name,data in files.items():
   info=zipfile.ZipInfo(name,(2026,10,12,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
 return b.getvalue()
def embed(data,name):
 src=(P/'fixtures-private/game-0.5.12.13/Degrees of Lewdity.html').read_text(encoding='utf8')
 m=re.search(r'window\.modDataValueZipList\s*=\s*(\[.*?\])\s*;',src,re.S)
 a=json.loads(m.group(1));a.extend(base64.b64encode(d).decode() for d in data)
 out=src[:m.start(1)]+json.dumps(a,separators=(',',':'))+src[m.end(1):]
 (P/'fixtures-private/game-0.5.12.13'/name).write_text(out,encoding='utf8',newline='')
boot=dict(name='DoLBeautyManager',version='0.1.1',styleFileList=[],scriptFileList_inject_early=['bootstrap.js'],scriptFileList=['vendor.js','config.js','engine.js','archive.js','sources.js','rules.js','diagnostics.js','baseline.js','profiles.js','host.js','ui.js','manager.js'],tweeFileList=[],imgFileList=[],addonPlugin=[],dependenceInfo=[dict(modName='ModLoader',version='>=2.100.0')])
vendor='(()=>{const module={exports:{}};const exports=module.exports;'+(P/'vendor/jszip/jszip.min.js').read_text(encoding='utf8')+';window.DBMZip=module.exports;})();'
files={'boot.json':json.dumps(boot,ensure_ascii=False,indent=2),'vendor.js':vendor,'manager.js':(P/'src/manager.js').read_bytes(),'host.js':(P/'src/host.js').read_bytes(),'bootstrap.js':(P/'src/bootstrap.js').read_bytes(),'LICENSE-JSZip.txt':(P/'vendor/jszip/LICENSE.markdown').read_bytes()}
for name in ['engine.js','archive.js','sources.js','rules.js','diagnostics.js','baseline.js','profiles.js','ui.js']:files[name]=(P/'src'/name).read_bytes()
profiles=[]
for v in ['0.5.8.9','0.5.10.12','0.5.11.9','0.5.12.13']:
 d=json.loads((P/'versions'/v/'profile.json').read_text(encoding='utf8'));profiles.append({k:d[k]for k in ['version','rendererProfileHash','rendererWhitelist']})
for v in ['0.5.8.9','0.5.10.12','0.5.11.9','0.5.12.13']:
 profiles.append(json.loads((P/'versions'/v/'runtime-profile.json').read_text(encoding='utf8')))
certified=P/'versions/certified';packs=[json.loads(f.read_text(encoding='utf8'))for f in sorted(certified.glob('*.json'))]if certified.exists()else []
worker_source='self.window=self;(()=>{const module={exports:{}};const exports=module.exports;'+(P/'vendor/jszip/jszip.min.js').read_text(encoding='utf8')+';self.DBMWorkerZip=module.exports;})();\n'+(P/'src/zip-worker.js').read_text(encoding='utf-8-sig')
config=dict(zipWorkerSource=worker_source,stateCatalogs=[json.loads((P/'versions/0.5.12.13/state-catalog.json').read_text(encoding='utf8'))],profiles=profiles,rulePacks=packs,baselines=[json.loads((P/'versions/0.5.12.13/baseline.json').read_text(encoding='utf8'))]if(P/'versions/0.5.12.13/baseline.json').exists()else [],ruleCatalogHash=hashlib.sha256(json.dumps(packs,sort_keys=True,separators=(',',':')).encode()).hexdigest())
if args.twee_entry:
 placeholder='<button type="button" data-dol-beauty-owner="DoLBeautyManager" data-dbm-origin="twee" style="display:block;width:100%;box-sizing:border-box">美化管理</button>'
 replacements=[];anchors={}
 catalogs=[P/'versions'/v/'anchors.json' for v in ['0.5.8.9','0.5.10.12','0.5.11.9','0.5.12.13']]+[P/'versions/0.5.12.13/runtime-anchors.json']
 for catalog in catalogs:
  d=json.loads(catalog.read_text(encoding='utf8'))
  for kind,passage in [('home','Widgets Clothing Caption'),('ingame','StoryCaption')]:
   a=d[kind]
   if a['matchCount']!=1 or not a['inMemoryStructureValidated']:raise ValueError('unverified-entry-anchor')
   anchors.setdefault(passage,set()).add(a['anchor'])
 for passage,items in anchors.items():
  escaped=[''.join('\\'+c if c in '\\^$.*+?()[]{}|' else c for c in text) for text in sorted(items)]
  replacements.append(dict(passage=passage,findRegex='(?:'+'|'.join(escaped)+')',replace='$&'+placeholder,all=False))
 boot['addonPlugin'].append(dict(modName='TweeReplacer',addonName='TweeReplacerAddon',modVersion='^1.7.0',params=replacements))
 files['boot.json']=json.dumps(boot,ensure_ascii=False,indent=2)
files['config.js']='window.DBMConfig='+json.dumps(config,ensure_ascii=False,separators=(',',':'))+';'
files['vendor.js']+='\n(()=>{const module={exports:{}};const exports=module.exports;'+(P/'vendor/pngjs/browser.js').read_text(encoding='utf8')+';window.DBMPNG=module.exports;})();'
files['LICENSE-pngjs.txt']=(P/'vendor/pngjs/LICENSE').read_bytes()
files['vendor.js']+='\n(()=>{const module={exports:{}};const exports=module.exports;'+(P/'vendor/json5/index.min.js').read_text(encoding='utf8')+';window.DBMJSON5=module.exports;})();'
files['LICENSE-JSON5.txt']=(P/'vendor/json5/LICENSE.md').read_bytes()
name='DoLBeautyManager-Twee.mod.zip' if args.twee_entry else 'DoLBeautyManager-M0.mod.zip'
b=zipped(files);(P/'dist'/name).write_bytes(b)
if args.fixture:
 source=(P/'fixtures-private/m0-source.mod.zip').read_bytes();embed([source,b],'m0-manager-twee.html' if args.twee_entry else 'm0-manager.html')
print(json.dumps(dict(file='dist/'+name,bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))
