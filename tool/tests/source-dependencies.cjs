const assert=require('assert/strict'),S=require('../src/sources.js');
const src={sourceId:'broken',nonImageDependencies:['main.js'],assets:new Map([['img/x.png',{enabled:true,readState:'failed',logicalPath:'img/x.png'}]]),issues:[]},rows=[{path:'img/x.png',winner:'broken',predicted:'broken'}];
assert.ok(S.compose([src],rows,{sourceId:'broken'}).issues.some(i=>i.code==='non-image-dependencies'));
assert.ok(S.compose([src],[{path:'img/x.png',predicted:'broken',status:'observation-failed'}]).issues.some(i=>i.code==='non-image-dependencies'));
src.assets.clear();assert.ok(S.compose([src],[],{sourceId:'broken'}).issues.some(i=>i.code==='non-image-dependencies'));
assert.equal(S.compose([src],[]).issues.length,0);
console.log('PASS code dependencies block explicit/active all-unreadable and explicit empty sources; inactive unselected source excluded');
