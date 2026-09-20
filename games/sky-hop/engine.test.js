const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine');

const seeded = (seed = 1) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const run = (s, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds - 1e-9; t += dt) E.step(s, dt); };
const playing = (opts) => { const s = E.createState({ rng: () => 0.5, ...opts }); E.flap(s); return s; };
/** 새가 항상 틈 중앙을 유지하도록 매 프레임 위치를 고정하는 자동 조종. */
const autopilot = (s, seconds) => {
  for (let t = 0; t < seconds && s.status === 'playing'; t += 1 / 60) {
    const next = s.gates.find(g => g.x + E.GATE_WIDTH >= s.bird.x - E.BIRD_HIT_RADIUS);
    s.bird.y = next.gapY; s.bird.vy = 0;
    E.step(s, 1 / 60);
  }
};

test('첫 입력은 게임을 시작하면서 동시에 날갯짓한다', () => {
  const s = E.createState({ rng: seeded() });
  assert.equal(s.status, 'ready');
  assert.equal(E.flap(s), true);
  assert.equal(s.status, 'playing');
  assert.equal(s.bird.vy, E.FLAP_VELOCITY);
});

test('대기 상태에서는 문이 움직이지 않고 중력도 없다', () => {
  const s = E.createState({ rng: seeded() });
  const gx = s.gates[0].x;
  run(s, 3);
  assert.equal(s.gates[0].x, gx);
  assert.ok(Math.abs(s.bird.y - E.BIRD_START_Y) <= 7.0001);
  assert.equal(s.score, 0);
});

test('문 하나는 통과할 때 정확히 1점만 준다', () => {
  const s = playing();
  const seen = new Set();
  let gained = 0;
  for (let t = 0; t < 8 && s.status === 'playing'; t += 1 / 60) {
    const next = s.gates.find(g => g.x + E.GATE_WIDTH >= s.bird.x - E.BIRD_HIT_RADIUS);
    s.bird.y = next.gapY; s.bird.vy = 0;
    const before = s.score;
    E.step(s, 1 / 60);
    if (s.score > before) {
      assert.equal(s.score - before, 1);
      const g = s.gates.find(g => g.scored && !seen.has(g));
      assert.ok(g, '새로 점수를 준 문이 있어야 함');
      seen.add(g);
      gained++;
    }
  }
  assert.equal(s.status, 'playing');
  assert.equal(s.score, gained);
  assert.ok(gained >= 2);
});

test('통과 직전에는 0점, 오른쪽 끝을 지나는 순간 1점', () => {
  const s = playing();
  const g = s.gates[0];
  g.x = E.BIRD_X - E.GATE_WIDTH + 0.5;   // 문 오른쪽 끝이 새 중심 바로 앞
  s.bird.y = g.gapY; s.bird.vy = 0;
  E.step(s, 1 / 240);
  assert.equal(s.score, 0);
  s.bird.y = g.gapY; s.bird.vy = 0;
  E.step(s, 0.02);
  assert.equal(s.score, 1);
  s.bird.y = g.gapY; s.bird.vy = 0;
  E.step(s, 0.05);
  assert.equal(s.score, 1);
});

test('원-사각형 충돌: 닿음/떨어짐/모서리', () => {
  assert.equal(E.circleRectHit(0, 0, 5, 10, -5, 10, 10), false);
  assert.equal(E.circleRectHit(5, 0, 5, 10, -5, 10, 10), true);    // 변에 접함
  assert.equal(E.circleRectHit(15, 5, 1, 10, -5, 10, 10), true);   // 사각형 내부
  // 모서리: 대각선 거리 √(3²+4²)=5
  assert.equal(E.circleRectHit(-3, -4, 5, 0, 0, 10, 10), true);
  assert.equal(E.circleRectHit(-3, -4, 4.99, 0, 0, 10, 10), false);
});

test('위쪽 문/아래쪽 문 모두 충돌로 게임오버', () => {
  for (const dy of [-1, +1]) {
    const s = playing();
    const g = s.gates[0];
    g.x = E.BIRD_X - 10;
    s.bird.y = g.gapY + dy * (E.GATE_GAP / 2 + 2); // 틈 가장자리 바깥
    s.bird.vy = 0;
    E.step(s, 1 / 60);
    assert.equal(s.status, 'gameover');
    assert.equal(s.deathReason, 'gate');
  }
});

test('틈 한가운데를 지나가면 충돌하지 않는다', () => {
  const s = playing();
  autopilot(s, 5);
  assert.equal(s.status, 'playing');
});

test('바닥은 게임오버, 천장은 막기만 하고 죽지 않는다', () => {
  const g = playing();
  g.gates.forEach(x => (x.x += 1000));
  run(g, 3);
  assert.equal(g.status, 'gameover');
  assert.equal(g.deathReason, 'ground');
  assert.equal(g.bird.y, E.GROUND_Y - E.BIRD_HIT_RADIUS);

  const c = playing();
  c.gates.forEach(x => (x.x += 1000));
  c.bird.y = E.BIRD_HIT_RADIUS + 1; c.bird.vy = -900;
  E.step(c, 1 / 60);
  assert.equal(c.status, 'playing');
  assert.equal(c.bird.y, E.BIRD_HIT_RADIUS);
  assert.ok(c.bird.vy >= 0);
});

test('날갯짓 상승 높이가 이론값(v²/2g)과 같고 틈보다 충분히 작다', () => {
  const s = playing();
  s.gates.forEach(x => (x.x += 1000));
  const y0 = s.bird.y; let minY = y0;
  for (let i = 0; i < 60; i++) { E.step(s, 1 / 120); minY = Math.min(minY, s.bird.y); }
  const rise = y0 - minY;
  const theory = (E.FLAP_VELOCITY ** 2) / (2 * E.GRAVITY);
  assert.ok(Math.abs(rise - theory) < 1.5, `rise ${rise} vs ${theory}`);
  assert.ok(theory < E.GATE_GAP / 2);
});

test('낙하 속도는 MAX_FALL_SPEED 를 넘지 않는다', () => {
  const s = playing();
  s.gates.forEach(x => (x.x += 1000));
  s.bird.y = 20; s.bird.vy = 0;
  run(s, 0.7);
  assert.ok(s.bird.vy <= E.MAX_FALL_SPEED + 1e-9);
  assert.equal(s.bird.vy, E.MAX_FALL_SPEED);
});

test('일시정지 중에는 모든 것이 완전히 멈추고 입력도 무시된다', () => {
  const s = playing();
  run(s, 0.2);
  assert.equal(E.pause(s), true);
  const snap = JSON.stringify({ ...s, rng: 0 });
  run(s, 5);
  E.step(s, 10);
  assert.equal(E.flap(s), false);
  assert.equal(JSON.stringify({ ...s, rng: 0 }), snap);
  assert.equal(E.pause(s), false);
});

test('재개하면 준비 시간 동안 물리가 멈춘 뒤 이어진다', () => {
  const s = playing();
  run(s, 0.2);
  E.pause(s);
  assert.equal(E.resume(s), true);
  const y = s.bird.y, gx = s.gates[0].x;
  assert.equal(E.flap(s), false);                  // 준비 중 날갯짓 무시
  run(s, E.RESUME_COUNTDOWN * 0.9);
  assert.equal(s.bird.y, y);
  assert.equal(s.gates[0].x, gx);
  run(s, 0.3);
  assert.ok(s.bird.y > y);
  assert.equal(E.flap(s), true);
});

test('대기/게임오버에서 pause·resume 은 아무 효과가 없다', () => {
  const s = E.createState({ rng: seeded() });
  assert.equal(E.pause(s), false);
  assert.equal(E.resume(s), false);
  assert.equal(s.status, 'ready');
});

test('게임오버는 정지 상태이며 flap 으로 재시작되지 않는다', () => {
  const s = playing();
  s.gates.forEach(x => (x.x += 1000));
  run(s, 3);
  assert.equal(s.status, 'gameover');
  const snap = JSON.stringify({ ...s, rng: 0 });
  assert.equal(E.flap(s), false);
  run(s, 2);
  assert.equal(JSON.stringify({ ...s, rng: 0 }), snap);
});

test('reset 은 점수·문·새·시간을 초기화하고 최고 기록만 유지한다', () => {
  const s = playing();
  autopilot(s, 8);
  s.status = 'playing';
  s.bird.y = E.GROUND_Y; E.step(s, 1 / 60);
  assert.equal(s.status, 'gameover');
  const best = s.best;
  assert.ok(best >= 1 && s.newBest);
  E.reset(s);
  assert.equal(s.status, 'ready');
  assert.equal(s.score, 0);
  assert.equal(s.elapsed, 0);
  assert.equal(s.countdown, 0);
  assert.equal(s.newBest, false);
  assert.equal(s.deathReason, null);
  assert.equal(s.best, best);
  assert.deepEqual(s.bird, { x: E.BIRD_X, y: E.BIRD_START_Y, vy: 0 });
  assert.equal(s.gates.length >= 2, true);
  assert.equal(s.gates[0].x, E.FIRST_GATE_X);
  assert.ok(s.gates.every(g => !g.scored));
});

test('기존 최고 기록보다 낮으면 newBest 가 아니다', () => {
  const s = playing({ best: 99 });
  s.gates.forEach(x => (x.x += 1000));
  run(s, 3);
  assert.equal(s.status, 'gameover');
  assert.equal(s.best, 99);
  assert.equal(s.newBest, false);
});

test('최고 기록 초기값은 잘못된 입력에도 안전하다', () => {
  for (const b of [undefined, null, NaN, -5, 'abc']) assert.equal(E.createState({ best: b }).best, 0);
  assert.equal(E.createState({ best: 7.9 }).best, 7);
});

test('경과 시간 일관성: 프레임 분할이 달라도 같은 위치', () => {
  const make = () => { const s = playing(); s.gates.forEach(x => (x.x += 1000)); return s; };
  const a = make(), b = make(), c = make();
  for (let i = 0; i < 30; i++) E.step(a, 0.01);     // 0.3초
  for (let i = 0; i < 10; i++) E.step(b, 0.03);
  E.step(c, 0.1); E.step(c, 0.1); E.step(c, 0.1);
  for (const o of [b, c]) {
    assert.ok(Math.abs(o.bird.y - a.bird.y) < 1e-6, `${o.bird.y} vs ${a.bird.y}`);
    assert.ok(Math.abs(o.bird.vy - a.bird.vy) < 1e-6);
    assert.ok(Math.abs(o.gates[0].x - a.gates[0].x) < 1e-6);
    assert.ok(Math.abs(o.elapsed - 0.3) < 1e-9);
  }
});

test('큰 dt 는 MAX_FRAME_DT 로 제한된다 (탭 복귀 시 순간이동 방지)', () => {
  const a = playing(), b = playing();
  a.gates.forEach(x => (x.x += 1000)); b.gates.forEach(x => (x.x += 1000));
  E.step(a, 30);
  E.step(b, E.MAX_FRAME_DT);
  assert.equal(a.bird.y, b.bird.y);
  assert.ok(Math.abs(a.elapsed - E.MAX_FRAME_DT) < 1e-9);
  for (const bad of [0, -1, NaN, undefined]) { const before = a.elapsed; E.step(a, bad); assert.equal(a.elapsed, before); }
});

test('빠른 하위 단계 덕분에 문 모서리를 뚫고 지나가지 않는다', () => {
  const s = playing();
  const g = s.gates[0];
  g.x = E.BIRD_X + 40;
  s.bird.y = g.gapY - E.GATE_GAP / 2 - 30;   // 위쪽 문 높이
  s.bird.vy = 0;
  for (let i = 0; i < 20 && s.status === 'playing'; i++) { s.bird.y = g.gapY - E.GATE_GAP / 2 - 30; E.step(s, E.MAX_FRAME_DT); }
  assert.equal(s.status, 'gameover');
});

test('무작위 틈 중심은 항상 안전한 범위 안에 있다', () => {
  const { min, max } = E.gapCenterRange();
  assert.ok(min - E.GATE_GAP / 2 >= E.GAP_MARGIN - 1e-9);
  assert.ok(E.GROUND_Y - (max + E.GATE_GAP / 2) >= E.GAP_MARGIN - 1e-9);
  const rng = seeded(42);
  for (let i = 0; i < 5000; i++) {
    const y = E.randomGapCenter(rng);
    assert.ok(y >= min && y <= max);
  }
  for (const u of [0, 0.9999999, 1, 2, -3, NaN, undefined]) {
    const y = E.randomGapCenter(() => u);
    assert.ok(y >= min && y <= max, `u=${u}`);
  }
  assert.equal(E.randomGapCenter(() => 0), min);
  assert.equal(E.randomGapCenter(() => 1), max);
});

test('진행 중 생성되는 모든 문의 틈이 안전 범위이며 간격이 일정하다', () => {
  const s = playing({ rng: seeded(7) });
  autopilot(s, 40);
  assert.equal(s.status, 'playing');
  const { min, max } = E.gapCenterRange();
  assert.ok(s.gates.every(g => g.gapY >= min && g.gapY <= max));
  for (let i = 1; i < s.gates.length; i++) assert.ok(Math.abs(s.gates[i].x - s.gates[i - 1].x - E.GATE_SPACING) < 1e-6);
  assert.ok(s.score >= 5);
});

test('지나간 문은 제거되고 앞쪽 문이 항상 채워진다', () => {
  const s = playing({ rng: seeded(3) });
  autopilot(s, 30);
  assert.ok(s.gates.length < 8);
  assert.ok(s.gates[s.gates.length - 1].x > E.WIDTH);
});

test('속도는 점수에 따라 늘지만 상한이 있다', () => {
  const s = E.createState({ rng: seeded() });
  assert.equal(E.currentSpeed(s), E.SCROLL_SPEED);
  s.score = 1000;
  assert.equal(E.currentSpeed(s), E.SCROLL_SPEED + E.SPEED_BONUS_MAX);
});

test('시작 난이도는 관대하다: 무입력이 아닌 주기적 날갯짓으로 첫 문을 통과할 수 있다', () => {
  // 틈 중앙 높이를 향해 단순 규칙(중심보다 낮아지면 flap)으로 조종
  const s = E.createState({ rng: seeded(11) });
  E.flap(s);
  for (let i = 0; i < 60 * 12 && s.status === 'playing'; i++) {
    const g = s.gates.find(g => g.x + E.GATE_WIDTH >= s.bird.x - E.BIRD_HIT_RADIUS);
    if (s.bird.y > g.gapY + 15 && s.bird.vy > 0) E.flap(s);
    E.step(s, 1 / 60);
  }
  assert.equal(s.status, 'playing');
  assert.ok(s.score >= 3, `score ${s.score}`);
});

// 첫 문 하나를 통과해 점수 1을 만든다 (문을 새 앞으로 당겨 놓고 진행).
const scoreOne = (s) => {
  s.gates[0].x = s.bird.x - E.GATE_WIDTH - 1 + 2;
  s.gates[0].gapY = s.bird.y;
  run(s, 0.1);
};

test('점수가 오르는 즉시 best 가 함께 오른다 (게임 오버 전에도)', () => {
  const s = playing();
  scoreOne(s);
  assert.equal(s.status, 'playing');
  assert.equal(s.score, 1);
  assert.equal(s.best, 1);
  assert.equal(s.newBest, true);
  assert.equal(s.runStartBest, 0);
});

test('점수 → 일시정지 → reset 해도 best 가 유지되고 다음 판 기준이 된다', () => {
  const s = playing();
  scoreOne(s);
  assert.equal(E.pause(s), true);
  E.reset(s);
  assert.equal(s.status, 'ready');
  assert.equal(s.score, 0);
  assert.equal(s.best, 1);
  assert.equal(s.runStartBest, 1);
  assert.equal(s.newBest, false);
});

test('newBest 는 판 시작 때의 최고 기록을 넘어야만 true 이고 동점은 아니다', () => {
  const s = playing({ best: 1 });
  scoreOne(s);
  assert.equal(s.score, 1);
  assert.equal(s.best, 1);
  assert.equal(s.newBest, false);
  s.gates.forEach(g => { if (!g.scored) g.x += 1000; });
  s.gates.push({ id: 99, x: s.bird.x - E.GATE_WIDTH + 1, gapY: s.bird.y, scored: false });
  run(s, 0.1);
  assert.equal(s.score, 2);
  assert.equal(s.best, 2);
  assert.equal(s.newBest, true);
  assert.equal(s.runStartBest, 1);
});

test('한 판에서 신기록을 세운 뒤 죽어도 newBest 가 유지된다', () => {
  const s = playing();
  scoreOne(s);
  s.bird.y = E.GROUND_Y; E.step(s, 1 / 60);
  assert.equal(s.status, 'gameover');
  assert.equal(s.best, 1);
  assert.equal(s.newBest, true);
});
