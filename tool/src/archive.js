/* ZIP jobs keep compressed input bytes off the UI thread when Worker is available. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DBMArchive=api;})(globalThis,()=>{
'use strict';
let workerUnavailable=false;
const aborted=signal=>{if(signal?.aborted)throw new DOMException('取消','AbortError');};
async function generate(entries,{Zip,workerSource,signal,onProgress=()=>{}}={}){
 aborted(signal);
 if(workerSource&&!workerUnavailable&&typeof Worker==='function'){
  let worker,url;try{url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));worker=new Worker(url);}catch(e){workerUnavailable=true;if(url)URL.revokeObjectURL(url);onProgress({phase:'worker-unavailable',reason:String(e)});}
  if(worker){let received=false;try{return await new Promise((resolve,reject)=>{
   const settle=(fn,value)=>{signal?.removeEventListener('abort',cancel);fn(value);};
   const cancel=()=>settle(reject,new DOMException('取消','AbortError'));
   signal?.addEventListener('abort',cancel,{once:true});
   worker.onerror=e=>{const error=Error('ZIP worker failed: '+e.message);error.code=received?'worker-failed':'worker-start-failed';settle(reject,error);};
   worker.onmessage=e=>{received=true;if(e.data.error)settle(reject,Error(e.data.error));else if(e.data.bytes){try{aborted(signal);settle(resolve,new Uint8Array(e.data.bytes));}catch(err){settle(reject,err);}}else onProgress(e.data);};
   worker.postMessage({entries});if(signal?.aborted)cancel();
  });}catch(e){if(e.name==='AbortError'||e.code!=='worker-start-failed')throw e;workerUnavailable=true;onProgress({phase:'worker-unavailable',reason:String(e)});}finally{worker.terminate();URL.revokeObjectURL(url);}}
 }
 const zip=new Zip();for(const [path,bytes]of entries){aborted(signal);zip.file(path,bytes);}
 return new Promise((resolve,reject)=>{
  const stream=zip.generateInternalStream({type:'uint8array',compression:'DEFLATE',streamFiles:true});let settled=false,total=0;const chunks=[];
  const finish=(fn,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',cancel);stream.pause();chunks.length=0;fn(value);};
  const cancel=()=>finish(reject,new DOMException('取消','AbortError'));signal?.addEventListener('abort',cancel,{once:true});
  stream.on('data',(chunk,m)=>{if(settled)return;try{aborted(signal);chunks.push(chunk);total+=chunk.length;onProgress({phase:'zip',percent:m.percent,backend:'main-thread-stream'});}catch(e){finish(reject,e);}});
  stream.on('error',e=>finish(reject,e));stream.on('end',()=>{if(settled)return;try{aborted(signal);const bytes=new Uint8Array(total);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}finish(resolve,bytes);}catch(e){finish(reject,e);}});
  if(signal?.aborted)cancel();else stream.resume();
 });
}
return {generate};
});
