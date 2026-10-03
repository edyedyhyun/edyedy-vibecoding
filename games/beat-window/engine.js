(function(root){'use strict';
const BPM=100,BEAT=60/BPM;
const chart=Array.from({length:32},(_,i)=>({id:i,time:2+i*BEAT,lane:[0,1,0,0,1,0,1,1][i%8]}));
class Game{
 constructor(window=.13){this.window=window;this.reset()}
 reset(){this.notes=chart.map(n=>({...n,status:'pending'}));this.time=0;this.phase='ready';this.combo=0;this.best=0;this.score=0;this.hits=0;this.misses=0;this.inputs=0;this.last='D / K 또는 아래 버튼을 눌러요';this.errors=[]}
 start(){this.reset();this.phase='playing'}
 advance(t){if(this.phase!=='playing')return;this.time=Math.max(this.time,t);for(const n of this.notes){if(n.status==='pending'&&this.time>n.time+this.window){n.status='miss';this.misses++;this.combo=0;this.last='놓침 · 다음 박자를 기다려요'}}if(this.time>chart.at(-1).time+.8){this.phase='finished';this.last='한 곡 끝! 다시 눌러 볼까요?'}}
 hit(lane,t=this.time){if(this.phase!=='playing')return null;this.advance(t);if(this.phase!=='playing')return null;this.inputs++;const candidates=this.notes.filter(n=>n.lane===lane&&n.status==='pending'&&Math.abs(t-n.time)<=this.window+1e-9);candidates.sort((a,b)=>Math.abs(t-a.time)-Math.abs(t-b.time));const n=candidates[0];if(!n){this.last='빈 박자 · 노트가 선에 올 때 눌러요';return null}const error=t-n.time;n.status=Math.abs(error)<=.055+1e-9?'perfect':'good';this.errors.push(error);this.hits++;this.combo++;this.best=Math.max(this.best,this.combo);this.score+=n.status==='perfect'?100:60;this.last=(n.status==='perfect'?'정확!':'좋아요')+' · '+Math.round(error*1000)+'ms';return {status:n.status,error,id:n.id}}
}
const api={Game,chart,BPM,BEAT};if(typeof module==='object')module.exports=api;else root.BeatWindow=api;
})(typeof globalThis!=='undefined'?globalThis:this);
