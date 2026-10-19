/* DoL Beauty Manager: runtime prototype. Support is defined by tested profiles. */
(() => {
'use strict';
if (window.DoLBeautyManager) return;
const OWNER='DoLBeautyManager', TYPE='DoLBeautyManager/managed', VERSION='0.1.1-m0';
const api=window.DoLBeautyManager={version:VERSION,status:'starting',events:[],openCount:0};
const record=(event,data={})=>api.events.push({time:new Date().toISOString(),event,...data});
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))).map(x=>x.toString(16).padStart(2,'0')).join('');
const safePath=p=>{if(typeof p!=='string'||!p||p.includes('\\')||p.startsWith('/')||p.includes(':')||p.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('不安全或歧义路径：'+p);return p;};
const bytesURL=(bytes,mime='image/png')=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return 'data:'+mime+';base64,'+btoa(s);};
const mime=b=>b[0]===71?'image/gif':b[0]===255?'image/jpeg':b[0]===82?'image/webp':'image/png';
const db=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('DoLBeautyManager-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('数据库升级被其他页面阻止'));});
async function store(mode,value,key='committed'){const d=await db();try{return await new Promise((resolve,reject)=>{const t=d.transaction('state',mode==='get'?'readonly':'readwrite'),s=t.objectStore('state');const r=mode==='get'?s.get(key):mode==='clear'?s.delete(key):s.put(value,key);let result;r.onsuccess=()=>result=r.result;t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('存储事务取消'));});}finally{d.close();}}
let backend,bsa,own,before=null,committed=null,busy=false;
const upstream=()=>bsa.getTypeOrder().filter(t=>t.modRef.name!==OWNER);
async function fingerprint(){
 const canonical=t=>t.modRef.mod?.name||t.modRef.name;
 const used=(bsa.typeOrderUsed||[]).filter(t=>t.modRef.name!==OWNER);
 const mods=modUtils.getModListNameNoAlias().filter(n=>n!==OWNER).map(n=>{const m=modUtils.getMod(n),z=modUtils.getModZip(n);return [n,m?.version||m?.bootJson?.version,String(z?.modZipReaderHash||'unknown')];});
 return sha(JSON.stringify({schema:3,modelContracts:typeof Renderer==='object'?Object.entries(Renderer.CanvasModels||{}).map(([name,m])=>[name,m.width,m.height,m.frames,m.scale,String(m.preprocess),String(m.defaultOptions),Object.entries(m.layers||{}).map(([n,l])=>[n,Object.entries(l).filter(([k,v])=>typeof v==='function'||['src','scale','width','height','dx','dy','z','animation'].includes(k)).map(([k,v])=>[k,typeof v==='function'?String(v):v])])]):null,rules:window.DBMConfig?.ruleCatalogHash||'no-certified-rules',mods,used:used.map(t=>[t.type,canonical(t)]),providers:backend.upstreamProviders(),renderer:typeof Renderer==='object'?['composeLayers','invalidateLayerCaches'].map(k=>String(Renderer[k])):null}));
}
async function refresh(paths){
 backend.publish();const changed=new Set(paths);
 if(window.Renderer){for(const p of changed){delete Renderer.ImageCaches?.[p];delete Renderer.ImageErrors?.[p];}
 const caches=Renderer.CanvasModelCaches||{};const models=new Set();
 const visit=(v,depth=0)=>{if(!v||typeof v!=='object'||depth>3)return;if(Array.isArray(v.layerList)&&typeof v.redraw==='function'){models.add(v);return;}for(const x of Object.values(v))visit(x,depth+1);};visit(caches);
 if(Renderer.lastModel)models.add(Renderer.lastModel);
 for(const model of models){if(model.layerList?.some(l=>changed.has(l.src)||(Array.isArray(l.masksrc)?l.masksrc:[l.masksrc]).some(m=>changed.has(typeof m==='string'?m:m?.path)))){Renderer.invalidateLayerCaches(model.layerList);model.redraw();}}
 Renderer.lastAnimation?.invalidateCaches?.();
 }
 for(const el of document.querySelectorAll('img')){const p=el.getAttribute('ml-src')||el.getAttribute('data-dbm-source')||el.getAttribute('src');if(!changed.has(p))continue;el.setAttribute('data-dbm-source',p);el.removeAttribute('data-dbm-replaced');el.removeAttribute('ml-src');el.removeAttribute('ml-replaced-src');el.setAttribute('src',p);}
 await window.modImgLoaderHooker?.replaceAllImageInHtmlElement(document.body);
 record('refresh',{paths:paths.length});
}
const checkCancelled=signal=>{if(signal?.aborted)throw new DOMException('取消','AbortError');};
async function prepare(input,{signal}={}){const items=[];const seen=new Set();for(const entry of input){checkCancelled(signal);const path=safePath(entry.path);if(!path.startsWith('img/'))throw Error('图片逻辑路径须以img/开头');if(seen.has(path))throw Error('重复路径：'+path);seen.add(path);const bytes=new Uint8Array(entry.bytes);if(!bytes.length)throw Error('空资源：'+path);const url=bytesURL(bytes,mime(bytes));await new Promise((res,rej)=>{const image=new Image();image.onload=res;image.onerror=()=>rej(Error('图片解码失败：'+path));image.src=url;});checkCancelled(signal);items.push({path,bytes,hash:await sha(bytes),url});}return items;}
function install(items){own.imgListRef.clear();for(const it of items)own.imgListRef.set(it.path,{path:it.path,realPath:it.path,getter:{invalid:false,getBase64Image:async()=>it.url,forceCache:async()=>{}}});bsa.typeOrderUsed=[own,...(bsa.typeOrderUsed||[]).filter(t=>t!==own)];}
async function exclusive(fn){if(busy)throw Error('已有操作进行中');busy=true;try{return await fn();}finally{busy=false;}}
api.apply=(input,metadata=null,{signal}={})=>exclusive(async()=>{
 const items=await prepare(input,{signal});checkCancelled(signal);const fp=await fingerprint();const outputHash=await sha(JSON.stringify(items.map(x=>[x.path,x.hash]).sort()));
 if(committed?.outputHash===outputHash&&committed?.fingerprint===fp&&JSON.stringify(committed.metadata)===JSON.stringify(metadata)){record('apply-noop');return {status:'unchanged',outputHash};}
 const old={entries:[...own.imgListRef.entries()],order:[...(bsa.typeOrderUsed||[])],before,committed};
 if(!before)before=(bsa.typeOrderUsed||[]).filter(t=>t!==own).map(t=>t.type);
 const state={schema:1,metadata,fingerprint:fp,outputHash,before,assets:items.map(({path,bytes,hash})=>({path,bytes,hash}))};
 try{checkCancelled(signal);install(items);await refresh([...new Set([...old.entries.map(x=>x[0]),...items.map(x=>x.path)])]);checkCancelled(signal);committed=state;}catch(e){own.imgListRef.clear();for(const [k,v]of old.entries)own.imgListRef.set(k,v);bsa.typeOrderUsed=old.order;before=old.before;committed=old.committed;await refresh(items.map(x=>x.path));throw e;}
 let persisted=true;try{await store('put',state);}catch(e){persisted=false;record('storage-failed',{error:String(e)});}
 api.status=persisted?'applied-and-saved':'applied-session-only';record('apply',{outputHash,persisted,assets:items.length});return {status:api.status,outputHash,persisted};
});
api.undo=()=>exclusive(async()=>{const upstreamChanged=committed&&await fingerprint()!==committed.fingerprint;const paths=[...own.imgListRef.keys()];own.imgListRef.clear();const all=new Map(upstream().map(t=>[t.type,t]));if(before&&!upstreamChanged)bsa.typeOrderUsed=before.filter(t=>all.has(t)).map(t=>all.get(t));else bsa.typeOrderUsed=(bsa.typeOrderUsed||[]).filter(t=>t!==own);committed=null;before=null;await refresh(paths);try{await store('clear');api.status='undone';}catch(e){api.status='undone-storage-failed';record('storage-failed',{error:String(e)});}record('undo');return api.status;});
api.exportZip=({signal,onProgress}={})=>exclusive(async()=>{
 checkCancelled(signal);
 if(!committed)throw Error('没有已应用结果');if(committed.metadata?.incomplete||committed.metadata?.issues?.length)throw Error('当前只应用了独立验证组，来源问题未解决，不能导出完整组合');if(await fingerprint()!==committed.fingerprint)throw Error('上游组合已变化，请重新检查后导出');
 const entries=[],zip={file:(path,bytes)=>entries.push([path,bytes])},paths=committed.assets.map(x=>x.path);
 const boot={name:'DoLBeautyExport-'+committed.outputHash.slice(0,12),version:'1.0.0',styleFileList:[],scriptFileList_inject_early:['export-bootstrap.js'],scriptFileList:['export-runtime.js'],tweeFileList:[],imgFileList:paths,additionFile:['beauty-report.json'],addonPlugin:[],dependenceInfo:[{modName:'ModLoader',version:'>=2.100.0'}]};
 const exportName=boot.name;
 zip.file('export-bootstrap.js',`(()=>{const name=${JSON.stringify(exportName)};modUtils.getAddonPluginManager().registerAddonPlugin(name,'ExportBootstrap',{afterInjectEarlyLoad:async()=>{if(window.modImgLoaderHooker){const m=modUtils.getMod(name);m.bootJson.addonPlugin.push({modName:'ImageLoaderHook',addonName:'ImageLoaderAddon',modVersion:'^2.22.0'});}}});})();`);
 zip.file('export-runtime.js',`(()=>{const name=${JSON.stringify(exportName)};function run(){if(!window.Renderer||!document.body){setTimeout(run,50);return;}if(window.modImgLoaderHooker)return;const host=(${DBMHost.create.toString()})(name,name+'/export');const mod=modUtils.getMod(name);for(const img of mod.imgs)host.own.imgListRef.set(img.path,{...img,realPath:img.path});host.state.typeOrderUsed.unshift(host.own);host.publish();window.DoLBeautyExport={name,backend:host.kind};}run();})();`);
 zip.file('boot.json',JSON.stringify(boot,null,2));for(const a of committed.assets)zip.file(a.path,a.bytes);
 zip.file('beauty-report.json',JSON.stringify({schema:1,scope:committed.metadata?.scope||'explicit selected image set',repairReport:committed.metadata||null,fingerprint:committed.fingerprint,outputHash:committed.outputHash,assets:committed.assets.map(({path,hash})=>({path,hash})),unverified:['all game states','Android']},null,2));
 const bytes=await DBMArchive.generate(entries,{Zip:DBMZip,workerSource:DBMConfig.zipWorkerSource,signal,onProgress});checkCancelled(signal);if(await fingerprint()!==committed.fingerprint)throw Error('导出期间上游组合已变化，请重新检查');record('export',{bytes:bytes.length,assets:paths.length});return bytes;
});
api.inspect=()=>({status:api.status,backend:backend.kind,managedPaths:[...own.imgListRef.keys()],using:bsa.getUsingTypeOrder(),before,outputHash:committed?.outputHash,events:api.events});
api.savedSelection=()=>committed?.metadata?.selection;
api.saveImports=async sources=>{const data=sources.map(s=>({...s,assets:[...s.assets.values()].map(({read,runtimeRead,...a})=>a)}));await store('put',data,'imports');};
api.clearImports=()=>store('clear',null,'imports');
api.fingerprint=fingerprint;api.sha=sha;api.prepare=prepare;api.safePath=safePath;
function panel(){api.openCount++;DBMUI.open(api);}
let scheduled=false;const bound=new WeakSet();
function mount(){scheduled=false;const visible=e=>e&&e.getClientRects().length;const start=document.getElementById('startCaption'),overlay=document.getElementById('overlayButtons');const parent=visible(start)?start:visible(overlay)?overlay:null;if(!parent)return;let keep=null;for(const e of document.querySelectorAll('[data-dol-beauty-owner="'+OWNER+'"]')){if(e.parentElement===parent&&!keep)keep=e;else e.remove();}if(!keep&&window.DBMConfig?.entryMode==='placeholder-only')return;if(!keep){keep=document.createElement('button');keep.type='button';keep.textContent='美化管理';keep.dataset.dolBeautyOwner=OWNER;keep.id='dol-beauty-entry';keep.style.cssText='display:block;width:100%;box-sizing:border-box';parent.append(keep);}keep.id='dol-beauty-entry';keep.type='button';keep.style.display='block';keep.style.width='100%';keep.style.boxSizing='border-box';if(!bound.has(keep)){bound.add(keep);keep.addEventListener('click',panel);}}
api.mount=mount;api.open=panel;
async function init(){
 backend=DBMHost.create(OWNER,TYPE);bsa=backend.state;own=backend.own;
 api.hostContext=()=>({modUtils,bsa:window.addonBeautySelectorAddon,hook:backend.hook,backendState:bsa,managedOwner:OWNER});
 api.readUpstream=async path=>{
  const hook=backend.hook;const direct=hook?.imgLookupTable.get(path)?.filter(x=>x.modName!==OWNER)[0];
  if(direct)try{const u=await direct.imgData.getter.getBase64Image();if(u)return DBMSources.fromURL(u);}catch{}
  const fromBSA=async()=>{for(const t of bsa.typeOrderUsed||[]){if(t===own)continue;const img=t.imgListRef.get(path);if(img){const u=await img.getter.getBase64Image();if(u)return DBMSources.fromURL(u);}}};
  if(hook){for(const h of hook.sideHooker||[]){try{const b=h.hookName==='BeautySelectorAddonImageSideHook'?await fromBSA():DBMSources.fromURL(await h.imageGetter(path));if(b)return b;}catch{}}}else return fromBSA();
 };
 api.isManaged=()=>!!committed;
 api.storageInfo=async()=>({database:'DoLBeautyManager-v1',committedAssets:committed?.assets.length||0,committedBytes:committed?.assets.reduce((n,a)=>n+a.bytes.length,0)||0,originEstimate:await navigator.storage?.estimate?.()});
 bsa.typeOrderUsed=(bsa.typeOrderUsed||[]).filter(t=>t!==own);api.status='ready';
 try{const saved=await store('get');if(saved){if(saved.schema!==1||saved.fingerprint!==await fingerprint()){api.status='saved-result-stale';record('restore-refused',{reason:'fingerprint-or-schema'});}else{const items=await prepare(saved.assets);for(let i=0;i<items.length;i++)if(items[i].hash!==saved.assets[i].hash)throw Error('保存结果哈希不匹配');before=saved.before;install(items);committed=saved;await refresh(items.map(x=>x.path));api.status='restored';record('restore',{outputHash:saved.outputHash});}}}catch(e){record('restore-failed',{error:String(e)});api.status='storage-unavailable';}
 try{const imports=await store('get',null,'imports');api.importedSources=[];for(const source of imports||[]){const assets=new Map();for(const a of source.assets){if(a.bytes&&await sha(a.bytes)!==a.sha256)throw Error('导入源缓存摘要不匹配');assets.set(a.logicalPath,{...a,read:async()=>{if(!a.bytes)throw Error(a.error||'缓存资源不可读');return new Uint8Array(a.bytes);}});}api.importedSources.push({...source,assets});}}catch(e){api.importedSources=[];record('input-cache-unavailable',{error:String(e)});}
 mount();new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(mount);}}).observe(document.body,{childList:true,subtree:true});
 record('ready');return api.inspect();
}
api.ready=new Promise((resolve,reject)=>{let attempts=0;const run=()=>{if(window.SugarCube?.Story&&document.querySelector('#passages')){init().then(resolve,e=>{api.status='failed';record('init-failed',{error:String(e)});reject(e);});}else if(++attempts<2400)setTimeout(run,50);else reject(Error('宿主初始化超时'));};run();});
api.ready.catch(e=>console.error('[DoLBeautyManager]',e));
})();
