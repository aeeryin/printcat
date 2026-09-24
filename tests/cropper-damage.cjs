const assert = require('node:assert/strict');
const damage = require('../src/scripts/cropper-damage.js');
const state = (rect, cursor = null) => ({rect, cursor, opacity: 1, annotated: false});
function contains(r, x, y) { return r && x >= r.x && x < r.x+r.w && y >= r.y && y < r.y+r.h; }
for (const [width,height] of [[3440,1440],[5120,1440],[6880,2880]]) {
  const a=state({x:100,y:100,w:width-300,h:height-300});
  const b=state({x:108,y:105,w:width-300,h:height-300});
  const dirty=damage(a,b,width,height);
  const area=dirty.reduce((sum,r)=>sum+r.w*r.h,0);
  assert.ok(area < width*height*.4, 'small moves must not repaint the full ultrawide screen');
  for (let y=0;y<height;y+=7) for(let x=0;x<width;x+=7) {
    if (!!contains(a.rect,x,y)!==!!contains(b.rect,x,y)) assert.ok(dirty.some(r=>contains(r,x,y)), 'changed dimming pixel must be repainted');
  }
  console.log(`${width}x${height}: dirty rectangles cover at most ${(area/(width*height)*100).toFixed(1)}% of the screen for an 8x5 move.`);
  assert.deepEqual(damage(null,b,width,height),[{x:0,y:0,w:width,h:height}]);
  assert.deepEqual(damage(a,{...b,opacity:.5},width,height),[{x:0,y:0,w:width,h:height}]);
}
// A selection can cross a monitor edge, collapse, disappear or jump entirely.
for (const rect of [null,{x:-200,y:-80,w:700,h:500},{x:900,y:500,w:100,h:100},{x:10,y:10,w:0,h:0}]) {
 const a=state({x:100,y:100,w:400,h:300}), b=state(rect);
 const dirty=damage(a,b,1200,800);
 for(let y=0;y<800;y+=3) for(let x=0;x<1200;x+=3) {
  if (!!contains(a.rect,x,y)!==!!contains(rect,x,y)) assert.ok(dirty.some(r=>contains(r,x,y)));
 }
}
console.log('PASS: changed pixels covered for move, monitor edges, collapse, reset, jump and fade.');
