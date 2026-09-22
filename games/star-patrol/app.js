/* app.js — 별빛 순찰대 화면/입력 레이어. 엔진(engine.js)은 순수 로직만 담당합니다. */
(function () {
  'use strict';
  var E = window.StarPatrolEngine;
  var BEST_KEY = 'starPatrolBest';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var startScreen = document.getElementById('startScreen');
  var hud = document.getElementById('hud');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var livesEl = document.getElementById('lives');
  var waveEl = document.getElementById('wave');
  var overlay = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlayTitle');
  var overlayHint = document.getElementById('overlayHint');
  var btnStart = document.getElementById('btnStart');
  var fireButtons = document.querySelectorAll('.fireOpt');
  var btnLeft = document.getElementById('btnLeft');
  var btnRight = document.getElementById('btnRight');
  var btnFire = document.getElementById('btnFire');

  function loadBest() {
    try { var n = Number(localStorage.getItem(BEST_KEY)); return Number.isFinite(n) && n > 0 ? Math.min(999999999, Math.floor(n)) : 0; }
    catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* 저장 불가 시 무시 */ }
  }

  var fireKey = 'normal';
  var state = E.createState({ best: loadBest(), fireInterval: fireKey });
  var lastBestSaved = state.best;

  fireButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      fireKey = btn.dataset.fire;
      fireButtons.forEach(function (b) { b.classList.toggle('active', b === btn); });
      E.setFireInterval(state, fireKey);
    });
  });

  btnStart.addEventListener('click', function () {
    clearAllInputs();
    E.start(state);
    startScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    canvas.focus();
  });

  // ---- 키보드 입력 --------------------------------------------------------
  var keyLeft = false, keyRight = false, keyFire = false;
  function syncInput() {
    E.setLeft(state, keyLeft);
    E.setRight(state, keyRight);
    E.setFire(state, keyFire);
  }
  window.addEventListener('keydown', function (ev) {
    if (['ArrowLeft','ArrowRight','Space'].includes(ev.code)) ev.preventDefault();
    if (ev.repeat) return;
    if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') { keyLeft = true; syncInput(); }
    else if (ev.code === 'ArrowRight' || ev.code === 'KeyD') { keyRight = true; syncInput(); }
    else if (ev.code === 'Space') { keyFire = true; syncInput(); ev.preventDefault(); }
    else if ((ev.code === 'KeyP' || ev.code === 'Escape')) togglePause();
    else if (ev.code === 'KeyR') doRestart();
  });
  window.addEventListener('keyup', function (ev) {
    if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') { keyLeft = false; syncInput(); }
    else if (ev.code === 'ArrowRight' || ev.code === 'KeyD') { keyRight = false; syncInput(); }
    else if (ev.code === 'Space') { keyFire = false; syncInput(); }
  });

  // ---- 터치/포인터 버튼 ----------------------------------------------------
  var pointerLeft = false, pointerRight = false, pointerFire = false;
  function syncPointerInput() {
    E.setLeft(state, keyLeft || pointerLeft);
    E.setRight(state, keyRight || pointerRight);
    E.setFire(state, keyFire || pointerFire);
  }
  // 키보드 경로와 포인터 경로가 각자 최신값을 병합해서 반영하도록 통일
  function makeSyncAll() {
    E.setLeft(state, keyLeft || pointerLeft);
    E.setRight(state, keyRight || pointerRight);
    E.setFire(state, keyFire || pointerFire);
  }
  syncInput = makeSyncAll;

  function bindHold(el, setter) {
    var ids = new Set();
    function off(ev) { ids.delete(ev.pointerId); setter(ids.size > 0); makeSyncAll(); }
    el.addEventListener('pointerdown', function(ev) {
      if (state.status !== E.STATUS.PLAYING || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      ev.preventDefault(); ids.add(ev.pointerId); el.setPointerCapture(ev.pointerId);
      setter(true); makeSyncAll();
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(function(type) { el.addEventListener(type, off); });
    return function() { ids.clear(); setter(false); };
  }
  var offLeft = bindHold(btnLeft, function (v) { pointerLeft = v; });
  var offRight = bindHold(btnRight, function (v) { pointerRight = v; });
  var offFire = bindHold(btnFire, function (v) { pointerFire = v; });

  function clearAllInputs() {
    offLeft(); offRight(); offFire();
    keyLeft = keyRight = keyFire = false;
    pointerLeft = pointerRight = pointerFire = false;
    E.clearInput(state);
  }

  window.addEventListener('blur', function () {
    clearAllInputs();
    if (state.status === E.STATUS.PLAYING) E.pause(state);
    render();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearAllInputs();
      if (state.status === E.STATUS.PLAYING) E.pause(state);
      render();
    }
  });

  function togglePause() {
    if (state.status === E.STATUS.PLAYING) { clearAllInputs(); E.pause(state); render(); }
    else if (state.status === E.STATUS.PAUSED) { clearAllInputs(); E.resume(state); }
  }
  function doRestart() {
    if (state.status !== E.STATUS.PAUSED && state.status !== E.STATUS.GAMEOVER) return;
    clearAllInputs();
    E.restart(state);
    startScreen.classList.remove('hidden');
    hud.classList.add('hidden');
    fireButtons.forEach(function (b) { b.classList.toggle('active', b.dataset.fire === fireKey); });
  }

  document.getElementById('btnPause').addEventListener('click', togglePause);
  document.getElementById('btnResume').addEventListener('click', togglePause);
  document.getElementById('btnRestart').addEventListener('click', doRestart);

  // ---- 렌더링 --------------------------------------------------------------
  var COLOR_BG_TOP = '#0a1730';
  var COLOR_BG_BOT = '#071022';
  var COLOR_MINT = '#5eead4';
  var COLOR_AMBER = '#ffc65c';
  var COLOR_CORAL = '#ff8a6b';

  function resize() {
    var wrap = canvas.parentElement;
    var scale = Math.min(wrap.clientWidth / E.WIDTH, wrap.clientHeight / E.HEIGHT);
    scale = Math.max(scale, 0.1);
    canvas.style.width = Math.floor(E.WIDTH * scale) + 'px';
    canvas.style.height = Math.floor(E.HEIGHT * scale) + 'px';
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(E.WIDTH * scale * dpr);
    canvas.height = Math.floor(E.HEIGHT * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  var starField = null;
  function buildStars() {
    starField = [];
    for (var i = 0; i < 70; i++) {
      starField.push({
        x: Math.random() * E.WIDTH, y: Math.random() * E.HEIGHT,
        r: 0.6 + Math.random() * 1.4, tw: Math.random() * Math.PI * 2
      });
    }
  }
  buildStars();

  function drawBackground(t) {
    var g = ctx.createLinearGradient(0, 0, 0, E.HEIGHT);
    g.addColorStop(0, COLOR_BG_TOP);
    g.addColorStop(1, COLOR_BG_BOT);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, E.WIDTH, E.HEIGHT);
    for (var i = 0; i < starField.length; i++) {
      var s = starField[i];
      var a = reduced ? 0.6 : 0.35 + 0.5 * Math.abs(Math.sin(t * 1.5 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cfe8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(p) {
    if (!p.alive) return;
    if (!reduced && p.invuln > 0 && Math.floor(p.invuln * 6) % 2 === 0) return; // 무적 점멸
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#ffbd69';
    ctx.beginPath(); ctx.moveTo(-5,12);ctx.lineTo(0,24+(reduced?0:4*Math.sin(state.elapsed*25)));ctx.lineTo(5,12);ctx.fill();
    ctx.fillStyle = COLOR_MINT;
    ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(9,-2);ctx.lineTo(20,11);ctx.lineTo(8,8);ctx.lineTo(5,15);ctx.lineTo(-5,15);ctx.lineTo(-8,8);ctx.lineTo(-20,11);ctx.lineTo(-9,-2);ctx.closePath();ctx.fill();
    ctx.fillStyle='#eafff8';ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(4,7);ctx.lineTo(-4,7);ctx.closePath();ctx.fill();
    ctx.fillStyle='#17364c';ctx.fillRect(-3,-7,6,9);
    if(p.invuln>0){ctx.strokeStyle='#b9fff0';ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }

  function drawEnemy(e) {
    var color = e.kind === 'coral' ? COLOR_CORAL : COLOR_AMBER;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.state === 'dying') {
      var k = 1 - e.dyingT / E.DYING_DURATION;
      ctx.globalAlpha = Math.max(0, k);
      ctx.scale(1 + (1 - k) * 0.6, 1 + (1 - k) * 0.6);
    }
    ctx.fillStyle = color;
    ctx.beginPath();ctx.moveTo(0,13);ctx.lineTo(-7,5);ctx.lineTo(-17,9);ctx.lineTo(-12,-7);ctx.lineTo(-5,-3);ctx.lineTo(0,-11);ctx.lineTo(5,-3);ctx.lineTo(12,-7);ctx.lineTo(17,9);ctx.lineTo(7,5);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff1c9';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(5,2);ctx.lineTo(0,8);ctx.lineTo(-5,2);ctx.closePath();ctx.fill();
    ctx.fillStyle='#132438';ctx.fillRect(-3,-1,6,3);
    ctx.restore();
  }

  function drawBullet(b, color, r) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(b.x-r/2, b.y-7, r, 14, 2);
    ctx.fill();
  }

  function drawParticle(pt) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function render() {
    drawBackground(state.elapsed);
    for (var i = 0; i < state.enemies.length; i++) drawEnemy(state.enemies[i]);
    for (i = 0; i < state.playerBullets.length; i++) drawBullet(state.playerBullets[i], COLOR_MINT, E.PLAYER_BULLET_R);
    for (i = 0; i < state.enemyBullets.length; i++) drawBullet(state.enemyBullets[i], COLOR_CORAL, E.ENEMY_BULLET_R);
    for (i = 0; i < state.particles.length; i += reduced ? 5 : 1) drawParticle(state.particles[i]);
    drawPlayer(state.player);

    document.getElementById('btnResume').hidden = state.status !== E.STATUS.PAUSED;
    document.getElementById('btnPause').disabled = state.status !== E.STATUS.PLAYING;
    [btnLeft,btnRight,btnFire].forEach(function(b){ b.disabled = state.status !== E.STATUS.PLAYING; });
    if (state.transitioning) {ctx.fillStyle='#eafff8';ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.fillText('WAVE CLEAR',E.WIDTH/2,E.HEIGHT/2);}
    scoreEl.textContent = String(state.score);
    bestEl.textContent = String(state.best);
    livesEl.textContent = String(state.lives);
    waveEl.textContent = String(state.wave);

    if (state.status === E.STATUS.PAUSED) {
      overlay.classList.remove('hidden');
      overlayTitle.textContent = '일시정지';
      overlayHint.textContent = 'P 재개 · R 대기 화면으로';
    } else if (state.status === E.STATUS.GAMEOVER) {
      overlay.classList.remove('hidden');
      overlayTitle.textContent = '게임 종료';
      overlayHint.textContent = (state.newBest ? '신기록! · ' : '') + 'R 다시 시작';
    } else {
      overlay.classList.add('hidden');
    }

    if (state.best > lastBestSaved) {
      lastBestSaved = state.best;
      saveBest(state.best);
    }
  }

  var lastT = null;
  function loop(t) {
    if (lastT == null) lastT = t;
    var dt = (t - lastT) / 1000;
    lastT = t;
    E.step(state, dt);
    render();
    requestAnimationFrame(loop);
  }

  resize();
  render();
  requestAnimationFrame(loop);
})();
