const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine');
const tick = (s, n=1, input={}) => { for(let i=0;i<n;i++) E.step(s,1/120,input); };
function flying(){const s=E.createState(); E.launch(s); return s;}
test('new board has sixty bricks, three lives and a resting ball',()=>{
 const s=E.createState();assert.equal(s.bricks.length,60);assert.equal(s.bricksRemaining,60);assert.equal(s.lives,3);assert.equal(s.score,0);assert.equal(s.status,'ready');
 tick(s,60,{left:true});assert.equal(s.ball.x,s.paddle.x+s.paddle.w/2);assert.equal(s.ball.vy,0);
});
test('paddle stays within both boundaries',()=>{const s=E.createState();tick(s,600,{left:true});assert.equal(s.paddle.x,0);tick(s,600,{right:true});assert.equal(s.paddle.x+s.paddle.w,E.WIDTH);});
test('launch only acts on a waiting ball',()=>{const s=flying();assert.ok(s.ball.vy<0);const b={...s.ball};E.launch(s);assert.deepEqual(s.ball,b);});
test('brick bottom hit awards ten points once',()=>{const s=flying(), b=s.bricks[55];Object.assign(s.ball,{x:b.x+b.w/2,y:b.y+b.h+E.BALL_RADIUS+1,vx:0,vy:-320});tick(s);assert.equal(b.alive,false);assert.equal(s.score,10);assert.equal(s.bricksRemaining,59);assert.ok(s.ball.vy>0);tick(s,5);assert.equal(s.score,10);});
test('brick side hit reflects horizontally',()=>{const s=flying(),b=s.bricks[59];Object.assign(s.ball,{x:b.x+b.w+E.BALL_RADIUS+1,y:b.y+b.h/2,vx:-320,vy:0});tick(s);assert.equal(b.alive,false);assert.ok(s.ball.vx>0);});
test('miss costs one life, preserves board and waits',()=>{const s=flying();Object.assign(s.ball,{x:40,y:E.HEIGHT+E.BALL_RADIUS+1,vx:0,vy:320});tick(s);assert.equal(s.lives,2);assert.equal(s.status,'lost_ball');tick(s,600);assert.equal(s.lives,2);assert.equal(s.bricksRemaining,60);E.launch(s);assert.equal(s.status,'playing');});
test('third miss ends game; reset makes a fresh board',()=>{const s=flying();s.lives=1;Object.assign(s.ball,{x:40,y:610,vx:0,vy:320});tick(s);assert.equal(s.status,'game_over');const snap=JSON.stringify(s);tick(s,200,{right:true});assert.equal(JSON.stringify(s),snap);E.reset(s);assert.equal(s.lives,3);assert.equal(s.status,'ready');});
test('last brick wins and freezes state',()=>{const s=flying();s.bricks.forEach((b,i)=>b.alive=i===55);s.bricksRemaining=1;s.score=590;const b=s.bricks[55];Object.assign(s.ball,{x:b.x+b.w/2,y:b.y+b.h+9,vx:0,vy:-320});tick(s);assert.equal(s.status,'won');assert.equal(s.score,600);const snap=JSON.stringify(s);tick(s,120,{left:true});assert.equal(JSON.stringify(s),snap);});
test('pause freezes physics and resume continues',()=>{const s=flying();E.pause(s);const snap=JSON.stringify(s);tick(s,120,{right:true});assert.equal(JSON.stringify(s),snap);E.resume(s);tick(s);assert.notEqual(JSON.stringify(s),snap);});
test('maximum-speed ball hits thin brick without tunnelling',()=>{const s=flying(),b=s.bricks[55];Object.assign(s.ball,{x:b.x+b.w/2,y:b.y+b.h+30,vx:0,vy:-460});E.step(s,0.1,{});assert.equal(b.alive,false);assert.ok(s.ball.vy>0);});
for(const [label,offset,sign] of [['left',-40,-1],['center',0,0],['right',40,1]]){
 test(`paddle ${label} contact steers outgoing ball`,()=>{
  const s=flying();Object.assign(s.ball,{x:s.paddle.x+s.paddle.w/2+offset,y:E.PADDLE_Y-E.BALL_RADIUS-1,vx:0,vy:320});tick(s);
  assert.ok(s.ball.vy<0);assert.equal(Math.sign(s.ball.vx),sign);assert.ok(Math.abs(Math.hypot(s.ball.vx,s.ball.vy)-320)<1e-6);
 });
}
test('ball below paddle is not rescued by a side overlap',()=>{const s=flying();Object.assign(s.ball,{x:s.paddle.x+1,y:E.PADDLE_Y+12,vx:0,vy:320});tick(s);assert.ok(s.ball.vy>0);});
test('last brick stops a long step immediately',()=>{const s=flying();s.bricks.forEach((b,i)=>b.alive=i===55);s.bricksRemaining=1;const b=s.bricks[55];Object.assign(s.ball,{x:b.x+b.w/2,y:b.y+b.h+9,vx:0,vy:-320});E.step(s,3,{});assert.equal(s.status,'won');assert.equal(s.lives,3);});
