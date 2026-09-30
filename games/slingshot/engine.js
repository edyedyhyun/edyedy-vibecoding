(function(root){
'use strict';
const M=typeof module==='object'?require('./vendor/matter.min.js'):root.Matter;
const {Engine,Bodies,Body,Composite,Events}=M;
const DT=1000/120, ANCHOR={x:180,y:370};
const stages=[
 {name:'첫 번째 탑',hint:'아래 상자를 밀거나, 꼭대기의 민트 표적을 직접 맞혀 보세요.',boxes:[[665,450,46,58],[665,390,46,58]],targets:[[665,341]]},
 {name:'두 개의 지붕',hint:'두 표적을 공 세 개 안에 맞혀 보세요.',boxes:[[610,448,36,62],[694,448,36,62],[652,407,134,18],[806,447,48,64]],targets:[[652,376],[806,394]]},
 {name:'높이와 거리',hint:'가까운 탑과 먼 탑. 각도와 힘을 나눠 생각해 보세요.',boxes:[[610,450,42,58],[610,390,42,58],[825,450,46,58],[825,390,46,58],[825,330,46,58]],targets:[[610,341],[825,281]]}
];
function projectile(x,y){return Bodies.circle(x,y,17,{density:.007,restitution:.35,friction:.55,frictionAir:0,label:'ball'});}
function velocity(angle,power){const s=power/100*24,a=angle*Math.PI/180;return{x:Math.cos(a)*s,y:-Math.sin(a)*s};}
function predict(angle,power,obstacles=[]){const e=Engine.create();e.gravity.y=1;e.gravity.scale=.001;const b=projectile(ANCHOR.x,ANCHOR.y);Composite.add(e.world,b);Body.setVelocity(b,velocity(angle,power));for(const o of obstacles){const ghost=o.size?Bodies.rectangle(o.position.x,o.position.y,o.size.w,o.size.h,{isStatic:true,angle:o.angle}):Bodies.circle(o.position.x,o.position.y,o.circleRadius,{isStatic:true});Composite.add(e.world,ghost);}let hit=false;Events.on(e,'collisionStart',ev=>{if(ev.pairs.some(p=>p.bodyA===b||p.bodyB===b))hit=true;});const pts=[];for(let i=0;i<240;i++){Engine.update(e,DT);if(i%8===0||hit)pts.push({...b.position});if(hit)break;if(b.position.y>478||b.position.x>1030)break;}Engine.clear(e);return pts;}
class Game{
 constructor(level=0){this.load(level);}
 load(level){if(this.engine)Engine.clear(this.engine);this.level=level;this.engine=Engine.create({positionIterations:8,velocityIterations:8});this.engine.gravity.y=1;this.engine.gravity.scale=.001;this.boxes=[];this.targets=[];this.balls=[];this.hits=0;this.shots=3;this.phase='ready';this.time=0;this.paused=false;this.message=stages[level].hint;this.lastImpact=0;this.clearTime=0;
 Composite.add(this.engine.world,Bodies.rectangle(500,515,1400,70,{isStatic:true,friction:.8,label:'ground'}));
 for(const [x,y,w,h] of stages[level].boxes){const b=Bodies.rectangle(x,y,w,h,{density:.0015,friction:.6,frictionStatic:.8,restitution:.05,label:'box'});b.size={w,h};this.boxes.push(b);Composite.add(this.engine.world,b);}
 for(const [x,y] of stages[level].targets){const b=Bodies.circle(x,y,20,{density:.001,friction:.8,restitution:.05,label:'target'});b.alive=true;this.targets.push(b);Composite.add(this.engine.world,b);}
 for(let i=0;i<180;i++)Engine.update(this.engine,DT);
 this.initial=this.targets.map(b=>({...b.position}));
 Events.on(this.engine,'beforeUpdate',()=>{this.previous=new Map(Composite.allBodies(this.engine.world).map(b=>[b.id,{...b.velocity}]));});
 Events.on(this.engine,'collisionStart',ev=>{if(this.phase!=='flying')return;for(const p of ev.pairs){const va=this.previous.get(p.bodyA.id)||{x:0,y:0},vb=this.previous.get(p.bodyB.id)||{x:0,y:0};const speed=Math.hypot(va.x-vb.x,va.y-vb.y);for(const t of [p.bodyA,p.bodyB])if(t.label==='target'&&t.alive&&speed>2.7){t.alive=false;this.hits++;this.lastImpact=speed;}}});
 }
 launch(angle,power){if(this.paused||this.phase!=='ready'||this.shots<=0)return false;angle=Math.max(5,Math.min(75,Number(angle)));power=Math.max(20,Math.min(100,Number(power)));const b=projectile(ANCHOR.x,ANCHOR.y);Body.setVelocity(b,velocity(angle,power));Composite.add(this.engine.world,b);this.balls.push(b);this.active=b;this.shots--;this.phase='flying';this.time=0;this.message='공과 상자가 멈출 때까지 지켜보세요.';return true;}
 step(){if(this.paused||this.phase!=='flying')return;Engine.update(this.engine,DT);this.time+=DT/1000;
 for(const t of this.targets){if(t.alive&&(t.position.y>550||t.position.x>1070||t.position.x< -70)){t.alive=false;this.hits++;}if(!t.alive&&Composite.get(this.engine.world,t.id,'body'))Composite.remove(this.engine.world,t);}
 if(this.hits===this.targets.length){this.clearTime+=DT/1000;if(this.clearTime<1)return;this.phase='won';this.message=this.level===2?'세 판 모두 성공! 다른 각도로 다시 도전해 보세요.':'표적을 모두 맞혔어요. 다음 판으로 가 볼까요?';return;}
 const moving=[...this.boxes,...this.targets.filter(t=>t.alive),this.active].some(b=>b.position.x>-70&&b.position.x<1070&&b.position.y<550&&(b.speed>.18||Math.abs(b.angularVelocity)>.02));
 if((this.time>1.5&&!moving)||this.time>8){this.phase=this.shots?'ready':'lost';this.message=this.shots?'각도나 힘을 조금 바꿔 다시 당겨 보세요.':'공을 다 썼어요. 같은 판에서 다시 도전할 수 있어요.';}
 }
}
const api={Game,stages,ANCHOR,DT,velocity,predict};if(typeof module==='object')module.exports=api;else root.Sling=api;
})(typeof globalThis!=='undefined'?globalThis:this);
