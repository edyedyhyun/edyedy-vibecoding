/**
 * SkyHopEngine — 구름새 · Sky Hop 의 순수 게임 로직.
 * DOM 의존성이 없으며 CommonJS(module.exports)와 브라우저 전역(SkyHopEngine) 양쪽에서 쓸 수 있습니다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkyHopEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 튜닝 상수 (단위: 논리 픽셀, 초) ---------------------------------
  var WIDTH = 420;
  var HEIGHT = 600;
  var GROUND_H = 56;
  var GROUND_Y = HEIGHT - GROUND_H;   // 바닥 윗면

  var GRAVITY = 1500;         // px/s² 아래로 당기는 힘
  var FLAP_VELOCITY = -430;   // px/s 날갯짓 한 번의 위쪽 속도 (한 번에 약 62px 상승)
  var MAX_FALL_SPEED = 640;   // px/s 낙하 속도 상한

  var SCROLL_SPEED = 115;     // px/s 시작 속도 (느긋하게)
  var SPEED_PER_POINT = 2;    // 점수 1점당 늘어나는 속도
  var SPEED_BONUS_MAX = 45;   // 속도 증가 상한

  var GATE_WIDTH = 64;
  var GATE_GAP = 200;         // 위·아래 문 사이 틈 (넉넉하게 시작)
  var GATE_SPACING = 235;     // 문과 문 사이 가로 간격
  var GAP_MARGIN = 64;        // 틈 가장자리와 천장/바닥 사이 최소 여유
  var FIRST_GATE_X = WIDTH + 10;

  var BIRD_X = 118;
  var BIRD_HIT_RADIUS = 11;   // 충돌 반지름 (그려진 몸통보다 약간 작아 관대함)
  var BIRD_DRAW_RADIUS = 14;
  var BIRD_START_Y = 280;

  var MAX_FRAME_DT = 0.1;     // 한 프레임에서 인정하는 최대 시간 (탭 복귀 등)
  var SUBSTEP_DT = 1 / 60;    // 물리 하위 단계 최대 길이
  var RESUME_COUNTDOWN = 0.9; // 재개 후 물리가 다시 시작되기까지의 준비 시간

  var STATUS = { READY: 'ready', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

  // ---- 순수 헬퍼 -------------------------------------------------------

  /** 틈 중심 y 의 허용 범위 [min, max]. */
  function gapCenterRange() {
    return { min: GAP_MARGIN + GATE_GAP / 2, max: GROUND_Y - GAP_MARGIN - GATE_GAP / 2 };
  }

  /** rng() ∈ [0,1) 로 안전한 틈 중심 y 를 뽑습니다. 범위를 벗어난 rng 값도 clamp 합니다. */
  function randomGapCenter(rng) {
    var r = gapCenterRange();
    var u = Math.min(Math.max(Number(rng()) || 0, 0), 1);
    return r.min + u * (r.max - r.min);
  }

  /** 원(cx,cy,r)과 사각형이 겹치는지 검사합니다. 닿기만 해도(경계 포함) 충돌. */
  function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
    var nx = Math.min(Math.max(cx, rx), rx + rw);
    var ny = Math.min(Math.max(cy, ry), ry + rh);
    var dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  }

  function makeGate(s, x) {
    return { id: s.gateSeq++, x: x, gapY: randomGapCenter(s.rng), scored: false };
  }

  function currentSpeed(state) {
    return SCROLL_SPEED + Math.min(state.score * SPEED_PER_POINT, SPEED_BONUS_MAX);
  }

  // ---- 상태 -------------------------------------------------------------

  function createState(opts) {
    opts = opts || {};
    var s = {
      rng: opts.rng || Math.random,
      best: Math.max(0, Math.floor(opts.best) || 0)
    };
    reset(s);
    return s;
  }

  /** 최고 기록과 rng 는 유지하고 나머지를 전부 새 판으로 되돌립니다. */
  function reset(s) {
    s.status = STATUS.READY;
    s.score = 0;
    s.runStartBest = s.best;   // 이번 판을 시작할 때의 최고 기록 (newBest 판정 기준)
    s.newBest = false;
    s.deathReason = null;
    s.elapsed = 0;          // 플레이 중 흐른 시간
    s.idleTime = 0;         // 대기 화면 애니메이션용
    s.scroll = 0;           // 바닥/배경 스크롤 누적 거리
    s.countdown = 0;
    s.acc = 0;
    s.bird = { x: BIRD_X, y: BIRD_START_Y, vy: 0 };
    s.gateSeq = 0;
    s.gates = [makeGate(s, FIRST_GATE_X)];
    fillGates(s);
    return s;
  }

  function fillGates(s) {
    var last = s.gates[s.gates.length - 1];
    while (last.x + GATE_SPACING < WIDTH + GATE_WIDTH + GATE_SPACING) {
      last = makeGate(s, last.x + GATE_SPACING);
      s.gates.push(last);
    }
  }

  // ---- 입력 ------------------------------------------------------------

  /** 날갯짓. 대기 상태에서는 게임을 시작하면서 곧바로 날갯짓합니다. */
  function flap(s) {
    if (s.status === STATUS.READY) s.status = STATUS.PLAYING;
    if (s.status !== STATUS.PLAYING || s.countdown > 0) return false;
    s.bird.vy = FLAP_VELOCITY;
    return true;
  }

  function pause(s) {
    if (s.status !== STATUS.PLAYING) return false;
    s.status = STATUS.PAUSED;
    return true;
  }

  function resume(s) {
    if (s.status !== STATUS.PAUSED) return false;
    s.status = STATUS.PLAYING;
    s.countdown = RESUME_COUNTDOWN;
    s.acc = 0;
    return true;
  }

  // ---- 시뮬레이션 --------------------------------------------------------

  /** 점수가 오르는 즉시 최고 기록을 갱신합니다. newBest 는 판 시작 때의 기록을 넘었는지로 정합니다. */
  function recordBest(s) {
    if (s.score > s.best) s.best = s.score;
    s.newBest = s.score > s.runStartBest;
  }

  function gameOver(s, reason) {
    s.status = STATUS.GAMEOVER;
    s.deathReason = reason;
  }

  function birdHitsGate(s, g) {
    var b = s.bird, top = g.gapY - GATE_GAP / 2, bottom = g.gapY + GATE_GAP / 2;
    return circleRectHit(b.x, b.y, BIRD_HIT_RADIUS, g.x, -1000, GATE_WIDTH, top + 1000) ||
           circleRectHit(b.x, b.y, BIRD_HIT_RADIUS, g.x, bottom, GATE_WIDTH, GROUND_Y - bottom + 1000);
  }

  function simulate(s, dt) {
    var b = s.bird;
    // 등가속 운동의 정확한 적분 → 프레임 길이에 거의 무관한 결과
    var vy0 = b.vy;
    var vy1 = Math.min(vy0 + GRAVITY * dt, MAX_FALL_SPEED);
    var tAcc = (vy1 - vy0) / GRAVITY;                 // 가속이 실제로 적용된 시간
    b.y += vy0 * tAcc + 0.5 * GRAVITY * tAcc * tAcc + vy1 * (dt - tAcc);
    b.vy = vy1;

    var dx = currentSpeed(s) * dt;
    s.scroll += dx;
    s.elapsed += dt;
    for (var i = 0; i < s.gates.length; i++) s.gates[i].x -= dx;

    if (b.y - BIRD_HIT_RADIUS < 0) { b.y = BIRD_HIT_RADIUS; if (b.vy < 0) b.vy = 0; } // 천장은 막기만 함

    for (i = 0; i < s.gates.length; i++) {
      var g = s.gates[i];
      if (birdHitsGate(s, g)) { gameOver(s, 'gate'); return; }
      if (!g.scored && g.x + GATE_WIDTH < b.x) { g.scored = true; s.score++; recordBest(s); }
    }
    if (b.y + BIRD_HIT_RADIUS >= GROUND_Y) {
      b.y = GROUND_Y - BIRD_HIT_RADIUS;
      gameOver(s, 'ground');
      return;
    }
    while (s.gates.length && s.gates[0].x + GATE_WIDTH < -20) s.gates.shift();
    fillGates(s);
  }

  /** 프레임 시간 dt(초)만큼 진행. dt 는 [0, MAX_FRAME_DT] 로 제한되고 하위 단계로 쪼개집니다. */
  function step(s, dt) {
    dt = Number(dt);
    if (!(dt > 0)) return;
    dt = Math.min(dt, MAX_FRAME_DT);

    if (s.status === STATUS.READY) {
      s.idleTime += dt;
      s.scroll += SCROLL_SPEED * dt;
      s.bird.y = BIRD_START_Y + Math.sin(s.idleTime * 4) * 7;
      return;
    }
    if (s.status !== STATUS.PLAYING) return; // 일시정지·게임오버는 완전 정지

    if (s.countdown > 0) {
      var used = Math.min(dt, s.countdown);
      s.countdown -= used;
      dt -= used;
      if (s.countdown <= 1e-9) s.countdown = 0;
      if (dt <= 0) return;
    }
    var n = Math.ceil(dt / SUBSTEP_DT - 1e-9);
    var h = dt / n;
    for (var i = 0; i < n && s.status === STATUS.PLAYING; i++) simulate(s, h);
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, GROUND_H: GROUND_H, GROUND_Y: GROUND_Y,
    GRAVITY: GRAVITY, FLAP_VELOCITY: FLAP_VELOCITY, MAX_FALL_SPEED: MAX_FALL_SPEED,
    SCROLL_SPEED: SCROLL_SPEED, SPEED_PER_POINT: SPEED_PER_POINT, SPEED_BONUS_MAX: SPEED_BONUS_MAX,
    GATE_WIDTH: GATE_WIDTH, GATE_GAP: GATE_GAP, GATE_SPACING: GATE_SPACING, GAP_MARGIN: GAP_MARGIN,
    FIRST_GATE_X: FIRST_GATE_X, BIRD_X: BIRD_X, BIRD_HIT_RADIUS: BIRD_HIT_RADIUS,
    BIRD_DRAW_RADIUS: BIRD_DRAW_RADIUS, BIRD_START_Y: BIRD_START_Y,
    MAX_FRAME_DT: MAX_FRAME_DT, SUBSTEP_DT: SUBSTEP_DT, RESUME_COUNTDOWN: RESUME_COUNTDOWN,
    STATUS: STATUS,
    gapCenterRange: gapCenterRange, randomGapCenter: randomGapCenter, circleRectHit: circleRectHit,
    currentSpeed: currentSpeed, createState: createState, reset: reset,
    flap: flap, pause: pause, resume: resume, step: step
  };
});
