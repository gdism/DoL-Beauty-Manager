from pathlib import Path
import zipfile,json,hashlib,subprocess,sys,datetime,shutil
P=Path(__file__).resolve().parents[1]

def main():
 target=P/'reports'/('source-verify-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S-%f'));target.mkdir(parents=True,exist_ok=False)
 with zipfile.ZipFile(P/'dist/DoLBeautyManager-local-source-preview.zip')as z:
  manifest=json.loads(z.read('SOURCE-MANIFEST.json'));expected={r['path']:r for r in manifest['files']};assert set(z.namelist())==set(expected)|{'SOURCE-MANIFEST.json'}
  for name in z.namelist():
   f=target/name;assert f.resolve().is_relative_to(target.resolve());data=z.read(name)
   if name in expected:assert hashlib.sha256(data).hexdigest()==expected[name]['sha256']
   f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(data)
 for args in [[sys.executable,'-B','tools/build.py'],[sys.executable,'-B','tools/build.py','--twee-entry'],[shutil.which('node'),'tests/release-smoke.cjs'],[shutil.which('node'),'tests/rule-groups.cjs'],[shutil.which('node'),'tests/diagnostics.cjs'],[shutil.which('node'),'tests/profiles.cjs'],[shutil.which('node'),'tests/source-dependencies.cjs']]:subprocess.run(args,cwd=target,check=True)
 rows=[]
 for name in ['DoLBeautyManager-M0.mod.zip','DoLBeautyManager-Twee.mod.zip']:
  original=hashlib.sha256((P/'dist'/name).read_bytes()).hexdigest();rebuilt=hashlib.sha256((target/'dist'/name).read_bytes()).hexdigest();assert original==rebuilt,name;rows.append(dict(file=name,sha256=original,reproduced=True))
 report=dict(status='passed-isolated-source-rebuild',directory=str(target),sourceFiles=len(expected),artifacts=rows)
 (P/'reports/source-rebuild.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(report,ensure_ascii=True))
if __name__=='__main__':main()
