from pathlib import Path
from html.parser import HTMLParser
import html,hashlib,json,re,struct,collections
P=Path(__file__).resolve().parents[1]
def sha(b):return hashlib.sha256(b).hexdigest()
def canon(v):return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
class Passages(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.current=None;self.passages={};self.parts=[]
 def handle_starttag(self,t,a):
  if t=='tw-passagedata':self.current=dict(a);self.parts=[]
 def handle_endtag(self,t):
  if t=='tw-passagedata' and self.current:
   self.passages[self.current['name']]=html.unescape(''.join(self.parts)).replace('\r\n','\n');self.current=None
 def handle_data(self,d):
  if self.current:self.parts.append(d)
 def handle_entityref(self,n):
  if self.current:self.parts.append('&'+n+';')
 def handle_charref(self,n):
  if self.current:self.parts.append('&#'+n+';')
def asset(p,root):
 b=p.read_bytes();o=dict(path='img/'+p.relative_to(root).as_posix(),bytes=len(b),sha256=sha(b))
 if b[:8]==b'\x89PNG\r\n\x1a\n' and len(b)>=24:o.update(width=struct.unpack('>I',b[16:20])[0],height=struct.unpack('>I',b[20:24])[0],format='png')
 else:o.update(format=p.suffix.lstrip('.'),dimensions='unparsed')
 return o
def profile(v,source):
 raw=source.read_bytes();s=raw.decode('utf-8-sig');p=Passages();p.feed(s)
 names=['StoryCaption','Widgets Clothing Caption','PassageFooter','overlayReplace']
 render_script=re.search(r'<script[^>]+id=["\']script-sugarcube[^>]*>(.*?)</script>',s,re.S)
 # Do not execute templates: preserve finite literal references and unresolved functions separately.
 plain=html.unescape(s)
 literals=sorted(set(re.findall(r'["\'](img/[^"\'\n<>`$]+\.(?:png|gif|webp|jpg))["\']',plain)))
 functions=[]
 for m in re.finditer(r'\b(masksrcfn|srcfn)\s*[:(]',plain):functions.append(dict(kind=m.group(1),offset=m.start(),snippet=plain[m.start():m.start()+500],status='unresolved-expression'))
 anchors={}
 for name in names:
  if name in p.passages:anchors[name]={'sha256':sha(p.passages[name].encode()),'characters':len(p.passages[name])}
 d=dict(schemaVersion=1,version=v,buildArtifactHash=sha(raw),normalization='HTMLParser raw entity accumulation; html.unescape once; LF',passageCount=len(p.passages),passages=anchors,literalRequests=literals,dynamicTemplates=functions,unresolvedCount=len(functions),rendererProfileHash=sha(canon(anchors)),coverage='literal extraction only; dynamic templates retained, not asserted unreachable')
 if v=='0.5.12.13':
  root=P/'fixtures-private/game-0.5.12.13/img';items=[asset(f,root)for f in sorted(root.rglob('*'))if f.is_file()];d['assetManifestHash']=sha(canon(items));d['assets']=items
  actual={x['path']for x in items};d['missingLiteralRequests']=sorted(set(literals)-actual);d['filesNotExplainedByLiteralRequests']=sorted(actual-set(literals))
 out=P/'versions'/v;out.mkdir(exist_ok=True);(out/'profile.json').write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf8',newline='')
 for name in names:
  if name in p.passages:(out/(name.replace(' ','_')+'.twee.txt')).write_text(p.passages[name],encoding='utf8',newline='')
 return {k:d[k]for k in ['version','buildArtifactHash','passageCount','unresolvedCount']}
def import_rules():
 root=P/'fixtures-private/legacy';all=[]
 for f in sorted((root/'规则文件').glob('*.txt')):
  ops=[];resources={}
  for n,line in enumerate(f.read_text(encoding='utf-8-sig').splitlines(),1):
   if not line.strip()or line.lstrip().startswith('#'):continue
   op,src,dst=(x.strip()for x in line.split('|'));item=dict(op=op,src=src,dst=dst,line=n)
   if op=='copy_from':
    r=root/src.replace('\\','/');assert r.resolve().is_relative_to(root.resolve());data=r.read_bytes();resources[src]=dict(path=src,sha256=sha(data),bytes=len(data))
   ops.append(item)
  target='0.5.11.9' if '5.11' in f.name else '0.5.10.12' if '5.10' in f.name else '0.5.9-unprovided'
  pack=dict(schemaVersion=1,rulePackId=f.stem,sourceHash=sha(f.read_bytes()),targetVersion=target,appliesWhen=dict(status='requires-validation',sourceSnapshotHash=None,targetProfileHash=None),operations=ops,resources=resources,coverage='Imported intent; not a certified cross-version rule pack')
  (P/'versions'/(f.stem+'.json')).write_text(json.dumps(pack,ensure_ascii=False,indent=2),encoding='utf8',newline='');all.append(dict(id=f.stem,count=len(ops),ops=dict(collections.Counter(x['op']for x in ops)),resources=len(resources)))
 return all
if __name__=='__main__':
 summary=[]
 for v in ['0.5.8.9','0.5.10.12','0.5.11.9','0.5.12.13']:
  f=P/'fixtures-private/game-0.5.12.13/Degrees of Lewdity.html' if v=='0.5.12.13' else P/f'fixtures-private/version-html/{v}.html';summary.append(profile(v,f))
 result=dict(profiles=summary,rules=import_rules());(P/'reports/version-extraction.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(result,ensure_ascii=True))
