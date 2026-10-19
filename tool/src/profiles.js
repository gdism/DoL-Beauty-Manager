/* Runtime profile uses source segments plus explicit live function contracts. */
(() => {
const sha=DBMEngine.hash;
async function match(){const u=document.getElementById('twine-user-script')?.textContent;if(!u)return {status:'unavailable',reason:'user-script-not-readable'};
 const wanted=new Set(DBMConfig.profiles.flatMap(p=>p.rendererWhitelist.map(([name])=>name))),scripts=new Map(),headers=/\/\* twine-user-script #(\d+): "(.*?)" \*\//g;
 let previous,current,count=0;const keep=end=>{if(previous&&wanted.has(previous.name))scripts.set(previous.name,u.slice(previous.end,end));};
 while((current=headers.exec(u))){keep(current.index);previous={name:current[2].replace(/\\+/g,'/'),end:headers.lastIndex};if(++count%32===0)await new Promise(r=>setTimeout(r,0));}keep(u.length);
 // This cache belongs to one fresh match only; source and passages are reread next time.
 const candidates=[],hashes=new Map();for(const profile of DBMConfig.profiles){const mismatch=[];for(const[name,expected]of profile.rendererWhitelist){if(!hashes.has(name)){const text=name.startsWith('passage:')?modUtils.getPassageData(name.slice(8))?.content:scripts.get(name);hashes.set(name,typeof text==='string'?await sha(text.replace(/\r\n/g,'\n').trim()):null);}if(hashes.get(name)!==expected)mismatch.push(name);}if(!mismatch.length)return {status:'matched',version:profile.version,variant:profile.variant||'original-source',rendererProfileHash:profile.rendererProfileHash};candidates.push({version:profile.version,mismatchedFiles:mismatch});}return {status:'unknown-host',candidates};}
async function checkContract(pack){const c=pack.modelContract,m=Renderer.CanvasModels[c?.name];if(!m||['width','height','frames','scale'].some(k=>m[k]!==c[k]))return false;
 if(c.layer&&await sha(String(m.layers[c.layer]?.srcfn))!==c.srcfnHash)return false;
 for(const[key,expected]of Object.entries(c.functions||{})){const split=key.lastIndexOf('.'),layer=key.slice(0,split),field=key.slice(split+1);if(await sha(String(m.layers[layer]?.[field]))!==expected)return false;}
 return true;}
async function stateCatalog(profile){const c=DBMConfig.stateCatalogs?.find(c=>c.targetProfileHash===profile?.rendererProfileHash);if(!c)return null;
 const valid=await checkContract({modelContract:{name:'main',width:256,height:256,frames:2,scale:true,functions:c.functions}});return valid?c:null;}
window.DBMProfiles={match,checkContract,stateCatalog};
})();
