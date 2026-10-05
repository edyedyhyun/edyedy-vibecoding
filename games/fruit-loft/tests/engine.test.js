const{test}=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
function run(s,n,input={}){for(let i=0;i<n;i++)E.step(s,1/120,input)}
function playing(){let s=E.create();E.start(s);return s}
test('ready and pause freeze simulation',()=>{let s=E.create(),before=JSON.stringify(s);run(s,100,{right:true});assert.equal(JSON.stringify(s),before);E.start(s);s.status='paused';before=JSON.stringify(s);run(s,100);assert.equal(JSON.stringify(s),before)});
test('all three layouts have 12 unique reachable fruit positions',()=>{for(let st=0;st<3;st++){let s=E.create(st);assert.equal(s.fruits.length,12);assert.equal(new Set(s.fruits.map(f=>`${f.x},${f.y}`)).size,12);for(let f of s.fruits){assert.ok(f.x>22&&f.x<778);assert.equal(f.y,E.FLOORS[f.floor]-22)}}});
test('walking collects only once',()=>{let s=playing();run(s,40,{right:true});assert.equal(s.collected,1);assert.equal(s.score,100);run(s,60);assert.equal(s.score,100)});
test('ladder rejects distant input',()=>{let s=playing();assert.equal(E.climb(s,-1),false);assert.equal(s.player.floor,0)});
test('climb snaps to ladder and arrives on correct floor',()=>{let s=playing();s.player.x=178;assert.equal(E.climb(s,-1),true);run(s,120);assert.equal(s.player.y,360);assert.equal(s.player.floor,1);assert.equal(s.player.x,180)});
test('downward ladder returns to same shelf',()=>{let s=playing();Object.assign(s.player,{x:180,y:360,floor:1});assert.ok(E.climb(s,1));run(s,120);assert.equal(s.player.floor,0)});
test('jump cannot repeat in air and lands on own shelf',()=>{let s=playing();s.player.x=70;assert.ok(E.jump(s));assert.equal(E.jump(s),false);run(s,110);assert.equal(s.player.floor,0);assert.equal(s.player.y,480)});
test('jump apex gives enough vertical clearance over hedgehog',()=>{let s=playing();E.jump(s);run(s,50);assert.ok(s.player.y<410);assert.ok(s.player.y>360)});
test('climbing prevents jump and lateral movement',()=>{let s=playing();s.player.x=180;E.climb(s,-1);assert.equal(E.jump(s),false);run(s,50,{right:true});assert.equal(s.player.x,180)});
test('damage preserves collected fruit and respawns safely',()=>{let s=playing();run(s,40,{right:true});s.invincible=0;assert.ok(E.hurt(s));assert.equal(s.lives,2);assert.equal(s.score,100);assert.equal(s.collected,1);assert.equal(s.player.x,50);assert.equal(E.hurt(s),false);assert.equal(s.lives,2)});
test('last life enters game over',()=>{let s=playing();s.lives=1;s.invincible=0;E.hurt(s);assert.equal(s.status,'over')});
test('patrol stays in bounds over 20 seconds',()=>{let s=playing();s.invincible=999;run(s,2400);for(let e of s.enemies)assert.ok(e.x>=e.min&&e.x<=e.max)});
test('collect every fruit clears stage at 1200 points',()=>{let s=playing();s.invincible=999;for(let f of s.fruits){Object.assign(s.player,{x:f.x,y:f.y+22,floor:f.floor});E.step(s,1/120)}assert.equal(s.status,'clear');assert.equal(s.score,1200);assert.equal(s.collected,12)});
test('next stage carries points and lives, starts with fresh fruit',()=>{let s=E.create(1,1200,2);assert.equal(s.score,1200);assert.equal(s.lives,2);assert.equal(s.collected,0);assert.equal(s.status,'ready')});
test('movement bounds protect player',()=>{let s=playing();s.invincible=999;run(s,900,{left:true});assert.equal(s.player.x,22);run(s,900,{right:true});assert.equal(s.player.x,778)});
test('jumping crosses a hedgehog without damage while walking collides',()=>{function trial(j){let s=playing();s.invincible=0;s.player.x=150;s.enemies=[{x:200,y:480,v:0,min:200,max:200}];if(j)E.jump(s);run(s,60,{right:true});return s.lives}assert.equal(trial(false),2);assert.equal(trial(true),3)});
