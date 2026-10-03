const {test}=require('node:test'),assert=require('node:assert/strict');const E=require('../engine');
test('wall blocks movement without recording a turn',()=>{let s=E.create(['#####','#@$.#','#####']);assert.equal(E.move(s,0,-1),false);assert.equal(s.moves,0);assert.equal(s.history.length,0)});
test('a single push onto a goal wins',()=>{let s=E.create(['#####','#@$.#','#####']);assert.equal(E.move(s,1,0),true);assert.ok(E.won(s));assert.equal(s.pushes,1)});
test('cannot push two boxes together',()=>{let s=E.create(['########','#@$$ ..#','########']);assert.equal(E.move(s,1,0),false)});
test('cannot push box into wall',()=>{let s=E.create(['######','#.@$##','######']);assert.equal(E.move(s,1,0),false)});
test('undo restores won state, counters, position and boxes',()=>{let s=E.create(['#####','#@$.#','#####']);E.move(s,1,0);assert.ok(E.undo(s));assert.equal(s.player,'1,1');assert.deepEqual(s.boxes,['2,1']);assert.equal(s.moves,0);assert.equal(s.pushes,0);assert.equal(E.won(s),false)});
test('undo on empty history is safe',()=>assert.equal(E.undo(E.create(E.levels[0].map)),false));
test('diagonal moves are rejected',()=>assert.equal(E.move(E.create(E.levels[0].map),1,1),false));
test('non-goal corner warns, goal corner does not',()=>{let a=E.create(['######','#$ @.#','######']);assert.deepEqual(E.corners(a),['1,1']);let b=E.create(['######','#* @ #','######']);assert.deepEqual(E.corners(b),[])});
test('restart creates independent state',()=>{let a=E.create(E.levels[0].map);E.move(a,0,-1);assert.equal(E.create(E.levels[0].map).moves,0)});
function solve(map){let first=E.create(map),q=[{s:first,path:''}],seen=new Set();const ds=[[0,-1,'U'],[1,0,'R'],[0,1,'D'],[-1,0,'L']];for(let i=0;i<q.length&&i<300000;i++){let {s,path}=q[i];if(E.won(s))return path;for(let [dx,dy,k]of ds){let n={...s,boxes:[...s.boxes],history:[]};if(!E.move(n,dx,dy))continue;n.history=[];let id=n.player+'|'+[...n.boxes].sort().join(';');if(!seen.has(id)){seen.add(id);q.push({s:n,path:path+k})}}}throw Error('No solution within limit');}
for(let [i,l]of E.levels.entries())test(`level ${i+1} has a replayable solution`,()=>{const path=solve(l.map);let s=E.create(l.map),d={U:[0,-1],R:[1,0],D:[0,1],L:[-1,0]};for(let k of path)assert.ok(E.move(s,...d[k]));assert.ok(E.won(s));console.log(`LEVEL ${i+1}: ${path} (${path.length} moves)`)});
