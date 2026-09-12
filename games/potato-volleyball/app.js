/*
 * app.js — 입력 처리, 렌더링, 화면 흐름 담당.
 * 물리 계산은 전부 engine.js(VolleyEngine)에 위임한다.
 */
(function () {
  'use strict';

  var Engine = window.VolleyEngine;
  var canvas = document.getElementById('court');
  var ctx = canvas.getContext('2d');

  var menuOverlay = document.getElementById('menuOverlay');
  var pauseOverlay = document.getElementById('pauseOverlay');
  var modeCpuBtn = document.getElementById('modeCpu');
  var modePvpBtn = document.getElementById('modePvp');
  var actionBtn = document.getElementById('actionBtn');
  var pauseBtn = document.getElementById('pauseBtn');
  var modeMenuBtn = document.getElementById('modeMenuBtn');
  var scoreText = document.getElementById('scoreText');
  var statusText = document.getElementById('statusText');
  var touchControls = document.getElementById('touchControls');
  var touchLeft = document.getElementById('touchLeft');
  var touchJump = document.getElementById('touchJump');
  var touchRight = document.getElementById('touchRight');

  var COLOR_LEFT = '#7a6a9a';   // 무디 퍼플
  var COLOR_LEFT_DARK = '#5c4e79';
  var COLOR_RIGHT = '#b5583f';  // 러스트
  var COLOR_RIGHT_DARK = '#8c4130';
  var COURT_GREEN = '#3f6a4a';
  var COURT_GREEN_LIGHT = '#4d7a58';
  var BG_CREAM = '#f5efe1';

  var ARROW_CODES = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };

  var mode = 'cpu'; // 'cpu' | 'pvp'
  var gameStarted = false;
  var paused = false;
  var menuOpen = true; // 메뉴 오버레이(모드 선택)가 보이는 중인지

  var keys = {};
  var touch = { left: false, right: false, jump: false };

  var state = Engine.createInitialState();

  function isGameActive() {
    return gameStarted && !paused && !menuOpen;
  }

  // ---- 모드 선택 ----
  modeCpuBtn.addEventListener('click', function () {
    mode = 'cpu';
    modeCpuBtn.classList.add('selected');
    modePvpBtn.classList.remove('selected');
  });
  modePvpBtn.addEventListener('click', function () {
    mode = 'pvp';
    modePvpBtn.classList.add('selected');
    modeCpuBtn.classList.remove('selected');
  });

  // ---- 단일 컨텍스트 액션 버튼 (시작/서브/다음/다시하기/메뉴 복귀) ----
  actionBtn.addEventListener('click', handleAction);
  pauseBtn.addEventListener('click', togglePause);
  modeMenuBtn.addEventListener('click', openModeMenu);

  function openModeMenu() {
    menuOpen = true;
    if (gameStarted) paused = true;
    menuOverlay.classList.remove('hidden');
    pauseOverlay.classList.add('hidden');
    refreshUI();
  }

  function startGame() {
    gameStarted = true;
    paused = false;
    menuOpen = false;
    menuOverlay.classList.add('hidden');
    Engine.resetMatch(state);
    refreshUI();
  }

  function handleAction() {
    if (menuOpen) {
      if (!gameStarted) {
        startGame();
      } else {
        // 게임 도중 모드 변경 화면에서 복귀
        menuOpen = false;
        paused = false;
        menuOverlay.classList.add('hidden');
        refreshUI();
      }
      return;
    }
    if (paused) return;
    if (state.phase === 'ready') {
      Engine.launchServe(state);
    } else if (state.phase === 'point') {
      Engine.continueAfterPoint(state);
    } else if (state.phase === 'gameover') {
      Engine.resetMatch(state);
    }
    refreshUI();
  }

  function togglePause() {
    if (!gameStarted || menuOpen || state.phase === 'gameover') return;
    paused = !paused;
    pauseOverlay.classList.toggle('hidden', !paused);
    refreshUI();
  }

  // ---- 키보드 입력 ----
  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;

    if (ARROW_CODES[e.code] && isGameActive()) {
      e.preventDefault();
    }

    if (e.code === 'Space') {
      // 버튼에 포커스가 있으면 브라우저 기본 클릭 활성화에 맡기고
      // 우리 쪽 핸들러는 실행하지 않는다 (중복 실행 방지).
      var activeIsButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
      if (activeIsButton) return;
      e.preventDefault();
      if (e.repeat) return;
      handleAction();
    } else if (e.code === 'KeyP') {
      if (e.repeat) return;
      togglePause();
    }
  });
  window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
  });

  // 탭 비활성화/포커스 이탈 시 입력을 지우고 자동 일시정지 (자동 재개는 하지 않음)
  function handleInactive() {
    keys = {};
    touch.left = touch.right = touch.jump = false;
    if (gameStarted && !paused && !menuOpen && state.phase !== 'gameover') {
      paused = true;
      pauseOverlay.classList.remove('hidden');
      refreshUI();
    }
  }
  window.addEventListener('blur', handleInactive);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) handleInactive();
  });

  // ---- 터치 컨트롤 (왼쪽 플레이어 전용) ----
  function bindTouchButton(el, onDown, onUp) {
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      onDown();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onUp);
  }
  bindTouchButton(touchLeft, function () { touch.left = true; }, function () { touch.left = false; });
  bindTouchButton(touchRight, function () { touch.right = true; }, function () { touch.right = false; });
  bindTouchButton(touchJump, function () { touch.jump = true; }, function () { touch.jump = false; });

  // ---- 입력 → 플레이어 인풋 매핑 ----
  function getInputs() {
    var p0 = {
      left: !!keys['KeyA'] || touch.left,
      right: !!keys['KeyD'] || touch.right,
      jump: !!keys['KeyW'] || touch.jump
    };
    var p1;
    if (mode === 'pvp') {
      p1 = {
        left: !!keys['ArrowLeft'],
        right: !!keys['ArrowRight'],
        jump: !!keys['ArrowUp']
      };
    } else {
      p1 = computeAiInput();
    }
    return { p0: p0, p1: p1 };
  }

  // ---- 간단한 컴퓨터 상대 AI ----
  // 서브/득점 후 재개는 여기서 자동으로 트리거하지 않는다. 누가 득점했든
  // 사람이 Space 또는 컨텍스트 버튼을 눌러야 다음 랠리가 시작된다.
  function computeAiInput() {
    var input = { left: false, right: false, jump: false };
    var ball = state.ball;
    var me = state.players[1];

    var targetX = ball.x;
    // 공이 상대 코트에 있으면 중앙 근처에서 대기
    if (ball.x < Engine.NET_X) {
      targetX = Engine.NET_X + 160;
    }
    var diff = targetX - me.x;
    if (Math.abs(diff) > 10) {
      if (diff > 0) input.right = true;
      else input.left = true;
    }

    var meCenterY = Engine.playerCenterY(me);
    var closeEnough = Math.abs(ball.x - me.x) < 70;
    var ballAbove = ball.y < meCenterY - 10;
    var ballFalling = ball.vy > -50;
    if (closeEnough && ballAbove && ballFalling && me.onGround) {
      input.jump = true;
    }
    return input;
  }

  // ---- 고정 스텝(1/120초) 게임 루프 ----
  var STEP = 1 / 120;
  var MAX_SUBSTEPS = 15;
  var acc = 0;
  var lastTime = null;

  function frame(time) {
    requestAnimationFrame(frame);
    if (lastTime === null) lastTime = time;
    var dt = (time - lastTime) / 1000;
    lastTime = time;
    if (dt > 0.25) dt = 0.25; // 탭 비활성 후 복귀 시 폭주 방지
    acc += dt;

    if (isGameActive()) {
      var steps = 0;
      while (acc >= STEP && steps < MAX_SUBSTEPS) {
        var inputs = getInputs();
        Engine.update(state, STEP, inputs);
        acc -= STEP;
        steps++;
      }
      if (steps === MAX_SUBSTEPS) acc = 0;
    } else {
      acc = 0;
    }

    render();
    refreshUI();
  }

  // ---- UI 텍스트/버튼 상태 갱신 (DOM, 캔버스 밖) ----
  var lastScoreStr = null;
  var lastStatusStr = null;

  function sideLabel(idx) {
    return idx === 0 ? '왼쪽' : '오른쪽';
  }

  function computeStatusStr() {
    if (menuOpen) {
      return gameStarted ? '일시정지됨 · 모드 변경 중' : '모드를 선택하고 시작하세요';
    }
    if (paused) return '일시정지 중';
    if (state.phase === 'ready') {
      return sideLabel(state.server) + ' 감자 서브 대기 · 서브하기 또는 Space';
    }
    if (state.phase === 'play') return '경기 진행 중';
    if (state.phase === 'point') {
      return sideLabel(state.lastPoint.winner) + ' 감자 득점! 다음 랠리 또는 Space';
    }
    if (state.phase === 'gameover') {
      return sideLabel(state.winner) + ' 감자 승리! 다시하기 또는 Space';
    }
    return '';
  }

  function computeActionLabel() {
    if (menuOpen) return gameStarted ? '게임으로 돌아가기' : '시작하기';
    if (paused) return '일시정지 중';
    if (state.phase === 'ready') return '서브하기';
    if (state.phase === 'play') return '진행 중';
    if (state.phase === 'point') return '다음 랠리';
    if (state.phase === 'gameover') return '다시하기';
    return '시작하기';
  }

  function refreshUI() {
    // DOM 점수/상태는 매 프레임 다시 쓰지 않고 변경될 때만 갱신한다.
    var scoreStr = state.score[0] + ' : ' + state.score[1];
    if (scoreStr !== lastScoreStr) {
      scoreText.textContent = scoreStr;
      lastScoreStr = scoreStr;
    }
    var statusStr = computeStatusStr();
    if (statusStr !== lastStatusStr) {
      statusText.textContent = statusStr;
      lastStatusStr = statusStr;
    }

    actionBtn.textContent = computeActionLabel();
    actionBtn.disabled = !menuOpen && (paused || state.phase === 'play');

    pauseBtn.textContent = paused ? '재개' : '일시정지';
    pauseBtn.disabled = !gameStarted || menuOpen || state.phase === 'gameover';

    // 메뉴/일시정지 오버레이가 떠 있을 때는 터치 컨트롤을 겹치지 않게 숨긴다.
    touchControls.classList.toggle('hidden', menuOpen || paused);
  }

  // ---- 렌더링 ----
  function render() {
    ctx.clearRect(0, 0, Engine.WIDTH, Engine.HEIGHT);
    drawBackground();
    drawCourt();
    drawNet();
    drawPlayer(state.players[0], COLOR_LEFT, COLOR_LEFT_DARK);
    drawPlayer(state.players[1], COLOR_RIGHT, COLOR_RIGHT_DARK);
    drawBall(state.ball);
    drawScore();
    drawStatus();
  }

  function drawBackground() {
    ctx.fillStyle = BG_CREAM;
    ctx.fillRect(0, 0, Engine.WIDTH, Engine.HEIGHT);
    // 은은한 배경 원 장식
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = COLOR_LEFT;
    ctx.beginPath();
    ctx.arc(120, 100, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOR_RIGHT;
    ctx.beginPath();
    ctx.arc(840, 90, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCourt() {
    var groundH = Engine.HEIGHT - Engine.GROUND_Y;
    var grad = ctx.createLinearGradient(0, Engine.GROUND_Y, 0, Engine.HEIGHT);
    grad.addColorStop(0, COURT_GREEN_LIGHT);
    grad.addColorStop(1, COURT_GREEN);
    ctx.fillStyle = grad;
    ctx.fillRect(0, Engine.GROUND_Y, Engine.WIDTH, groundH);

    // 코트 라인
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Engine.WALL_LEFT, Engine.GROUND_Y);
    ctx.lineTo(Engine.WALL_RIGHT, Engine.GROUND_Y);
    ctx.stroke();
    ctx.strokeRect(Engine.WALL_LEFT, Engine.GROUND_Y, Engine.WALL_RIGHT - Engine.WALL_LEFT, groundH - 4);

    // 중앙 표시
    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.moveTo(Engine.NET_X, Engine.GROUND_Y);
    ctx.lineTo(Engine.NET_X, Engine.HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawNet() {
    var topY = Engine.GROUND_Y - Engine.NET_HEIGHT;
    // 기둥
    ctx.fillStyle = '#6b5a45';
    ctx.fillRect(Engine.NET_X - Engine.NET_HALF_WIDTH, topY, Engine.NET_HALF_WIDTH * 2, Engine.NET_HEIGHT);
    // 네트 그물 패턴
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    for (var y = topY + 6; y < Engine.GROUND_Y; y += 10) {
      ctx.beginPath();
      ctx.moveTo(Engine.NET_X - Engine.NET_HALF_WIDTH, y);
      ctx.lineTo(Engine.NET_X + Engine.NET_HALF_WIDTH, y);
      ctx.stroke();
    }
    // 상단 테이프
    ctx.fillStyle = '#fff8ee';
    ctx.fillRect(Engine.NET_X - Engine.NET_HALF_WIDTH - 4, topY - 6, Engine.NET_HALF_WIDTH * 2 + 8, 8);
  }

  // 감자 캐릭터: 몸통(타원) + 눈 + 팔다리 스텁
  function drawPlayer(player, color, darkColor) {
    var cy = Engine.playerCenterY(player);
    var r = Engine.PLAYER_RADIUS;
    var squash = player.onGround ? 1 : 0.94;

    ctx.save();
    ctx.translate(player.x, cy);
    ctx.scale(1, squash);

    // 몸통
    var grad = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r * 1.2);
    grad.addColorStop(0, lighten(color));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05, r, 0, 0, Math.PI * 2);
    ctx.fill();

    // 감자 반점(울퉁불퉁 텍스처)
    ctx.fillStyle = darkColor;
    ctx.globalAlpha = 0.35;
    dot(-r * 0.4, -r * 0.2, 3.5);
    dot(r * 0.35, 0.1 * r, 3);
    dot(-r * 0.1, r * 0.45, 2.6);
    dot(r * 0.2, -r * 0.5, 2.4);
    ctx.globalAlpha = 1;

    // 눈
    var dir = player.side === 'left' ? 1 : -1;
    ctx.fillStyle = '#2b2420';
    ctx.beginPath();
    ctx.ellipse(dir * r * 0.32, -r * 0.12, 4.2, 5.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(dir * r * 0.62, -r * 0.05, 3.6, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 다리(짧은 스텁), 스쿼시 영향 안 받도록 별도로 그림
    ctx.fillStyle = darkColor;
    var legY = cy + r * 0.85;
    ctx.beginPath();
    ctx.ellipse(player.x - r * 0.4, legY, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(player.x + r * 0.4, legY, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    function dot(x, y, rr) {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function lighten(hex) {
    var c = hexToRgb(hex);
    return 'rgb(' + Math.min(255, c.r + 60) + ',' + Math.min(255, c.g + 60) + ',' + Math.min(255, c.b + 60) + ')';
  }
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  }

  function drawBall(ball) {
    var r = Engine.BALL_RADIUS;

    // 바닥 그림자 (공보다 먼저 그려 공 아래 깔리도록)
    ctx.save();
    ctx.globalAlpha = shadowAlpha(ball.y);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(ball.x, Engine.GROUND_Y + 4, r * 0.8, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(ball.x, ball.y);
    // 공 자체에 은은한 입체 그림자
    ctx.shadowColor = 'rgba(60,45,20,0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    var grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r);
    grad.addColorStop(0, '#fffaf0');
    grad.addColorStop(1, '#c9b48a'); // 대비를 조금 더 강하게
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(90,70,40,0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI + 0.3, Math.PI * 2 - 0.3);
    ctx.stroke();
    ctx.restore();

    function shadowAlpha(y) {
      var t = 1 - (Engine.GROUND_Y - y) / 300;
      return Math.max(0.05, Math.min(0.25, t * 0.25));
    }
  }

  function drawScore() {
    ctx.fillStyle = '#2b2420';
    ctx.font = 'bold 34px "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.score[0], Engine.WIDTH * 0.28, 54);
    ctx.fillText(state.score[1], Engine.WIDTH * 0.72, 54);

    ctx.font = '600 15px "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = COLOR_LEFT_DARK;
    ctx.fillText('왼쪽 감자', Engine.WIDTH * 0.28, 76);
    ctx.fillStyle = COLOR_RIGHT_DARK;
    ctx.fillText('오른쪽 감자', Engine.WIDTH * 0.72, 76);

    ctx.fillStyle = '#8a7d6c';
    ctx.font = '20px sans-serif';
    ctx.fillText('–', Engine.WIDTH / 2, 54);
  }

  function drawStatus() {
    if (menuOpen) return;
    var msg = '';
    if (paused) {
      msg = '일시정지 중 — 재개 버튼 또는 P';
    } else if (state.phase === 'ready') {
      msg = (state.server === 0 ? '왼쪽 감자' : '오른쪽 감자') + ' 서브 — 서브하기 버튼 또는 Space';
    } else if (state.phase === 'point') {
      msg = (state.lastPoint.winner === 0 ? '왼쪽' : '오른쪽') + ' 감자 득점! 다음 랠리 버튼 또는 Space';
    } else if (state.phase === 'gameover') {
      msg = (state.winner === 0 ? '왼쪽' : '오른쪽') + ' 감자 승리! 🎉  다시하기 버튼 또는 Space';
    }
    if (!msg) return;
    ctx.save();
    ctx.fillStyle = 'rgba(43,36,32,0.78)';
    ctx.font = '600 18px "Apple SD Gothic Neo", sans-serif';
    var w = ctx.measureText(msg).width;
    ctx.fillRect(Engine.WIDTH / 2 - w / 2 - 16, Engine.HEIGHT - 64, w + 32, 34);
    ctx.fillStyle = '#fff8ee';
    ctx.textAlign = 'center';
    ctx.fillText(msg, Engine.WIDTH / 2, Engine.HEIGHT - 41);
    ctx.restore();
  }

  refreshUI();
  requestAnimationFrame(frame);
})();
