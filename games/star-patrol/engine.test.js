'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var E = require('./engine.js');

function seqRng(values) {
  var i = 0;
  return function () { var v = values[i % values.length]; i++; return v; };
}

test('createState starts ready with full formation and lives', function () {
  var s = E.createState({});
  assert.equal(s.status, E.STATUS.READY);
  assert.equal(s.lives, E.LIVES_START);
  assert.equal(s.enemies.length, E.ROWS * E.COLS);
  assert.equal(s.wave, 1);
});

test('setFireInterval only works while ready', function () {
  var s = E.createState({});
  assert.equal(E.setFireInterval(s, 'fast'), true);
  assert.equal(s.fireInterval, E.FIRE_INTERVAL.FAST);
  E.start(s);
  assert.equal(E.setFireInterval(s, 'normal'), false);
  assert.equal(s.fireInterval, E.FIRE_INTERVAL.FAST);
});

test('start only transitions from ready to playing', function () {
  var s = E.createState({});
  assert.equal(E.start(s), true);
  assert.equal(s.status, E.STATUS.PLAYING);
  assert.equal(E.start(s), false);
});

test('pause/resume only valid from matching states', function () {
  var s = E.createState({});
  assert.equal(E.pause(s), false);
  E.start(s);
  assert.equal(E.pause(s), true);
  assert.equal(s.status, E.STATUS.PAUSED);
  assert.equal(E.resume(s), true);
  assert.equal(s.status, E.STATUS.PLAYING);
});

test('pause clears input', function () {
  var s = E.createState({});
  E.start(s);
  E.setLeft(s, true);
  E.setFire(s, true);
  E.pause(s);
  assert.equal(s.input.left, false);
  assert.equal(s.input.fire, false);
});

test('restart only valid from paused or gameover, resets to ready', function () {
  var s = E.createState({ best: 500 });
  assert.equal(E.restart(s), false);
  E.start(s);
  assert.equal(E.restart(s), false);
  E.pause(s);
  assert.equal(E.restart(s), true);
  assert.equal(s.status, E.STATUS.READY);
  assert.equal(s.score, 0);
  assert.equal(s.best, 500); // 최고 기록은 유지
});

test('step is a no-op unless playing', function () {
  var s = E.createState({});
  var before = JSON.stringify(s.player);
  E.step(s, 0.1);
  assert.equal(JSON.stringify(s.player), before);
});

test('player moves left/right within margins and clamps', function () {
  var s = E.createState({});
  E.start(s);
  E.setLeft(s, true);
  for (var i = 0; i < 500; i++) E.step(s, 0.1);
  assert.ok(s.player.x >= E.PLAYER_MARGIN);
  assert.ok(s.player.x <= E.PLAYER_MARGIN + 0.001);
});

test('opposing left+right cancels movement', function () {
  var s = E.createState({});
  E.start(s);
  var x0 = s.player.x;
  E.setLeft(s, true);
  E.setRight(s, true);
  E.step(s, 0.5);
  assert.equal(s.player.x, x0);
});

test('firing spawns a bullet respecting cooldown', function () {
  var s = E.createState({ fireInterval: 'fast' });
  E.start(s);
  E.setFire(s, true);
  E.step(s, 0.01);
  assert.equal(s.playerBullets.length, 1);
  E.step(s, 0.01);
  assert.equal(s.playerBullets.length, 1); // 쿨다운 중
});

test('killing an enemy increases score and best, sets newBest', function () {
  var s = E.createState({ best: 0, rng: seqRng([0]) });
  E.start(s);
  var target = s.enemies[0];
  s.playerBullets.push({ x: target.x, y: target.y, prevY: target.y, vy: -1 });
  E.step(s, 1 / 240);
  assert.ok(s.score > 0);
  assert.equal(s.score, E.SCORE_AMBER);
  assert.equal(s.best, s.score);
  assert.equal(s.newBest, true);
});

test('coral row (odd row) scores more than amber row', function () {
  var s = E.createState({});
  var amber = s.enemies.filter(function (e) { return e.kind === 'amber'; })[0];
  var coral = s.enemies.filter(function (e) { return e.kind === 'coral'; })[0];
  assert.ok(amber);
  assert.ok(coral);
  assert.equal(E.SCORE_CORAL > E.SCORE_AMBER, true);
  assert.notEqual(amber.row % 2, coral.row % 2);
});

test('enemy collision with player costs a life and grants invulnerability', function () {
  var s = E.createState({});
  E.start(s);
  var e = s.enemies[0];
  s.player.x = e.x; s.player.y = e.y;
  E.step(s, 1 / 240);
  assert.equal(s.lives, E.LIVES_START - 1);
  assert.ok(s.player.invuln > 0);
});

test('losing all lives ends the game', function () {
  var s = E.createState({});
  E.start(s);
  for (var i = 0; i < E.LIVES_START; i++) {
    s.player.invuln = 0;
    var e = s.enemies.filter(function (en) { return en.alive; })[0];
    s.player.x = e.x; s.player.y = e.y;
    E.step(s, 1 / 240);
  }
  assert.equal(s.status, E.STATUS.GAMEOVER);
  assert.equal(s.lives, 0);
  assert.equal(s.player.alive, false);
});

test('clearing formation triggers a wave transition then next wave', function () {
  var s = E.createState({});
  E.start(s);
  s.enemies = [];
  E.step(s, 0.001);
  assert.equal(s.transitioning, true);
  assert.equal(s.wave, 1);
  for (var i = 0; i < 400; i++) E.step(s, 0.01);
  assert.equal(s.wave, 2);
  assert.equal(s.transitioning, false);
  assert.equal(s.enemies.length, E.ROWS * E.COLS);
});

test('difficulty helpers scale with wave up to the cap', function () {
  assert.ok(E.formationSpeed(1) < E.formationSpeed(3));
  assert.equal(E.formationSpeed(E.MAX_WAVE_SCALING), E.formationSpeed(E.MAX_WAVE_SCALING + 5));
  assert.ok(E.diveInterval(1) > E.diveInterval(4));
  assert.ok(E.maxConcurrentDivers(1) <= E.maxConcurrentDivers(6));
});

test('circle collision helpers behave as expected', function () {
  assert.equal(E.circleHit(0, 0, 5, 6, 0, 2), true);
  assert.equal(E.circleHit(0, 0, 5, 20, 0, 2), false);
  assert.equal(E.circleVsVerticalSegment(0, 0, 5, 0, -10, 10, 1), true);
  assert.equal(E.circleVsVerticalSegment(50, 0, 5, 0, -10, 10, 1), false);
});

test('clearInput resets all input flags', function () {
  var s = E.createState({});
  E.start(s);
  E.setLeft(s, true); E.setRight(s, true); E.setFire(s, true);
  E.clearInput(s);
  assert.deepEqual(s.input, { left: false, right: false, fire: false });
});

test('invalid saved best is finite and bounded', () => {
  for (const v of [Infinity, NaN, -1, 'bad']) assert.equal(E.createState({best:v}).best,0);
  assert.equal(E.createState({best:1e20}).best,999999999);
});

test('wave transition removes hostile bullets', () => {
  const s=E.createState(); E.start(s); s.enemies=[];
  s.enemyBullets=[{x:10,y:300,vy:200}];
  E.step(s,1/60);
  assert.equal(s.transitioning,true); assert.equal(s.enemyBullets.length,0);
});

test('fast cadence produces more shots during identical sustained input', () => {
  function count(mode){const s=E.createState({fireInterval:mode});E.start(s);s.enemies=[];s.transitioning=true;s.transitionTimer=10;E.setFire(s,true);for(let i=0;i<60;i++)E.step(s,1/60);return s.playerBullets.length;}
  assert.ok(count('fast')>count('normal'));
});
