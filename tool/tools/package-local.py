from pathlib import Path
import json,hashlib,zipfile,io
P=Path(__file__).resolve().parents[1]

def main():
 files={}
 for root,pattern in [('src','*.js'),('versions/certified','*.json')]:
  for f in sorted((P/root).glob(pattern)):files[f.relative_to(P).as_posix()]=f.read_bytes()
 names=['README.md','BJ-0.1.1-FIX.md','DEVELOPMENT.md','SUPPORT.md','PROGRESS.md','PERFORMANCE.md','BROWSER-MATRIX.md','RUNTIME-PROFILES.md','CHANGELOG.md','LICENSE.md','THIRD-PARTY.md','package.json','tools/build.py','tools/dolhtml.py','tools/package-local.py','tools/verify-source-package.py','tests/release-smoke.cjs','tests/rule-groups.cjs','tests/diagnostics.cjs','tests/profiles.cjs','tests/source-dependencies.cjs']
 for name in names:files[name]=(P/name).read_bytes()
 for v in ['0.5.8.9','0.5.10.12','0.5.11.9','0.5.12.13']:
  root=P/'versions'/v;profile=json.loads((root/'profile.json').read_text(encoding='utf8'));public={k:profile[k]for k in ['version','rendererProfileHash','rendererWhitelist']};files[f'versions/{v}/profile.json']=json.dumps(public,ensure_ascii=False,indent=2).encode()
  files[f'versions/{v}/anchors.json']=(root/'anchors.json').read_bytes()
  files[f'versions/{v}/runtime-profile.json']=(root/'runtime-profile.json').read_bytes()
 for name in ['runtime-anchors.json','baseline.json','state-catalog.json']:files['versions/0.5.12.13/'+name]=(P/'versions/0.5.12.13'/name).read_bytes()
 sources=json.loads((P/'vendor/SOURCES.json').read_text(encoding='utf8'))
 urls={'jszip':'https://github.com/Stuk/jszip/tree/v3.10.1','pngjs':'https://github.com/pngjs/pngjs/tree/v7.0.0'}
 for row in sources:
  if row['package'] in urls:row['source']=urls[row['package']]
  for item in row['files']:
   name='vendor/'+row['package']+'/'+item['path'];data=(P/name).read_bytes();assert hashlib.sha256(data).hexdigest()==item['sha256'],name;files[name]=data
 files['vendor/SOURCES.json']=json.dumps(sources,ensure_ascii=False,indent=2).encode()
 for name,data in files.items():
  assert not Path(name).is_absolute()and'..'not in Path(name).parts
  assert not any(part in {'fixtures-private','node_modules','reports','TASK.md'}for part in Path(name).parts)
  markers=[b'c:'+sep+b'users'+sep for sep in [bytes([92]),bytes([47]),bytes([92,92])]]
  assert not any(marker in data.lower()for marker in markers),name
  assert not data.startswith((b'\x89PNG',b'GIF8',b'PK\x03\x04')),name
 rows=[dict(path=name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest())for name,data in sorted(files.items())]
 manifest=dict(scope='local source review preview; no private game or beauty assets',files=rows,excluded=['fixtures-private','reports','node_modules','task logs','original game and beauty images'],licenseStatus='original source public license pending owner choice')
 files['SOURCE-MANIFEST.json']=json.dumps(manifest,ensure_ascii=False,indent=2).encode()
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED)as z:
  for name,data in sorted(files.items()):
   info=zipfile.ZipInfo(name,(2026,10,12,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
 dist=P/'dist';dist.mkdir(exist_ok=True);archive=dist/'DoLBeautyManager-local-source-preview.zip';archive.write_bytes(out.getvalue());(dist/'source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
 artifacts=['DoLBeautyManager-M0.mod.zip','DoLBeautyManager-Twee.mod.zip',archive.name]
 (dist/'CHECKSUMS.txt').write_text(''.join(hashlib.sha256((dist/name).read_bytes()).hexdigest()+'  '+name+'\n'for name in artifacts),encoding='ascii')
 print(json.dumps(dict(archive=archive.name,bytes=archive.stat().st_size,sourceFiles=len(rows),sha256=hashlib.sha256(archive.read_bytes()).hexdigest())))
if __name__=='__main__':main()
