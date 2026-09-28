(function(root){
'use strict';
const N=15, DIR=[[0,-1],[1,0],[0,1],[-1,0]];
const MAPS=[
['...............','...............','..BB..S.S..BB..','..BB.......BB..','......BBB......','SS.BB.....BB.SS','...BB..S..BB...','.......S.......','..SS.......SS..','.....BB.BB.....','..B.........B..','..B..SS.SS..B..','...............','......BBB......','......B.B......'],
['...............','...............','..SS..BBB..SS..','.......B.......','BBB.S.....S.BBB','....S.....S....','..B...BBB...B..','..B.........B..','SS...SS.SS...SS','.....B...B.....','..BB.......BB..','.....S...S.....','...............','......BBB......','......B.B......'],
['...............','...............','...BB..S..BB...','SS.....S.....SS','.....B...B.....','..SS.B...B.SS..','.......B.......','BBB.S.....S.BBB','....S.....S....','..B...S.S...B..','..B.........B..','.....BB.BB.....','...............','......BBB......','......B.B......']
];
class Game{
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(){this.stage=0;this.score=0;this.lives=3;this.load();this.state='ready';}
 load(){this.map=MAPS[this.stage].map(r=>r.split(''));this.player={x:5,y:14,dir:0,move:0,fire:0,immune:2};this.base={x:7,y:14,alive:true};this.enemies=[];this.bullets=[];this.effects=[];this.spawn=1.4;this.remaining=5+this.stage*2;this.state='playing';this.reason='';}
 start(){if(this.state==='ready')this.state='playing';}
 pause(){if(this.state==='playing')this.state='paused';else if(this.state==='paused')this.state='playing';}
 next(){if(this.state==='stageclear'){this.stage++;this.load();}}
 tile(x,y){return x<0||y<0||x>=N||y>=N?'S':this.map[y][x];}
 blocked(x,y,actor){return this.tile(x,y)!=='.'||(x===7&&y===14)||this.enemies.some(e=>e!==actor&&e.x===x&&e.y===y)||(actor!==this.player&&this.player.x===x&&this.player.y===y);}
 shoot(actor,team){if(actor.fire>0)return;actor.fire=team==='player'?.28:1.15-this.stage*.1;const d=DIR[actor.dir];this.bullets.push({x:actor.x+.5+d[0]*.48,y:actor.y+.5+d[1]*.48,dir:actor.dir,team});}
 route(e){ // Breadth-first routing through breakable bricks; steel and base are excluded.
 const q=[[e.x,e.y,-1]], seen=new Set([e.x+','+e.y]);
 for(let i=0;i<q.length;i++){const [x,y,first]=q[i];if((x===7&&y===13)||(x===6&&y===14)||(x===8&&y===14))return first;
 for(let k=0;k<4;k++){const [dx,dy]=DIR[k],nx=x+dx,ny=y+dy,key=nx+','+ny;if(nx<0||ny<0||nx>=N||ny>=N||this.tile(nx,ny)==='S'||(nx===7&&ny===14)||seen.has(key))continue;seen.add(key);q.push([nx,ny,first<0?k:first]);}}
 return 2;}
 hitPlayer(){if(this.player.immune>0)return;this.lives--;this.effects.push({x:this.player.x+.5,y:this.player.y+.5,t:.35});if(this.lives<=0){this.state='lost';this.reason='탱크를 모두 잃었습니다.';}else {const spots=[[5,14],[9,14],[4,13],[10,13],[1,14]];const p=spots.find(([x,y])=>!this.blocked(x,y,this.player))||[5,14];Object.assign(this.player,{x:p[0],y:p[1],immune:2,move:.2,fire:.2});}}
 step(dt,input={}){if(this.state!=='playing')return;dt=Math.min(Math.max(dt,0),.1);while(dt>1e-8&&this.state==='playing'){const d=Math.min(dt,.012);this.tick(d,input);dt-=d;}}
 tick(dt,input){const p=this.player;p.move-=dt;p.fire=Math.max(0,p.fire-dt);p.immune=Math.max(0,p.immune-dt);
 if(Number.isInteger(input.dir)&&input.dir>=0&&input.dir<4){p.dir=input.dir;if(p.move<=0){const d=DIR[p.dir];if(!this.blocked(p.x+d[0],p.y+d[1],p)){p.x+=d[0];p.y+=d[1];}p.move=.13;}}
 if(input.fire)this.shoot(p,'player');
 this.spawn-=dt;if(this.remaining>0&&this.enemies.length<3&&this.spawn<=0){const xs=[1,7,13],x=xs[Math.floor(this.random()*3)];if(!this.blocked(x,0,null)){this.enemies.push({x,y:0,dir:2,move:.6,fire:1});this.remaining--;this.spawn=2.5;}else this.spawn=.4;}
 for(const e of this.enemies){e.move-=dt;e.fire=Math.max(0,e.fire-dt);if(e.move<=0){if(Math.abs(e.x-7)+Math.abs(e.y-14)===1){e.dir=e.x<7?1:e.x>7?3:2;}else{e.dir=this.route(e);const d=DIR[e.dir];if(!this.blocked(e.x+d[0],e.y+d[1],e)){e.x+=d[0];e.y+=d[1];}}e.move=.44-this.stage*.045;}this.shoot(e,'enemy');}
 const keep=[];for(const b of this.bullets){const d=DIR[b.dir];b.x+=d[0]*8*dt;b.y+=d[1]*8*dt;const x=Math.floor(b.x),y=Math.floor(b.y),tile=this.tile(x,y);let hit=false;
 if(tile!=='.'){hit=true;if(tile==='B'){this.map[y][x]='.';this.effects.push({x:x+.5,y:y+.5,t:.22});}}
 else if(x===7&&y===14){hit=true;if(b.team==='enemy'){this.base.alive=false;this.state='lost';this.reason='기지가 파괴되었습니다.';}}
 else if(b.team==='player'){const e=this.enemies.find(e=>e.x===x&&e.y===y);if(e){this.enemies=this.enemies.filter(a=>a!==e);this.score+=100;this.effects.push({x:x+.5,y:y+.5,t:.3});hit=true;}}
 else if(x===p.x&&y===p.y){this.hitPlayer();hit=true;}
 if(!hit)keep.push(b);if(this.state==='lost')break;}
 this.bullets=keep;this.effects=this.effects.filter(e=>(e.t-=dt)>0);
 if(this.state==='playing'&&this.remaining===0&&this.enemies.length===0){this.bullets=[];this.state=this.stage===2?'won':'stageclear';}
 }
}
const api={Game,N,DIR,MAPS};if(typeof module!=='undefined')module.exports=api;else root.TankGuard=api;
})(typeof window!=='undefined'?window:globalThis);
