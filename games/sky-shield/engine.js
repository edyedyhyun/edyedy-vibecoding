(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.SkyShield=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';const W=640,H=480,GROUND=420,BASES=[80,320,560],SPEED=220,RADIUS=58;
function create(){return {mode:'ready',wave:1,time:0,spawned:0,next:1,enemies:[],shots:[],bursts:[],bases:[true,true,true],ammo:18,score:0,hit:0,missed:0,cooldown:0,aim:null,message:'세 기지를 지키세요. 빈 하늘을 눌러 방어탄을 보냅니다.'};}
function start(s){if(s.mode==='ready')s.mode='playing';}
function fire(s,x,y){if(s.mode!=='playing'||s.ammo<=0||s.cooldown>0)return false;x=Math.max(16,Math.min(W-16,x));y=Math.max(24,Math.min(350,y));s.shots.push({x:320,y:GROUND,tx:x,ty:y});s.ammo--;s.cooldown=.18;s.aim={x,y};s.message='목표 지점으로 방어탄을 보냈습니다.';return true;}
function radius(b){return b.max*Math.max(0,b.age<.55?b.age/.55:1-(b.age-.55)/1.05);}
function spawn(s){const order=[0,2,1,0,2,1,0,1,2,1],lane=order[s.spawned%order.length],target=BASES[lane],x=s.wave===1?target:Math.max(20,Math.min(620,target+(s.spawned%2?120:-120)));let dx=target-x,dy=GROUND;const d=Math.hypot(dx,dy),speed=55+(s.wave-1)*12;s.enemies.push({x,y:0,fromX:x,vx:dx/d*speed,vy:dy/d*speed,target:lane});s.spawned++;}
function step(s,dt){if(s.mode!=='playing')return;dt=Math.max(0,Math.min(.05,dt));s.time+=dt;s.cooldown=Math.max(0,s.cooldown-dt);const count=6+(s.wave-1)*2;s.next-=dt;if(s.next<=0&&s.spawned<count){spawn(s);s.next+=2-(s.wave-1)*.2;}
for(const b of s.bursts)b.age+=dt;s.bursts=s.bursts.filter(b=>b.age<1.6);
const pending=[];s.shots=s.shots.filter(a=>{let dx=a.tx-a.x,dy=a.ty-a.y,d=Math.hypot(dx,dy);if(d<=SPEED*dt){pending.push({x:a.tx,y:a.ty,age:0,max:RADIUS});return false;}a.x+=dx/d*SPEED*dt;a.y+=dy/d*SPEED*dt;return true;});s.bursts.push(...pending);
for(const e of s.enemies){e.x+=e.vx*dt;e.y+=e.vy*dt;}
const chain=[];s.enemies=s.enemies.filter(e=>{if(s.bursts.some(b=>Math.hypot(e.x-b.x,e.y-b.y)<=radius(b)+4)){s.score+=100;s.hit++;chain.push({x:e.x,y:e.y,age:0,max:32});return false;}if(e.y>=GROUND){s.bases[e.target]=false;s.missed++;return false;}return true;});s.bursts.push(...chain);
if(!s.bases.some(Boolean)){s.mode='over';s.message='세 기지가 모두 멈췄습니다. 다시 조준해 볼까요?';}else if(s.spawned>=count&&s.enemies.length===0&&s.shots.length===0){s.mode='clear';s.message=s.wave===3?'세 차례 방어 완료!':'이번 하늘을 지켰습니다. 다음 차례로 갈 수 있습니다.';}}
function next(s){if(s.mode!=='clear'||s.wave>=3)return false;s.wave++;s.time=0;s.spawned=0;s.next=1;s.ammo=18;s.cooldown=0;s.bursts=[];s.shots=[];s.aim=null;s.mode='playing';s.message='기지는 유지하고 방어탄 18발을 새로 받았습니다.';return true;}
return {W,H,GROUND,BASES,SPEED,RADIUS,create,start,fire,radius,spawn,step,next};
});
