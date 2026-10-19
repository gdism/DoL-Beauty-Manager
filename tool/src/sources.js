/* Source inventory preserves declarations, runtime registration and observed resolution separately. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DBMSources=api;})(globalThis,()=>{
'use strict';
const parseJSON=typeof module==='object'&&module.exports?require('../vendor/json5/index.min.js').parse:globalThis.DBMJSON5.parse;
const imagePath=p=>/\.(png|gif|jpe?g|webp)$/i.test(p);
const safe=p=>{if(typeof p!=='string'||!p||p.includes('\\')||p.startsWith('/')||p.includes(':')||p.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('unsafe-path:'+p);return p;};
const owner=t=>t.modRef?.mod?.name||t.modRef?.name;
const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b instanceof Uint8Array?b:new TextEncoder().encode(b)))].map(x=>x.toString(16).padStart(2,'0')).join('');
function fromURL(u){if(typeof u!=='string'||!/^data:image\/[a-z0-9.+-]+;base64,/i.test(u))throw Error('image-getter-not-base64');const s=atob(u.slice(u.indexOf(',')+1));return Uint8Array.from(s,c=>c.charCodeAt(0));}
const id=(...parts)=>JSON.stringify(parts);
const cancelled=signal=>{if(signal?.aborted)throw new DOMException('取消','AbortError');};
function source(sourceId,name,kind,extra={}){return {sourceId,name,kind,assets:new Map(),issues:[],...extra};}
function add(s,path,archivePath,read,extra={}){safe(path);if(archivePath)safe(archivePath);const old=s.assets.get(path);if(old){Object.assign(old,extra);if(read)old.read=read;if(archivePath)old.archivePath=archivePath;return old;}const a={sourceId:s.sourceId,logicalPath:path,archivePath:archivePath||null,declared:false,registered:false,enabled:false,readState:'unread',...extra,read};s.assets.set(path,a);return a;}
function nonImage(boot={}){return ['scriptFileList','scriptFileList_preload','scriptFileList_earlyload','scriptFileList_inject_early','styleFileList','tweeFileList','replacePatchList'].flatMap(k=>(boot[k]||[]).map(p=>({field:k,path:p})));}
async function host({modUtils,bsa,hook,backendState,managedOwner='DoLBeautyManager'}={}){
 const sources=[],types=bsa?.getTypeOrder?.()||backendState?.getTypeOrder?.()||[],used=bsa?.typeOrderUsed||backendState?.typeOrderUsed||[];
 for(const name of modUtils.getModListNameNoAlias()){
  if(name===managedOwner)continue;const mod=modUtils.getMod(name),boot=mod?.bootJson||{};let zip,zipError,from;
  try{zip=modUtils.getModZip(name)?.zip;}catch(e){zipError=String(e);}
  try{from=modUtils.getModAndFromInfo?.(name)?.from;}catch{}
  const base=source(id('mod',name),name,'sideload',{modName:name,version:mod?.version||boot.version,from:String(from??'unavailable'),nonImageDependencies:nonImage(boot)});sources.push(base);
  if(zipError)base.issues.push({code:'archive-unavailable',reason:zipError});
  const reader=real=>async()=>{const f=zip?.file(real);if(!f)throw Error('archive-entry-missing:'+real);return f.async('uint8array');};
  for(const p of boot.imgFileList||[])try{add(base,p,p,reader(p),{declared:true,evidence:'boot.imgFileList'});}catch(e){base.issues.push({code:'unsafe-declaration',path:p,reason:String(e)});}
  const variants=[];
  for(const ad of boot.addonPlugin||[])if(ad.modName==='BeautySelectorAddon'&&ad.addonName==='BeautySelectorAddon'){
   const cfg=ad.params;let configs;
   const strings=a=>Array.isArray(a)&&a.every(p=>typeof p==='string');
   if(cfg&&(cfg.type==null||typeof cfg.type==='string')&&cfg.imgFileList==null&&cfg.types==null)configs=[{type:cfg.type||'converted-'+name,mode:'0'}];
   else if(cfg&&typeof cfg.type==='string'&&strings(cfg.imgFileList)&&cfg.types==null)configs=[cfg];
   else if(cfg&&cfg.type==null&&cfg.imgFileList==null&&Array.isArray(cfg.types)&&cfg.types.every(c=>c&&typeof c.type==='string'&&((typeof c.imgFileListFile==='string'&&c.imgDir==null)||(typeof c.imgDir==='string'&&c.imgFileListFile==null))))configs=cfg.types;
   else{base.issues.push({code:'declaration-unresolved',reason:'invalid-BSA-config'});continue;}
   for(const c of configs){
    const s=source(id('bsa',name,c.type),name+' / '+c.type,'bsa',{modName:name,type:c.type,nonImageDependencies:nonImage(boot)});sources.push(s);variants.push(s);
    let mappings=[];
    try{
     if(c.imgFileList)mappings=c.imgFileList.map(p=>[p,p]);
     else if(c.imgFileListFile){safe(c.imgFileListFile);const text=await zip?.file(c.imgFileListFile)?.async('string');if(!text)throw Error('list-unavailable');const list=parseJSON(text);if(!Array.isArray(list)||list.some(p=>typeof p!=='string'))throw Error('invalid-image-list');const dir=c.imgFileListFile.includes('/')?c.imgFileListFile.slice(0,c.imgFileListFile.lastIndexOf('/')+1):'';mappings=list.map(p=>[p,dir+p]);}
     else if(c.imgDir){const dir=safe(c.imgDir.replace(/\/$/,''))+'/';zip?.forEach((p,f)=>{if(!f.dir&&p.startsWith(dir)&&imagePath(p))mappings.push([p.slice(dir.length),p]);});}
     else mappings=(boot.imgFileList||[]).map(p=>[p,p]);
     for(const[p,real]of mappings){add(s,p,real,reader(real),{declared:true,evidence:'BSA-config'});if(real===p)base.assets.delete(p);}
    }catch(e){s.issues.push({code:'declaration-unresolved',reason:String(e)});}
   }
  }
  for(const t of types.filter(t=>owner(t)===name)){
   let s=variants.find(s=>s.type===t.type);if(!s){s=source(id('registered',name,t.type),name+' / '+t.type,'runtime',{modName:name,type:t.type,nonImageDependencies:nonImage(boot)});sources.push(s);}
   for(const[p,img]of t.imgListRef)try{const existing=s.assets.get(p);const a=add(s,p,existing?.archivePath,null,{registered:true,enabled:used.includes(t),runtimeOrder:used.indexOf(t),evidence:(existing?.evidence||'')+'; runtime-type'});a.runtimeRead=async()=>fromURL(await img.getter.getBase64Image());if(!zip?.file(a.archivePath||p)){a.archiveState=zip?'missing':'unavailable';a.read=a.runtimeRead;}else a.archiveState='present';}catch(e){s.issues.push({code:'runtime-path-rejected',path:p,reason:String(e)});}
  }
  for(const[p,providers]of hook?.imgLookupTable||[])for(let i=0;i<providers.length;i++){const pr=providers[i];if(pr.modName!==name)continue;let a=base.assets.get(p);if(!a)a=add(base,p,p,reader(p));Object.assign(a,{registered:true,enabled:true,directOrder:i,evidence:(a.evidence||'')+'; Hook-provider'});a.runtimeRead=async()=>fromURL(await pr.imgData.getter.getBase64Image());if(!zip?.file(p))a.read=a.runtimeRead;}
  if(zip)zip.forEach((p,f)=>{if(f.dir||!imagePath(p))return;const mapped=sources.some(s=>s.modName===name&&[...s.assets.values()].some(a=>a.archivePath===p));if(!mapped)try{add(base,p,p,reader(p),{evidence:'archive-only'});}catch(e){base.issues.push({code:'archive-path-rejected',path:p,reason:String(e)});}});
 }
 return sources.filter(s=>s.assets.size||s.issues.length);
}
function validateZip(input,maxBytes){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);let e=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===b.length){e=i;break;}
 if(e<0)throw Error('zip-directory-missing');if(v.getUint16(e+4,true)||v.getUint16(e+6,true))throw Error('multipart-zip-unsupported');
 const count=v.getUint16(e+10,true);let pos=v.getUint32(e+16,true),total=0;const seen=new Set();if(count===65535||pos===4294967295)throw Error('zip64-unsupported');
 for(let i=0;i<count;i++){if(pos+46>b.length||v.getUint32(pos,true)!==0x02014b50)throw Error('invalid-zip-directory');const flags=v.getUint16(pos+8,true),size=v.getUint32(pos+24,true),n=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true);if(flags&1)throw Error('encrypted-zip-unsupported');
 const name=new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(pos+46,pos+46+n));safe(name.replace(/\/$/,''));if(seen.has(name))throw Error('duplicate-zip-path:'+name);seen.add(name);total+=size;if(size>32*1024*1024||total>maxBytes)throw Error('zip-expansion-limit');pos+=46+n+extra+comment;
 }if(pos!==v.getUint32(e+16,true)+v.getUint32(e+12,true))throw Error('zip-directory-size-mismatch');return seen;
}
async function importZip(bytes,{Zip,name='导入 ZIP',rootPrefix='',maxBytes=256*1024*1024}={}){
 if(bytes.byteLength>maxBytes)throw Error('zip-size-limit');validateZip(bytes,maxBytes);const zip=await Zip.loadAsync(bytes);const bootFile=zip.file('boot.json');let boot=null;if(bootFile)boot=parseJSON(await bootFile.async('string'));
 // Use the same declaration mapper as live mods, but do not pretend imported sources are registered.
 if(boot){const n=boot.name||name;const all=await host({modUtils:{getModListNameNoAlias:()=>[n],getMod:()=>({bootJson:boot}),getModZip:()=>({zip})}});for(const s of all){s.sourceId=id('import',await hash(bytes),s.sourceId);s.kind='import-zip';s.name=name+' / '+s.name;for(const a of s.assets.values())a.sourceId=s.sourceId;}return all;}
 const s=source(id('zip',await hash(bytes)),name,'import-zip');const files=[];zip.forEach((p,f)=>{if(!f.dir)files.push([p,f]);});if(rootPrefix)safe(rootPrefix.replace(/\/$/,''));const prefix=rootPrefix?rootPrefix.replace(/\/$/,'')+'/':'';
 for(const[p,f]of files){safe(f.unsafeOriginalName||p);if(prefix&&!p.startsWith(prefix))continue;let logical=p.slice(prefix.length);if(!imagePath(logical))continue;if(!logical.startsWith('img/'))throw Error('请选择包含img目录的ZIP，或明确指定根目录');if(!imagePath(logical))continue;if(s.assets.has(logical))throw Error('duplicate-path:'+logical);add(s,logical,p,()=>f.async('uint8array'),{declared:true,evidence:'user-import'});}
 return [s];
}
async function importDirectory(files,{name='导入 img 目录'}={}){
 const s=source(id('directory',name,Date.now()),name,'import-directory');for(const f of files){const p=safe(f.webkitRelativePath||f.path||f.name);const parts=p.split('/');const index=parts.indexOf('img');if(index<0)throw Error('请选择名为img的目录或包含img的目录');const logical=parts.slice(index).join('/');if(!imagePath(logical))continue;if(s.assets.has(logical))throw Error('duplicate-path:'+logical);add(s,logical,p,async()=>new Uint8Array(await f.arrayBuffer()),{declared:true,evidence:'user-import'});}return [s];
}
async function decodeImage(bytes){
 let data='';for(let i=0;i<bytes.length;i+=32768)data+=String.fromCharCode(...bytes.subarray(i,i+32768));const mime=bytes[0]===71?'image/gif':bytes[0]===255?'image/jpeg':bytes[0]===82?'image/webp':'image/png';
 return new Promise((res,rej)=>{const img=new Image();img.onload=()=>res({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>rej(Error('image-decode-failed'));img.src='data:'+mime+';base64,'+btoa(data);});
}
async function scan(sources,{decode=decodeImage,signal,onProgress=()=>{},maxAssetBytes=32*1024*1024,maxPixels=32*1024*1024,maxTotalBytes=512*1024*1024}={}){
 const assets=sources.flatMap(s=>[...s.assets.values()]);let total=0,done=0;const cases=new Map();
 for(const a of assets){cancelled(signal);try{const b=new Uint8Array(await a.read());if(!b.length)throw Error('empty-image');if(b.length>maxAssetBytes)throw Error('asset-byte-limit');total+=b.length;if(total>maxTotalBytes)throw Error('total-byte-limit');a.bytes=b;a.byteLength=b.length;a.sha256=await hash(b);if(b[0]===137&&b.length>=24){const v=new DataView(b.buffer,b.byteOffset,b.byteLength);if(v.getUint32(16)*v.getUint32(20)>maxPixels)throw Error('decoded-pixel-limit');}a.dimensions=await decode(b);if(a.dimensions.width*a.dimensions.height>maxPixels)throw Error('decoded-pixel-limit');a.readState='readable';delete a.error;
  if(a.runtimeRead){const runtime=await a.runtimeRead();a.runtimeHash=await hash(runtime);a.runtimeMatchesArchive=a.runtimeHash===a.sha256;}
 }catch(e){a.readState='failed';a.error=String(e);delete a.bytes;if(total>maxTotalBytes)throw e;}
 const folded=a.logicalPath.toLowerCase();if(!cases.has(folded))cases.set(folded,new Set());cases.get(folded).add(a.logicalPath);onProgress({done:++done,total:assets.length,path:a.logicalPath});if(done%16===0)await new Promise(r=>setTimeout(r,0));
 }
 for(const a of assets)a.caseCollision=cases.get(a.logicalPath.toLowerCase()).size>1;
 return {assets:assets.length,readable:assets.filter(a=>a.readState==='readable').length,failed:assets.filter(a=>a.readState==='failed').length,totalBytes:total};
}
async function resolve(sources,{observe,signal}={}){
 const byPath=new Map();for(const s of sources)for(const a of s.assets.values()){if(!byPath.has(a.logicalPath))byPath.set(a.logicalPath,[]);byPath.get(a.logicalPath).push(a);}
 const rows=[];for(const[path,all]of byPath){cancelled(signal);const direct=all.filter(a=>a.enabled&&a.directOrder!==undefined).sort((a,b)=>a.directOrder-b.directOrder);const sides=all.filter(a=>a.enabled&&a.runtimeOrder>=0).sort((a,b)=>a.runtimeOrder-b.runtimeOrder);const predicted=direct[0]||sides[0];const row={path,providers:all.map(a=>({sourceId:a.sourceId,declared:a.declared,registered:a.registered,enabled:a.enabled,sha256:a.sha256,readState:a.readState})),predicted:predicted?.sourceId,status:predicted?'predicted-only':'not-enabled'};
  if(predicted&&observe)try{const actual=await observe(path);row.observedHash=actual?await hash(actual):null;row.status=row.observedHash===(predicted.runtimeHash||predicted.sha256)?'observed-match':'resolver-conflict';if(row.status==='observed-match')row.winner=predicted.sourceId;}catch(e){row.status='observation-failed';row.error=String(e);}
  rows.push(row);
 }return rows;
}
function compose(sources,rows,{sourceId}={}){
 const selected=[];const issues=[];for(const row of rows){const sid=sourceId||row.winner;if(!sid){if(row.predicted)issues.push({path:row.path,code:row.status});continue;}const s=sources.find(s=>s.sourceId===sid),a=s?.assets.get(row.path);if(!a)continue;if(a.readState!=='readable'||a.caseCollision||a.runtimeMatchesArchive===false){issues.push({path:row.path,code:a.caseCollision?'case-collision':a.runtimeMatchesArchive===false?'runtime-archive-mismatch':a.error||'unreadable'});continue;}selected.push({path:a.logicalPath,bytes:a.bytes,sha256:a.sha256,sourceId:sid});}
 const selectedIds=new Set(selected.map(a=>a.sourceId));for(const s of sources)if((selectedIds.has(s.sourceId)||sourceId===s.sourceId||(!sourceId&&[...s.assets.values()].some(a=>a.enabled)))&&s.nonImageDependencies?.length)issues.push({sourceId:s.sourceId,code:'non-image-dependencies',files:s.nonImageDependencies});
 const selectedMods=new Set(sources.filter(s=>selectedIds.has(s.sourceId)).map(s=>s.modName).filter(Boolean));
 for(const s of sources)if(selectedIds.has(s.sourceId)||sourceId===s.sourceId||(!sourceId&&selectedMods.has(s.modName)))for(const issue of s.issues||[])if(issue.code!=='archive-unavailable')issues.push({...issue,sourceId:s.sourceId});
 return {assets:selected,issues,status:issues.length?'blocked':'complete-image-composition'};
}
function report(sources,rows){return {schemaVersion:1,sources:sources.map(({assets,...s})=>({...s,assets:[...assets.values()].map(({bytes,read,runtimeRead,...a})=>a)})),resolution:rows};}
return {validateZip,host,importZip,importDirectory,scan,resolve,compose,report,decodeImage,hash,fromURL,safe,owner};
});
