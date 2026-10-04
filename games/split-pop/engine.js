(function(root){'use strict';
const W=800,H=440,FLOOR=392,R=[13,24,42],SPEED=[145,112,84],BOUNCE=[220,310,395];
function ball(x,y,size,vx){return{x,y,size,r:R[size],vx:vx??SPEED[size],vy:0};}
function create(stage=0,score=0,lives=3){const sets=[[ball(400,100,2,84)],[ball(215,100,2,84),ball(600,170,1,-112)],[ball(160,100,2,84),ball(640,100,2,-84)]];return{stage,score,lives,balls:sets[stage],player:{x:400,y:FLOOR-17,r:13},shots:[],cooldown:0,invincible:1.5,time:0,status:'ready',hits:0};}
function start(s){if(s.status==='ready')s.status='playing';}
function fire(s){if(s.status!=='playing'||s.cooldown>0||s.shots.length>=2)return false;s.shots.push({x:s.player.x,top:FLOOR-32,bottom:FLOOR-4,age:0});s.cooldown=.28;return true;}
function split(s,index){const b=s.balls[index];s.balls.splice(index,1);s.score+=(3-b.size)*100;s.hits++;if(b.size){let z=b.size-1;for(let d of[-1,1]){let n=ball(Math.max(R[z],Math.min(W-R[z],b.x+d*R[z]*.55)),Math.min(FLOOR-R[z],b.y),z,d*SPEED[z]);n.vy=-BOUNCE[z]*.8;s.balls.push(n);}}if(!s.balls.length)s.status='clear';}
function shotHit(q,b){let y=Math.max(q.top,Math.min(q.bottom,b.y));return (q.x-b.x)**2+(y-b.y)**2<=b.r*b.r;}
function step(s,dt,input={}){if(s.status!=='playing')return;dt=Math.max(0,Math.min(dt,.05));s.time+=dt;s.cooldown=Math.max(0,s.cooldown-dt);s.invincible=Math.max(0,s.invincible-dt);s.player.x=Math.max(18,Math.min(W-18,s.player.x+(Number(!!input.right)-Number(!!input.left))*250*dt));if(input.fire)fire(s);
for(const b of s.balls){b.vy+=600*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx)}if(b.x>W-b.r){b.x=W-b.r;b.vx=-Math.abs(b.vx)}if(b.y>=FLOOR-b.r){b.y=FLOOR-b.r;b.vy=-BOUNCE[b.size]}if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy)}}
for(let i=s.shots.length-1;i>=0;i--){let q=s.shots[i];q.top=Math.max(12,q.top-620*dt);q.age+=dt;let idx=s.balls.findIndex(b=>shotHit(q,b));if(idx>=0){s.shots.splice(i,1);split(s,idx);}else if(q.age>.95)s.shots.splice(i,1);}
if(s.status!=='playing')return;
if(s.invincible===0&&s.balls.some(b=>(b.x-s.player.x)**2+(b.y-s.player.y)**2<(b.r+s.player.r)**2)){s.lives--;s.invincible=1.8;s.shots=[];if(s.lives<=0)s.status='over';}
}
const api={W,H,FLOOR,R,SPEED,BOUNCE,ball,create,start,fire,split,shotHit,step};if(typeof module!=='undefined')module.exports=api;else root.SplitPop=api;
})(typeof globalThis!=='undefined'?globalThis:this);
