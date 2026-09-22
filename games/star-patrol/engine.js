/**
 * StarPatrolEngine — 별빛 순찰대 · STAR PATROL 의 순수 게임 로직.
 * DOM 의존성이 없으며 CommonJS(module.exports)와 브라우저 전역(StarPatrolEngine) 양쪽에서 쓸 수 있습니다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StarPatrolEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 튜닝 상수 (단위: 논리 픽셀, 초) ---------------------------------
  var WIDTH = 480;
  var HEIGHT = 640;

  var STATUS = { READY: 'ready', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

  var FIRE_INTERVAL = { FAST: 0.16, NORMAL: 0.24 };

  var PLAYER_SPEED = 260;         // px/s
  var PLAYER_Y = HEIGHT - 56;
  var PLAYER_RADIUS = 13;         // 충돌 반지름
  var PLAYER_MARGIN = 24;         // 화면 가장자리 여유

  var PLAYER_BULLET_SPEED = 560;  // px/s 위로
  var PLAYER_BULLET_R = 4;

  var ENEMY_BULLET_R = 4;
  var ENEMY_BULLET_BASE_SPEED = 200;
  var ENEMY_BULLET_SPEED_STEP = 12;
  var ENEMY_BULLET_SPEED_MAX = 260;
  var MAX_ENEMY_BULLETS = 6;

  var INVULN_TIME = 1.5;
  var LIVES_START = 3;

  var ROWS = 4;
  var COLS = 8;
  var ENEMY_SPACING_X = 46;
  var ENEMY_SPACING_Y = 38;
  var ENEMY_TOP = 100;
  var ENEMY_MARGIN_X = 42;
  var ENEMY_RADIUS = 13;
  var DYING_DURATION = 0.16;      // 격추 후 잔상이 보이는 시간(이 동안은 충돌 판정에서 제외)

  var FORMATION_MARGIN = 20;
  var FORMATION_BASE_SPEED = 40;
  var FORMATION_SPEED_STEP = 6;
  var FORMATION_SPEED_MAX = 88;

  var DIVE_DOWN_TIME = 1.1;
  var DIVE_UP_TIME = 0.9;
  var DIVE_DUR = DIVE_DOWN_TIME + DIVE_UP_TIME;
  var DIVE_FIRE_AT = 0.5;         // diveT/diveDur 가 이 값을 넘으면 한 번 발사
  var DIVE_INTERVAL_BASE = 3.2;
  var DIVE_INTERVAL_STEP = 0.25;
  var DIVE_INTERVAL_MIN = 1.4;
  var MAX_CONCURRENT_DIVERS_BASE = 1;
  var MAX_CONCURRENT_DIVERS_CAP = 3;

  var FORMATION_FIRE_MIN = 2.4;
  var FORMATION_FIRE_MAX = 4.0;
  var FORMATION_FIRE_STEP = 0.15;
  var FORMATION_FIRE_FLOOR = 0.9;

  var MAX_WAVE_SCALING = 6;       // 이 웨이브 이후로는 난이도가 더 오르지 않음(상한)
  var WAVE_TRANSITION_TIME = 1.6;

  var MAX_FRAME_DT = 0.1;
  var SUBSTEP_DT = 1 / 120;

  var SCORE_AMBER = 100;
  var SCORE_CORAL = 150;

  // ---- 순수 헬퍼 -------------------------------------------------------
  function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

  function effWave(wave) { return Math.min(wave, MAX_WAVE_SCALING); }

  function formationSpeed(wave) {
    var e = effWave(wave);
    return Math.min(FORMATION_SPEED_MAX, FORMATION_BASE_SPEED + (e - 1) * FORMATION_SPEED_STEP);
  }
  function diveInterval(wave) {
    var e = effWave(wave);
    return Math.max(DIVE_INTERVAL_MIN, DIVE_INTERVAL_BASE - (e - 1) * DIVE_INTERVAL_STEP);
  }
  function maxConcurrentDivers(wave) {
    var e = effWave(wave);
    return Math.min(MAX_CONCURRENT_DIVERS_CAP, MAX_CONCURRENT_DIVERS_BASE + Math.floor((e - 1) / 2));
  }
  function enemyBulletSpeed(wave) {
    var e = effWave(wave);
    return Math.min(ENEMY_BULLET_SPEED_MAX, ENEMY_BULLET_BASE_SPEED + (e - 1) * ENEMY_BULLET_SPEED_STEP);
  }
  function formationFireInterval(wave, rng) {
    var e = effWave(wave);
    var lo = Math.max(FORMATION_FIRE_FLOOR, FORMATION_FIRE_MIN - (e - 1) * FORMATION_FIRE_STEP);
    var hi = Math.max(lo + 0.2, FORMATION_FIRE_MAX - (e - 1) * FORMATION_FIRE_STEP);
    var u = clamp(Number(rng()) || 0, 0, 1);
    return lo + u * (hi - lo);
  }

  function bezierPoint(p0, p1, p2, t) {
    var mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    };
  }

  /** 원과 수직 선분(x 고정, yA~yB)이 충돌하는지 검사. 빠른 총알의 스킵(터널링) 방지용. */
  function circleVsVerticalSegment(cx, cy, r, x, yA, yB, r2) {
    var closestY = clamp(cy, Math.min(yA, yB), Math.max(yA, yB));
    var dx = cx - x, dy = cy - closestY;
    var rr = r + r2;
    return dx * dx + dy * dy <= rr * rr;
  }

  function circleHit(ax, ay, ar, bx, by, br) {
    var dx = ax - bx, dy = ay - by, rr = ar + br;
    return dx * dx + dy * dy <= rr * rr;
  }

  // ---- 상태 -------------------------------------------------------------

  function createState(opts) {
    opts = opts || {};
    var s = {
      rng: opts.rng || Math.random,
      best: Number.isFinite(opts.best) && opts.best > 0 ? Math.min(999999999,Math.floor(opts.best)) : 0,
      fireInterval: opts.fireInterval === 'fast' ? FIRE_INTERVAL.FAST : FIRE_INTERVAL.NORMAL
    };
    resetRun(s);
    return s;
  }

  function spawnFormation(s, wave) {
    var enemies = [];
    var id = 0;
    for (var row = 0; row < ROWS; row++) {
      for (var col = 0; col < COLS; col++) {
        var homeX = col * ENEMY_SPACING_X;
        var homeY = row * ENEMY_SPACING_Y;
        enemies.push({
          id: id++,
          row: row, col: col,
          homeX: homeX, homeY: homeY,
          baseX: ENEMY_MARGIN_X + homeX,
          x: ENEMY_MARGIN_X + homeX, y: ENEMY_TOP + homeY,
          kind: row % 2 === 0 ? 'amber' : 'coral',
          state: 'formation',
          alive: true,
          dyingT: 0,
          diveT: 0, diveDur: DIVE_DUR, p0: null, p1: null, p2: null, firedThisDive: false
        });
      }
    }
    s.enemies = enemies;
    var rightmostBase = ENEMY_MARGIN_X + (COLS - 1) * ENEMY_SPACING_X;
    s.formation = {
      offsetX: 0, dir: 1,
      minOffset: FORMATION_MARGIN - ENEMY_MARGIN_X,
      maxOffset: WIDTH - FORMATION_MARGIN - rightmostBase
    };
    s.diveTimer = diveInterval(wave) * 0.6;
    s.formationFireTimer = formationFireInterval(wave, s.rng);
  }

  /** 최고 기록과 rng, 발사 간격 설정은 유지하고 나머지를 전부 새 판으로 되돌립니다. */
  function resetRun(s) {
    s.status = STATUS.READY;
    s.score = 0;
    s.runStartBest = s.best;
    s.newBest = false;
    s.lives = LIVES_START;
    s.wave = 1;
    s.transitioning = false;
    s.transitionTimer = 0;
    s.elapsed = 0;
    s.player = { x: WIDTH / 2, y: PLAYER_Y, alive: true, invuln: 0, cooldown: 0 };
    s.input = { left: false, right: false, fire: false };
    s.playerBullets = [];
    s.enemyBullets = [];
    s.particles = [];
    spawnFormation(s, s.wave);
    return s;
  }

  // ---- 입력/제어 ---------------------------------------------------------

  function setFireInterval(s, key) {
    if (s.status !== STATUS.READY) return false;
    s.fireInterval = key === 'fast' ? FIRE_INTERVAL.FAST : FIRE_INTERVAL.NORMAL;
    return true;
  }
  function start(s) {
    if (s.status !== STATUS.READY) return false;
    s.status = STATUS.PLAYING;
    return true;
  }
  function setLeft(s, v) { s.input.left = !!v; }
  function setRight(s, v) { s.input.right = !!v; }
  function setFire(s, v) { s.input.fire = !!v; }
  function clearInput(s) { s.input.left = false; s.input.right = false; s.input.fire = false; }

  function pause(s) {
    if (s.status !== STATUS.PLAYING) return false;
    s.status = STATUS.PAUSED;
    clearInput(s);
    return true;
  }
  function resume(s) {
    if (s.status !== STATUS.PAUSED) return false;
    s.status = STATUS.PLAYING;
    return true;
  }
  /** 일시정지 또는 게임 오버 상태에서만 허용. 대기 화면으로 돌아가고, 총알/입자/입력이 모두 사라집니다. */
  function restart(s) {
    if (s.status !== STATUS.PAUSED && s.status !== STATUS.GAMEOVER) return false;
    resetRun(s);
    return true;
  }

  // ---- 점수/게임오버 ------------------------------------------------------

  function addScore(s, pts) {
    s.score += pts;
    if (s.score > s.best) s.best = s.score;
    s.newBest = s.score > s.runStartBest;
  }

  function gameOver(s) {
    s.status = STATUS.GAMEOVER;
    clearInput(s);
  }

  function spawnParticles(s, x, y, color, count) {
    for (var i = 0; i < count; i++) {
      var a = s.rng() * Math.PI * 2;
      var sp = 60 + s.rng() * 140;
      s.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.28 + s.rng() * 0.3, maxLife: 0.6, color: color
      });
    }
  }

  function killEnemy(s, e) {
    if (!e.alive) return;
    e.alive = false;
    e.state = 'dying';
    e.dyingT = 0;
    addScore(s, e.kind === 'coral' ? SCORE_CORAL : SCORE_AMBER);
    spawnParticles(s, e.x, e.y, e.kind === 'coral' ? '#ff8a6b' : '#ffc65c', 10);
  }

  function hurtPlayer(s) {
    var p = s.player;
    if (p.invuln > 0 || !p.alive) return;
    s.lives--;
    p.invuln = INVULN_TIME;
    spawnParticles(s, p.x, p.y, '#cdeee3', 14);
    if (s.lives <= 0) {
      s.lives = 0;
      p.alive = false;
      gameOver(s);
    }
  }

  // ---- 다이빙 -------------------------------------------------------------

  function startDive(s, e) {
    e.state = 'diving';
    e.diveT = 0;
    e.firedThisDive = false;
    e.p0 = { x: e.x, y: e.y };
    var targetX = clamp(s.player.x + (s.rng() * 2 - 1) * 70, 30, WIDTH - 30);
    e.p1 = { x: targetX, y: HEIGHT - 150 };
    e.p2 = { x: e.baseX, y: -30 };
  }

  // ---- 시뮬레이션(하위 단계 h초) --------------------------------------------

  function simulate(s, h) {
    var p = s.player;
    s.elapsed += h;

    // 플레이어 이동
    var vx = 0;
    if (s.input.left && !s.input.right) vx = -PLAYER_SPEED;
    else if (s.input.right && !s.input.left) vx = PLAYER_SPEED;
    p.x = clamp(p.x + vx * h, PLAYER_MARGIN, WIDTH - PLAYER_MARGIN);
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - h);
    if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - h);

    // 발사
    if (p.alive && s.input.fire && p.cooldown <= 0) {
      s.playerBullets.push({ x: p.x, y: p.y - 18, vy: -PLAYER_BULLET_SPEED });
      p.cooldown = s.fireInterval;
    }

    // 총알 이동 (기록: prevY → 스윕 충돌에 사용)
    var i;
    for (i = 0; i < s.playerBullets.length; i++) {
      var pb = s.playerBullets[i];
      pb.prevY = pb.y;
      pb.y += pb.vy * h;
    }
    for (i = 0; i < s.enemyBullets.length; i++) {
      var eb = s.enemyBullets[i];
      eb.prevY = eb.y;
      eb.y += eb.vy * h;
    }

    // 편대 이동
    var f = s.formation;
    var fs = formationSpeed(s.wave);
    f.offsetX += f.dir * fs * h;
    if (f.offsetX > f.maxOffset) { f.offsetX = f.maxOffset; f.dir = -1; }
    if (f.offsetX < f.minOffset) { f.offsetX = f.minOffset; f.dir = 1; }

    // 적 갱신
    var divingCount = 0;
    for (i = 0; i < s.enemies.length; i++) {
      var e = s.enemies[i];
      if (e.state === 'formation') {
        e.x = f.offsetX + e.baseX;
        e.y = ENEMY_TOP + e.homeY;
      } else if (e.state === 'diving') {
        divingCount++;
        e.diveT += h;
        var t = clamp(e.diveT / e.diveDur, 0, 1);
        var pos = bezierPoint(e.p0, e.p1, e.p2, t);
        e.x = pos.x; e.y = pos.y;
        if (!e.firedThisDive && t >= DIVE_FIRE_AT && s.enemyBullets.length < MAX_ENEMY_BULLETS) {
          e.firedThisDive = true;
          s.enemyBullets.push({ x: e.x, y: e.y, prevY: e.y, vy: enemyBulletSpeed(s.wave) });
        }
        if (e.diveT >= e.diveDur) e.state = 'formation';
      } else if (e.state === 'dying') {
        e.dyingT += h;
      }
    }

    if (!s.transitioning) {
      // 다이빙 발동
      s.diveTimer -= h;
      if (s.diveTimer <= 0 && divingCount < maxConcurrentDivers(s.wave)) {
        var candidates = [];
        for (i = 0; i < s.enemies.length; i++) if (s.enemies[i].state === 'formation') candidates.push(s.enemies[i]);
        if (candidates.length) {
          var idx = Math.min(candidates.length - 1, Math.floor(s.rng() * candidates.length));
          startDive(s, candidates[idx]);
        }
        s.diveTimer = diveInterval(s.wave);
      }

      // 편대 사격
      s.formationFireTimer -= h;
      if (s.formationFireTimer <= 0) {
        s.formationFireTimer = formationFireInterval(s.wave, s.rng);
        if (s.enemyBullets.length < MAX_ENEMY_BULLETS) {
          var shooters = [];
          for (i = 0; i < s.enemies.length; i++) if (s.enemies[i].state === 'formation') shooters.push(s.enemies[i]);
          if (shooters.length) {
            var si = Math.min(shooters.length - 1, Math.floor(s.rng() * shooters.length));
            var shooter = shooters[si];
            s.enemyBullets.push({ x: shooter.x, y: shooter.y, prevY: shooter.y, vy: enemyBulletSpeed(s.wave) });
          }
        }
      }
    }

    // 충돌: 플레이어 총알 vs 적
    for (i = 0; i < s.playerBullets.length; i++) {
      var b = s.playerBullets[i];
      if (b.dead) continue;
      for (var j = 0; j < s.enemies.length; j++) {
        var en = s.enemies[j];
        if (!en.alive) continue;
        if (circleVsVerticalSegment(en.x, en.y, ENEMY_RADIUS, b.x, b.prevY, b.y, PLAYER_BULLET_R)) {
          b.dead = true;
          killEnemy(s, en);
          break;
        }
      }
    }

    // 충돌: 적 총알 vs 플레이어
    if (p.alive) {
      for (i = 0; i < s.enemyBullets.length; i++) {
        var eb2 = s.enemyBullets[i];
        if (eb2.dead) continue;
        if (circleVsVerticalSegment(p.x, p.y, PLAYER_RADIUS, eb2.x, eb2.prevY, eb2.y, ENEMY_BULLET_R)) {
          eb2.dead = true;
          hurtPlayer(s);
        }
      }
    }

    // 충돌: 적 vs 플레이어 (몸통 박치기)
    if (p.alive) {
      for (i = 0; i < s.enemies.length; i++) {
        var en2 = s.enemies[i];
        if (!en2.alive) continue;
        if (circleHit(p.x, p.y, PLAYER_RADIUS, en2.x, en2.y, ENEMY_RADIUS)) {
          killEnemy(s, en2);
          hurtPlayer(s);
        }
      }
    }

    // 정리: 화면 밖/소멸된 것들 제거
    s.playerBullets = s.playerBullets.filter(function (bb) { return !bb.dead && bb.y > -20; });
    s.enemyBullets = s.enemyBullets.filter(function (bb) { return !bb.dead && bb.y < HEIGHT + 20; });
    s.enemies = s.enemies.filter(function (ee) { return ee.state !== 'dying' || ee.dyingT < DYING_DURATION; });
    s.particles = s.particles.filter(function (pp) { return pp.life > 0; });
    for (i = 0; i < s.particles.length; i++) {
      var pt = s.particles[i];
      pt.x += pt.vx * h; pt.y += pt.vy * h; pt.life -= h;
    }

    // 웨이브 전환
    if (!s.transitioning) {
      var anyLeft = false;
      for (i = 0; i < s.enemies.length; i++) if (s.enemies[i].state !== 'dying') { anyLeft = true; break; }
      if (!anyLeft && s.enemies.length === 0 && s.status === STATUS.PLAYING) {
        s.transitioning = true;
        s.transitionTimer = WAVE_TRANSITION_TIME;
        s.enemyBullets = []; s.playerBullets = [];
      }
    } else {
      s.transitionTimer -= h;
      if (s.transitionTimer <= 0) {
        s.wave++;
        spawnFormation(s, s.wave);
        s.transitioning = false;
      }
    }
  }

  /** 프레임 시간 dt(초)만큼 진행. dt 는 [0, MAX_FRAME_DT] 로 제한되고 하위 단계로 쪼개집니다. */
  function step(s, dt) {
    dt = Number(dt);
    if (!(dt > 0)) return;
    if (s.status !== STATUS.PLAYING) return; // 대기·일시정지·게임오버는 완전 정지
    dt = Math.min(dt, MAX_FRAME_DT);
    var n = Math.ceil(dt / SUBSTEP_DT - 1e-9);
    var h = dt / n;
    for (var i = 0; i < n && s.status === STATUS.PLAYING; i++) simulate(s, h);
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, STATUS: STATUS, FIRE_INTERVAL: FIRE_INTERVAL,
    PLAYER_SPEED: PLAYER_SPEED, PLAYER_Y: PLAYER_Y, PLAYER_RADIUS: PLAYER_RADIUS, PLAYER_MARGIN: PLAYER_MARGIN,
    PLAYER_BULLET_SPEED: PLAYER_BULLET_SPEED, PLAYER_BULLET_R: PLAYER_BULLET_R,
    ENEMY_BULLET_R: ENEMY_BULLET_R, MAX_ENEMY_BULLETS: MAX_ENEMY_BULLETS,
    INVULN_TIME: INVULN_TIME, LIVES_START: LIVES_START,
    ROWS: ROWS, COLS: COLS, ENEMY_SPACING_X: ENEMY_SPACING_X, ENEMY_SPACING_Y: ENEMY_SPACING_Y,
    ENEMY_TOP: ENEMY_TOP, ENEMY_MARGIN_X: ENEMY_MARGIN_X, ENEMY_RADIUS: ENEMY_RADIUS, DYING_DURATION: DYING_DURATION,
    FORMATION_MARGIN: FORMATION_MARGIN,
    DIVE_DUR: DIVE_DUR, MAX_WAVE_SCALING: MAX_WAVE_SCALING, WAVE_TRANSITION_TIME: WAVE_TRANSITION_TIME,
    MAX_FRAME_DT: MAX_FRAME_DT, SUBSTEP_DT: SUBSTEP_DT,
    SCORE_AMBER: SCORE_AMBER, SCORE_CORAL: SCORE_CORAL,
    formationSpeed: formationSpeed, diveInterval: diveInterval, maxConcurrentDivers: maxConcurrentDivers,
    enemyBulletSpeed: enemyBulletSpeed, formationFireInterval: formationFireInterval,
    circleVsVerticalSegment: circleVsVerticalSegment, circleHit: circleHit,
    createState: createState, restart: restart, setFireInterval: setFireInterval, start: start,
    setLeft: setLeft, setRight: setRight, setFire: setFire, clearInput: clearInput,
    pause: pause, resume: resume, step: step
  };
});
