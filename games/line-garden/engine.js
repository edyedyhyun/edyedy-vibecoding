/* Original grid territory game. Shared by browser and node:test. */
(function(root){
class LineGarden {
 constructor({cols=28,rows=24,goal=70}={}) {Object.assign(this,{cols,rows,goal});this.reset();}
 reset(){this.grid=Array.from({length:this.rows},(_,y)=>Array.from({length:this.cols},(_,x)=>x===0||y===0||x===this.cols-1||y===this.rows-1?1:0));this.player={x:Math.floor(this.cols/2),y:0};this.anchor={...this.player};this.trail=[];this.lives=3;this.state='ready';this.elapsed=0;this.captures=0;this.lastGain=0;this.message='안전한 테두리에서 시작하세요';this.enemies=[{x:6,y:8,dx:1,dy:1},{x:21,y:17,dx:-1,dy:-1}].map(e=>({...e,x:Math.min(e.x,this.cols-2),y:Math.min(e.y,this.rows-2)}));this.enemyClock=0;}
 start(){if(this.state==='ready'||this.state==='paused')this.state='playing';}
 pause(){if(this.state==='playing')this.state='paused';}
 percent(){let n=0;for(let y=1;y<this.rows-1;y++)for(let x=1;x<this.cols-1;x++)if(this.grid[y][x]===1)n++;return n/((this.cols-2)*(this.rows-2))*100;}
 move(dx,dy){if(this.state!=='playing'||Math.abs(dx)+Math.abs(dy)!==1)return;const x=this.player.x+dx,y=this.player.y+dy;if(x<0||y<0||x>=this.cols||y>=this.rows)return;if(this.grid[y][x]===2){this.message='그어진 선으로 되돌아갈 수 없어요';return;}
 if(!this.trail.length&&this.grid[y][x]===0)this.anchor={...this.player};this.player={x,y};
 if(this.grid[y][x]===0){this.grid[y][x]=2;this.trail.push({x,y});this.message='아직 내 땅이 아닙니다 — 안전한 땅으로 돌아오세요';if(this.enemies.some(e=>e.x===x&&e.y===y)){this.hit();return;}}
 else if(this.trail.length)this.capture();
 }
 capture(){const before=this.percent();for(const p of this.trail)this.grid[p.y][p.x]=1;this.trail=[];const seen=new Set(),queue=[];for(const e of this.enemies){const key=e.y*this.cols+e.x;if(this.grid[e.y][e.x]===0&&!seen.has(key)){seen.add(key);queue.push(e);}}
 for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){let x=p.x+dx,y=p.y+dy,k=y*this.cols+x;if(x>=0&&y>=0&&x<this.cols&&y<this.rows&&this.grid[y][x]===0&&!seen.has(k)){seen.add(k);queue.push({x,y});}}}
 for(let y=1;y<this.rows-1;y++)for(let x=1;x<this.cols-1;x++)if(this.grid[y][x]===0&&!seen.has(y*this.cols+x))this.grid[y][x]=1;
 this.captures++;this.lastGain=this.percent()-before;this.message=`영역 확보 +${this.lastGain.toFixed(1)}%`;if(this.percent()>=this.goal){this.state='won';this.message='정원을 충분히 넓혔습니다!';}}
 hit(){for(const p of this.trail)this.grid[p.y][p.x]=0;this.trail=[];this.player={...this.anchor};this.lives--;this.message='선이 끊겼습니다. 완성한 땅은 남아 있어요';if(this.lives<=0){this.state='lost';this.message='다음에는 조금 일찍 돌아와 볼까요?';}}
 tick(dt){if(this.state!=='playing')return;dt=Math.max(0,Math.min(dt,.25));this.elapsed+=dt;this.enemyClock+=dt;while(this.enemyClock>=.22&&this.state==='playing'){this.enemyClock-=.22;for(const e of this.enemies){let nx=e.x+e.dx,ny=e.y+e.dy;const solid=(x,y)=>!this.grid[y]||this.grid[y][x]===undefined||this.grid[y][x]===1;if(solid(nx,e.y))e.dx*=-1;if(solid(e.x,ny))e.dy*=-1;nx=e.x+e.dx;ny=e.y+e.dy;if(solid(nx,ny)){e.dx*=-1;e.dy*=-1;nx=e.x+e.dx;ny=e.y+e.dy;}if(solid(nx,ny))continue;if(this.grid[ny][nx]===2)this.hit();e.x=nx;e.y=ny;if(this.state!=='playing')break;}}}
}
if(typeof module!=='undefined'&&module.exports)module.exports=LineGarden;else root.LineGarden=LineGarden;
})(typeof globalThis!=='undefined'?globalThis:this);
