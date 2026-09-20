/* 구름새 · Sky Hop — 화면, 입력, 렌더링. 게임 규칙은 SkyHopEngine 에 있습니다. */
(function () {
  'use strict';
  var E = SkyHopEngine;
  var W = E.WIDTH, H = E.HEIGHT;
  var NAVY = '#1d2b4f', CREAM = '#fff6e4', CORAL = '#ef7a62', TEAL = '#2a9d8f';
  var BEST_KEY = 'skyhop.best.v1';

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('game'), ctx = canvas.getContext('2d');
  var scoreEl = $('score'), bestEl = $('best'), statusEl = $('status');
  var readyOv = $('readyOverlay'), pauseOv = $('pauseOverlay'), overOv = $('overOverlay'), overText = $('overText');
  var pauseBtn = $('pauseBtn');

  // ---- 최고 기록 저장 (저장소가 막혀 있어도 게임은 계속) -------------------
  function loadBest() {
    try { return Math.max(0, parseInt(localStorage.getItem(BEST_KEY), 10) || 0); } catch (e) { return 0; }
  }
  function saveBest(v) { try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* 무시 */ } }

  var state = E.createState({ best: loadBest() });
  var savedBest = state.best;
  // 최고 기록이 오른 즉시 저장 — 일시정지 후 재시작하거나 탭을 닫아도 남는다.
  function persistBest() {
    if (state.best > savedBest) { savedBest = state.best; saveBest(savedBest); }
  }
  var shownStatus = null, wing = 0;

  // ---- 상태 표시 -----------------------------------------------------------
  function syncUI() {
    scoreEl.textContent = state.score;
    bestEl.textContent = state.best;
    persistBest();
    readyOv.hidden = state.status !== 'ready';
    pauseOv.hidden = state.status !== 'paused';
    overOv.hidden = state.status !== 'gameover';
    pauseBtn.disabled = state.status !== 'playing';
    if (shownStatus === state.status) return;
    shownStatus = state.status;
    var msg = {
      ready: '준비됐어요. 스페이스나 클릭으로 시작!',
      playing: '플레이 중',
      paused: '일시정지됨. 계속하기 버튼이나 P 키로 재개하세요.',
      gameover: '게임 오버. 점수 ' + state.score + '점, 최고 ' + state.best + '점.'
    }[state.status];
    statusEl.textContent = msg;
    if (state.status === 'gameover') {
      overText.textContent = '점수 ' + state.score + ' · 최고 ' + state.best + (state.newBest ? ' — 새 기록!' : '');
    }
  }

  // ---- 동작 ----------------------------------------------------------------
  function doFlap() {
    if (state.status !== 'ready' && state.status !== 'playing') return;
    if (E.flap(state)) wing = 1;
    syncUI();
  }
  function doPause() { if (E.pause(state)) syncUI(); }
  function doResume() { if (E.resume(state)) syncUI(); }
  function doRestart() {
    if (state.status !== 'gameover' && state.status !== 'paused') return;
    E.reset(state);
    shownStatus = null;
    syncUI();
  }
  function togglePause() { if (state.status === 'playing') doPause(); else if (state.status === 'paused') doResume(); }

  // ---- 입력 ----------------------------------------------------------------
  var held = {};   // 키를 뗄 때까지 다시 눌린 것으로 치지 않는다 (반복 입력 방지)
  var FLAP_KEYS = { Space: 1, ArrowUp: 1, KeyW: 1 };

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var c = e.code;
    if (c === 'Space' || c === 'ArrowUp') e.preventDefault(); // 스크롤·버튼 활성화 방지
    if (e.repeat || held[c]) return;
    held[c] = true;
    if (FLAP_KEYS[c]) doFlap();
    else if (c === 'KeyP' || c === 'Escape') togglePause();
    else if (c === 'KeyR' || (c === 'Enter' && e.target.tagName !== 'BUTTON')) doRestart();
  });
  document.addEventListener('keyup', function (e) {
    held[e.code] = false;
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('blur', function () { held = {}; doPause(); });
  document.addEventListener('visibilitychange', function () { held = {}; if (document.hidden) doPause(); });

  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    doFlap();
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  pauseBtn.addEventListener('click', function () { doPause(); pauseBtn.blur(); });
  $('resumeBtn').addEventListener('click', doResume);
  $('restartBtn').addEventListener('click', doRestart);
  $('restartFromPauseBtn').addEventListener('click', doRestart);

  // ---- 캔버스 크기 (DPR 대응) ------------------------------------------------
  var scale = 1;
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var cssW = canvas.clientWidth || W;
    var px = Math.max(1, Math.round(cssW * dpr));
    if (canvas.width !== px) { canvas.width = px; canvas.height = Math.round(px * H / W); }
    scale = canvas.width / W;
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);

  // ---- 그리기 ---------------------------------------------------------------
  var clouds = [];
  (function () {
    var seed = 7;
    function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 6; i++) clouds.push({ x: r() * W, y: 40 + r() * 260, s: 0.7 + r() * 0.8, k: 0.12 + r() * 0.12 });
  })();

  function rr(x, y, w, h, tl, tr, br, bl) {
    ctx.beginPath();
    ctx.moveTo(x + tl, y); ctx.lineTo(x + w - tr, y); ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br); ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h); ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl); ctx.arcTo(x, y, x + tl, y, tl); ctx.closePath();
  }

  function drawSky(s) {
    var g = ctx.createLinearGradient(0, 0, 0, E.GROUND_Y);
    g.addColorStop(0, '#bfe9dc'); g.addColorStop(1, CREAM);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,246,228,.9)';
    ctx.beginPath(); ctx.arc(330, 96, 34, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    clouds.forEach(function (c) {
      var x = ((c.x - s.scroll * c.k) % (W + 160) + (W + 160)) % (W + 160) - 80;
      ctx.beginPath();
      ctx.arc(x, c.y, 20 * c.s, 0, 7); ctx.arc(x + 22 * c.s, c.y + 5 * c.s, 16 * c.s, 0, 7);
      ctx.arc(x - 22 * c.s, c.y + 6 * c.s, 14 * c.s, 0, 7); ctx.fill();
    });
    // 멀리 있는 언덕 두 겹
    [[0.25, 'rgba(60,74,112,.20)', 70, 0.012], [0.5, 'rgba(29,43,79,.28)', 42, 0.02]].forEach(function (l) {
      ctx.fillStyle = l[1]; ctx.beginPath(); ctx.moveTo(0, E.GROUND_Y);
      for (var x = 0; x <= W; x += 6) {
        ctx.lineTo(x, E.GROUND_Y - 30 - l[2] * 0.5 * (1 + Math.sin((x + s.scroll * l[0]) * l[3] + l[2])));
      }
      ctx.lineTo(W, E.GROUND_Y); ctx.fill();
    });
  }

  function drawGate(g) {
    var top = g.gapY - E.GATE_GAP / 2, bot = g.gapY + E.GATE_GAP / 2;
    var col = g.id % 2 ? TEAL : CORAL, dark = g.id % 2 ? '#1f7a6f' : '#d2604a';
    ctx.lineWidth = 3; ctx.strokeStyle = NAVY; ctx.fillStyle = col;
    rr(g.x, -30, E.GATE_WIDTH, top + 30, 0, 0, 16, 16); ctx.fill(); ctx.stroke();
    rr(g.x, bot, E.GATE_WIDTH, E.GROUND_Y - bot + 10, 16, 16, 0, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = dark;   // 틈 쪽 끝의 띠
    rr(g.x + 3, top - 20, E.GATE_WIDTH - 6, 14, 0, 0, 8, 8); ctx.fill();
    rr(g.x + 3, bot + 6, E.GATE_WIDTH - 6, 14, 8, 8, 0, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)';   // 왼쪽 하이라이트
    rr(g.x + 9, -30, 7, top - 28, 3, 3, 3, 3); ctx.fill();
    rr(g.x + 9, bot + 26, 7, E.GROUND_Y - bot - 22, 3, 3, 3, 3); ctx.fill();
  }

  function drawGround(s) {
    ctx.fillStyle = NAVY; ctx.fillRect(0, E.GROUND_Y, W, E.GROUND_H);
    ctx.fillStyle = '#3c4a70'; ctx.fillRect(0, E.GROUND_Y, W, 6);
    ctx.fillStyle = 'rgba(205,238,227,.55)';
    var off = -(s.scroll % 40);
    for (var x = off; x < W; x += 40) { rr(x, E.GROUND_Y + 22, 22, 6, 3, 3, 3, 3); ctx.fill(); }
  }

  function drawBird(s) {
    var b = s.bird, r = E.BIRD_DRAW_RADIUS;
    var tilt = s.status === 'ready' ? 0 : Math.max(-0.45, Math.min(1.0, b.vy / 520));
    var flapAngle = Math.sin(s.idleTime * 12 + s.elapsed * 22) * 0.5 - 0.1 + wing * 0.6;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(tilt);
    ctx.lineWidth = 2.5; ctx.strokeStyle = NAVY; ctx.lineJoin = 'round';
    ctx.fillStyle = TEAL;   // 꼬리
    ctx.beginPath(); ctx.moveTo(-r + 3, -2); ctx.lineTo(-r - 9, -8); ctx.lineTo(-r - 7, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = CORAL;  // 부리
    ctx.beginPath(); ctx.moveTo(r - 2, -3); ctx.lineTo(r + 9, 2); ctx.lineTo(r - 2, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fffaf0';  // 몸통
    ctx.beginPath(); ctx.ellipse(0, 0, r + 1, r - 1, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#cdeee3';  // 배
    ctx.beginPath(); ctx.ellipse(1, 5, r - 5, 5, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(-3, 1); ctx.rotate(flapAngle);   // 날개
    ctx.fillStyle = NAVY; ctx.beginPath(); ctx.ellipse(-3, 0, 9, 5, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = NAVY; ctx.beginPath(); ctx.arc(6, -5, 2.6, 0, 7); ctx.fill();   // 눈
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6.8, -5.8, 0.9, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawText(txt, x, y, size) {
    ctx.font = '800 ' + size + 'px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = CREAM; ctx.lineJoin = 'round'; ctx.strokeText(txt, x, y);
    ctx.fillStyle = NAVY; ctx.fillText(txt, x, y);
  }

  function draw() {
    var s = state;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawSky(s);
    for (var i = 0; i < s.gates.length; i++) drawGate(s.gates[i]);
    drawGround(s);
    drawBird(s);
    if (s.status !== 'ready') drawText(String(s.score), W / 2, 70, 52);
    if (s.status === 'playing' && s.countdown > 0) drawText(String(Math.ceil(s.countdown / (E.RESUME_COUNTDOWN / 3))), W / 2, 220, 64);
  }

  // ---- 메인 루프 ---------------------------------------------------------------
  var last = null;
  function frame(t) {
    var dt = last == null ? 0 : (t - last) / 1000;
    last = t;
    wing = Math.max(0, wing - dt * 5);
    var was = state.status;
    E.step(state, dt);
    if (state.status !== was) syncUI();
    else if (scoreEl.textContent !== String(state.score)) {
      scoreEl.textContent = state.score;
      bestEl.textContent = state.best;
      persistBest();
    }
    draw();
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () { last = null; });

  resize();
  syncUI();
  requestAnimationFrame(frame);

  // 테스트/디버깅용 노출
  window.__skyHop = { state: state };
})();
