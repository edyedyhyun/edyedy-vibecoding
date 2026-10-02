(function(root){'use strict';
const W=960,H=480,DT=1/120;
const solids=[{x:0,y:420,w:620,h:60},{x:710,y:420,w:940,h:60},{x:270,y:324,w:130,h:96},{x:430,y:268,w:150,h:20},{x:1040,y:330,w:140,h:20},{x:1220,y:280,w:120,h:20}];
const profiles={prototype:{speed:220,jump:520,gravity:1800,coyote:0,buffer:0},tuned:{speed:220,jump:610,gravity:1700,coyote:.09,buffer:.12}};
class Game{
 constructor(profile='tuned'){this.profile=profile;this.config={...profiles[profile]};this.reset();}
 reset(){this.player={x:85,y:399,vx:0,vy:0,w:28,h:42,grounded:true,face:1};this.phase='playing';this.paused=false;this.deaths=0;this.elapsed=0;this.checkpoint=false;this.coins=[{x:335,y:296,taken:false},{x:500,y:240,taken:false},{x:1120,y:302,taken:false}];this.coyote=this.config.coyote;this.buffer=0;this.maxJumpRise=0;this.jumpStartY=399;this.jumps=0;this.camera=0;this.message='첫 발판을 넘어 깃발까지 가 보세요.';}
 requestJump(){if(this.paused||this.phase!=='playing')return false;if(this.player.grounded||this.coyote>0){this.doJump();return true;}this.buffer=this.config.buffer;return false;}
 doJump(){let p=this.player;p.vy=-this.config.jump;p.grounded=false;this.coyote=0;this.buffer=0;this.jumpStartY=p.y;this.maxJumpRise=0;this.jumps++;this.message='점프! 발판 끝과 착지 위치를 보세요.';}
 respawn(){this.deaths++;this.player={x:this.checkpoint?745:85,y:399,vx:0,vy:0,w:28,h:42,grounded:true,face:1};this.buffer=0;this.coyote=this.config.coyote;this.message=this.checkpoint?'중간 깃발부터 다시 출발해요.':'발을 헛디뎠어요. 시작점에서 다시!';}
 step(input={},dt=DT){if(this.paused||this.phase!=='playing')return;dt=Math.min(dt,1/30);this.elapsed+=dt;let p=this.player;const dir=(input.right?1:0)-(input.left?1:0);p.vx=dir*this.config.speed;if(dir)p.face=dir;
 this.buffer=Math.max(0,this.buffer-dt);this.coyote=Math.max(0,this.coyote-dt);if(p.grounded)this.coyote=this.config.coyote;
 p.x+=p.vx*dt;for(const s of solids){if(p.y+p.h/2>s.y+.1&&p.y-p.h/2<s.y+s.h-.1&&p.x+p.w/2>s.x&&p.x-p.w/2<s.x+s.w){if(p.vx>0)p.x=s.x-p.w/2;else if(p.vx<0)p.x=s.x+s.w+p.w/2;}}
 p.x=Math.max(p.w/2,Math.min(1635,p.x));const oldBottom=p.y+p.h/2,oldTop=p.y-p.h/2;p.vy+=this.config.gravity*dt;p.y+=p.vy*dt;p.grounded=false;
 for(const s of solids){if(p.x+p.w/2<=s.x||p.x-p.w/2>=s.x+s.w)continue;if(p.vy>=0&&oldBottom<=s.y+.1&&p.y+p.h/2>=s.y){p.y=s.y-p.h/2;p.vy=0;p.grounded=true;}else if(p.vy<0&&oldTop>=s.y+s.h-.1&&p.y-p.h/2<s.y+s.h){p.y=s.y+s.h+p.h/2;p.vy=0;}}
 this.maxJumpRise=Math.max(this.maxJumpRise,this.jumpStartY-p.y);if(p.grounded&&this.buffer>0)this.doJump();
 for(const coin of this.coins){if(!coin.taken&&Math.hypot(p.x-coin.x,p.y-coin.y)<32){coin.taken=true;this.message='별 하나! 깃발까지 계속 가 보세요.';}}
 if(!this.checkpoint&&p.x>730&&p.grounded){this.checkpoint=true;this.message='중간 깃발 저장. 떨어져도 여기서 다시!';}
 if(p.y>H+80)this.respawn();if(p.x>=1530&&p.grounded){this.phase='won';this.message='도착! 별을 모두 모으지 않아도 완주할 수 있어요.';}
 this.camera=Math.max(0,Math.min(690,p.x-350));}
}
const api={Game,solids,profiles,W,H,DT};if(typeof module==='object')module.exports=api;else root.CloudTrail=api;
})(typeof globalThis!=='undefined'?globalThis:this);
