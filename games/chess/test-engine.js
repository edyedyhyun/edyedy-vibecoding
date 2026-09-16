'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const moves=s=>E.legalMoves(s).map(m=>m.from+m.to+(m.promotion||'').toLowerCase()).sort();
function play(s,a,b,p){assert.equal(E.play(s,a,b,p),true,`${a}-${b}`)}
function perft(s,n){if(n===0)return 1;let count=0;for(const m of E.legalMoves(s)){play(s,m.from,m.to,m.promotion);count+=perft(s,n-1);assert.equal(E.undo(s),true)}return count}
test('initial legal move tree: 20, 400, 8902',()=>{const s=E.createState();assert.equal(perft(s,1),20);assert.equal(perft(s,2),400);assert.equal(perft(s,3),8902)});
test('illegal move rejected without mutation',()=>{const s=E.createState();const before=JSON.stringify(s);assert.equal(E.play(s,'e2','e5'),false);assert.equal(JSON.stringify(s),before)});
test('pinned rook cannot expose own king',()=>{const s=E.loadFEN('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1');assert(!moves(s).includes('e2d2'));assert(moves(s).includes('e2e8'))});
test('castling both sides when safe, but never through attack',()=>{let s=E.loadFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');assert(moves(s).includes('e1g1'));assert(moves(s).includes('e1c1'));s=E.loadFEN('r3kr1r/8/8/8/8/8/8/R3K2R w KQ - 0 1');assert(!moves(s).includes('e1g1'));assert(moves(s).includes('e1c1'))});
test('en passant allowed immediately and disallowed if exposes king',()=>{let s=E.loadFEN('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');assert(moves(s).includes('e5d6'));play(s,'e1','f1');play(s,'e8','f8');assert(!moves(s).includes('e5d6'));s=E.loadFEN('k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');assert(!moves(s).includes('e5d6'))});
test('four promotion choices, no implicit promotion',()=>{const s=E.loadFEN('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');assert.deepEqual(moves(s).filter(m=>m.startsWith('a7a8')),['a7a8b','a7a8n','a7a8q','a7a8r']);assert.equal(E.play(s,'a7','a8'),false)});
test('special moves undo restore exact position',()=>{for(const [fen,a,b,p] of [['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','e1','g1'],['4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1','e5','d6'],['4k3/P7/8/8/8/8/8/4K3 w - - 0 1','a7','a8','N']]){const s=E.loadFEN(fen),before=JSON.stringify(s);play(s,a,b,p);assert.equal(E.undo(s),true);assert.equal(JSON.stringify(s),before)}});
test('fools mate ends game and undo reopens it',()=>{const s=E.createState();for(const [a,b] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']])play(s,a,b);assert.equal(s.status,'checkmate');assert.equal(s.winner,'b');assert.equal(E.play(s,'e2','e4'),false);E.undo(s);assert.equal(s.status,'playing')});
test('stalemate is draw, not checkmate',()=>{const s=E.loadFEN('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1');assert.equal(s.status,'stalemate');assert.equal(s.winner,null)});
test('threefold ignores unavailable en passant; claim and undo',()=>{const s=E.createState();play(s,'e2','e4');for(let i=0;i<2;i++)for(const [a,b] of [['g8','f6'],['g1','f3'],['f6','g8'],['f3','g1']])play(s,a,b);assert.equal(E.status(s).canClaimThreefold,true);assert.equal(E.claimDraw(s,'threefold'),true);assert.equal(s.status,'draw');E.undo(s);assert.equal(s.status,'playing');assert.equal(E.status(s).canClaimThreefold,true)});
test('fivefold automatically draws',()=>{const s=E.createState();for(let i=0;i<4;i++)for(const [a,b] of [['g1','f3'],['g8','f6'],['f3','g1'],['f6','g8']])play(s,a,b);assert.equal(s.reason,'fivefold')});
test('50 move claim and 75 move automatic ending',()=>{let s=E.loadFEN('4k3/8/8/8/8/8/8/R3K3 w - - 100 60');assert.equal(E.status(s).canClaimFifty,true);assert.equal(E.claimDraw(s,'fifty'),true);s=E.loadFEN('4k3/8/8/8/8/8/8/R3K3 w - - 149 80');play(s,'a1','a2');assert.equal(s.reason,'75move')});
test('same color bishops insufficient, opposite bishops not automatically drawn',()=>{assert.equal(E.loadFEN('4k3/8/8/8/8/4B3/8/2B1K3 w - - 0 1').reason,'insufficient');assert.equal(E.loadFEN('4k3/8/8/8/8/3b4/8/2B1K3 w - - 0 1').status,'playing')});
