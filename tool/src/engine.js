/* Pure, transactional asset engine. No filesystem or game mutations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DBMEngine=api;})(globalThis,()=>{
'use strict';
const path=p=>{if(typeof p!=='string'||!p||p.includes('\\')||p.startsWith('/')||/^[a-z]+:/i.test(p)||p.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('unsafe-path:'+p);return p;};
const dirname=p=>p.includes('/')?p.slice(0,p.lastIndexOf('/')):'';
const isChild=(p,d)=>p.startsWith(d+'/');
class Tree{
 constructor(entries=[],dirs=[]){this.files=new Map();this.dirs=new Set(['',...dirs.map(path)]);for(const[p,b]of entries)this.set(p,b);}
 parents(p){let d=dirname(p);while(d){this.dirs.add(d);d=dirname(d);}}
 set(p,b){path(p);if(this.dirs.has(p))throw Error('directory-collision:'+p);for(let d=dirname(p);d;d=dirname(d))if(this.files.has(d))throw Error('file-parent:'+d);this.parents(p);this.files.set(p,b instanceof Uint8Array?b:new Uint8Array(b));}
 clone(){return new Tree(this.files,[...this.dirs].filter(Boolean));}
 exists(p){return this.files.has(p)||this.dirs.has(p);}
 subtree(p){return [...this.files].filter(([k])=>isChild(k,p));}
 eraseTree(p){for(const k of this.files.keys())if(k===p||isChild(k,p))this.files.delete(k);for(const k of this.dirs)if(k===p||isChild(k,p))this.dirs.delete(k);}
}
const hash=async b=>[...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',typeof b==='string'?new TextEncoder().encode(b):b))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function treeHash(tree){const rows=[];for(const[p,b]of [...tree.files].sort(([a],[b])=>a.localeCompare(b,'en')))rows.push([p,await hash(b)]);return hash(JSON.stringify(rows));}
function pixelMerge(a,b){if(a.width!==b.width||a.height!==b.height)throw Error('dimension-mismatch');const data=new Uint8Array(a.data.length);for(let i=0;i<data.length;i+=4){const aa=a.data[i+3],ba=b.data[i+3];if(aa||ba)data.set((aa>ba?a.data:b.data).subarray(i,i+4),i);}return {width:a.width,height:a.height,data};}
function pixelMask(a){const data=new Uint8Array(a.data);for(let i=0;i<data.length;i+=4)if(data[i+3])data[i]=data[i+1]=data[i+2]=255;return {width:a.width,height:a.height,data};}
function pngCodec(PNG){const BufferClass=new PNG({width:1,height:1}).data.constructor;return {decode:b=>PNG.sync.read(BufferClass.from(b)),encode:o=>new Uint8Array(PNG.sync.write({width:o.width,height:o.height,data:BufferClass.from(o.data)}))};}
function executeOp(tree,item,resources,codec){
 const {op}=item;let src=item.src,dst=item.dst;
 if(op!=='copy_from'&&op!=='merge')path(src);if(op!=='delete')path(dst);
 if(op==='copy_from'){if(!resources.has(src))throw Error('resource-missing:'+src);tree.set(dst,resources.get(src));return 'success';}
 if(op==='merge'){const names=src.split('+');if(names.length!==2)throw Error('merge-needs-two');names.forEach(path);if(names.some(p=>!tree.files.has(p)))throw Error('source-missing:'+src);const a=codec.decode(tree.files.get(names[0])),b=codec.decode(tree.files.get(names[1]));tree.set(dst,codec.encode(pixelMerge(a,b)));return 'success';}
 if(!tree.exists(src))return item.optional?'skip-optional-source-missing':(()=>{throw Error('source-missing:'+src);})();
 if(op==='delete'){if(tree.files.delete(src))return 'success';if(tree.subtree(src).length||[...tree.dirs].some(d=>isChild(d,src)))return 'skip-nonempty-directory';tree.dirs.delete(src);return 'success';}
 if(op==='mask'){if(!tree.files.has(src))throw Error('expected-file:'+src);tree.set(dst,codec.encode(pixelMask(codec.decode(tree.files.get(src)))));return 'success';}
 if(!['rename','move','copy','copy_folder'].includes(op))throw Error('unsupported-op:'+op);
 if(op==='move'&&tree.dirs.has(dst))dst=dst+'/'+src.split('/').pop();
 if(src===dst)return 'skip-identical-path';
 if(op==='copy_folder'){
  if(!tree.dirs.has(src))throw Error('expected-directory:'+src);if(isChild(dst,src)||isChild(src,dst))throw Error('overlapping-directory-copy');
  const files=tree.subtree(src),dirs=[...tree.dirs].filter(d=>d===src||isChild(d,src));tree.eraseTree(dst);tree.parents(dst);for(const d of dirs)tree.dirs.add(dst+d.slice(src.length));for(const [p,b]of files)tree.set(dst+p.slice(src.length),b);return 'success';
 }
 if(op==='rename'&&!tree.dirs.has(dirname(dst)))throw Error('target-parent-missing:'+dst);
 if(tree.files.has(src)){if(tree.dirs.has(dst))throw Error('directory-collision:'+dst);tree.set(dst,tree.files.get(src));if(op!=='copy')tree.files.delete(src);return 'success';}
 if(op==='copy')throw Error('expected-file:'+src);
 if(isChild(dst,src)||isChild(src,dst))throw Error('overlapping-directory-move');if(tree.exists(dst))throw Error('directory-target-exists:'+dst);
 const files=tree.subtree(src),dirs=[...tree.dirs].filter(d=>d===src||isChild(d,src));tree.eraseTree(src);tree.parents(dst);for(const d of dirs)tree.dirs.add(dst+d.slice(src.length));for(const[p,b]of files)tree.set(dst+p.slice(src.length),b);return 'success';
}
async function run(tree,pack,{targetProfileHash,resources=new Map(),codec,signal,yieldEvery=20}={}){
 if(pack.schemaVersion!==1)throw Error('unsupported-rule-schema');const inputHash=await treeHash(tree),gate=pack.appliesWhen;
 if(!gate||gate.status!=='validated'||gate.targetProfileHash!==targetProfileHash)throw Error('rule-target-not-validated');
 if(gate.outputSnapshotHash===inputHash)return {tree:tree.clone(),report:{status:'already-adapted',inputHash,outputHash:inputHash,steps:[],groups:[]}};
 if(gate.sourceSnapshotHash!==inputHash)throw Error('rule-source-mismatch');
 for(const[id,r]of Object.entries(pack.resources||{})){if(!resources.has(id)||await hash(resources.get(id))!==r.sha256)throw Error('resource-fingerprint-mismatch:'+id);}
 let current=tree.clone();const report={schemaVersion:1,rulePackId:pack.rulePackId,inputHash,steps:[],groups:[],status:'rules-passed',unverified:pack.unverified||['rendering not verified by file operations']};
 const groups=pack.groups||[{id:'entire-sequence',indices:pack.operations.map((_,i)=>i)}];let n=0;
 for(const group of groups){let work=current.clone(),failed=false;const entries=[];
  for(const i of group.indices){if(signal?.aborted)throw new DOMException('取消','AbortError');const item=pack.operations[i];if(!item)throw Error('invalid-operation-index');const step={index:i,line:item.line,op:item.op,src:item.src,dst:item.dst,group:group.id};
   if(failed){step.status='blocked';step.reason='previous-required-step-failed';}else try{step.status=executeOp(work,item,resources,codec);}catch(e){step.status='failed';step.reason=e.message;failed=true;}
   entries.push(step);if(++n%yieldEvery===0)await new Promise(r=>setTimeout(r,0));
  }
  const required=group.requiredOutputs||[];if(!failed&&required.some(p=>!work.files.has(p))){failed=true;entries.push({group:group.id,status:'failed',reason:'required-output-missing'});}
  if(failed){for(const s of entries)if(s.status==='success')s.status='rolled-back';report.status='partial-or-blocked';report.groups.push({id:group.id,status:'rolled-back'});}else{current=work;report.groups.push({id:group.id,status:'committed'});}report.steps.push(...entries);
 }
 report.outputHash=await treeHash(current);return {tree:current,report};
}
return {Tree,path,hash,treeHash,pixelMerge,pixelMask,pngCodec,executeOp,run};
});
