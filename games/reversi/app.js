// app.js — 뒤집는 한 수 UI 로직 (engine.js에 의존, 외부 라이브러리 없음)

(function () {
  'use strict';

  var Engine = (typeof window !== 'undefined' && window.ReversiEngine) ||
    (typeof require === 'function' ? require('./engine.js') : null);

  var SIZE = Engine.SIZE;
  var BLACK = Engine.BLACK;
  var WHITE = Engine.WHITE;

  var state = Engine.createState();
  var showHints = true;
  var focusPos = { row: 0, col: 0 };

  var boardEl = document.getElementById('board');
  var colLabelsEl = document.getElementById('col-labels');
  var rowLabelsEl = document.getElementById('row-labels');
  var turnSwatchEl = document.getElementById('turn-swatch');
  var turnTextEl = document.getElementById('turn-text');
  var countBlackEl = document.getElementById('count-black');
  var countWhiteEl = document.getElementById('count-white');
  var countEmptyEl = document.getElementById('count-empty');
  var moveNumberEl = document.getElementById('move-number');
  var noticeEl = document.getElementById('notice');
  var hintToggleEl = document.getElementById('hint-toggle');
  var undoBtn = document.getElementById('undo-btn');
  var newGameBtn = document.getElementById('new-game-btn');
  var dialogOverlay = document.getElementById('dialog-overlay');
  var dialogCancel = document.getElementById('dialog-cancel');
  var dialogConfirm = document.getElementById('dialog-confirm');
  var liveRegion = document.getElementById('live-region');

  var COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  var cellEls = []; // [row][col] -> button element

  function buildLabels() {
    for (var c = 0; c < SIZE; c++) {
      var span = document.createElement('span');
      span.textContent = COL_LABELS[c];
      colLabelsEl.appendChild(span);
    }
    for (var r = 0; r < SIZE; r++) {
      var rspan = document.createElement('span');
      rspan.textContent = String(r + 1);
      rowLabelsEl.appendChild(rspan);
    }
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    cellEls = [];
    for (var r = 0; r < SIZE; r++) {
      var rowArr = [];
      for (var c = 0; c < SIZE; c++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell';
        btn.setAttribute('role', 'gridcell');
        btn.dataset.row = r;
        btn.dataset.col = c;
        btn.tabIndex = -1;
        btn.addEventListener('click', onCellClick);
        btn.addEventListener('keydown', onCellKeydown);
        btn.addEventListener('focus', onCellFocus);
        boardEl.appendChild(btn);
        rowArr.push(btn);
      }
      cellEls.push(rowArr);
    }
    updateTabIndex();
  }

  function updateTabIndex() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        cellEls[r][c].tabIndex = (r === focusPos.row && c === focusPos.col) ? 0 : -1;
      }
    }
  }

  function onCellFocus(e) {
    var r = Number(e.currentTarget.dataset.row);
    var c = Number(e.currentTarget.dataset.col);
    focusPos = { row: r, col: c };
    updateTabIndex();
  }

  function coordLabel(row, col) {
    return COL_LABELS[col] + String(row + 1);
  }

  function onCellClick(e) {
    var r = Number(e.currentTarget.dataset.row);
    var c = Number(e.currentTarget.dataset.col);
    attemptMove(r, c);
  }

  function attemptMove(r, c) {
    if (state.status !== 'playing') {
      return;
    }
    var mover = state.turn;
    var ok = Engine.play(state, r, c);
    if (ok) {
      focusPos = { row: r, col: c };
      announceMove(mover, r, c);
      render();
    }
  }

  function announceMove(mover, r, c) {
    var label = mover === BLACK ? '흑' : '백';
    var msg = label + '이(가) ' + coordLabel(r, c) + '에 착수했습니다.';
    liveRegion.textContent = msg;
  }

  function onCellKeydown(e) {
    var r = Number(e.currentTarget.dataset.row);
    var c = Number(e.currentTarget.dataset.col);
    var handled = true;

    switch (e.key) {
      case 'ArrowUp':
        r = Math.max(0, r - 1);
        break;
      case 'ArrowDown':
        r = Math.min(SIZE - 1, r + 1);
        break;
      case 'ArrowLeft':
        c = Math.max(0, c - 1);
        break;
      case 'ArrowRight':
        c = Math.min(SIZE - 1, c + 1);
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        attemptMove(r, c);
        handled = true;
        e.preventDefault();
        return;
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      focusPos = { row: r, col: c };
      updateTabIndex();
      cellEls[r][c].focus();
    }
  }

  function render() {
    var counts = Engine.counts(state.board);
    var legal = state.status === 'playing' ? Engine.legalMoves(state.board, state.turn) : [];
    var legalSet = {};
    legal.forEach(function (m) { legalSet[m.row + ',' + m.col] = true; });

    var lastFlipSet = {};
    state.lastFlips.forEach(function (f) { lastFlipSet[f.row + ',' + f.col] = true; });

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = cellEls[r][c];
        var val = state.board[r][c];
        var key = r + ',' + c;
        cell.innerHTML = '';
        cell.classList.remove('last-move');

        var label = coordLabel(r, c) + ', ';

        if (val === BLACK || val === WHITE) {
          var disk = document.createElement('span');
          disk.className = 'disk ' + (val === BLACK ? 'black' : 'white');
          if (lastFlipSet[key]) {
            disk.classList.add('flipped');
          }
          cell.appendChild(disk);
          label += (val === BLACK ? '흑돌' : '백돌');
        } else if (showHints && legalSet[key]) {
          var dot = document.createElement('span');
          dot.className = 'hint-dot';
          cell.appendChild(dot);
          label += '착수 가능';
        } else {
          label += '빈칸';
        }

        cell.setAttribute('aria-label', label);

        if (state.lastMove && state.lastMove.row === r && state.lastMove.col === c) {
          cell.classList.add('last-move');
        }
      }
    }

    updateTabIndex();

    countBlackEl.textContent = counts.black;
    countWhiteEl.textContent = counts.white;
    countEmptyEl.textContent = counts.empty;
    moveNumberEl.textContent = state.moveNumber;
    noticeEl.textContent = state.notice || '';

    if (state.status === 'over') {
      turnTextEl.textContent = '게임 종료';
      turnSwatchEl.style.display = 'none';
    } else {
      turnSwatchEl.style.display = '';
      turnSwatchEl.className = 'turn-swatch ' + (state.turn === BLACK ? 'black' : 'white');
      turnTextEl.textContent = (state.turn === BLACK ? '흑' : '백') + ' 차례';
    }

    undoBtn.disabled = state.history.length === 0;
  }

  function requestNewGame() {
    if (state.history.length === 0 && state.moveNumber === 0) {
      Engine.reset(state);
      focusPos = { row: 0, col: 0 };
      render();
      return;
    }
    openDialog();
  }

  function openDialog() {
    dialogOverlay.hidden = false;
    dialogCancel.focus();
  }

  function closeDialog() {
    dialogOverlay.hidden = true;
  }

  dialogCancel.addEventListener('click', function () {
    closeDialog();
  });

  dialogConfirm.addEventListener('click', function () {
    Engine.reset(state);
    focusPos = { row: 0, col: 0 };
    closeDialog();
    render();
  });

  dialogOverlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeDialog();
    }
  });

  undoBtn.addEventListener('click', function () {
    if (Engine.undo(state)) {
      render();
    }
  });

  newGameBtn.addEventListener('click', requestNewGame);

  hintToggleEl.addEventListener('change', function () {
    showHints = hintToggleEl.checked;
    render();
  });

  buildLabels();
  buildBoard();
  render();
})();
