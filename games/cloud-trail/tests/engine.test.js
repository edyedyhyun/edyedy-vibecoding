const {test}=require('node:test'),a=require('node:assert/strict');const {Game,DT}=require('../engine');
function run(g,t,input={}){for(let i=0;i<Math.ceil(t/DT);i++)g.step(input)}
function at(g,x,y=399){Object.assign(g.player,{x,y,vy:0,grounded:true});}
test('initial jump cannot reach 96px step; tuning exceeds it',()=>{let old=new Game('prototype'),g=new Game();old.requestJump();g.requestJump();run(old,.8);run(g,.8);a.ok(old.maxJumpRise<96);a.ok(g.maxJumpRise>96);console.log('Measured jump rise',old.maxJumpRise.toFixed(1),g.maxJumpRise.toFixed(1))});
test('horizontal movement stops at solid step',()=>{let g=new Game();run(g,2,{right:true});a.equal(g.player.x,256)});
test('tuned jump climbs first step',()=>{let g=new Game();at(g,256);g.requestJump();run(g,.24);run(g,.24,{right:true});run(g,.5);a.equal(g.player.y,303);a.equal(g.player.grounded,true)});
test('no airborne double jump',()=>{let g=new Game();g.requestJump();a.equal(g.requestJump(),false);a.equal(g.jumps,1)});
test('jump works just after leaving edge',()=>{let g=new Game();at(g,629);run(g,.04,{right:true});a.equal(g.player.grounded,false);a.equal(g.requestJump(),true)});
test('late edge jump fails outside grace window',()=>{let g=new Game();at(g,638);run(g,.13,{right:true});a.equal(g.requestJump(),false)});
test('landing buffer starts jump on contact',()=>{let g=new Game();at(g,150,365);g.player.grounded=false;g.coyote=0;g.player.vy=250;g.requestJump();run(g,.1);a.equal(g.jumps,1);a.ok(g.player.vy<0)});
test('expired buffer does not autojump',()=>{let g=new Game();at(g,150,180);g.player.grounded=false;g.coyote=0;g.requestJump();run(g,1);a.equal(g.jumps,0);a.equal(g.player.grounded,true)});
test('pit respawns at start and counts retry',()=>{let g=new Game();at(g,690);run(g,1);a.equal(g.deaths,1);a.equal(g.player.x,85)});
test('checkpoint is reached and preserved after fall',()=>{let g=new Game();at(g,745);g.step();a.equal(g.checkpoint,true);at(g,690);run(g,1);a.equal(g.player.x,745);a.equal(g.deaths,1)});
test('coin collected once and stars are optional to win',()=>{let g=new Game();at(g,335,296);g.step();a.equal(g.coins.filter(c=>c.taken).length,1);g.step();a.equal(g.coins.filter(c=>c.taken).length,1);at(g,1535);g.step();a.equal(g.phase,'won')});
test('pause freezes physics and jump input',()=>{let g=new Game();g.paused=true;let state=JSON.stringify(g);g.requestJump();run(g,2,{right:true});a.equal(JSON.stringify(g),state)});
test('reset clears progress and temporary input state',()=>{let g=new Game();g.checkpoint=true;g.coins[0].taken=true;g.deaths=3;g.buffer=.1;g.reset();a.equal(g.deaths,0);a.equal(g.checkpoint,false);a.equal(g.coins[0].taken,false);a.equal(g.buffer,0)});

test('90px gap can be crossed and goal reached from the course',()=>{let g=new Game();at(g,600);g.requestJump();run(g,.65,{right:true});run(g,.3);a.equal(g.checkpoint,true);a.equal(g.deaths,0);run(g,4,{right:true});a.equal(g.phase,'won')});
