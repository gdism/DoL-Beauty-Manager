/* Verified repair groups: each group is a transaction, baseline authenticity comes from the release catalog. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DBMRules=api;})(globalThis,()=>{
'use strict';
function validatePack(pack){
 if(pack.schemaVersion!==1||pack.status!=='validated')throw Error('unvalidated-rule-pack');if(!pack.targetProfileHash||!Array.isArray(pack.groups))throw Error('invalid-rule-pack');
 const ids=new Set(),written=new Set();for(const g of pack.groups){if(!g.id||ids.has(g.id))throw Error('duplicate-group');for(const dependency of g.dependsOn||[])if(!ids.has(dependency))throw Error('dependency-not-earlier:'+dependency);ids.add(g.id);if(!Array.isArray(g.operations)||!g.requiredOutputs?.length||!g.sourceHashes||!g.outputHashes)throw Error('incomplete-group-contract:'+g.id);for(const p of g.requiredOutputs){if(written.has(p))throw Error('overlapping-group-output:'+p);written.add(p);}if(g.fallbackPaths&&(g.fallbackPaths.length!==g.requiredOutputs.length||!g.requiredOutputs.every(p=>g.fallbackPaths.includes(p))))throw Error('fallback-not-in-dependency-group');}
}
async function matches(tree,expected,hash){for(const[p,h]of Object.entries(expected)){const b=tree.files.get(p);if(h===null){if(b)return false;}else if(!b||await hash(b)!==h)return false;}return true;}
async function verifyBaseline(entries,descriptor,catalog,{hash,signal}={}){
 const trusted=catalog.find(c=>c.id===descriptor.id&&c.cleanSourceVerified===true);if(!trusted)throw Error('baseline-source-not-certified');if(descriptor.targetProfileHash!==trusted.targetProfileHash)throw Error('baseline-target-mismatch');
 const files=new Map(entries.map(x=>[x.path,x.bytes]));if(files.size!==entries.length)throw Error('baseline-duplicate-path');for(const[p,h]of Object.entries(trusted.assets)){if(signal?.aborted)throw new DOMException('取消','AbortError');if(!files.has(p)||await hash(files.get(p))!==h)throw Error('baseline-content-mismatch:'+p);}
 return Object.freeze({id:trusted.id,targetProfileHash:trusted.targetProfileHash,files,verifiedHashes:trusted.assets,cleanSourceVerified:true});
}
async function run(tree,pack,{engine,codec,targetProfileHash,resources=new Map(),baseline,signal,onProgress=()=>{}}={}){
 validatePack(pack);if(targetProfileHash!==pack.targetProfileHash)throw Error('target-profile-mismatch');let result=tree.clone();const done=new Map(),report={schemaVersion:1,rulePackId:pack.id,rulePackHash:await engine.hash(JSON.stringify(pack)),targetProfileHash,groups:[],status:'rules-passed',unverified:pack.unverified||[]};
 for(const g of pack.groups){if(signal?.aborted)throw new DOMException('取消','AbortError');const row={id:g.id,steps:[],evidence:g.evidence,status:'pending'};report.groups.push(row);
  if((g.dependsOn||[]).some(d=>!['committed','already-adapted','fallback-original'].includes(done.get(d)))){row.status='blocked-dependency';done.set(g.id,row.status);continue;}
  if(await matches(result,g.outputHashes,engine.hash)){row.status='already-adapted';done.set(g.id,row.status);continue;}
  if(!await matches(result,g.sourceHashes,engine.hash)){row.status='not-applicable-source';done.set(g.id,row.status);continue;}
  let work=result.clone(),failed;
  try{for(const op of g.operations){if(signal?.aborted)throw new DOMException('取消','AbortError');if(op.op==='crop-transparent-right'){
    const b=work.files.get(op.src);if(!b)throw Error('source-missing:'+op.src);const img=codec.decode(b);if(img.width!==op.fromWidth||img.height!==op.height||op.width>=img.width)throw Error('crop-dimension-contract');
    for(let y=0;y<img.height;y++)for(let x=op.width;x<img.width;x++)if(img.data[(y*img.width+x)*4+3])throw Error('crop-would-remove-visible-pixels');const data=new Uint8Array(op.width*img.height*4);for(let y=0;y<img.height;y++)data.set(img.data.subarray(y*img.width*4,(y*img.width+op.width)*4),y*op.width*4);work.set(op.dst,codec.encode({width:op.width,height:img.height,data}));row.steps.push({op:op.op,src:op.src,dst:op.dst,status:'success'});
   }else row.steps.push({...op,status:engine.executeOp(work,op,resources,codec)});await new Promise(r=>setTimeout(r,0));}
   const allowed=new Set([...Object.keys(g.sourceHashes),...Object.keys(g.outputHashes)]);for(const p of new Set([...result.files.keys(),...work.files.keys()]))if(result.files.get(p)!==work.files.get(p)&&!allowed.has(p))throw Error('undeclared-group-write:'+p);
   if(!g.requiredOutputs.every(p=>work.files.has(p))||!await matches(work,g.outputHashes,engine.hash))throw Error('group-postcondition-mismatch');
   result=work;row.status='committed';
  }catch(e){if(e.name==='AbortError')throw e;failed=e;row.error=String(e);for(const step of row.steps)if(step.status==='success')step.status='rolled-back';row.status='rolled-back';}
  if(failed&&g.fallbackPaths?.length){
   if(!baseline?.cleanSourceVerified||baseline.targetProfileHash!==targetProfileHash){row.fallback='fallback-unavailable';}
   else {const missing=[];for(const p of g.fallbackPaths){const bytes=baseline.files.get(p);if(!bytes||await engine.hash(bytes)!==baseline.verifiedHashes[p])missing.push(p);}if(missing.length){row.fallback='fallback-unavailable';row.missingBaseline=missing;}else{const clean=result.clone();for(const p of g.fallbackPaths)clean.set(p,baseline.files.get(p));result=clean;row.status='fallback-original';row.baselineId=baseline.id;row.fallbackPaths=g.fallbackPaths;}}
  }
  done.set(g.id,row.status);onProgress(row);
 }
 if(report.groups.some(g=>['rolled-back','blocked-dependency'].includes(g.status)))report.status='partial-or-blocked';report.inputHash=await engine.treeHash(tree);report.outputHash=await engine.treeHash(result);return {tree:result,report};
}
return {validatePack,verifyBaseline,run,matches};
});
