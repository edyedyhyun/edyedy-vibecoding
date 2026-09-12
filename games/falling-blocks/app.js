/**
 * app.js — DOM/canvas wiring for 블록 한 줄. Depends on window.BlockEngine
 * (see engine.js). No game logic lives here beyond input timing (DAS/repeat)
 * and rendering; all rules/collision live in the engine.
 */
(function () {
  'use strict';

  var Engine = window.BlockEngine;
  var CELL = 28; // px, internal canvas resolution unit

  var COLORS = {
    1: { fill: '#3E8E8A', hi: '#6FBAB4' }, // I — deep teal
    2: { fill: '#D9764C', hi: '#F0A578' }, // O — coral
    3: { fill: '#9C7BAE', hi: '#C6ACD6' }, // T — plum
    4: { fill: '#7FA06B', hi: '#A8C793' }, // S — sage
    5: { fill: '#C1553F', hi: '#E08669' }, // Z — rust
    6: { fill: '#4C6B8A', hi: '#7C9CBC' }, // J — slate
    7: { fill: '#C99A3E', hi: '#E4BE6E' }  // L — amber
  };

  var boardCanvas = document.getElementById('board');
  var boardCtx = boardCanvas.getContext('2d');
  var nextCanvases = [
    document.getElementById('next0'),
    document.getElementById('next1'),
    document.getElementById('next2')
  ];
  var nextCtxs = nextCanvases.map(function (c) { return c.getContext('2d'); });

  var scoreEl = document.getElementById('score');
  var linesEl = document.getElementById('lines');
  var statusEl = document.getElementById('status');
  var nextNamesEl = document.getElementById('nextNames');

  var startBtn = document.getElementById('btnStart');
  var pauseBtn = document.getElementById('btnPause');
  var resetBtn = document.getElementById('btnReset');
  var touchButtons = document.querySelectorAll('[data-action]');

  var state = Engine.createState(Date.now() >>> 0);
  var lastRender = { score: null, lines: null, status: null, next: null };

  // --- DAS / auto-repeat tracking ------------------------------------
  var das = { left: null, right: null };

  function keyAction(action, isDown, repeatEvent) {
    if (action === 'left' || action === 'right') {
      if (isDown) {
        // Only arm DAS while actually running; otherwise a held arrow
        // pressed while paused/idle would still queue a repeat that fires
        // the instant the game resumes.
        if (das[action] === null && state.status === 'running') {
          Engine.move(state, action);
          das[action] = { since: performance.now(), lastRepeat: null };
        }
      } else {
        das[action] = null;
      }
      return;
    }
    if (isDown && repeatEvent) return; // ignore OS key-repeat for one-shot actions
    switch (action) {
      case 'softDrop':
        Engine.softDrop(state, isDown);
        break;
      case 'hardDrop':
        if (isDown) Engine.hardDrop(state);
        break;
      case 'rotate':
        if (isDown) Engine.rotate(state);
        break;
      case 'pause':
        if (isDown) togglePause();
        break;
      case 'reset':
        if (isDown) doReset();
        break;
      case 'start':
        if (isDown) doStart();
        break;
    }
  }

  var KEY_MAP = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'softDrop',
    ArrowUp: 'rotate',
    KeyX: 'rotate',
    Space: 'hardDrop',
    KeyP: 'pause',
    KeyR: 'reset'
  };

  window.addEventListener('keydown', function (e) {
    var action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault(); // stop page scroll and native button re-activation
    keyAction(action, true, e.repeat);
  });

  window.addEventListener('keyup', function (e) {
    var action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    keyAction(action, false, false);
  });

  // --- Touch / pointer buttons -----------------------------------------
  touchButtons.forEach(function (btn) {
    var action = btn.getAttribute('data-action');
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
      keyAction(action, true, false);
    });
    var release = function (e) {
      e.preventDefault();
      keyAction(action, false, false);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // Keyboard activation (Enter/Space on a focused button) fires a 'click'
    // event without any pointer events, so it needs its own handler to be
    // reachable without a mouse/touch. Real pointer/mouse clicks also fire
    // a trailing 'click' after pointerdown/up already handled the action;
    // those are distinguished by MouseEvent.detail being a nonzero click
    // count, whereas a keyboard-synthesized click reports detail === 0.
    btn.addEventListener('click', function (e) {
      if (e.detail !== 0) return;
      keyAction(action, true, false);
      keyAction(action, false, false);
    });
  });

  startBtn.addEventListener('click', doStart);
  pauseBtn.addEventListener('click', togglePause);
  resetBtn.addEventListener('click', doReset);

  function doStart() {
    Engine.start(state);
  }

  function togglePause() {
    if (state.status === 'running') {
      // Clear DAS on manual pause too, same as the blur/hidden auto-pause,
      // so a held arrow key doesn't resume as a queued repeat move.
      das.left = null;
      das.right = null;
      Engine.pause(state);
    } else if (state.status === 'paused') {
      Engine.resume(state);
    }
  }

  function doReset() {
    das.left = null;
    das.right = null;
    Engine.reset(state, Date.now() >>> 0);
  }

  // --- Pause on blur / hidden, clear held inputs, require explicit resume
  function forcePauseAndClearInputs() {
    das.left = null;
    das.right = null;
    Engine.softDrop(state, false);
    Engine.pause(state);
  }
  window.addEventListener('blur', forcePauseAndClearInputs);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) forcePauseAndClearInputs();
  });

  // --- Rendering ----------------------------------------------------
  function drawCell(ctx, x, y, colorId, ghost) {
    var c = COLORS[colorId];
    var px = x * CELL;
    var py = y * CELL;
    if (ghost) {
      ctx.strokeStyle = 'rgba(31,78,74,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
      return;
    }
    ctx.fillStyle = c.fill;
    ctx.fillRect(px, py, CELL, CELL);
    ctx.strokeStyle = '#2B2620';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 0.75, py + 0.75, CELL - 1.5, CELL - 1.5);
    ctx.fillStyle = c.hi;
    ctx.fillRect(px + 4, py + 4, CELL - 16, CELL - 16);
  }

  function renderBoard() {
    var w = Engine.BOARD_W, h = Engine.BOARD_H;
    boardCtx.fillStyle = '#F4EDE0';
    boardCtx.fillRect(0, 0, w * CELL, h * CELL);

    boardCtx.strokeStyle = 'rgba(43,38,32,0.12)';
    boardCtx.lineWidth = 1;
    for (var gx = 0; gx <= w; gx++) {
      boardCtx.beginPath();
      boardCtx.moveTo(gx * CELL, 0);
      boardCtx.lineTo(gx * CELL, h * CELL);
      boardCtx.stroke();
    }
    for (var gy = 0; gy <= h; gy++) {
      boardCtx.beginPath();
      boardCtx.moveTo(0, gy * CELL);
      boardCtx.lineTo(w * CELL, gy * CELL);
      boardCtx.stroke();
    }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var v = state.board[y][x];
        if (v !== 0) drawCell(boardCtx, x, y, v, false);
      }
    }

    if (state.current) {
      var ghostY = Engine.landingY(state);
      var cells = Engine.shapeCells(state.current.type, state.current.rot);
      var i;
      if (ghostY !== state.current.y) {
        for (i = 0; i < cells.length; i++) {
          var gx2 = state.current.x + cells[i].x;
          var gy2 = ghostY + cells[i].y;
          if (gy2 >= 0) drawCell(boardCtx, gx2, gy2, state.current.type, true);
        }
      }
      var id = Engine.PIECE_IDS[state.current.type];
      for (i = 0; i < cells.length; i++) {
        var cx = state.current.x + cells[i].x;
        var cy = state.current.y + cells[i].y;
        if (cy >= 0) drawCell(boardCtx, cx, cy, id, false);
      }
    }
  }

  function renderNext() {
    var namesChanged = !lastRender.next || state.next.join(',') !== lastRender.next.join(',');
    for (var i = 0; i < 3; i++) {
      var ctx = nextCtxs[i];
      ctx.fillStyle = '#F4EDE0';
      ctx.fillRect(0, 0, 4 * (CELL * 0.6), 4 * (CELL * 0.6));
      var type = state.next[i];
      if (!type) continue;
      var small = CELL * 0.6;
      var cells = Engine.shapeCells(type, 0);
      var id = Engine.PIECE_IDS[type];
      var c = COLORS[id];
      cells.forEach(function (cell) {
        ctx.fillStyle = c.fill;
        ctx.fillRect(cell.x * small, cell.y * small, small, small);
        ctx.strokeStyle = '#2B2620';
        ctx.lineWidth = 1;
        ctx.strokeRect(cell.x * small + 0.5, cell.y * small + 0.5, small - 1, small - 1);
      });
    }
    if (namesChanged) {
      nextNamesEl.textContent = state.next.join(', ');
      lastRender.next = state.next.slice();
    }
  }

  function renderAccessibleInfo() {
    if (state.score !== lastRender.score) {
      scoreEl.textContent = String(state.score);
      lastRender.score = state.score;
    }
    if (state.lines !== lastRender.lines) {
      linesEl.textContent = String(state.lines);
      lastRender.lines = state.lines;
    }
    if (state.status !== lastRender.status) {
      var labels = {
        idle: '대기 중 — 시작을 눌러주세요',
        running: '진행 중',
        paused: '일시 정지',
        gameover: '게임 종료'
      };
      statusEl.textContent = labels[state.status] || state.status;
      lastRender.status = state.status;
      pauseBtn.disabled = state.status !== 'running' && state.status !== 'paused';
      // Start is only a valid action from idle; running/paused/gameover are
      // all no-ops for it (gameover requires Reset instead).
      startBtn.disabled = state.status !== 'idle';
    }
  }

  // --- Main loop ------------------------------------------------------
  var lastTs = null;
  function loop(ts) {
    if (lastTs !== null) {
      var dt = (ts - lastTs) / 1000;
      if (state.status === 'running') {
        applyDas(ts);
        Engine.step(state, dt);
      }
    }
    lastTs = ts;
    renderBoard();
    renderNext();
    renderAccessibleInfo();
    requestAnimationFrame(loop);
  }

  function applyDas(ts) {
    ['left', 'right'].forEach(function (dir) {
      var d = das[dir];
      if (!d) return;
      var elapsed = ts - d.since;
      if (elapsed < Engine.DAS_MS) return;
      if (d.lastRepeat === null || ts - d.lastRepeat >= Engine.REPEAT_MS) {
        Engine.move(state, dir);
        d.lastRepeat = ts;
      }
    });
  }

  renderAccessibleInfo();
  requestAnimationFrame(loop);
}());
