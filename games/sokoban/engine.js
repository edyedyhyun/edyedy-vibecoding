(function(root){
'use strict';
const levels=[
 {name:'한 걸음 뒤에서',map:['#######','#     #','#  .  #','#  $  #','#  @  #','#     #','#######']},
 {name:'돌아가는 길',map:['########','#      #','# .  . #','# $  $ #','#   @  #','#      #','########']},
 {name:'좁은 창고',map:['########','#  .   #','#  $   #','# # #  #','# $@ . #','#      #','########']},
 {name:'자리 바꾸기',map:['########','# .  . #','#  $$  #','#  #   #','#  @   #','#      #','########']},
 {name:'세 개의 짐',map:['########','# . . .#','# $ $ $#','#      #','#  @   #','#      #','########']}
];
const key=(x,y)=>`${x},${y}`;
function create(map){const s={width:map[0].length,height:map.length,walls:[],goals:[],boxes:[],player:null,moves:0,pushes:0,history:[]};map.forEach((row,y)=>{if(row.length!==s.width)throw Error('Uneven map');[...row].forEach((c,x)=>{let p=key(x,y);if(c==='#')s.walls.push(p);if('.+*'.includes(c))s.goals.push(p);if('$*'.includes(c))s.boxes.push(p);if('@+'.includes(c)){if(s.player)throw Error('Multiple players');s.player=p;}})});if(!s.player||s.boxes.length!==s.goals.length||!s.boxes.length)throw Error('Invalid map');return s;}
const has=(a,x,y)=>a.includes(key(x,y));
function wall(s,x,y){return x<0||y<0||x>=s.width||y>=s.height||has(s.walls,x,y);}
function won(s){return s.boxes.every(p=>s.goals.includes(p));}
function move(s,dx,dy){if(Math.abs(dx)+Math.abs(dy)!==1||won(s))return false;let [x,y]=s.player.split(',').map(Number),nx=x+dx,ny=y+dy;if(wall(s,nx,ny))return false;let box=s.boxes.indexOf(key(nx,ny));if(box>=0&&(wall(s,nx+dx,ny+dy)||has(s.boxes,nx+dx,ny+dy)))return false;s.history.push({player:s.player,boxes:[...s.boxes],moves:s.moves,pushes:s.pushes});if(box>=0){s.boxes[box]=key(nx+dx,ny+dy);s.pushes++;}s.player=key(nx,ny);s.moves++;return true;}
function undo(s){const prev=s.history.pop();if(!prev)return false;Object.assign(s,prev);return true;}
function corners(s){return s.boxes.filter(p=>{if(s.goals.includes(p))return false;let[x,y]=p.split(',').map(Number);return (wall(s,x-1,y)||wall(s,x+1,y))&&(wall(s,x,y-1)||wall(s,x,y+1));});}
const api={levels,create,move,undo,won,corners};if(typeof module!=='undefined')module.exports=api;else root.Sokoban=api;
})(typeof globalThis!=='undefined'?globalThis:this);
