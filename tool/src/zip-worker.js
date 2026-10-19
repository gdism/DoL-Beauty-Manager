self.onmessage=async event=>{
 try{const zip=new self.DBMWorkerZip();let done=0;for(const[path,bytes]of event.data.entries){zip.file(path,bytes);if(++done%128===0)self.postMessage({phase:'collect',done,total:event.data.entries.length,backend:'worker'});}
 const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',streamFiles:true},m=>self.postMessage({phase:'zip',percent:m.percent,backend:'worker'}));self.postMessage({bytes:bytes.buffer},[bytes.buffer]);
 }catch(e){self.postMessage({error:String(e)});}
};
