/* One host adapter selected per session. Existing ImageLoaderHook remains authoritative. */
(() => {
'use strict';
function create(owner,type){
 const hook=window.modImgLoaderHooker,native=window.addonBeautySelectorAddon;
 let state,own;const touched=new Set();
 if(native&&hook){state=native;own=state.getTypeOrder().find(x=>x.type===type&&x.modRef.name===owner);if(!own)throw Error('BSA预注册层缺失');}
 else{
  own={type,modRef:{name:owner},imgListRef:new Map()};const types=[];
  for(const name of modUtils.getModListNameNoAlias()){
   if(name===owner)continue;const mod=modUtils.getMod(name);if(!mod?.imgs?.length)continue;
   types.unshift({type:'mod/'+name,modRef:{name,mod,modZip:modUtils.getModZip(name)},imgListRef:new Map(mod.imgs.map(x=>[x.path,{...x,realPath:x.path}]))});
  }
  state={typeOrderUsed:[...types],getTypeOrder:()=>[own,...types],getUsingTypeOrder(){return this.typeOrderUsed.map(x=>({type:x.type,modName:x.modRef.name}));}};
 }
 const enabled=()=>state.typeOrderUsed.includes(own);
 const lookup=p=>{for(const t of state.typeOrderUsed){const img=t.imgListRef.get(p);if(img)return img;}return null;};
 const resolve=async p=>{const img=lookup(p);return img?await img.getter.getBase64Image():undefined;};
 const publish=()=>{
  if(!hook)return;
  if(!(hook.imgLookupTable instanceof Map))throw Error('Hook提供者表结构未确认');
  const paths=new Set([...touched,...own.imgListRef.keys()]);
  for(const p of paths){const upstream=(hook.imgLookupTable.get(p)||[]).filter(x=>x.modName!==owner);const img=enabled()?own.imgListRef.get(p):null;
   // BSA supplies unshadowed paths; only hook-owned paths require a managed first provider.
   if(img&&(!native||upstream.length)){hook.imgLookupTable.set(p,[{modName:owner,imgData:img},...upstream]);touched.add(p);}else if(upstream.length)hook.imgLookupTable.set(p,upstream);else hook.imgLookupTable.delete(p);
  }
 };
 let observer,originalLoader;
 if(!hook){
  if(!window.Renderer?.ImageLoader?.loadImage)throw Error('游戏Renderer加载接口不可用');
  originalLoader=Renderer.ImageLoader;
  Renderer.ImageLoader={...originalLoader,loadImage(src,layer,success,error){resolve(src).then(url=>originalLoader.loadImage(url||src,layer,(_s,l,image)=>success(src,l,image),(_s,l,e)=>error(src,l,e)),e=>error(src,layer,e));}};
  const tokens=new WeakMap();
  const process=async el=>{
   if(el.tagName!=='IMG')return;const current=el.getAttribute('src');if(!current)return;const prev=el.getAttribute('data-dbm-replaced');if(current===prev)return;
   const p=/^(data:|blob:)/.test(current)?el.getAttribute('data-dbm-source'):current;if(!p)return;
   el.setAttribute('data-dbm-source',p);const token={};tokens.set(el,token);const url=await resolve(p);if(tokens.get(el)!==token||!el.isConnected)return;el.setAttribute('data-dbm-replaced',url||p);el.setAttribute('src',url||p);
  };
  observer=new MutationObserver(ms=>{for(const m of ms){if(m.type==='attributes')process(m.target);else for(const n of m.addedNodes)if(n.nodeType===1){process(n);n.querySelectorAll('img').forEach(process);}}});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});document.querySelectorAll('img').forEach(process);
 }
 return {kind:native&&hook?'BSA-pre-registered-type0':hook?'ImageLoaderHook-preserved-providers':'ModLoader-Renderer-DOM',state,own,publish,resolve,hook,
  upstreamProviders:()=>hook?[...hook.imgLookupTable].map(([p,list])=>[p,list.filter(x=>x.modName!==owner).map(x=>x.modName)]).filter(x=>x[1].length).sort():[],
  dispose(){observer?.disconnect();if(originalLoader)Renderer.ImageLoader=originalLoader;}
 };
}
window.DBMHost={create};
})();
