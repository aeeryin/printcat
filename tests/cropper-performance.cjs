const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const events={},frames=[],sent=[],elements=new Map();let capture,reads=0;
const ctx=new Proxy({measureText:()=>({width:20}),getImageData:()=>{reads++;return {data:[52,86,120,255]}}},{get:(t,k)=>t[k]||(()=>{})});
function el(id){if(!elements.has(id))elements.set(id,{style:{},classList:{add(){},remove(){}},getContext:()=>ctx,before(){},contains:()=>false,addEventListener(){},querySelector:()=>el('child'),querySelectorAll:()=>[],setAttribute(){},getAttribute:()=>'',offsetWidth:340,offsetHeight:44});return elements.get(id)}
const document={addEventListener(){},getElementById:el,createElement:()=>el('canvas'+elements.size),querySelector:()=>el('query'),querySelectorAll:()=>[],documentElement:el('root')};
const window={cropperDamage:require("../src/scripts/cropper-damage.js"),innerWidth:3440,innerHeight:1440,devicePixelRatio:1,addEventListener:(k,fn)=>events[k]=fn,api:new Proxy({onCaptureImage:fn=>capture=fn,sendCropperEvent:e=>sent.push(e)},{get:(t,k)=>t[k]||(()=>{})})};
class Image {naturalWidth=3440;naturalHeight=1440;set src(v){this.onload()}}
vm.runInNewContext(fs.readFileSync('src/scripts/cropper.js','utf8'),{document,window,Image,console,requestAnimationFrame:fn=>frames.push(fn),performance:{now:()=>0},setTimeout});
function flush(){const batch=frames.splice(0);batch.forEach(fn=>fn(0))}
capture({displayOffset:{x:0,y:0},displaySize:{width:3440,height:1440},totalSize:{width:3440,height:1440},displayCaptures:[{x:0,y:0,width:3440,height:1440,url:'mock'}]},'pt');flush();
events.mousedown({button:0,clientX:100,clientY:100});
for(let i=0;i<1000;i++)events.mousemove({clientX:200+i,clientY:500});
assert.equal(sent.filter(e=>e.type==='move').length,0);flush();assert.equal(sent.filter(e=>e.type==='move').length,1);assert.equal(reads,1);
events.mousemove({clientX:1300,clientY:600});events.mouseup({clientX:1400,clientY:650});flush();
assert.equal(sent.at(-1).type,'end');assert.equal(sent.at(-1).rect.w,1300);assert.equal(sent.at(-1).rect.h,550);assert.equal(el('cropper-toolbar').style.display,'flex');assert.equal(sent.filter(e=>e.type==='move').length,1);
console.log('PASS: 1000 mouse moves -> 1 IPC update and 1 pixel read; final 1300x550 crop preserved; pending move cancelled on mouseup.');

