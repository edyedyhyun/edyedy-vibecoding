(function () {
  'use strict';

  var Engine = window.BreakoutEngine;
  var state = Engine.createState();

  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var stage = document.getElementById('stage');
  var overlay = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlayDesc = document.getElementById('overlay-desc');
  var actionBtn = document.getElementById('action-btn');
  var pauseBtn = document.getElementById('pause-btn');
  var scoreValue = document.getElementById('score-value');
  var bricksValue = document.getElementById('bricks-value');
  var livesValue = document.getElementById('lives-value');

  // ---- Cosmetic particles (purely visual, no gameplay effect) ----------
  var particles = [];

  function spawnParticles(x, y, color) {
    for (var i = 0; i < 8; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 40 + Math.random() * 90;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color: color
      });
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  var BRICK_COLORS = ['#e8654f', '#ef9b52', '#e8c04f', '#7fb069', '#1f7a72', '#3d6cb9'];

  // Track alive-count per brick row to detect newly-broken bricks for particles.
  var lastAliveById = {};
  state.bricks.forEach(function (b) {
    lastAliveById[b.row + '-' + b.col] = true;
  });

  function checkNewlyBroken() {
    state.bricks.forEach(function (b) {
      var key = b.row + '-' + b.col;
      if (lastAliveById[key] && !b.alive) {
        spawnParticles(b.x + b.w / 2, b.y + b.h / 2, BRICK_COLORS[b.row % BRICK_COLORS.length]);
      }
      lastAliveById[key] = b.alive;
    });
  }

  // ---- Input state -------------------------------------------------------

  var input = { left: false, right: false };
  var pointerActive = false;

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  window.addEventListener('keydown', function (e) {
    if (isTypingTarget(document.activeElement)) return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      input.left = true;
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      input.right = true;
      e.preventDefault();
    } else if (e.code === 'Space') {
      // Let a focused button handle its own native Space activation (click)
      // instead of also triggering our handler, which would double-fire.
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
        return;
      }
      e.preventDefault();
      if (e.repeat) return;
      handlePrimaryAction();
    } else if (e.key === 'p' || e.key === 'P') {
      if (e.repeat) return;
      togglePause();
    } else if (e.key === 'r' || e.key === 'R') {
      if (e.repeat) return;
      doRestart();
    }
  });

  window.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      input.left = false;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      input.right = false;
    }
  });

  // Mouse / touch drag — moves paddle directly to pointer x (converted to
  // virtual canvas coordinates).
  function pointerToVirtualX(clientX) {
    var rect = canvas.getBoundingClientRect();
    var scale = Engine.WIDTH / rect.width;
    return (clientX - rect.left) * scale;
  }

  function paddleInputAllowed() {
    return state.status === Engine.STATUS.PLAYING ||
      state.status === Engine.STATUS.READY ||
      state.status === Engine.STATUS.LOST_BALL;
  }

  function movePaddleTo(virtualX) {
    if (!paddleInputAllowed()) return;
    var half = state.paddle.w / 2;
    var x = virtualX - half;
    if (x < 0) x = 0;
    if (x + state.paddle.w > Engine.WIDTH) x = Engine.WIDTH - state.paddle.w;
    state.paddle.x = x;
    if (state.status === Engine.STATUS.READY || state.status === Engine.STATUS.LOST_BALL) {
      state.ball.x = state.paddle.x + state.paddle.w / 2;
      state.ball.y = Engine.PADDLE_Y - state.ball.r;
    }
  }

  canvas.addEventListener('mousedown', function (e) {
    pointerActive = true;
    movePaddleTo(pointerToVirtualX(e.clientX));
  });
  window.addEventListener('mousemove', function (e) {
    if (!pointerActive) return;
    movePaddleTo(pointerToVirtualX(e.clientX));
  });
  window.addEventListener('mouseup', function () {
    pointerActive = false;
  });

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var t = e.touches[0];
    if (t) movePaddleTo(pointerToVirtualX(t.clientX));
  }, { passive: false });
  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var t = e.touches[0];
    if (t) movePaddleTo(pointerToVirtualX(t.clientX));
  }, { passive: false });

  // ---- Actions -----------------------------------------------------------

  var wasPausedByBlur = false;

  function handlePrimaryAction() {
    if (state.status === Engine.STATUS.READY || state.status === Engine.STATUS.LOST_BALL) {
      Engine.launch(state);
      updateOverlay();
    } else if (state.status === Engine.STATUS.PAUSED) {
      resumeGame();
    } else if (state.status === Engine.STATUS.WON || state.status === Engine.STATUS.GAME_OVER) {
      doRestart();
    }
  }

  function togglePause() {
    if (state.status === Engine.STATUS.PLAYING) {
      pauseGame();
    } else if (state.status === Engine.STATUS.PAUSED) {
      resumeGame();
    }
  }

  function pauseGame() {
    Engine.pause(state);
    updateOverlay();
  }

  function resumeGame() {
    Engine.resume(state);
    wasPausedByBlur = false;
    updateOverlay();
  }

  function doRestart() {
    Engine.reset(state);
    state.bricks.forEach(function (b) {
      lastAliveById[b.row + '-' + b.col] = true;
    });
    particles.length = 0;
    updateOverlay();
  }

  actionBtn.addEventListener('click', handlePrimaryAction);
  pauseBtn.addEventListener('click', togglePause);

  // Auto-pause on blur / hidden tab, requires explicit resume.
  function clearHeldInput() {
    input.left = false;
    input.right = false;
    pointerActive = false;
  }

  window.addEventListener('blur', function () {
    clearHeldInput();
    if (state.status === Engine.STATUS.PLAYING) {
      Engine.pause(state);
      wasPausedByBlur = true;
      updateOverlay();
    }
  });
  document.addEventListener('visibilitychange', function () {
    clearHeldInput();
    if (document.hidden && state.status === Engine.STATUS.PLAYING) {
      Engine.pause(state);
      wasPausedByBlur = true;
      updateOverlay();
    }
  });

  // ---- Overlay / HUD -------------------------------------------------

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function showOverlay(title, desc, btnLabel) {
    overlayTitle.textContent = title;
    overlayDesc.textContent = desc;
    actionBtn.textContent = btnLabel;
    overlay.classList.remove('hidden');
  }

  function updateOverlay() {
    switch (state.status) {
      case Engine.STATUS.READY:
        showOverlay('벽돌깨기', '스페이스바 또는 버튼으로 공을 던지세요.', '시작하기');
        break;
      case Engine.STATUS.LOST_BALL:
        showOverlay('공을 놓쳤습니다', '남은 목숨: ' + state.lives, '다음 공 던지기');
        break;
      case Engine.STATUS.PAUSED:
        showOverlay('일시정지', '이어서 진행하려면 계속하기를 누르세요.', '계속하기');
        break;
      case Engine.STATUS.WON:
        showOverlay('승리!', '모든 벽돌을 깼습니다. 점수: ' + state.score, '다시 하기');
        break;
      case Engine.STATUS.GAME_OVER:
        showOverlay('게임 종료', '최종 점수: ' + state.score, '다시 하기');
        break;
      default:
        hideOverlay();
    }
    pauseBtn.textContent = state.status === Engine.STATUS.PAUSED ? '계속하기' : '일시정지';
    pauseBtn.disabled = state.status !== Engine.STATUS.PLAYING && state.status !== Engine.STATUS.PAUSED;
  }

  var lastHud = { score: null, bricksRemaining: null, lives: null };

  function updateHud() {
    if (state.score !== lastHud.score) {
      scoreValue.textContent = String(state.score);
      lastHud.score = state.score;
    }
    if (state.bricksRemaining !== lastHud.bricksRemaining) {
      bricksValue.textContent = String(state.bricksRemaining);
      lastHud.bricksRemaining = state.bricksRemaining;
    }
    if (state.lives !== lastHud.lives) {
      livesValue.textContent = String(state.lives);
      lastHud.lives = state.lives;
    }
  }

  // ---- Rendering -----------------------------------------------------

  function draw() {
    ctx.clearRect(0, 0, Engine.WIDTH, Engine.HEIGHT);

    // Background
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, Engine.WIDTH, Engine.HEIGHT);

    // Bricks
    state.bricks.forEach(function (b) {
      if (!b.alive) return;
      ctx.fillStyle = BRICK_COLORS[b.row % BRICK_COLORS.length];
      roundRect(ctx, b.x, b.y, b.w, b.h, 5);
      ctx.fill();
    });

    // Particles (cosmetic only)
    particles.forEach(function (p) {
      var alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Paddle
    ctx.fillStyle = '#241f21';
    roundRect(ctx, state.paddle.x, state.paddle.y, state.paddle.w, state.paddle.h, 8);
    ctx.fill();

    // Ball
    ctx.fillStyle = '#e8654f';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#241f21';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- Responsive fit --------------------------------------------------

  function fitStage() {
    var wrap = document.getElementById('app');
    var availW = wrap.clientWidth;
    var availH = wrap.clientHeight - document.querySelector('header').offsetHeight
      - document.getElementById('hud').offsetHeight
      - document.getElementById('controls-hint').offsetHeight
      - 40;
    var scale = Math.min(availW / Engine.WIDTH, availH / Engine.HEIGHT, 1);
    if (scale <= 0 || !isFinite(scale)) scale = 1;
    var w = Math.floor(Engine.WIDTH * scale);
    var h = Math.floor(Engine.HEIGHT * scale);
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  window.addEventListener('resize', fitStage);
  fitStage();

  // ---- Main loop -------------------------------------------------------

  var lastTime = null;

  function frame(timestamp) {
    if (lastTime === null) lastTime = timestamp;
    var dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (dt > 0.05) dt = 0.05; // avoid huge jumps (e.g. tab was hidden)

    var prevStatus = state.status;
    Engine.step(state, dt, input);
    updateParticles(dt);
    checkNewlyBroken();

    if (state.status !== prevStatus) {
      updateOverlay();
    }
    updateHud();
    draw();

    requestAnimationFrame(frame);
  }

  updateOverlay();
  updateHud();
  requestAnimationFrame(frame);
})();
