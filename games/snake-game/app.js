/*
 * 화면 표시 및 입력 처리 담당 (렌더링 계층).
 * 게임 규칙 자체는 engine.js 에만 있고, 여기서는 그 결과를 그리고
 * 키보드/터치/버튼 입력을 engine 함수 호출로 옮기는 역할만 한다.
 */
(function () {
  'use strict';

  var GRID_SIZE = 20;
  var TICK_MS = 150; // 고정 속도 (난이도 단계는 이번 스테이지 범위 밖)
  var HIGH_SCORE_KEY = 'edyedy-vibecoding-snake-high-score';

  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var CELL_SIZE = canvas.width / GRID_SIZE;

  var scoreEl = document.getElementById('score');
  var highScoreEl = document.getElementById('high-score');
  var statusEl = document.getElementById('status-message');
  var pauseButton = document.getElementById('pause-button');

  var overlay = document.getElementById('overlay');
  var panelReady = document.getElementById('panel-ready');
  var panelPaused = document.getElementById('panel-paused');
  var panelResult = document.getElementById('panel-result');
  var resultText = document.getElementById('result-text');

  var startButton = document.getElementById('start-button');
  var resumeButton = document.getElementById('resume-button');
  var restartButton = document.getElementById('restart-button');
  var dpadButtons = document.querySelectorAll('.dpad-btn');

  var KEY_TO_DIRECTION = {
    ArrowUp: 'UP',
    ArrowDown: 'DOWN',
    ArrowLeft: 'LEFT',
    ArrowRight: 'RIGHT',
    w: 'UP',
    W: 'UP',
    s: 'DOWN',
    S: 'DOWN',
    a: 'LEFT',
    A: 'LEFT',
    d: 'RIGHT',
    D: 'RIGHT'
  };

  var state = SnakeEngine.createGame(GRID_SIZE);
  var loopId = null;

  // ---- 최고 점수 (localStorage) ----
  // 개인정보/사설 브라우징 모드 등으로 접근이 막혀 있을 수 있으므로
  // try/catch로 감싸고, 실패하면 최고 점수 기능만 조용히 비활성화한다.
  var storageAvailable = true;
  var highScore = 0;

  (function loadHighScore() {
    try {
      var probeKey = '__snake_storage_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      var saved = window.localStorage.getItem(HIGH_SCORE_KEY);
      highScore = saved ? parseInt(saved, 10) || 0 : 0;
    } catch (err) {
      storageAvailable = false;
      highScore = 0;
    }
  }());

  function saveHighScoreIfNeeded() {
    if (state.score <= highScore) return;
    highScore = state.score;
    if (!storageAvailable) return;
    try {
      window.localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    } catch (err) {
      storageAvailable = false;
    }
  }

  function updateScoreDisplay() {
    scoreEl.textContent = String(state.score);
    highScoreEl.textContent = String(highScore);
  }

  function draw() {
    // 배경 (크림색 노트 느낌)
    ctx.fillStyle = '#f5efd8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 격자선
    ctx.strokeStyle = 'rgba(47, 74, 60, 0.15)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= GRID_SIZE; i++) {
      var pos = i * CELL_SIZE + 0.5;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(canvas.width, pos);
      ctx.stroke();
    }

    // 먹이
    if (state.food) {
      ctx.fillStyle = '#a5402d';
      var fx = state.food.x * CELL_SIZE + CELL_SIZE / 2;
      var fy = state.food.y * CELL_SIZE + CELL_SIZE / 2;
      ctx.beginPath();
      ctx.arc(fx, fy, CELL_SIZE / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 뱀 몸통
    for (var s = state.snake.length - 1; s >= 0; s--) {
      var seg = state.snake[s];
      ctx.fillStyle = s === 0 ? '#1c2f22' : '#345c40';
      ctx.fillRect(
        seg.x * CELL_SIZE + 1,
        seg.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      );
    }
  }

  function showPanel(name) {
    panelReady.hidden = name !== 'ready';
    panelPaused.hidden = name !== 'paused';
    panelResult.hidden = name !== 'result';
    overlay.hidden = name === null;
  }

  function stopLoop() {
    if (loopId !== null) {
      clearInterval(loopId);
      loopId = null;
    }
  }

  // 현재 state.status 값에 맞춰 오버레이/버튼/스크린리더용 상태 문구를 동기화한다.
  function syncUI() {
    if (state.status === 'ready') {
      showPanel('ready');
      pauseButton.hidden = true;
      statusEl.textContent = '';
    } else if (state.status === 'running') {
      showPanel(null);
      pauseButton.hidden = false;
      pauseButton.textContent = '일시정지';
      statusEl.textContent = '';
    } else if (state.status === 'paused') {
      showPanel('paused');
      pauseButton.hidden = false;
      pauseButton.textContent = '계속하기';
      statusEl.textContent = '일시정지되었습니다.';
    } else if (state.status === 'gameover') {
      stopLoop();
      saveHighScoreIfNeeded();
      resultText.textContent = '게임 오버! 점수 ' + state.score + '점.';
      showPanel('result');
      pauseButton.hidden = true;
      statusEl.textContent = '게임 오버! 점수 ' + state.score + '점입니다. 다시하기를 눌러주세요.';
    } else if (state.status === 'cleared') {
      stopLoop();
      saveHighScoreIfNeeded();
      resultText.textContent = '축하합니다! 보드를 가득 채워 클리어했어요. 점수 ' + state.score + '점.';
      showPanel('result');
      pauseButton.hidden = true;
      statusEl.textContent = '축하합니다! 점수 ' + state.score + '점으로 클리어했습니다.';
    }
    updateScoreDisplay();
  }

  function frame() {
    SnakeEngine.tick(state);
    draw();
    syncUI();
  }

  function beginRun() {
    stopLoop();
    draw();
    syncUI();
    loopId = setInterval(frame, TICK_MS);
  }

  function handleStart() {
    SnakeEngine.startGame(state);
    beginRun();
    canvas.focus({ preventScroll: true });
  }

  function handleRestart() {
    state = SnakeEngine.createGame(GRID_SIZE);
    SnakeEngine.startGame(state);
    beginRun();
    canvas.focus({ preventScroll: true });
  }

  // 일시정지/재개 토글. running -> paused 로 갈 땐 타이머를 완전히 멈추고,
  // paused -> running 으로 돌아올 땐 타이머를 다시 건다.
  function handleTogglePause() {
    if (state.status === 'running') {
      SnakeEngine.pauseGame(state);
      stopLoop();
      syncUI();
    } else if (state.status === 'paused') {
      SnakeEngine.resumeGame(state);
      syncUI();
      loopId = setInterval(frame, TICK_MS);
    }
  }

  function autoPauseIfRunning() {
    if (state.status === 'running') {
      handleTogglePause();
    }
  }

  startButton.addEventListener('click', handleStart);
  resumeButton.addEventListener('click', handleTogglePause);
  restartButton.addEventListener('click', handleRestart);
  pauseButton.addEventListener('click', handleTogglePause);

  for (var d = 0; d < dpadButtons.length; d++) {
    dpadButtons[d].addEventListener('click', function (event) {
      var dir = event.currentTarget.getAttribute('data-dir');
      SnakeEngine.setDirection(state, dir);
    });
  }

  window.addEventListener('keydown', function (event) {
    var isPauseKey = event.key === ' ' || event.code === 'Space' || event.key === 'p' || event.key === 'P';
    var dir = KEY_TO_DIRECTION[event.key];
    if (!isPauseKey && !dir) return;

    // 방향키/스페이스로 페이지가 스크롤되는 것을 막는다.
    event.preventDefault();

    // 키를 길게 누르고 있을 때 브라우저가 반복 발생시키는 keydown은 무시한다.
    // (일시정지가 깜빡이거나 방향이 불필요하게 반복 예약되는 것을 방지)
    if (event.repeat) return;

    if (isPauseKey) {
      if (state.status === 'running' || state.status === 'paused') {
        handleTogglePause();
      }
      return;
    }

    SnakeEngine.setDirection(state, dir);
  });

  // 탭이 백그라운드로 가거나(visibilitychange) 창 포커스를 잃으면(blur)
  // 진행 중인 게임을 자동으로 일시정지한다. 자동으로 재개하지는 않는다.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) autoPauseIfRunning();
  });
  window.addEventListener('blur', autoPauseIfRunning);

  // 시작 전 초기 화면(빈 보드 + 뱀 초기 위치)을 미리 그려둔다.
  draw();
  syncUI();
})();
