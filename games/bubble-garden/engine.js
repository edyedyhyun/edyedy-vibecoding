(function(root){'use strict';
const W=960,H=540,DT=1/120;
const levels=[
 {name:'방울 하나부터',platforms:[],enemies:[{x:390,y:461,min:300,max:820,speed:36}]},
 {name:'한 층 올라가서',platforms:[{x:300,y:355,w:360}],enemies:[{x:710,y:461,min:520,max:850,speed:42},{x:500,y:336,min:330,max:630,speed:34}]},
 {name:'높은 곳의 방울',platforms:[{x:210,y:355,w:265},{x:545,y:355,w:205},{x:365,y:230,w:235}],enemies:[{x:775,y:461,min:560,max:865,speed:52},{x:330,y:336,min:235,max:448,speed:40},{x:460,y:211,min:390,max:570,speed:32}]}
];
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
class Game{
 constructor(){this.level=0;this.score=0;this.load(0);}
 load(level){this.level=level;this.score=0;this.phase='playing';this.paused=false;this.lives=3;this.player={x:110,y:460,vy:0,face:1,grounded:true,invuln:0};this.enemies=levels[level].enemies.map((e,i)=>({...e,id:i,dir:-1,state:'free',timer:0,homeY:e.y}));this.bubbles=[];this.effects=[];this.cooldown=0;this.popped=0;this.captures=0;this.escapes=0;this.message='Z로 가두고, 가까이에서 X로 터뜨리세요.';this.event='ready';}
 jump(){if(this.paused||this.phase!=='playing'||!this.player.grounded)return false;this.player.vy=-570;this.player.grounded=false;return true;}
 fire(){if(this.paused||this.phase!=='playing'||this.cooldown>0)return false;const p=this.player;this.bubbles.push({x:p.x+p.face*27,y:p.y-4,vx:p.face*340,age:0});this.cooldown=.32;return true;}
 pop(){if(this.paused||this.phase!=='playing')return 0;let n=0;for(const e of this.enemies){if(e.state==='trapped'&&distance(e,this.player)<=120){e.state='gone';this.score+=100;this.popped++;n++;this.effects.push({x:e.x,y:e.y,age:0});}}this.message=n?`톡! ${n}개를 터뜨렸어요. +${n*100}`:'가둔 방울에 조금 더 가까이 가세요.';this.event=n?'pop':'too-far';if(this.popped===this.enemies.length){this.phase='won';this.message=this.level===2?'정원 정리 끝! 세 판을 모두 마쳤어요.':'모든 방울을 터뜨렸어요. 다음 정원으로!';}return n;}
 step(input={},dt=DT){if(this.paused||this.phase!=='playing')return;dt=Math.min(dt,1/30);const p=this.player;this.cooldown=Math.max(0,this.cooldown-dt);p.invuln=Math.max(0,p.invuln-dt);const dir=(input.right?1:0)-(input.left?1:0);if(dir)p.face=dir;p.x=Math.max(24,Math.min(W-24,p.x+dir*220*dt));const oldFeet=p.y+20;p.vy+=1150*dt;p.y+=p.vy*dt;p.grounded=false;for(const s of [{x:0,y:480,w:960},...levels[this.level].platforms]){if(p.vy>=0&&oldFeet<=s.y+.1&&p.y+20>=s.y&&p.x+14>s.x&&p.x-14<s.x+s.w){p.y=s.y-20;p.vy=0;p.grounded=true;}}
 for(const b of this.bubbles){b.age+=dt;b.x+=b.vx*dt;if(b.age>.55){b.vx*=Math.pow(.07,dt);b.y-=58*dt;}for(const e of this.enemies){if(e.state==='free'&&distance(b,e)<36){e.state='trapped';e.timer=6;this.captures++;this.event='capture';this.message='가두기 성공! 6초 안에 가까이에서 X를 누르세요.';b.age=99;break;}}}
 this.bubbles=this.bubbles.filter(b=>b.age<3&&b.x>-30&&b.x<W+30&&b.y>-30);
 for(const e of this.enemies){if(e.state==='trapped'){e.timer-=dt;e.y=Math.max(70,e.y-25*dt);if(e.timer<=0){e.state='free';e.y=e.homeY;e.x=Math.max(e.min,Math.min(e.max,e.x));this.escapes++;this.message='시간이 지나 풀려났어요. 다시 가둬야 해요.';this.event='escape';}}
 else if(e.state==='free'){e.x+=e.dir*e.speed*dt;if(e.x<e.min){e.x=e.min;e.dir=1;}if(e.x>e.max){e.x=e.max;e.dir=-1;}if(p.invuln<=0&&Math.abs(e.x-p.x)<32&&Math.abs(e.y-p.y)<35){this.lives--;p.invuln=1.7;p.x=110;p.y=460;p.vy=0;p.grounded=true;this.message='앗, 닿았어요. 잠깐 반짝일 때 자리를 잡으세요.';this.event='hurt';if(!this.lives){this.phase='lost';this.message='기회를 모두 썼어요. 이 판에서 다시 시작해 보세요.';}}}}
 this.effects.forEach(e=>e.age+=dt);this.effects=this.effects.filter(e=>e.age<.6);
 }
}
const api={Game,levels,W,H,DT};if(typeof module==='object')module.exports=api;else root.BubbleGarden=api;
})(typeof globalThis!=='undefined'?globalThis:this);
