/*
 * engine.js — 감자 발리볼 순수 물리 엔진
 * 프레임워크/DOM 의존 없음. 브라우저 전역(window.VolleyEngine) 및
 * CommonJS(module.exports) 양쪽에서 사용 가능.
 * 좌표계: 가상 코트 960x540, y는 아래로 증가.
 */
(function (root) {
  'use strict';

  var WIDTH = 960;
  var HEIGHT = 540;
  var GROUND_Y = 480;
  var WALL_LEFT = 20;
  var WALL_RIGHT = 940;
  var NET_X = WIDTH / 2;
  var NET_HALF_WIDTH = 6;
  var NET_HEIGHT = 130;

  var PLAYER_RADIUS = 30;
  var PLAYER_SPEED = 260; // px/s
  var JUMP_SPEED = 620; // px/s (초기 점프 속도)
  var GRAVITY_PLAYER = 1700;

  var BALL_RADIUS = 16;
  var GRAVITY_BALL = 900;
  var MAX_BALL_SPEED = 820;
  var CEILING_Y = 0;

  var WIN_SCORE = 7;

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function makePlayer(side) {
    var isLeft = side === 'left';
    var x = isLeft ? WALL_LEFT + 140 : WALL_RIGHT - 140;
    return {
      side: side,
      x: x,
      height: 0, // 지면 위로 뜬 높이 (0 = 접지)
      vy: 0,
      onGround: true
    };
  }

  function playerBounds(side) {
    if (side === 'left') {
      return {
        min: WALL_LEFT + PLAYER_RADIUS,
        max: NET_X - NET_HALF_WIDTH - PLAYER_RADIUS
      };
    }
    return {
      min: NET_X + NET_HALF_WIDTH + PLAYER_RADIUS,
      max: WALL_RIGHT - PLAYER_RADIUS
    };
  }

  function playerCenterY(player) {
    return GROUND_Y - PLAYER_RADIUS - player.height;
  }

  function createInitialState() {
    var state = {
      players: [makePlayer('left'), makePlayer('right')],
      ball: { x: NET_X / 2, y: GROUND_Y - 200, vx: 0, vy: 0 },
      score: [0, 0],
      server: 0, // 다음 서브를 넣을 플레이어 index
      phase: 'ready', // 'ready' | 'play' | 'point' | 'gameover'
      lastPoint: null, // {winner, reason}
      winner: null
    };
    resetServe(state, state.server);
    return state;
  }

  // 서브 준비 상태로 리셋: 공을 서버 위에 배치, 플레이어 위치 초기화
  function resetServe(state, serverIndex) {
    state.server = serverIndex;
    state.phase = 'ready';
    state.lastPoint = null;
    state.players[0] = makePlayer('left');
    state.players[1] = makePlayer('right');
    var server = state.players[serverIndex];
    state.ball.x = server.x;
    state.ball.y = playerCenterY(server) - PLAYER_RADIUS - BALL_RADIUS - 10;
    state.ball.vx = 0;
    state.ball.vy = 0;
    return state;
  }

  // ready 상태에서 스페이스바로 서브를 시작할 때 호출.
  // vx=300, vy=-580은 분석적으로 검증됨: 시작 x=160(또는 800), y=394 기준
  // x=NET_X(480) 통과 시각 t≈1.067s에서 y≈287.3 (네트 상단 350보다 훨씬 위,
  // 공 반지름 16을 빼도 여유 45px+로 네트 상단 모서리에 걸리지 않고 확실히
  // 넘긴다). 착지(y=464)는 t≈1.4s, x≈580(반대편 코트 내부, 네트와 상대
  // 플레이어 사이)로 자동 실점 없이 상대가 받을 수 있는 위치에 떨어진다.
  function launchServe(state) {
    if (state.phase !== 'ready') return;
    var dir = state.server === 0 ? 1 : -1;
    state.ball.vx = dir * 300;
    state.ball.vy = -580;
    state.phase = 'play';
  }

  function resetMatch(state) {
    state.score = [0, 0];
    state.winner = null;
    resetServe(state, 0);
    state.phase = 'ready';
  }

  function updatePlayer(player, input, dt) {
    var bounds = playerBounds(player.side);
    var dir = 0;
    if (input) {
      if (input.left) dir -= 1;
      if (input.right) dir += 1;
    }
    player.x += dir * PLAYER_SPEED * dt;
    player.x = clamp(player.x, bounds.min, bounds.max);

    if (input && input.jump && player.onGround) {
      player.vy = -JUMP_SPEED;
      player.onGround = false;
    }

    player.vy += GRAVITY_PLAYER * dt;
    player.height -= player.vy * dt;
    if (player.height <= 0) {
      player.height = 0;
      player.vy = 0;
      player.onGround = true;
    }
  }

  function reflectFromNormal(ball, nx, ny, restitution) {
    var dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= (1 + restitution) * dot * nx;
    ball.vy -= (1 + restitution) * dot * ny;
  }

  function clampBallSpeed(ball) {
    var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > MAX_BALL_SPEED) {
      var scale = MAX_BALL_SPEED / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }
  }

  function resolveBallVsCircle(ball, cx, cy, radius, extraVx) {
    var dx = ball.x - cx;
    var dy = ball.y - cy;
    var distSq = dx * dx + dy * dy;
    var minDist = radius + BALL_RADIUS;
    if (distSq >= minDist * minDist) return false;
    var dist = Math.sqrt(distSq);
    var nx, ny;
    if (dist === 0) {
      // 중심이 정확히 겹치는 예외 상황: 법선을 정할 수 없으므로
      // 위쪽을 기본 법선으로 사용해 밀어낸다.
      nx = 0;
      ny = -1;
    } else {
      nx = dx / dist;
      ny = dy / dist;
    }
    // 겹침 해소는 접근/분리 여부와 무관하게 항상 수행 (끼임 방지)
    var overlap = minDist - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    // 공이 법선 방향으로 접근 중일 때만 반사 처리. 이미 분리 중인 경우
    // 반사를 적용하면 불필요한 추가 가속이 생기므로 침투 해소만 한다.
    var approachDot = ball.vx * nx + ball.vy * ny;
    if (approachDot < 0) {
      reflectFromNormal(ball, nx, ny, 1);
      // 캐릭터 몸통에 맞은 방향으로 약간의 추진력 부여
      ball.vx += nx * 120 + (extraVx || 0) * 0.3;
      ball.vy += ny * 120 - 60; // 위로 살짝 튀도록 보정
      clampBallSpeed(ball);
    }
    return true;
  }

  function updateBall(state, dt) {
    var ball = state.ball;
    ball.vy += GRAVITY_BALL * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // 천장
    if (ball.y - BALL_RADIUS < CEILING_Y) {
      ball.y = CEILING_Y + BALL_RADIUS;
      ball.vy = Math.abs(ball.vy) * 0.85;
    }

    // 좌우 벽
    if (ball.x - BALL_RADIUS < WALL_LEFT) {
      ball.x = WALL_LEFT + BALL_RADIUS;
      ball.vx = Math.abs(ball.vx) * 0.9;
    } else if (ball.x + BALL_RADIUS > WALL_RIGHT) {
      ball.x = WALL_RIGHT - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx) * 0.9;
    }

    // 네트 (기둥 + 상단)
    var netTop = GROUND_Y - NET_HEIGHT;
    var withinNetX = ball.x + BALL_RADIUS > NET_X - NET_HALF_WIDTH &&
      ball.x - BALL_RADIUS < NET_X + NET_HALF_WIDTH;
    if (withinNetX && ball.y + BALL_RADIUS > netTop) {
      // 네트 상단 위를 넘어가는 경우는 통과, 아니면 측면 충돌 처리
      if (ball.y - BALL_RADIUS < netTop) {
        // 네트 위쪽 모서리에 맞음 -> 위로 튕김
        ball.y = netTop - BALL_RADIUS;
        ball.vy = -Math.abs(ball.vy) * 0.6;
      } else {
        // 네트 측면
        if (ball.x < NET_X) {
          ball.x = NET_X - NET_HALF_WIDTH - BALL_RADIUS;
          ball.vx = -Math.abs(ball.vx) * 0.7;
        } else {
          ball.x = NET_X + NET_HALF_WIDTH + BALL_RADIUS;
          ball.vx = Math.abs(ball.vx) * 0.7;
        }
      }
    }

    // 플레이어 충돌
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      var cy = playerCenterY(p);
      resolveBallVsCircle(ball, p.x, cy, PLAYER_RADIUS, 0);
    }

    clampBallSpeed(ball);

    // 바닥 충돌 -> 점수
    if (ball.y + BALL_RADIUS >= GROUND_Y) {
      ball.y = GROUND_Y - BALL_RADIUS;
      var landedLeft = ball.x < NET_X;
      var scorer = landedLeft ? 1 : 0;
      awardPoint(state, scorer);
    }
  }

  function awardPoint(state, scorerIndex) {
    state.score[scorerIndex] += 1;
    state.lastPoint = { winner: scorerIndex };
    state.phase = 'point';
    if (state.score[scorerIndex] >= WIN_SCORE) {
      state.winner = scorerIndex;
      state.phase = 'gameover';
    }
  }

  // 득점 연출 후 앱에서 호출하여 다음 서브 준비
  function continueAfterPoint(state) {
    if (state.phase !== 'point' || state.lastPoint === null) return;
    resetServe(state, state.lastPoint.winner);
  }

  function update(state, dt, inputs) {
    if (state.phase === 'gameover') return state;
    updatePlayer(state.players[0], inputs && inputs.p0, dt);
    updatePlayer(state.players[1], inputs && inputs.p1, dt);

    if (state.phase === 'ready') {
      // 서브 대기 중에는 공이 서버를 따라다님
      var server = state.players[state.server];
      state.ball.x = server.x;
      state.ball.y = playerCenterY(server) - PLAYER_RADIUS - BALL_RADIUS - 10;
      state.ball.vx = 0;
      state.ball.vy = 0;
    } else if (state.phase === 'play') {
      updateBall(state, dt);
    }
    return state;
  }

  var VolleyEngine = {
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    GROUND_Y: GROUND_Y,
    WALL_LEFT: WALL_LEFT,
    WALL_RIGHT: WALL_RIGHT,
    NET_X: NET_X,
    NET_HALF_WIDTH: NET_HALF_WIDTH,
    NET_HEIGHT: NET_HEIGHT,
    PLAYER_RADIUS: PLAYER_RADIUS,
    BALL_RADIUS: BALL_RADIUS,
    WIN_SCORE: WIN_SCORE,
    createInitialState: createInitialState,
    resetServe: resetServe,
    resetMatch: resetMatch,
    launchServe: launchServe,
    continueAfterPoint: continueAfterPoint,
    update: update,
    playerCenterY: playerCenterY
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VolleyEngine;
  } else {
    root.VolleyEngine = VolleyEngine;
  }
})(typeof window !== 'undefined' ? window : this);
