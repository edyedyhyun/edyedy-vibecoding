(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FruitLoft=factory()})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const W=800,H=540,FLOORS=[480,360,240,120],LADDERS=[{x:180,from:0,to:1},{x:650,from:1,to:2},{x:250,from:2,to:3}];
const layouts=[[[105,390,680],[85,310,520],[95,420,725],[95,445,705]],[[100,350,690],[70,400,735],[130,460,710],[80,430,720]],[[110,430,715],[85,355,725],[65,370,700],[90,450,730]]];
function create(stage=0,score=0,lives=3){return{stage,score,lives,status:'ready',time:0,invincible:1.5,player:{x:50,y:480,vy:0,floor:0,climbing:null,face:1},fruits:layouts[stage].flatMap((xs,f)=>xs.map((x,i)=>({x,y:FLOORS[f]-22,floor:f,kind:(i+f)%3,taken:false}))),enemies:[{x:540,y:480,v:55+stage*12,min:310,max:755},{x:470,y:360,v:-52-stage*10,min:310,max:755},{x:120,y:240,v:48+stage*12,min:45,max:560},{x:600,y:120,v:-48-stage*10,min:340,max:755}],collected:0,notice:'과일 12개를 모으면 다음 창고로 갈 수 있어요.'};}
function start(s){if(s.status==='ready')s.status='playing'}
function jump(s){let p=s.player;if(s.status!=='playing'||p.climbing||p.floor===null)return false;p.vy=-380;p.floor=null;return true;}
function climb(s,dir){let p=s.player;if(s.status!=='playing'||p.climbing||p.floor===null)return false;let l=LADDERS.find(l=>Math.abs(l.x-p.x)<=25&&(dir<0?l.from===p.floor:l.to===p.floor));if(!l){s.notice='사다리 가까이에서 위·아래를 눌러 주세요.';return false;}p.x=l.x;p.climbing={target:dir<0?l.to:l.from};p.floor=null;p.vy=0;return true;}
function hurt(s){if(s.invincible>0)return false;s.lives--;s.invincible=1.8;s.notice='앗! 모은 과일은 유지됩니다. 잠시 보호돼요.';if(s.lives<=0){s.status='over';return true;}s.player={x:50,y:480,vy:0,floor:0,climbing:null,face:1};return true;}
function step(s,dt,input={}){if(s.status!=='playing')return;dt=Math.min(Math.max(dt,0),.05);s.time+=dt;s.invincible=Math.max(0,s.invincible-dt);let p=s.player;
if(p.climbing){let target=p.climbing.target,y=FLOORS[target],d=Math.sign(y-p.y);p.y+=d*125*dt;if((d<0&&p.y<=y)||(d>0&&p.y>=y)){p.y=y;p.floor=target;p.climbing=null;s.notice=`${target+1}층에 도착했어요. 남은 과일을 찾아보세요.`;}}
else{let dir=(input.right?1:0)-(input.left?1:0);p.x=Math.max(22,Math.min(W-22,p.x+dir*165*dt));if(dir)p.face=dir;
if(p.floor===null){let prev=p.y;p.vy+=900*dt;p.y+=p.vy*dt;if(p.vy>=0){let landing=FLOORS.map((y,i)=>({y,i})).filter(f=>prev<=f.y&&p.y>=f.y).sort((a,b)=>a.y-b.y)[0];if(landing){p.y=landing.y;p.floor=landing.i;p.vy=0}}}}
for(let f of s.fruits){if(!f.taken&&Math.abs(f.x-p.x)<22&&Math.abs(f.y-(p.y-20))<26){f.taken=true;s.collected++;s.score+=100;s.notice=`모은 과일 ${s.collected}/12`;}}
for(let e of s.enemies){e.x+=e.v*dt;if(e.x<e.min){e.x=e.min;e.v=Math.abs(e.v)}if(e.x>e.max){e.x=e.max;e.v=-Math.abs(e.v)}if(Math.abs(e.x-p.x)<25&&Math.abs((e.y-12)-(p.y-20))<24){hurt(s);if(s.status==='over')return;}}
if(s.collected===s.fruits.length){s.status='clear';s.notice=s.stage===2?'세 창고의 과일을 모두 모았어요!':'과일을 모두 모았어요. 다음 창고도 열렸습니다.';}}
return{W,H,FLOORS,LADDERS,create,start,jump,climb,hurt,step};});
