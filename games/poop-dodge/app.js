/* 오늘도 무사히 · 똥피하기 — 화면·입력·저장 (게임 규칙은 engine.js) */
(function () {
  'use strict';
  var E = window.PoopDodgeEngine;
  var W = E.WIDTH, H = E.HEIGHT, GY = E.GROUND_Y;
  var BEST_KEY = 'edyedy.poopDodge.bestMs';

  var C = {
    cream: '#fff6e4', sky1: '#ffe8c2', sky2: '#fff8ea', navy: '#1d2b4f', coral: '#ef7a62', teal: '#2a9d8f',
    tealLight: '#8fd0c3', tealPale: '#c4e8df', poop: '#94612f', poopLight: '#b98550', poopDark: '#4d2f17',
    skin: '#ffd9b8', soil: '#ecd0a2', soilDark: '#d9b782'
  };

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('game'), ctx = canvas.getContext('2d');
  var el = {
    time: $('time'), dodged: $('dodged'), best: $('best'), status: $('status'), notice: $('notice'),
    pauseBtn: $('pauseBtn'), startBtn: $('startBtn'), resumeBtn: $('resumeBtn'), restartBtn: $('restartBtn'),
    restartFromPauseBtn: $('restartFromPauseBtn'),
    ready: $('readyOverlay'), pause: $('pauseOverlay'), over: $('overOverlay'),
    overText: $('overText'), badge: $('recordBadge'), left: $('leftBtn'), right: $('rightBtn')
  };

  // ---- 저장 (실패해도 게임은 계속) -------------------------------------
  var storageOk = true;
  function loadBest() {
    try { return E.parseStoredBest(localStorage.getItem(BEST_KEY)); } catch (e) { return 0; }
  }
  function writeStorage(fn) {
    try { fn(); return true; } catch (e) {
      if (storageOk) {
        storageOk = false;
        el.notice.textContent = '기록을 저장할 수 없어요. 이 창을 닫으면 기록이 사라져요.';
      }
      return false;
    }
  }

  var s = E.createState({ best: loadBest() });
  var savedTenth = Math.floor(s.best * 10), savedSer = E.serializeBest(s.best);

  /** 최고 기록이 오르는 즉시(0.1초 단위) 저장. force 면 정확한 값으로 한 번 더 저장. */
  function persistBest(force) {
    var tenth = Math.floor(s.best * 10);
    if (!force && tenth === savedTenth) return;
    var ser = E.serializeBest(s.best);
    if (ser === savedSer) return;
    savedTenth = tenth; savedSer = ser;
    writeStorage(function () { localStorage.setItem(BEST_KEY, ser); });
  }

  // ---- 화면 상태 --------------------------------------------------------
  var shownStatus = null;
  var anim = 0, shake = 0, facing = 1, stride = 0;
  var splats = [], bursts = [];
  var dragPointer = null;
  var raf = 0, lastT = 0;

  function say(msg) { el.status.textContent = msg; }

  function updateHud() {
    var t = E.formatTime(s.time), b = E.formatTime(s.best);
    if (el.time.textContent !== t) el.time.textContent = t;
    if (el.best.textContent !== b) el.best.textContent = b;
    var d = String(s.dodged);
    if (el.dodged.textContent !== d) el.dodged.textContent = d;
  }

  function updateHoldUI() {
    var l = false, r = false, held = s.input.held;
    for (var k in held) { if (held[k] < 0) l = true; else r = true; }
    el.left.classList.toggle('on', l);
    el.right.classList.toggle('on', r);
  }

  function syncStatus() {
    if (shownStatus === s.status) return;
    var prev = shownStatus;
    shownStatus = s.status;
    var st = E.STATUS;
    el.ready.hidden = s.status !== st.READY;
    el.pause.hidden = s.status !== st.PAUSED;
    el.over.hidden = s.status !== st.GAMEOVER;
    var active = s.status === st.PLAYING;
    el.left.disabled = el.right.disabled = !active;
    el.pauseBtn.disabled = !(active || s.status === st.PAUSED);
    el.pauseBtn.textContent = s.status === st.PAUSED ? '▶' : '⏸';
    el.pauseBtn.setAttribute('aria-label', s.status === st.PAUSED ? '계속하기' : '일시정지');
    updateHoldUI();
    if (s.status === st.PAUSED) { say('일시정지'); el.resumeBtn.focus(); }
    else if (s.status === st.PLAYING) { say(prev === st.PAUSED ? '계속합니다' : '시작!'); blurIfHidden(); }
    else if (s.status === st.GAMEOVER) {
      el.overText.textContent = E.formatTime(s.time) + ' 버텼고, 똥 ' + s.dodged + '개를 피했어요.';
      el.badge.hidden = !s.newRecord;
      persistBest(true);
      say('게임 오버. ' + el.overText.textContent + (s.newRecord ? ' 신기록입니다.' : ''));
      el.restartBtn.focus();
    } else say('준비');
    updateHud();
    ensureLoop();
  }
  function blurIfHidden() {
    var a = document.activeElement;
    if (a && a !== document.body && a.offsetParent === null && a.blur) a.blur();
  }

  // ---- 동작 (버튼·키보드가 공유) ------------------------------------------
  function doStart() { if (E.start(s)) syncStatus(); }
  function doPause() {
    if (E.pause(s)) { dragPointer = null; persistBest(true); syncStatus(); return true; }
    return false;
  }
  function doResume() { if (E.resume(s)) { dragPointer = null; syncStatus(); } }
  function doRestart() {
    if (E.restart(s)) {
      dragPointer = null; splats = []; bursts = []; shake = 0;
      shownStatus = null; syncStatus();
      say('다시 시작!');
    }
  }
  function togglePause() { if (!doPause()) doResume(); }

  // 버튼은 click 하나만 사용한다 (pointerdown 과 겹쳐 두 번 처리되는 일 방지)
  el.startBtn.addEventListener('click', doStart);
  el.pauseBtn.addEventListener('click', togglePause);
  el.resumeBtn.addEventListener('click', doResume);
  el.restartBtn.addEventListener('click', doRestart);
  el.restartFromPauseBtn.addEventListener('click', doRestart);

  // 기록 지우기: 두 번 눌러야 지워진다
  var resetTimer = 0;
  Array.prototype.forEach.call(document.querySelectorAll('.resetBest'), function (btn) {
    btn.addEventListener('click', function () {
      if (s.status === E.STATUS.PLAYING) return;
      if (!resetTimer) {
        setAllReset('정말 지울까요? 한 번 더 누르세요');
        resetTimer = setTimeout(cancelReset, 3500);
        return;
      }
      cancelReset();
      if (E.resetBest(s)) {
        savedTenth = 0; savedSer = '0';
        writeStorage(function () { localStorage.removeItem(BEST_KEY); });
        updateHud();
        el.badge.hidden = true;
        say('최고 기록을 지웠어요');
      }
    });
  });
  function setAllReset(text) {
    Array.prototype.forEach.call(document.querySelectorAll('.resetBest'), function (b) { b.textContent = text; });
  }
  function cancelReset() { clearTimeout(resetTimer); resetTimer = 0; setAllReset('기록 지우기'); }

  // ---- 키보드 -----------------------------------------------------------
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var act = E.actionForCode(e.code);
    if (!act) return;
    if (act === 'left' || act === 'right') {
      e.preventDefault();
      if (E.press(s, 'key:' + e.code, act === 'left' ? -1 : 1)) updateHoldUI();
    } else if (!e.repeat) {
      e.preventDefault();
      if (act === 'pause') togglePause();
      else if (act === 'restart') doRestart();   // 엔진이 일시정지·게임 오버에서만 허용
    }
  });
  window.addEventListener('keyup', function (e) {
    if (E.release(s, 'key:' + e.code)) updateHoldUI();
  });

  // ---- 화면 버튼(누르고 있기) ---------------------------------------------
  function bindHold(btn, dir) {
    var prefix = 'btn:' + dir + ':';
    btn.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (E.press(s, prefix + e.pointerId, dir)) {
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
        updateHoldUI();
      }
    });
    function up(e) { if (E.release(s, prefix + e.pointerId)) updateHoldUI(); }
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function (e) { e.preventDefault(); });   // 키보드 Enter/Space 로는 이동하지 않음
  }
  bindHold(el.left, -1);
  bindHold(el.right, 1);

  // ---- 캔버스 끌기 (누른 채 손가락/마우스 쪽으로 이동) -------------------------
  function logicalX(e) {
    var r = canvas.getBoundingClientRect();
    return (e.clientX - r.left) / r.width * W;
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (s.status !== E.STATUS.PLAYING || dragPointer !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    dragPointer = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    E.setTarget(s, logicalX(e));
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId === dragPointer) E.setTarget(s, logicalX(e));
  });
  function endDrag(e) {
    if (e.pointerId !== dragPointer) return;
    dragPointer = null;
    E.setTarget(s, null);
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---- 창이 가려지면 자동 일시정지 -------------------------------------------
  function autoPause() { doPause(); }
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', function () { if (document.hidden) autoPause(); });
  window.addEventListener('pagehide', function () { persistBest(true); autoPause(); });

  // ---- 그리기 -----------------------------------------------------------
  function fit() {
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var pw = Math.max(1, Math.round(r.width * dpr));
    var ph = Math.round(pw * H / W);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    ctx.setTransform(pw / W, 0, 0, pw / W, 0, 0);
    draw();
  }
  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas);

  function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); }
  function outline(w) { ctx.lineWidth = w || 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = C.navy; ctx.stroke(); }

  function cloud(x, y, sc) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, 6.2832); ctx.arc(22, -8, 22, 0, 6.2832); ctx.arc(46, 0, 17, 0, 6.2832);
    ctx.rect(0, 0, 46, 17); ctx.fill();
    ctx.restore();
  }

  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, C.sky1); g.addColorStop(1, C.sky2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 해
    ctx.fillStyle = 'rgba(239,122,98,.18)'; ellipse(392, 96, 54, 54); ctx.fill();
    ctx.fillStyle = C.coral; ellipse(392, 96, 34, 34); ctx.fill(); outline(3);
    // 구름
    var d = anim * 9;
    cloud(((70 + d) % (W + 160)) - 80, 70, 1.1);
    cloud(((300 + d * .6) % (W + 160)) - 80, 150, .8);
    cloud(((190 + d * .8) % (W + 160)) - 80, 240, .7);
    // 언덕
    ctx.fillStyle = C.tealPale;
    ctx.beginPath(); ctx.moveTo(0, GY); ctx.quadraticCurveTo(90, GY - 120, 210, GY - 40); ctx.quadraticCurveTo(320, GY - 100, W, GY - 30); ctx.lineTo(W, GY); ctx.fill();
    ctx.fillStyle = C.tealLight;
    ctx.beginPath(); ctx.moveTo(0, GY); ctx.quadraticCurveTo(120, GY - 50, 260, GY - 8); ctx.quadraticCurveTo(380, GY - 60, W, GY - 12); ctx.lineTo(W, GY); ctx.fill();
    // 땅
    ctx.fillStyle = C.soil; ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = C.soilDark;
    for (var i = 0; i < 16; i++) { ellipse(18 + i * 31 + (i % 3) * 5, GY + 30 + (i % 4) * 8, 4 + i % 3, 2.4); ctx.fill(); }
    ctx.fillStyle = C.teal; ctx.fillRect(0, GY, W, 12);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, GY, W, 3);
    ctx.strokeStyle = C.navy; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, GY + 12); ctx.lineTo(W, GY + 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, GY); ctx.lineTo(W, GY); ctx.stroke();
  }

  function drawPoop(x, y, rot, scale, mood) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
    ctx.fillStyle = C.poop;
    // 아래 → 위 세 덩이
    ellipse(0, 9, 21, 11); ctx.fill(); outline(3);
    ellipse(0, -3, 15.5, 9.5); ctx.fill(); outline(3);
    ctx.beginPath(); ctx.moveTo(-9, -10); ctx.quadraticCurveTo(-8, -20, 4, -23); ctx.quadraticCurveTo(3, -17, 9, -13); ctx.quadraticCurveTo(0, -6, -9, -10);
    ctx.fill(); outline(3);
    // 하이라이트
    ctx.strokeStyle = C.poopLight; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-15, 8); ctx.quadraticCurveTo(-13, 3, -8, 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, -4); ctx.quadraticCurveTo(-8, -7, -4, -8); ctx.stroke();
    // 얼굴
    ctx.fillStyle = '#fff';
    ellipse(-6, 6, 4.2, 4.8); ctx.fill(); ellipse(6, 6, 4.2, 4.8); ctx.fill();
    ctx.fillStyle = C.navy;
    var look = mood === 'hit' ? 0 : 1.6;
    ellipse(-6, 6.6 + look * .3, 2.1, 2.5); ctx.fill(); ellipse(6, 6.6 + look * .3, 2.1, 2.5); ctx.fill();
    ctx.strokeStyle = C.navy; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'hit') ctx.arc(0, 14, 3.5, 3.4, 6.0); else ctx.arc(0, 11, 4.5, 0.25, 2.9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(239,122,98,.55)';
    ellipse(-13, 11, 3, 2); ctx.fill(); ellipse(13, 11, 3, 2); ctx.fill();
    ctx.restore();
  }

  function drawPlayer(dead) {
    var p = s.player;
    var lean = p.vx / E.PLAYER_SPEED * 0.1;
    var bob = s.status === E.STATUS.READY ? Math.sin(anim * 3) * 1.5 : 0;
    ctx.save(); ctx.translate(p.x, GY + bob); ctx.rotate(dead ? 0 : lean);
    // 그림자
    ctx.fillStyle = 'rgba(29,43,79,.18)'; ellipse(0, 1, 20, 4); ctx.fill();
    var sw = dead ? 0 : Math.sin(stride) * (Math.abs(p.vx) > 20 ? 6 : 0);
    // 다리
    ctx.strokeStyle = C.navy; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, -14); ctx.lineTo(-7 + sw, -3); ctx.moveTo(7, -14); ctx.lineTo(7 - sw, -3); ctx.stroke();
    ctx.fillStyle = C.coral;
    ellipse(-7 + sw, -2, 6, 3.4); ctx.fill(); outline(2.5); ellipse(7 - sw, -2, 6, 3.4); ctx.fill(); outline(2.5);
    // 몸
    ctx.fillStyle = C.teal;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-14, -34, 28, 24, 9) : ctx.rect(-14, -34, 28, 24);
    ctx.fill(); outline(3);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-9, -30, 5, 12);
    // 팔
    var armUp = dead ? 0 : (s.status === E.STATUS.PLAYING ? 1 : 0);
    ctx.strokeStyle = C.navy; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-14, -28); ctx.lineTo(-21, -22 - armUp * 4); ctx.moveTo(14, -28); ctx.lineTo(21, -22 - armUp * 4); ctx.stroke();
    // 머리
    ctx.fillStyle = C.skin; ellipse(0, -41, 16, 15.5); ctx.fill(); outline(3);
    // 모자
    ctx.fillStyle = C.coral;
    ctx.beginPath(); ctx.arc(0, -43, 16.5, 3.3, 6.12); ctx.closePath(); ctx.fill(); outline(3);
    ctx.beginPath(); ctx.ellipse(facing * 11, -44, 9, 3, 0, 0, 6.2832); ctx.fill(); outline(2.5);
    // 얼굴
    var fx = facing * 2;
    ctx.fillStyle = C.navy; ctx.strokeStyle = C.navy; ctx.lineWidth = 2;
    if (dead) {
      [-6, 6].forEach(function (ex) {
        ctx.beginPath(); ctx.moveTo(ex + fx - 2.5, -40); ctx.lineTo(ex + fx + 2.5, -35); ctx.moveTo(ex + fx + 2.5, -40); ctx.lineTo(ex + fx - 2.5, -35); ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(-4 + fx, -30); ctx.quadraticCurveTo(fx, -33, 4 + fx, -30); ctx.stroke();
    } else {
      ellipse(-5.5 + fx, -37, 1.9, 2.4); ctx.fill(); ellipse(5.5 + fx, -37, 1.9, 2.4); ctx.fill();
      ctx.beginPath();
      if (s.status === E.STATUS.PLAYING) ctx.arc(fx, -31, 2.4, 0, 6.2832); else ctx.arc(fx, -33, 3.6, 0.25, 2.9);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(239,122,98,.5)';
    ellipse(-10 + fx, -33, 3, 2); ctx.fill(); ellipse(10 + fx, -33, 3, 2); ctx.fill();
    ctx.restore();
  }

  function drawShadows() {
    for (var i = 0; i < s.poops.length; i++) {
      var q = s.poops[i];
      var k = Math.max(0, Math.min(1, q.y / GY));
      ctx.fillStyle = 'rgba(29,43,79,' + (0.06 + 0.16 * k).toFixed(3) + ')';
      ellipse(q.x, GY + 6, 7 + 12 * k, 2 + 2.5 * k); ctx.fill();
    }
  }

  function drawEffects() {
    for (var i = 0; i < splats.length; i++) {
      var sp = splats[i], a = Math.max(0, 1 - sp.age / 1.1), sq = Math.min(1, sp.age / 0.12);
      ctx.globalAlpha = a; ctx.fillStyle = C.poop;
      ellipse(sp.x, GY + 5, 12 + 6 * sq, 3 + 2 * sq); ctx.fill();
      ellipse(sp.x - 9, GY + 4, 3, 1.6); ctx.fill(); ellipse(sp.x + 10, GY + 5, 2.4, 1.4); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (var j = 0; j < bursts.length; j++) {
      var b = bursts[j];
      ctx.globalAlpha = Math.max(0, 1 - b.age / 0.9);
      ctx.fillStyle = b.c; ellipse(b.x, b.y, b.r, b.r); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * shake * 10, (Math.random() - .5) * shake * 10);
    drawBackground();
    drawShadows();
    drawEffects();
    var dead = s.status === E.STATUS.GAMEOVER;
    drawPlayer(dead);
    for (var i = 0; i < s.poops.length; i++) {
      var q = s.poops[i];
      drawPoop(q.x, q.y, Math.sin(anim * 5 + q.id) * 0.18 + q.rot * 0.05, 1, 'fall');
    }
    if (dead && s.hitBy) drawPoop(s.hitBy.x, s.hitBy.y, 0.2, 1.1, 'hit');
    if (s.status === E.STATUS.READY) {
      drawPoop(96, 120 + Math.sin(anim * 2) * 6, -0.15, 1.15, 'fall');
      drawPoop(392, 190 + Math.sin(anim * 2 + 1.5) * 6, 0.18, 0.95, 'fall');
    }
    ctx.restore();
  }

  // ---- 루프 (일시정지·정지 화면에서는 멈춘다) --------------------------------
  function effectsActive() { return splats.length > 0 || bursts.length > 0 || shake > 0; }
  function needsLoop() {
    return s.status === E.STATUS.READY || s.status === E.STATUS.PLAYING ||
      (s.status === E.STATUS.GAMEOVER && effectsActive());
  }
  function ensureLoop() {
    if (needsLoop()) { if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); } }
    else { draw(); }
  }

  function tickEffects(dt) {
    var i;
    for (i = splats.length - 1; i >= 0; i--) { splats[i].age += dt; if (splats[i].age > 1.1) splats.splice(i, 1); }
    for (i = bursts.length - 1; i >= 0; i--) {
      var b = bursts[i]; b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 700 * dt;
      if (b.age > 0.9) bursts.splice(i, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 3);
  }

  function frame(now) {
    raf = 0;
    var dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 0;
    lastT = now;
    var wasPlaying = s.status === E.STATUS.PLAYING;

    E.step(s, dt);
    if (s.status === E.STATUS.READY || s.status === E.STATUS.PLAYING) {
      anim += dt;
      stride += Math.abs(s.player.vx) * dt * 0.09;
      if (Math.abs(s.player.vx) > 10) facing = s.player.vx > 0 ? 1 : -1;
    }
    for (var i = 0; i < s.landings.length; i++) splats.push({ x: s.landings[i].x, age: 0 });
    s.landings.length = 0;
    if (wasPlaying && s.status === E.STATUS.GAMEOVER && s.hitBy) {
      shake = 1;
      var cols = [C.poop, C.coral, C.teal, C.cream];
      for (var k = 0; k < 16; k++) {
        var ang = Math.random() * 6.2832, sp = 90 + Math.random() * 190;
        bursts.push({ x: s.hitBy.x, y: s.hitBy.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, r: 2.5 + Math.random() * 3, c: cols[k % 4], age: 0 });
      }
    }
    tickEffects(dt);

    persistBest(false);
    updateHud();
    syncStatus();
    draw();
    if (needsLoop() && !raf) raf = requestAnimationFrame(frame);
  }

  // ---- 시작 ---------------------------------------------------------------
  syncStatus();
  fit();
})();
