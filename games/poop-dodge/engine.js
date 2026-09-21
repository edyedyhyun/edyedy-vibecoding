/**
 * PoopDodgeEngine — 오늘도 무사히 · 똥피하기 의 순수 게임 로직.
 * DOM 의존성이 없으며 CommonJS(module.exports)와 브라우저 전역(PoopDodgeEngine) 양쪽에서 쓸 수 있습니다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PoopDodgeEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 튜닝 상수 (단위: 논리 픽셀, 초) ---------------------------------
  var WIDTH = 480;
  var HEIGHT = 600;
  var GROUND_H = 64;
  var GROUND_Y = HEIGHT - GROUND_H;   // 바닥 윗면

  var PLAYER_W = 44;                  // 그려지는 캐릭터 크기
  var PLAYER_H = 56;
  var PLAYER_HIT_W = 28;              // 충돌 상자(AABB): 그림보다 작게 — 스쳐 지나가는 건 봐준다
  var PLAYER_HIT_H = 40;
  var PLAYER_SPEED = 330;             // px/s 최고 이동 속도
  var PLAYER_ACCEL = 2800;            // px/s² 가속·감속 (약 0.12초에 최고 속도)
  var PLAYER_MIN_X = PLAYER_W / 2;
  var PLAYER_MAX_X = WIDTH - PLAYER_W / 2;
  var PLAYER_START_X = WIDTH / 2;
  var DRAG_SLOW_ZONE = 24;            // 끌기 목표 가까이에서 부드럽게 멈추는 거리

  var POOP_DRAW_R = 22;               // 그려지는 똥 반지름
  var POOP_HIT_R = 15;                // 충돌 원 반지름 (그림보다 작음)
  var SPAWN_Y = -30;                  // 화면 위쪽 밖에서 생성

  var RAMP_SECONDS = 100;             // 이 시간이 지나면 난이도가 상한에 도달
  var FALL_SPEED_START = 170;         // px/s
  var FALL_SPEED_MAX = 380;
  var SPAWN_INTERVAL_START = 0.95;    // 초
  var SPAWN_INTERVAL_MIN = 0.42;
  var SPAWN_JITTER = 0.2;             // 간격의 ±20%
  var FIRST_SPAWN_DELAY = 0.8;
  var AIM_CHANCE = 0.35;              // 플레이어 근처를 노리는 확률

  // 생성 지점에 여유를 남기는 '안전 통로': 천천히 좌우로 떠다니며 이 폭 안에는 똥을 만들지 않는다
  var LANE_MARGIN = 26;
  var LANE_HALF = POOP_HIT_R + PLAYER_HIT_W / 2 + LANE_MARGIN;   // 55
  var LANE_MIN_X = LANE_HALF;
  var LANE_MAX_X = WIDTH - LANE_HALF;
  var LANE_SPEED = 100;               // px/s — 플레이어 속도보다 충분히 느림
  var LANE_RETARGET_MIN = 0.8;
  var LANE_RETARGET_MAX = 1.6;

  var MAX_FRAME_DT = 1 / 20;          // 프레임 하나가 처리할 최대 시간 (탭 복귀 등 큰 dt 방지)
  var SUBSTEP_DT = 1 / 120;           // 충돌 판정 하위 단계
  var MAX_LANDINGS = 24;
  var BEST_CAP_MS = 359999000;

  var STATUS = { READY: 'ready', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return t >= 1 ? b : a + (b - a) * t; }

  /** 경과 시간(초)에 따른 난이도. 상한이 있어 무한히 어려워지지 않는다. */
  function difficultyAt(t) {
    var k = t === Infinity ? 1 : clamp(t === t ? t / RAMP_SECONDS : 0, 0, 1);
    return {
      level: k,
      fallSpeed: lerp(FALL_SPEED_START, FALL_SPEED_MAX, k),
      spawnInterval: lerp(SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN, k)
    };
  }

  /** 똥이 화면 위에서 나타나 플레이어 머리 높이에 닿기까지 걸리는 최소 시간(가장 빠를 때). */
  var MIN_REACTION_TIME = (GROUND_Y - PLAYER_HIT_H - POOP_HIT_R - SPAWN_Y) / FALL_SPEED_MAX;

  /** 원(cx,cy,r) 과 사각형(rx,ry,rw,rh) 이 겹치는가. */
  function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
    var nx = clamp(cx, rx, rx + rw);
    var ny = clamp(cy, ry, ry + rh);
    var dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  }

  function playerBox(s) {
    return { x: s.player.x - PLAYER_HIT_W / 2, y: GROUND_Y - PLAYER_HIT_H, w: PLAYER_HIT_W, h: PLAYER_HIT_H };
  }

  // ---- 입력 (순수 로직) ------------------------------------------------
  /** 키보드 code → 동작. 한글 자판 상태에서도 동작하도록 e.code 기준. */
  function actionForCode(code) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': return 'left';
      case 'ArrowRight': case 'KeyD': return 'right';
      case 'KeyP': case 'Escape': return 'pause';
      case 'KeyR': return 'restart';
      default: return null;
    }
  }

  /** 누르고 있는 입력 출처(source) 별로 기록한다. 왼쪽·오른쪽이 동시에 눌리면 상쇄된다. */
  function press(s, source, dir) {
    if (s.status !== STATUS.PLAYING) return false;
    if (dir !== -1 && dir !== 1) return false;
    s.input.held[source] = dir;
    return true;
  }
  function release(s, source) {
    if (!Object.prototype.hasOwnProperty.call(s.input.held, source)) return false;
    delete s.input.held[source];
    return true;
  }
  function releaseAll(s) {
    s.input.held = {};
    s.input.target = null;
  }
  function inputDir(s) {
    var d = 0;
    var held = s.input.held;
    var seenL = false, seenR = false;
    for (var k in held) {
      if (held[k] < 0) seenL = true; else if (held[k] > 0) seenR = true;
    }
    if (seenL) d -= 1;
    if (seenR) d += 1;
    return d;
  }
  /** 캔버스 끌기 목표 지점(논리 x). null 이면 해제. */
  function setTarget(s, x) {
    if (x === null) { s.input.target = null; return true; }
    if (s.status !== STATUS.PLAYING || !isFinite(x)) return false;
    s.input.target = clamp(x, PLAYER_MIN_X, PLAYER_MAX_X);
    return true;
  }

  // ---- 상태 ------------------------------------------------------------
  function createState(opts) {
    opts = opts || {};
    var s = {
      rng: opts.rng || Math.random,
      status: STATUS.READY,
      time: 0,              // 생존 시간(초) — 플레이 중에만 흐른다
      dodged: 0,
      best: sanitizeBest(opts.best),   // 최고 생존 시간(초)
      bestAtStart: 0,
      newRecord: false,
      player: { x: PLAYER_START_X, vx: 0 },
      input: { held: {}, target: null },
      poops: [],
      landings: [],         // 바닥에 떨어진 위치(연출용). 앱이 비워 간다.
      lane: { x: WIDTH / 2, v: 0, retarget: 0 },
      spawnTimer: FIRST_SPAWN_DELAY,
      nextId: 1,
      hitBy: null
    };
    s.bestAtStart = s.best;
    return s;
  }

  function reset(s) {
    var best = s.best;
    var fresh = createState({ rng: s.rng, best: best });
    for (var k in fresh) s[k] = fresh[k];
    return s;
  }

  function start(s) {
    if (s.status !== STATUS.READY) return false;
    s.status = STATUS.PLAYING;
    s.bestAtStart = s.best;
    releaseAll(s);
    return true;
  }
  function pause(s) {
    if (s.status !== STATUS.PLAYING) return false;
    s.status = STATUS.PAUSED;
    s.player.vx = 0;
    releaseAll(s);
    return true;
  }
  function resume(s) {
    if (s.status !== STATUS.PAUSED) return false;
    s.status = STATUS.PLAYING;
    releaseAll(s);
    return true;
  }
  /** 일시정지·게임 오버 상태에서만 다시 시작. 최고 기록은 유지. */
  function restart(s) {
    if (s.status !== STATUS.PAUSED && s.status !== STATUS.GAMEOVER) return false;
    reset(s);
    s.status = STATUS.PLAYING;
    s.bestAtStart = s.best;
    return true;
  }
  /** 최고 기록 지우기. 플레이 중에는 거부한다. */
  function resetBest(s) {
    if (s.status === STATUS.PLAYING) return false;
    s.best = 0;
    s.bestAtStart = 0;
    s.newRecord = false;
    return true;
  }

  // ---- 저장값 다루기 ----------------------------------------------------
  /** 저장된 문자열/숫자(밀리초 또는 초)를 안전한 초 단위 숫자로. 이상한 값은 0. */
  function sanitizeBest(v) {
    if (typeof v !== 'number' || !isFinite(v) || v <= 0) return 0;
    return Math.min(v, BEST_CAP_MS / 1000);
  }
  function parseStoredBest(raw) {
    if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw)) return 0;
    return sanitizeBest(parseInt(raw, 10) / 1000);
  }
  function serializeBest(sec) {
    return String(Math.floor(sanitizeBest(sec) * 1000));
  }
  function formatTime(sec) {
    sec = isFinite(sec) && sec > 0 ? sec : 0;
    var tenths = Math.floor(sec * 10 + 1e-9);
    var m = Math.floor(tenths / 600);
    var rest = (tenths - m * 600) / 10;
    var txt = rest.toFixed(1);
    if (m > 0) return m + '분 ' + (rest < 10 ? '0' : '') + txt + '초';
    return txt + '초';
  }

  // ---- 진행 ------------------------------------------------------------
  function updateLane(s, h) {
    var lane = s.lane;
    lane.retarget -= h;
    if (lane.retarget <= 0) {
      lane.v = (s.rng() * 2 - 1) * LANE_SPEED;
      lane.retarget = lerp(LANE_RETARGET_MIN, LANE_RETARGET_MAX, s.rng());
    }
    lane.x += lane.v * h;
    if (lane.x < LANE_MIN_X) { lane.x = LANE_MIN_X; lane.v = Math.abs(lane.v); }
    else if (lane.x > LANE_MAX_X) { lane.x = LANE_MAX_X; lane.v = -Math.abs(lane.v); }
  }

  /** 안전 통로 밖에서 x 를 고른다. 통로 밖이 없으면 null. */
  function pickSpawnX(s) {
    var lo = POOP_DRAW_R, hi = WIDTH - POOP_DRAW_R;
    var a1 = lo, b1 = s.lane.x - LANE_HALF;
    var a2 = s.lane.x + LANE_HALF, b2 = hi;
    var l1 = Math.max(0, b1 - a1), l2 = Math.max(0, b2 - a2);
    function allowed(x) { return (x >= a1 && x <= b1) || (x >= a2 && x <= b2); }
    if (s.rng() < AIM_CHANCE) {
      var aim = s.player.x + (s.rng() - 0.5) * 60;
      if (allowed(aim)) return aim;
    }
    var total = l1 + l2;
    if (total <= 0) return null;
    var u = s.rng() * total;
    return u < l1 ? a1 + u : a2 + (u - l1);
  }

  function spawnPoop(s, fallSpeed) {
    var x = pickSpawnX(s);
    if (x === null) return;
    s.poops.push({ id: s.nextId++, x: x, y: SPAWN_Y, vy: fallSpeed, r: POOP_HIT_R, rot: s.rng() * 6.283 });
  }

  function movePlayer(s, h) {
    var p = s.player;
    var dir = inputDir(s);
    var want = 0;
    if (dir !== 0) want = dir * PLAYER_SPEED;
    else if (s.input.target !== null) {
      var d = s.input.target - p.x;
      if (Math.abs(d) > 1) want = (d > 0 ? 1 : -1) * PLAYER_SPEED * Math.min(1, Math.abs(d) / DRAG_SLOW_ZONE);
    }
    var dv = want - p.vx, maxDv = PLAYER_ACCEL * h;
    p.vx += clamp(dv, -maxDv, maxDv);
    p.x += p.vx * h;
    if (p.x < PLAYER_MIN_X) { p.x = PLAYER_MIN_X; p.vx = 0; }
    else if (p.x > PLAYER_MAX_X) { p.x = PLAYER_MAX_X; p.vx = 0; }
  }

  function substep(s, h) {
    s.time += h;
    if (s.time > s.best) {
      s.best = s.time;
      s.newRecord = s.time > s.bestAtStart;
    }
    var diff = difficultyAt(s.time);

    movePlayer(s, h);
    updateLane(s, h);

    s.spawnTimer -= h;
    if (s.spawnTimer <= 0) {
      spawnPoop(s, diff.fallSpeed);
      s.spawnTimer += diff.spawnInterval * (1 + (s.rng() * 2 - 1) * SPAWN_JITTER);
    }

    var box = playerBox(s);
    var keep = [];
    for (var i = 0; i < s.poops.length; i++) {
      var q = s.poops[i];
      q.y += q.vy * h;
      if (circleRectHit(q.x, q.y, q.r, box.x, box.y, box.w, box.h)) {
        s.status = STATUS.GAMEOVER;
        s.hitBy = q;
        s.player.vx = 0;
        releaseAll(s);
        return;
      }
      if (q.y + q.r >= GROUND_Y) {
        s.dodged += 1;   // 판정을 지나 바닥에 닿는 순간 딱 한 번 (목록에서 즉시 제거)
        s.landings.push({ x: q.x, id: q.id });
        if (s.landings.length > MAX_LANDINGS) s.landings.shift();
      } else keep.push(q);
    }
    s.poops = keep;
  }

  /** dt(초)만큼 진행. 너무 큰 dt 는 잘라내고, 작은 하위 단계로 나눠 관통을 막는다. */
  function step(s, dt) {
    if (s.status !== STATUS.PLAYING) return;
    if (!isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, MAX_FRAME_DT);
    var n = Math.ceil(dt / SUBSTEP_DT - 1e-9);
    var h = dt / n;
    for (var i = 0; i < n && s.status === STATUS.PLAYING; i++) substep(s, h);
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, GROUND_H: GROUND_H, GROUND_Y: GROUND_Y,
    PLAYER_W: PLAYER_W, PLAYER_H: PLAYER_H, PLAYER_HIT_W: PLAYER_HIT_W, PLAYER_HIT_H: PLAYER_HIT_H,
    PLAYER_SPEED: PLAYER_SPEED, PLAYER_ACCEL: PLAYER_ACCEL, PLAYER_MIN_X: PLAYER_MIN_X, PLAYER_MAX_X: PLAYER_MAX_X,
    PLAYER_START_X: PLAYER_START_X,
    POOP_DRAW_R: POOP_DRAW_R, POOP_HIT_R: POOP_HIT_R, SPAWN_Y: SPAWN_Y,
    RAMP_SECONDS: RAMP_SECONDS, FALL_SPEED_START: FALL_SPEED_START, FALL_SPEED_MAX: FALL_SPEED_MAX,
    SPAWN_INTERVAL_START: SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN: SPAWN_INTERVAL_MIN,
    SPAWN_JITTER: SPAWN_JITTER, FIRST_SPAWN_DELAY: FIRST_SPAWN_DELAY, AIM_CHANCE: AIM_CHANCE,
    LANE_HALF: LANE_HALF, LANE_SPEED: LANE_SPEED, MIN_REACTION_TIME: MIN_REACTION_TIME,
    MAX_FRAME_DT: MAX_FRAME_DT, SUBSTEP_DT: SUBSTEP_DT, STATUS: STATUS,
    difficultyAt: difficultyAt, circleRectHit: circleRectHit, playerBox: playerBox,
    actionForCode: actionForCode, press: press, release: release, releaseAll: releaseAll,
    inputDir: inputDir, setTarget: setTarget,
    createState: createState, reset: reset, start: start, pause: pause, resume: resume,
    restart: restart, resetBest: resetBest,
    sanitizeBest: sanitizeBest, parseStoredBest: parseStoredBest, serializeBest: serializeBest,
    formatTime: formatTime, step: step
  };
});
