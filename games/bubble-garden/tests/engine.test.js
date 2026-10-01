const {test}=require('node:test');const a=require('node:assert/strict');const {Game,DT}=require('../engine');
function run(g,s,input={}){for(let i=0;i<Math.ceil(s/DT);i++)g.step(input)}
function trapped(g,x=g.player.x+60){Object.assign(g.enemies[0],{state:'trapped',timer:6,x,y:g.player.y});}
test('capture gives no score',()=>{let g=new Game();g.player.x=300;g.fire();run(g,.2);a.equal(g.enemies[0].state,'trapped');a.equal(g.score,0)});
test('near pop scores only once and wins',()=>{let g=new Game();trapped(g);a.equal(g.pop(),1);a.equal(g.score,100);a.equal(g.phase,'won');a.equal(g.pop(),0)});
test('far pop does not score',()=>{let g=new Game();trapped(g,400);a.equal(g.pop(),0);a.equal(g.score,0)});
test('trapped enemy escapes after six seconds',()=>{let g=new Game();trapped(g,400);run(g,6.1);a.equal(g.enemies[0].state,'free');a.equal(g.escapes,1);a.equal(g.score,0)});
test('pause freezes timer movement and actions',()=>{let g=new Game();trapped(g);g.paused=true;let x=JSON.stringify(g);run(g,7,{right:true});g.fire();g.jump();g.pop();a.equal(JSON.stringify(g),x)});
test('fire cooldown prevents simultaneous shots',()=>{let g=new Game();a.equal(g.fire(),true);a.equal(g.fire(),false);run(g,.33);a.equal(g.fire(),true)});
test('jump cannot double jump and lands',()=>{let g=new Game();a.equal(g.jump(),true);a.equal(g.jump(),false);run(g,1.1);a.equal(g.player.y,460);a.equal(g.player.grounded,true)});
test('jump can reach platform from below',()=>{let g=new Game();g.load(1);g.player.x=400;g.jump();run(g,.7);a.equal(g.player.y,335);a.equal(g.player.grounded,true)});
test('movement respects board bounds',()=>{let g=new Game();g.enemies=[];run(g,10,{left:true});a.equal(g.player.x,24);run(g,10,{right:true});a.equal(g.player.x,936)});
test('contact costs one life with invulnerability',()=>{let g=new Game();g.enemies[0].x=110;g.enemies[0].min=0;g.step();a.equal(g.lives,2);g.enemies[0].x=110;g.step();a.equal(g.lives,2)});
test('last life ends play',()=>{let g=new Game();g.lives=1;g.enemies[0].x=110;g.enemies[0].min=0;g.step();a.equal(g.phase,'lost')});
test('load resets stage score and temporary state',()=>{let g=new Game();trapped(g);g.pop();g.load(1);a.equal(g.score,0);a.equal(g.enemies.length,2);a.equal(g.phase,'playing');a.equal(g.lives,3)});
