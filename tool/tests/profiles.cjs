const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),E=require('../src/engine.js');
(async()=>{
 let script='/* twine-user-script #1: "ignored.js" */ignored\r\n/* twine-user-script #2: "renderer\\main.js" */\r\n main(); \r\n/* twine-user-script #3: "last.js" */\r\n last();\r\n',passage=' caption(); ',calls=0;
 const main=await E.hash('main();'),last=await E.hash('last();'),caption=await E.hash('caption();');
 const profiles=[{version:'wrong',rendererProfileHash:'wrong',rendererWhitelist:[['renderer/main.js','wrong'],['last.js',last],['passage:Caption',caption]]},{version:'test',rendererProfileHash:'expected',rendererWhitelist:[['renderer/main.js',main],['last.js',last],['passage:Caption',caption]]}];
 const sandbox={window:{},document:{getElementById:()=>({textContent:script})},DBMConfig:{profiles},DBMEngine:{hash:async s=>{calls++;return E.hash(s);}},modUtils:{getPassageData:()=>({content:passage})},setTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/profiles.js'),'utf8'),sandbox);const match=sandbox.window.DBMProfiles.match;
 assert.equal((await match()).rendererProfileHash,'expected');assert.equal(calls,3);console.log('PASS selected source/last segment/CRLF/passage hashes and per-call deduplication');
 script=script.replace('main();','changed();');assert.equal((await match()).status,'unknown-host');console.log('PASS source mutation invalidates next match');
 script=script.replace('changed();','main();');passage='changed();';assert.equal((await match()).status,'unknown-host');console.log('PASS passage mutation invalidates next match');
 passage=' caption(); ';assert.equal((await match()).status,'matched');script='';assert.equal((await match()).status,'unavailable');console.log('PASS restoration and unavailable source remain explicit');
})().catch(e=>{console.error(e);process.exitCode=1;});
