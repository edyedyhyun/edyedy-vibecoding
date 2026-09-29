(function(root){
'use strict';
const W=500,H=760,R=9;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
class Pinball{
 constructor(){this.reset();}
 reset(){this.score=0;this.lives=3;this.hits=0;this.elapsed=0;this.mode='ready';this.power=1;this.ball=null;this.input={left:false,right:false};this.flippers=[{x:142,y:638,a:.35,target:.35,w:0},{x:358,y:638,a:Math.PI-.35,target:Math.PI-.35,w:0}];this.bumpers=[{x:178,y:225,r:29,cool:0,flash:0},{x:322,y:225,r:29,cool:0,flash:0},{x:250,y:340,r:32,cool:0,flash:0}];}
 launch(){if(this.mode!=='ready')return;this.ball={x:443,y:500,vx:-155,vy:-880};this.mode='playing';}
 pause(){if(this.mode==='playing'){this.mode='paused';this.release();}else if(this.mode==='paused')this.mode='playing';}
 release(){this.input.left=false;this.input.right=false;}
 segment(ax,ay,bx,by,restitution=0.8,moving=null){let b=this.ball;if(!b)return;const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy,t=clamp(((b.x-ax)*dx+(b.y-ay)*dy)/l2,0,1),px=ax+t*dx,py=ay+t*dy;let nx=b.x-px,ny=b.y-py,d=Math.hypot(nx,ny),radius=R+(moving?8:3);if(d>=radius)return;if(d<.0001){nx=-dy;ny=dx;d=Math.hypot(nx,ny);}nx/=d;ny/=d;b.x=px+nx*radius;b.y=py+ny*radius;let svx=0,svy=0;if(moving){svx=-moving.w*(py-moving.y);svy=moving.w*(px-moving.x);}const vn=(b.vx-svx)*nx+(b.vy-svy)*ny;if(vn<0){b.vx-=(1+restitution)*vn*nx;b.vy-=(1+restitution)*vn*ny;}}
 step(dt){if(this.mode!=='playing')return;const n=Math.ceil(Math.min(dt,.05)/(1/480)),h=Math.min(dt,.05)/n;for(let k=0;k<n&&this.mode==='playing';k++)this.tick(h);}
 tick(h){const b=this.ball;this.elapsed+=h;for(let i=0;i<2;i++){let f=this.flippers[i];f.target=i?(this.input.right?Math.PI+.50:Math.PI-.35):(this.input.left?-.50:.35);let old=f.a;f.a+=clamp(f.target-f.a,-h*13*this.power,h*13*this.power);f.w=(f.a-old)/h;}
 b.vy+=880*h;b.vx*=Math.exp(-.08*h);b.x+=b.vx*h;b.y+=b.vy*h;
 this.segment(26,90,26,554);this.segment(26,90,92,35);this.segment(92,35,408,35);this.segment(408,35,474,90);this.segment(474,90,474,554);this.segment(26,554,127,630);this.segment(474,554,373,630);
 for(const a of this.bumpers){a.cool=Math.max(0,a.cool-h);a.flash=Math.max(0,a.flash-h);let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),r=R+a.r;if(d<r){if(d<.001){dx=0;dy=-1;d=1;}let nx=dx/d,ny=dy/d;b.x=a.x+nx*r;b.y=a.y+ny*r;let vn=b.vx*nx+b.vy*ny;if(vn<0){b.vx-=1.85*vn*nx;b.vy-=1.85*vn*ny;b.vx+=nx*140;b.vy+=ny*140;if(!a.cool){this.score+=100;this.hits++;a.cool=.15;a.flash=.18;}}}}
 for(const f of this.flippers)this.segment(f.x,f.y,f.x+Math.cos(f.a)*96,f.y+Math.sin(f.a)*96,.72,f);
 const speed=Math.hypot(b.vx,b.vy);if(speed>1350){b.vx*=1350/speed;b.vy*=1350/speed;}
 if(b.y>H+R){this.lives--;this.ball=null;this.release();this.mode=this.lives?'ready':'over';}
 }
}
if(typeof module!=='undefined')module.exports={Pinball,W,H,R};else root.Pinball=Pinball;
})(typeof window!=='undefined'?window:globalThis);
