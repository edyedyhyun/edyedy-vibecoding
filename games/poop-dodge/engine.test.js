const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine');

const seeded = (seed = 1) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const run = (s, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds - 1e-9; t += dt) E.step(s, dt); };
const playing = (opts) => { const s = E.createState({ rng: seeded(7), ...opts }); E.start(s); return s; };
const poop = (s, x, y, vy = 200) => { s.poops.push({ id: s.nextId++, x, y, vy, r: E.POOP_HIT_R, rot: 0 }); };
/** 새 똥이 더 생기지 않게 막는다 (수동 배치 테스트용). */
const noSpawn = (s) => { s.spawnTimer = 1e9; };

test('시작 버튼(start) 전에는 아무것도 진행되지 않는다', () => {
  const s = E.createState({ rng: seeded() });
  assert.equal(s.status, 'ready');
  assert.equal(E.press(s, 'k', 1), false);
  run(s, 3);
  assert.equal(s.time, 0);
  assert.equal(s.poops.length, 0);
  assert.equal(E.pause(s), false);
  assert.equal(E.restart(s), false, 'R 은 대기 화면에서 무시');
  assert.equal(E.start(s), true);
  assert.equal(E.start(s), false, '이미 시작했으면 다시 시작하지 않음');
});

test('상수 관계: 충돌 상자는 그림보다 작고, 반응 시간은 충분하다', () => {
  assert.ok(E.PLAYER_HIT_W < E.PLAYER_W && E.PLAYER_HIT_H < E.PLAYER_H);
  assert.ok(E.POOP_HIT_R < E.POOP_DRAW_R);
  assert.ok(E.MIN_REACTION_TIME >= 1.0, `반응 시간 ${E.MIN_REACTION_TIME}`);
  assert.ok(E.LANE_SPEED < E.PLAYER_SPEED / 2);
  assert.equal(E.WIDTH, 480);
  assert.equal(E.HEIGHT, 600);
});

test('원-사각형 충돌 판정', () => {
  assert.equal(E.circleRectHit(50, 50, 10, 40, 40, 20, 20), true, '내부');
  assert.equal(E.circleRectHit(30, 50, 10, 40, 40, 20, 20), true, '변에 닿음');
  assert.equal(E.circleRectHit(29, 50, 10, 40, 40, 20, 20), false, '살짝 떨어짐');
  const d = 10 / Math.SQRT2;
  assert.equal(E.circleRectHit(40 - d + 0.01, 40 - d + 0.01, 10, 40, 40, 20, 20), true, '모서리 안쪽');
  assert.equal(E.circleRectHit(40 - d - 0.5, 40 - d - 0.5, 10, 40, 40, 20, 20), false, '모서리 바깥은 사각형 확장이 아님');
});

test('충돌: 시각적으로 스치기만 하는 똥은 맞지 않는다 (관대한 판정)', () => {
  const s = playing(); noSpawn(s);
  const edge = s.player.x + E.PLAYER_HIT_W / 2 + E.POOP_HIT_R + 2;
  assert.ok(edge - s.player.x < E.PLAYER_W / 2 + E.POOP_DRAW_R, '그림상으로는 겹쳐 보임');
  poop(s, edge, 300);
  run(s, 2);
  assert.equal(s.status, 'playing');
  assert.equal(s.dodged, 1);
});

test('충돌: 머리 위로 떨어지는 똥은 맞는다', () => {
  const s = playing(); noSpawn(s);
  poop(s, s.player.x, 300);
  run(s, 2);
  assert.equal(s.status, 'gameover');
  assert.equal(s.dodged, 0);
  assert.ok(s.hitBy);
});

test('고속 낙하에서도 얇은 판정을 뚫지 않는다 (하위 단계 + 프레임 상한)', () => {
  for (const vy of [400, 2000, 8000]) {
    const s = playing(); noSpawn(s);
    poop(s, s.player.x, 100, vy);
    E.step(s, 1 / 30);  // 큰 프레임 하나가 여러 하위 단계로 쪼개져야 함
    for (let i = 0; i < 400 && s.status === 'playing'; i++) E.step(s, 1 / 30);
    assert.equal(s.status, 'gameover', `vy=${vy}`);
  }
  // 하위 단계 한 번의 이동량이 판정 크기보다 작음 (최대 낙하 속도 기준)
  assert.ok(E.FALL_SPEED_MAX * E.SUBSTEP_DT < E.POOP_HIT_R);
});

test('큰 dt 는 MAX_FRAME_DT 로 잘린다', () => {
  const s = playing(); noSpawn(s);
  E.step(s, 5);
  assert.ok(Math.abs(s.time - E.MAX_FRAME_DT) < 1e-9);
  E.step(s, NaN); E.step(s, -1); E.step(s, 0);
  assert.ok(Math.abs(s.time - E.MAX_FRAME_DT) < 1e-9);
});

test('좌우 이동과 경계 클램프', () => {
  const s = playing(); noSpawn(s);
  E.press(s, 'k:left', -1);
  run(s, 5);
  assert.equal(s.player.x, E.PLAYER_MIN_X);
  assert.equal(s.player.vx, 0);
  E.release(s, 'k:left'); E.press(s, 'k:right', 1);
  run(s, 5);
  assert.equal(s.player.x, E.PLAYER_MAX_X);
  // 큰 프레임에서도 밖으로 나가지 않음
  for (let i = 0; i < 20; i++) E.step(s, 1);
  assert.ok(s.player.x <= E.PLAYER_MAX_X && s.player.x >= E.PLAYER_MIN_X);
});

test('속도는 최고 속도를 넘지 않고 가속은 부드럽다', () => {
  const s = playing(); noSpawn(s);
  E.press(s, 'a', 1);
  E.step(s, 1 / 60);
  assert.ok(s.player.vx > 0 && s.player.vx < E.PLAYER_SPEED);
  run(s, 0.5);
  assert.ok(Math.abs(s.player.vx - E.PLAYER_SPEED) < 1e-6);
});

test('입력 출처별 관리: 반대 방향 동시 입력은 상쇄, 하나만 떼면 다른 쪽이 유지', () => {
  const s = playing();
  E.press(s, 'key:left', -1);
  E.press(s, 'btn:right', 1);
  assert.equal(E.inputDir(s), 0);
  E.release(s, 'key:left');
  assert.equal(E.inputDir(s), 1);
  E.press(s, 'btn:right2', 1);   // 같은 방향 두 출처
  E.release(s, 'btn:right');
  assert.equal(E.inputDir(s), 1, '다른 출처가 남아 있으면 유지');
  E.release(s, 'btn:right2');
  assert.equal(E.inputDir(s), 0);
  assert.equal(E.release(s, 'nothing'), false);
  assert.equal(E.press(s, 'x', 0), false);
});

test('일시정지·재시작·게임 오버에서 눌린 입력이 모두 풀린다', () => {
  let s = playing(); noSpawn(s);
  E.press(s, 'a', -1); E.setTarget(s, 10);
  E.pause(s);
  assert.equal(E.inputDir(s), 0);
  assert.equal(s.input.target, null);
  E.resume(s);
  const x = s.player.x;
  run(s, 1);
  assert.equal(s.player.x, x, '재개 뒤에는 다시 눌러야 움직임');

  s = playing(); noSpawn(s);
  E.press(s, 'a', 1);
  E.pause(s); E.restart(s);
  assert.equal(E.inputDir(s), 0);

  s = playing(); noSpawn(s);
  s.player.x = E.PLAYER_MAX_X;
  E.press(s, 'a', 1);
  poop(s, s.player.x, 400);
  run(s, 1);
  assert.equal(s.status, 'gameover');
  assert.equal(E.inputDir(s), 0);
  assert.equal(E.press(s, 'a', 1), false, '게임 오버 뒤에는 입력 무시');
});

test('끌기 목표: 목표에 도달하면 멈추고 넘어서지 않는다', () => {
  const s = playing(); noSpawn(s);
  E.setTarget(s, 100);
  run(s, 3);
  assert.ok(Math.abs(s.player.x - 100) < 2, `x=${s.player.x}`);
  assert.equal(E.setTarget(s, 99999), true);
  assert.equal(s.input.target, E.PLAYER_MAX_X);
  assert.equal(E.setTarget(s, NaN), false);
  E.setTarget(s, null);
  assert.equal(s.input.target, null);
});

test('키 매핑: 물리 키(code) 기준, 방향키와 A/D, P/Esc, R', () => {
  assert.equal(E.actionForCode('ArrowLeft'), 'left');
  assert.equal(E.actionForCode('KeyA'), 'left');
  assert.equal(E.actionForCode('ArrowRight'), 'right');
  assert.equal(E.actionForCode('KeyD'), 'right');
  assert.equal(E.actionForCode('KeyP'), 'pause');
  assert.equal(E.actionForCode('Escape'), 'pause');
  assert.equal(E.actionForCode('KeyR'), 'restart');
  assert.equal(E.actionForCode('Space'), null);
  assert.equal(E.actionForCode('Enter'), null);
});

test('일시정지는 완전히 멈춘다 (시간·똥·점수·생성 타이머)', () => {
  const s = playing();
  run(s, 3);
  E.pause(s);
  const snap = JSON.stringify({ t: s.time, p: s.poops, d: s.dodged, x: s.player, sp: s.spawnTimer, l: s.lane });
  run(s, 30);
  E.step(s, 5);
  assert.equal(JSON.stringify({ t: s.time, p: s.poops, d: s.dodged, x: s.player, sp: s.spawnTimer, l: s.lane }), snap);
  assert.equal(E.pause(s), false, '이미 정지');
  assert.equal(E.resume(s), true);
  assert.equal(E.resume(s), false);
  run(s, 1);
  assert.ok(s.time > 3);
});

test('재시작은 일시정지·게임 오버에서만, 최고 기록은 유지', () => {
  const s = playing(); noSpawn(s);
  assert.equal(E.restart(s), false, '플레이 중 R 무시');
  run(s, 2);
  const best = s.best;
  assert.ok(best > 1.9);
  E.pause(s);
  assert.equal(E.restart(s), true);
  assert.equal(s.status, 'playing');
  assert.equal(s.time, 0);
  assert.equal(s.dodged, 0);
  assert.equal(s.poops.length, 0);
  assert.equal(s.best, best);
});

test('피한 똥은 바닥에 닿을 때 정확히 한 번만 센다', () => {
  const s = playing(); noSpawn(s);
  poop(s, 60, 400); poop(s, 400, 450);
  const seen = [];
  for (let i = 0; i < 300; i++) { E.step(s, 1 / 60); seen.push(s.dodged); }
  assert.equal(s.dodged, 2);
  assert.equal(s.poops.length, 0);
  assert.equal(s.landings.length, 2);
  assert.ok(seen.every((v, i) => i === 0 || v >= seen[i - 1]));
  run(s, 3);
  assert.equal(s.dodged, 2, '더 늘지 않음');
});

test('맞은 똥은 피한 개수에 들어가지 않는다', () => {
  const s = playing(); noSpawn(s);
  poop(s, s.player.x, 500);
  run(s, 1);
  assert.equal(s.status, 'gameover');
  assert.equal(s.dodged, 0);
  const t = s.time;
  run(s, 3);
  assert.equal(s.time, t, '게임 오버 뒤 시간 정지');
});

test('생존 시간은 플레이 중에만 흐르고 최고 기록은 죽기 전에도 갱신된다', () => {
  const s = playing({ best: 1.5 }); noSpawn(s);
  run(s, 1);
  assert.equal(s.best, 1.5);
  assert.equal(s.newRecord, false);
  run(s, 1);
  assert.ok(s.best > 1.9 && s.best === s.time, '플레이 중 즉시 반영');
  assert.equal(s.newRecord, true);
});

test('최고 기록 초기화는 플레이 중에는 거부, 그 외에는 0으로', () => {
  const s = playing({ best: 12 });
  assert.equal(E.resetBest(s), false);
  assert.equal(s.best, 12);
  E.pause(s);
  assert.equal(E.resetBest(s), true);
  assert.equal(s.best, 0);
  assert.equal(s.newRecord, false);
});

test('저장값 해석: 이상한 값은 0, 정상값은 초로 변환, 왕복 가능', () => {
  for (const bad of [null, undefined, '', 'abc', '-5', '1e9', '12.5', NaN, {}, '9999999999']) {
    assert.equal(E.parseStoredBest(bad), 0, String(bad));
  }
  assert.equal(E.parseStoredBest('12345'), 12.345);
  assert.equal(E.parseStoredBest(E.serializeBest(83.4567)), 83.456);
  assert.equal(E.serializeBest(-3), '0');
  assert.equal(E.serializeBest(NaN), '0');
  assert.equal(E.createState({ best: -4 }).best, 0);
  assert.equal(E.createState({ best: 'x' }).best, 0);
});

test('시간 표기', () => {
  assert.equal(E.formatTime(0), '0.0초');
  assert.equal(E.formatTime(12.34), '12.3초');
  assert.equal(E.formatTime(59.99), '59.9초');
  assert.equal(E.formatTime(65.3), '1분 05.3초');
  assert.equal(E.formatTime(-1), '0.0초');
  assert.equal(E.formatTime(NaN), '0.0초');
});

test('난이도는 점진적으로 오르고 상한에서 멈춘다', () => {
  let prev = E.difficultyAt(0);
  assert.equal(prev.fallSpeed, E.FALL_SPEED_START);
  assert.equal(prev.spawnInterval, E.SPAWN_INTERVAL_START);
  for (let t = 1; t <= E.RAMP_SECONDS; t++) {
    const d = E.difficultyAt(t);
    assert.ok(d.fallSpeed >= prev.fallSpeed && d.spawnInterval <= prev.spawnInterval);
    assert.ok(d.fallSpeed - prev.fallSpeed < 5, '한 번에 확 뛰지 않음');
    prev = d;
  }
  for (const t of [E.RAMP_SECONDS, 1000, 1e9, Infinity]) {
    const d = E.difficultyAt(t);
    assert.equal(d.fallSpeed, E.FALL_SPEED_MAX);
    assert.equal(d.spawnInterval, E.SPAWN_INTERVAL_MIN);
  }
  assert.equal(E.difficultyAt(-5).fallSpeed, E.FALL_SPEED_START);
});

test('실제 진행 중 생성되는 똥 속도·간격이 상한을 넘지 않는다', () => {
  const s = playing(); noSpawn(s); s.spawnTimer = 0;
  s.time = 5000;   // 오래 버틴 상황
  const times = [];
  let last = null;
  for (let i = 0; i < 60 * 30; i++) {
    const n = s.poops.length + s.dodged;
    E.step(s, 1 / 60);
    if (s.status !== 'playing') { s.status = 'playing'; s.hitBy = null; }
    if (s.poops.length + s.dodged > n) { times.push(i); }
  }
  for (const q of s.poops) assert.ok(q.vy <= E.FALL_SPEED_MAX + 1e-9);
  const gaps = times.slice(1).map((v, i) => (v - times[i]) / 60);
  assert.ok(Math.min(...gaps) >= E.SPAWN_INTERVAL_MIN * (1 - E.SPAWN_JITTER) - 0.05, `최소 간격 ${Math.min(...gaps)}`);
});

test('시작 직후에는 첫 똥이 늦게 나오고 처음 속도는 느리다', () => {
  const s = playing();
  run(s, E.FIRST_SPAWN_DELAY - 0.1);
  assert.equal(s.poops.length, 0);
  run(s, 0.3);
  assert.equal(s.poops.length, 1);
  assert.ok(s.poops[0].vy >= E.FALL_SPEED_START && s.poops[0].vy < E.FALL_SPEED_START + 5);
});

test('똥은 안전 통로 안에서는 생성되지 않는다 (통로 폭 = 플레이어가 서 있을 수 있는 자리)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = playing({ rng: seeded(seed) });
    s.time = 60;
    for (let i = 0; i < 60 * 60; i++) {
      const before = s.nextId;
      E.step(s, 1 / 60);
      if (s.nextId > before) {
        const q = s.poops[s.poops.length - 1];
        // 방금 생성된 똥의 x 는 (같은 서브스텝의) 통로 중심에서 LANE_HALF 이상 떨어져 있어야 한다 — 통로가 프레임 안에 조금 움직이므로 오차 허용
        assert.ok(Math.abs(q.x - s.lane.x) >= E.LANE_HALF - E.LANE_SPEED / 60 - 1e-6, `seed ${seed} x=${q.x} lane=${s.lane.x}`);
      }
      if (s.status !== 'playing') { s.status = 'playing'; }
    }
  }
});

test('통로를 따라가는 봇은 최대 난이도에서도 3분간 한 번도 맞지 않는다 (전 가로폭 봉쇄 없음)', () => {
  for (const seed of [11, 22, 33, 44, 55, 66]) {
    const s = E.createState({ rng: seeded(seed) });
    E.start(s);
    const hist = [];
    const dt = 1 / 60;
    let t = 0;
    while (t < 180 && s.status === 'playing') {
      const d = E.difficultyAt(s.time);
      const fall = (E.GROUND_Y - E.PLAYER_HIT_H - E.SPAWN_Y) / d.fallSpeed;   // 똥이 플레이어 높이에 오기까지
      hist.push({ t, x: s.lane.x });
      // 지금 플레이어 높이에 도착할 똥은 fall 초 전에 만들어졌다 → 그때의 통로 위치를 따라간다
      let target = s.lane.x;
      for (let i = hist.length - 1; i >= 0; i--) { if (hist[i].t <= t - fall) { target = hist[i].x; break; } }
      const diff = target - s.player.x;
      E.releaseAll(s);
      if (Math.abs(diff) > 4) E.press(s, 'bot', diff > 0 ? 1 : -1);
      E.step(s, dt);
      t += dt;
    }
    assert.equal(s.status, 'playing', `seed ${seed} 에서 ${t.toFixed(1)}초에 맞음`);
    assert.ok(s.dodged > 200);
  }
});

test('무입력으로 가만히 있으면 결국 맞는다 (게임이 실제로 도전적임)', () => {
  const s = playing({ rng: seeded(3) });
  run(s, 120);
  assert.equal(s.status, 'gameover');
});
