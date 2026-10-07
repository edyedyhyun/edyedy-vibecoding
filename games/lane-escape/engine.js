(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LaneEscape=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const W=480,H=640,LANES=[140,240,340],PLAYER_Y=545,CHANGE=.22,DURATION=60;
function create(seed=731){return {mode:'ready',time:0,distance:0,speed:180,lane:1,x:240,vehicles:[],passed:0,rows:0,safe:1,next:1.1,seed:seed>>>0,road:0,message:'60초 동안 세 차선 사이의 길을 찾아보세요.'};}
function random(s){s.seed=(1664525*s.seed+1013904223)>>>0;return s.seed/4294967296;}
function start(s){if(s.mode==='ready')s.mode='playing';}
function move(s,d){if(s.mode!=='playing')return false;let lane=Math.max(0,Math.min(2,s.lane+Math.sign(d)));if(lane===s.lane)return false;s.lane=lane;s.message=['왼쪽 차선','가운데 차선','오른쪽 차선'][lane];return true;}
function spawn(s){let choices=[s.safe];if(s.safe>0)choices.push(s.safe-1);if(s.safe<2)choices.push(s.safe+1);s.safe=choices[Math.floor(random(s)*choices.length)];s.rows++;let blocked=[0,1,2].filter(l=>l!==s.safe);if(s.time<12)blocked=[blocked[Math.floor(random(s)*blocked.length)]];for(const l of blocked)s.vehicles.push({lane:l,x:LANES[l],y:-60,passed:false,color:l%2?'#edb751':'#8cadc6',row:s.rows});}
function step(s,dt){if(s.mode!=='playing')return;dt=Math.max(0,Math.min(.05,dt));s.time+=dt;s.speed=180+Math.min(s.time/45,1)*160;s.distance+=s.speed*dt/10;s.road=(s.road+s.speed*dt)%80;let delta=LANES[s.lane]-s.x;s.x+=Math.sign(delta)*Math.min(Math.abs(delta),100/CHANGE*dt);s.next-=dt;if(s.next<=0){spawn(s);s.next+=1.25-.35*Math.min(s.time/45,1);}
for(const v of s.vehicles){v.y+=s.speed*dt;if(Math.abs(v.x-s.x)<43&&Math.abs(v.y-PLAYER_Y)<65){s.mode='over';s.message='차와 부딪혔습니다. 다른 길로 다시 가 볼까요?';return;}if(!v.passed&&v.y>PLAYER_Y+68){v.passed=true;s.passed++;}}
s.vehicles=s.vehicles.filter(v=>v.y<H+80);if(s.time>=DURATION){s.time=DURATION;s.mode='clear';s.message='60초 완주! 다음엔 다른 흐름의 도로를 달려보세요.';}}
return {W,H,LANES,PLAYER_Y,CHANGE,DURATION,create,start,move,spawn,step};
});
