(function () {
  'use strict';

  var Engine = (typeof module === 'object' && module.exports)
    ? require('./engine.js')
    : window.GomokuEngine;

  var SIZE = Engine.BOARD_SIZE;
  var COL_LETTERS = 'ABCDEFGHIJKLMNO'.split('');

  var state = Engine.createState();
  var focusedRow = 0;
  var focusedCol = 0;

  var boardEl = document.getElementById('board');
  var colLabelsEl = document.getElementById('colLabels');
  var rowLabelsEl = document.getElementById('rowLabels');
  var turnBadgeEl = document.getElementById('turnBadge');
  var statusLineEl = document.getElementById('statusLine');
  var moveCountEl = document.getElementById('moveCount');
  var lastCoordEl = document.getElementById('lastCoord');
  var historyEl = document.getElementById('history');
  var undoBtn = document.getElementById('undoBtn');
  var newGameBtn = document.getElementById('newGameBtn');

  var cellButtons = [];

  function coordLabel(row, col) {
    return COL_LETTERS[col] + (row + 1);
  }

  function buildLabels() {
    for (var c = 0; c < SIZE; c++) {
      var colEl = document.createElement('span');
      colEl.textContent = COL_LETTERS[c];
      colLabelsEl.appendChild(colEl);
    }
    for (var r = 0; r < SIZE; r++) {
      var rowEl = document.createElement('span');
      rowEl.textContent = String(r + 1);
      rowLabelsEl.appendChild(rowEl);
    }
  }

  function buildBoard() {
    for (var r = 0; r < SIZE; r++) {
      var rowGroup = document.createElement('div');
      rowGroup.setAttribute('role', 'row');
      rowGroup.style.display = 'contents';
      cellButtons.push([]);

      for (var c = 0; c < SIZE; c++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell';
        btn.setAttribute('role', 'gridcell');
        btn.dataset.row = String(r);
        btn.dataset.col = String(c);
        if (r === 0) btn.classList.add('edge-top');
        if (r === SIZE - 1) btn.classList.add('edge-bottom');
        if (c === 0) btn.classList.add('edge-left');
        if (c === SIZE - 1) btn.classList.add('edge-right');
        btn.tabIndex = (r === 0 && c === 0) ? 0 : -1;

        var preview = document.createElement('span');
        preview.className = 'stone-preview';
        btn.appendChild(preview);

        btn.addEventListener('click', handleCellActivate);
        btn.addEventListener('keydown', handleCellKeydown);
        btn.addEventListener('focus', handleCellFocus);
        btn.addEventListener('mouseenter', handleCellHoverEnter);
        btn.addEventListener('mouseleave', handleCellHoverLeave);

        rowGroup.appendChild(btn);
        cellButtons[r].push(btn);
      }
      boardEl.appendChild(rowGroup);
    }
  }

  function handleCellHoverEnter(event) {
    var btn = event.currentTarget;
    var r = Number(btn.dataset.row);
    var c = Number(btn.dataset.col);
    if (state.status !== 'playing' || state.board[r][c] !== 0) return;
    var preview = btn.querySelector('.stone-preview');
    preview.classList.remove('black', 'white');
    preview.classList.add(state.turn === 1 ? 'black' : 'white');
  }

  function handleCellHoverLeave(event) {
    var preview = event.currentTarget.querySelector('.stone-preview');
    preview.classList.remove('black', 'white');
  }

  function handleCellFocus(event) {
    var btn = event.currentTarget;
    var row = Number(btn.dataset.row);
    var col = Number(btn.dataset.col);
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        cellButtons[r][c].tabIndex = (r === row && c === col) ? 0 : -1;
      }
    }
    focusedRow = row;
    focusedCol = col;
  }

  function setRovingFocus(row, col) {
    var prev = cellButtons[focusedRow][focusedCol];
    if (prev) prev.tabIndex = -1;
    focusedRow = row;
    focusedCol = col;
    var next = cellButtons[row][col];
    next.tabIndex = 0;
    next.focus();
  }

  function handleCellKeydown(event) {
    var row = Number(event.currentTarget.dataset.row);
    var col = Number(event.currentTarget.dataset.col);
    var handled = true;

    switch (event.key) {
      case 'ArrowUp':
        if (row > 0) setRovingFocus(row - 1, col);
        break;
      case 'ArrowDown':
        if (row < SIZE - 1) setRovingFocus(row + 1, col);
        break;
      case 'ArrowLeft':
        if (col > 0) setRovingFocus(row, col - 1);
        break;
      case 'ArrowRight':
        if (col < SIZE - 1) setRovingFocus(row, col + 1);
        break;
      case 'Home':
        setRovingFocus(row, 0);
        break;
      case 'End':
        setRovingFocus(row, SIZE - 1);
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        attemptPlace(row, col);
        break;
      default:
        handled = false;
    }

    if (handled) event.preventDefault();
  }

  function handleCellActivate(event) {
    var row = Number(event.currentTarget.dataset.row);
    var col = Number(event.currentTarget.dataset.col);
    setRovingFocus(row, col);
    attemptPlace(row, col);
  }

  function attemptPlace(row, col) {
    var placed = Engine.place(state, row, col);
    if (placed) render();
  }

  function updateAriaLabel(btn, row, col) {
    var value = state.board[row][col];
    var occ = value === 1 ? '흑돌' : value === 2 ? '백돌' : '빈칸';
    btn.setAttribute('aria-label', coordLabel(row, col) + ' ' + occ);
  }

  function render() {
    var isLast = state.moves.length > 0 ? state.moves[state.moves.length - 1] : null;
    var winSet = {};
    state.winningCells.forEach(function (cell) {
      winSet[cell.row + ',' + cell.col] = true;
    });

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var btn = cellButtons[r][c];
        var value = state.board[r][c];

        var existingStone = btn.querySelector('.stone');
        if (existingStone) existingStone.remove();

        var preview = btn.querySelector('.stone-preview');
        if (preview) preview.classList.remove('black', 'white');

        if (value !== 0) {
          var stone = document.createElement('span');
          stone.className = 'stone ' + (value === 1 ? 'black' : 'white');
          btn.appendChild(stone);
        }

        btn.classList.toggle('last-move', !!(isLast && isLast.row === r && isLast.col === c));
        btn.classList.toggle('win-cell', !!winSet[r + ',' + c]);

        updateAriaLabel(btn, r, c);
      }
    }

    if (state.status === 'playing') {
      turnBadgeEl.textContent = state.turn === 1 ? '흑돌 차례' : '백돌 차례';
    } else {
      turnBadgeEl.textContent = '대국 종료';
    }
    turnBadgeEl.classList.toggle('white-turn', state.status === 'playing' && state.turn === 2);

    statusLineEl.classList.remove('won', 'draw');
    if (state.status === 'won') {
      var winnerName = state.winner === 1 ? '흑돌' : '백돌';
      statusLineEl.textContent = winnerName + ' 승리!';
      statusLineEl.classList.add('won');
    } else if (state.status === 'draw') {
      statusLineEl.textContent = '무승부 (보드가 가득 찼습니다)';
      statusLineEl.classList.add('draw');
    } else {
      statusLineEl.textContent = '진행중';
    }

    moveCountEl.textContent = String(state.moves.length);

    if (state.moves.length > 0) {
      var last = state.moves[state.moves.length - 1];
      lastCoordEl.textContent = coordLabel(last.row, last.col);
    } else {
      lastCoordEl.textContent = '-';
    }

    renderHistory();

    undoBtn.disabled = state.moves.length === 0;
  }

  function renderHistory() {
    historyEl.innerHTML = '';
    var moves = state.moves;
    var start = Math.max(0, moves.length - 6);
    historyEl.setAttribute('start', String(start + 1));
    for (var i = start; i < moves.length; i++) {
      var move = moves[i];
      var li = document.createElement('li');
      var playerName = move.player === 1 ? '흑' : '백';
      li.textContent = playerName + ' ' + coordLabel(move.row, move.col);
      historyEl.appendChild(li);
    }
  }

  undoBtn.addEventListener('click', function () {
    var undone = Engine.undo(state);
    if (undone) render();
  });

  newGameBtn.addEventListener('click', function () {
    if (state.moves.length > 0) {
      var confirmed = window.confirm('진행 중인 대국을 종료하고 새 게임을 시작할까요?');
      if (!confirmed) return;
    }
    Engine.reset(state);
    setRovingFocus(0, 0);
    render();
  });

  buildLabels();
  buildBoard();
  render();
})();
