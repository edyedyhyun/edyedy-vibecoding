// app.js — 다음 한 수 UI 로직 (engine.js에 의존, 외부 라이브러리 없음)

(function () {
  'use strict';

  var Engine = (typeof window !== 'undefined' && window.ChessEngine) ||
    (typeof require === 'function' ? require('./engine.js') : null);

  var FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  var PIECE_GLYPH = {
    K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟'
  };
  var PIECE_NAME_KO = {
    K: '킹', Q: '퀸', R: '룩', B: '비숍', N: '나이트', P: '폰'
  };
  var PROMO_ORDER = ['Q', 'R', 'B', 'N'];

  var state = Engine.createState();
  var selected = null; // 'e2' 형식의 선택된 칸
  var legalTargets = []; // 선택된 기물의 합법수 목록 (engine move 객체)
  var pendingPromotion = null; // {from, to}
  var orientation = 'white'; // 'white' | 'black' — 보드 시점
  var focus = { dr: 0, dc: 0 }; // 화면 표시 좌표 기준 포커스

  var boardEl = document.getElementById('board');
  var colLabelsEl = document.getElementById('col-labels');
  var rowLabelsEl = document.getElementById('row-labels');
  var turnSwatchEl = document.getElementById('turn-swatch');
  var turnTextEl = document.getElementById('turn-text');
  var noticeEl = document.getElementById('notice');
  var undoBtn = document.getElementById('undo-btn');
  var flipBtn = document.getElementById('flip-btn');
  var claimFiftyBtn = document.getElementById('claim-fifty-btn');
  var claimThreefoldBtn = document.getElementById('claim-threefold-btn');
  var newGameBtn = document.getElementById('new-game-btn');
  var moveLogEl = document.getElementById('move-log');
  var dialogOverlay = document.getElementById('dialog-overlay');
  var dialogCancel = document.getElementById('dialog-cancel');
  var dialogConfirm = document.getElementById('dialog-confirm');
  var promoOverlay = document.getElementById('promo-overlay');
  var promoButtonsEl = document.getElementById('promo-buttons');
  var liveRegion = document.getElementById('live-region');

  var cellEls = []; // cellEls[dr][dc] -> button

  function sq(row, col) { return FILES[col] + String(row + 1); }

  function displayToAbsolute(dr, dc) {
    if (orientation === 'white') {
      return { row: 7 - dr, col: dc };
    }
    return { row: dr, col: 7 - dc };
  }

  function absoluteToDisplay(row, col) {
    if (orientation === 'white') {
      return { dr: 7 - row, dc: col };
    }
    return { dr: row, dc: 7 - col };
  }

  function buildLabels() {
    colLabelsEl.innerHTML = '';
    rowLabelsEl.innerHTML = '';
    for (var dc = 0; dc < 8; dc++) {
      var abs = displayToAbsolute(0, dc);
      var span = document.createElement('span');
      span.textContent = FILES[abs.col].toUpperCase();
      colLabelsEl.appendChild(span);
    }
    for (var dr = 0; dr < 8; dr++) {
      var absR = displayToAbsolute(dr, 0);
      var rspan = document.createElement('span');
      rspan.textContent = String(absR.row + 1);
      rowLabelsEl.appendChild(rspan);
    }
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    cellEls = [];
    for (var dr = 0; dr < 8; dr++) {
      var rowArr = [];
      for (var dc = 0; dc < 8; dc++) {
        var abs = displayToAbsolute(dr, dc);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell ' + ((abs.row + abs.col) % 2 === 0 ? 'dark' : 'light');
        btn.setAttribute('role', 'gridcell');
        btn.dataset.dr = dr;
        btn.dataset.dc = dc;
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
    for (var dr = 0; dr < 8; dr++) {
      for (var dc = 0; dc < 8; dc++) {
        cellEls[dr][dc].tabIndex = (dr === focus.dr && dc === focus.dc) ? 0 : -1;
      }
    }
  }

  function onCellFocus(e) {
    focus = { dr: Number(e.currentTarget.dataset.dr), dc: Number(e.currentTarget.dataset.dc) };
    updateTabIndex();
  }

  function onCellClick(e) {
    var dr = Number(e.currentTarget.dataset.dr), dc = Number(e.currentTarget.dataset.dc);
    var abs = displayToAbsolute(dr, dc);
    handleSquareActivate(abs.row, abs.col);
  }

  function onCellKeydown(e) {
    var dr = Number(e.currentTarget.dataset.dr), dc = Number(e.currentTarget.dataset.dc);
    switch (e.key) {
      case 'ArrowUp':
        dr = Math.max(0, dr - 1);
        break;
      case 'ArrowDown':
        dr = Math.min(7, dr + 1);
        break;
      case 'ArrowLeft':
        dc = Math.max(0, dc - 1);
        break;
      case 'ArrowRight':
        dc = Math.min(7, dc + 1);
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar': {
        e.preventDefault();
        var abs = displayToAbsolute(dr, dc);
        handleSquareActivate(abs.row, abs.col);
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    focus = { dr: dr, dc: dc };
    updateTabIndex();
    cellEls[dr][dc].focus();
  }

  function handleSquareActivate(row, col) {
    if (pendingPromotion) return;
    if (state.status !== 'playing') return;

    var squareStr = sq(row, col);
    var piece = state.board[row][col];

    if (!selected) {
      if (piece && piece[0] === state.turn) {
        selectSquare(squareStr);
      }
      return;
    }

    if (selected === squareStr) {
      clearSelection();
      render();
      return;
    }

    if (piece && piece[0] === state.turn) {
      selectSquare(squareStr);
      return;
    }

    var match = legalTargets.filter(function (m) { return m.to === squareStr; });
    if (match.length === 0) {
      return;
    }

    var requiresPromotion = match.some(function (m) { return !!m.promotion; });
    if (requiresPromotion) {
      pendingPromotion = { from: selected, to: squareStr, color: state.turn };
      openPromoDialog();
      return;
    }

    var mover = state.turn;
    var ok = Engine.play(state, selected, squareStr);
    if (ok) {
      focus = absoluteToDisplay(row, col);
      announceMove(mover, selected, squareStr, null);
      clearSelection();
      render();
    }
  }

  function selectSquare(squareStr) {
    selected = squareStr;
    legalTargets = Engine.legalMoves(state, squareStr);
    render();
  }

  function clearSelection() {
    selected = null;
    legalTargets = [];
  }

  function coordAria(row, col) {
    return sq(row, col);
  }

  function announceMove(mover, from, to, promotion) {
    var label = mover === 'w' ? '백' : '흑';
    var msg = label + '이(가) ' + from + '에서 ' + to + '으로 이동했습니다.';
    if (promotion) msg += ' ' + PIECE_NAME_KO[promotion] + '(으)로 승진.';
    liveRegion.textContent = msg;
  }

  // ---------- 프로모션 모달 ----------

  function openPromoDialog() {
    promoButtonsEl.innerHTML = '';
    var color = pendingPromotion.color;
    PROMO_ORDER.forEach(function (type) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'promo-btn';
      var glyphSpan = document.createElement('span');
      glyphSpan.className = 'piece-glyph ' + (color === 'w' ? 'white' : 'black');
      glyphSpan.textContent = PIECE_GLYPH[type];
      var labelSpan = document.createElement('span');
      labelSpan.className = 'label';
      labelSpan.textContent = PIECE_NAME_KO[type];
      btn.appendChild(glyphSpan);
      btn.appendChild(labelSpan);
      btn.addEventListener('click', function () { resolvePromotion(type); });
      promoButtonsEl.appendChild(btn);
    });
    promoOverlay.hidden = false;
    promoButtonsEl.querySelector('.promo-btn').focus();
  }

  function resolvePromotion(type) {
    var mover = state.turn;
    var from = pendingPromotion.from, to = pendingPromotion.to;
    var ok = Engine.play(state, from, to, type);
    promoOverlay.hidden = true;
    pendingPromotion = null;
    if (ok) {
      announceMove(mover, from, to, type);
      clearSelection();
      render();
    }
  }

  promoOverlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      // 프로모션은 필수 선택 사항이므로 임의 취소 시 마지막 선택을 취소만 한다.
      promoOverlay.hidden = true;
      pendingPromotion = null;
      clearSelection();
      render();
    }
  });

  // ---------- 렌더링 ----------

  function render() {
    var info = Engine.status(state);
    var kingSquare = null;
    if (info.inCheck) {
      kingSquare = Engine.findKing(state.board, state.turn);
    }

    var legalSet = {};
    legalTargets.forEach(function (m) { legalSet[m.to] = legalSet[m.to] || []; legalSet[m.to].push(m); });

    for (var dr = 0; dr < 8; dr++) {
      for (var dc = 0; dc < 8; dc++) {
        var abs = displayToAbsolute(dr, dc);
        var row = abs.row, col = abs.col;
        var cell = cellEls[dr][dc];
        var squareStr = sq(row, col);
        var piece = state.board[row][col];

        cell.innerHTML = '';
        cell.classList.remove('selected', 'last-move', 'check-square');

        var labelParts = [squareStr];

        if (piece) {
          var colorClass = piece[0] === 'w' ? 'white' : 'black';
          var typeChar = piece[1];
          var glyph = document.createElement('span');
          glyph.className = 'piece-glyph ' + colorClass;
          glyph.textContent = PIECE_GLYPH[typeChar];
          cell.appendChild(glyph);
          labelParts.push((piece[0] === 'w' ? '흰' : '검은') + ' ' + PIECE_NAME_KO[typeChar]);
        }

        if (legalSet[squareStr]) {
          if (piece) {
            var ring = document.createElement('span');
            ring.className = 'capture-ring';
            cell.appendChild(ring);
            labelParts.push('잡기 가능');
          } else {
            var dot = document.createElement('span');
            dot.className = 'move-dot';
            cell.appendChild(dot);
            labelParts.push('이동 가능');
          }
        }

        if (selected === squareStr) {
          cell.classList.add('selected');
          labelParts.push('선택됨');
        }

        if (state.lastMove && (state.lastMove.from === squareStr || state.lastMove.to === squareStr)) {
          cell.classList.add('last-move');
        }

        if (kingSquare === squareStr) {
          cell.classList.add('check-square');
          labelParts.push('체크');
        }

        cell.setAttribute('aria-label', labelParts.join(', '));
      }
    }

    updateTabIndex();

    // 차례/상태 표시
    if (info.status === 'checkmate') {
      turnSwatchEl.style.display = 'none';
      var winnerLabel = info.winner === 'w' ? '백' : '흑';
      turnTextEl.textContent = '체크메이트 — ' + winnerLabel + ' 승리';
    } else if (info.status === 'stalemate') {
      turnSwatchEl.style.display = 'none';
      turnTextEl.textContent = '스테일메이트 — 무승부';
    } else if (info.status === 'draw') {
      turnSwatchEl.style.display = 'none';
      turnTextEl.textContent = '무승부 (' + drawReasonKo(info.reason) + ')';
    } else {
      turnSwatchEl.style.display = '';
      turnSwatchEl.className = 'turn-swatch ' + info.turn;
      turnTextEl.textContent = (info.turn === 'w' ? '백' : '흑') + ' 차례' + (info.inCheck ? ' — 체크' : '');
    }

    noticeEl.classList.toggle('result', info.status !== 'playing');
    if (info.status === 'checkmate') {
      noticeEl.textContent = (info.winner === 'w' ? '백' : '흑') + '이(가) 체크메이트로 승리했습니다.';
    } else if (info.status === 'stalemate') {
      noticeEl.textContent = '둘 곳이 없어 스테일메이트로 무승부입니다.';
    } else if (info.status === 'draw') {
      noticeEl.textContent = drawReasonKo(info.reason) + '(으)로 무승부입니다.';
    } else {
      noticeEl.textContent = '';
    }

    undoBtn.disabled = state.history.length === 0 || !!pendingPromotion;

    claimFiftyBtn.hidden = !info.canClaimFifty;
    claimThreefoldBtn.hidden = !info.canClaimThreefold;

    renderMoveLog();
  }

  function drawReasonKo(reason) {
    switch (reason) {
      case 'insufficient': return '기물 부족';
      case '75move': return '75수 규칙';
      case 'fivefold': return '5회 동형 반복';
      case 'fifty-claimed': return '50수 규칙 선언';
      case 'threefold-claimed': return '3회 동형 반복 선언';
      default: return '무승부';
    }
  }

  function renderMoveLog() {
    moveLogEl.innerHTML = '';
    var log = state.moveLog;
    for (var i = 0; i < log.length; i += 2) {
      var li = document.createElement('li');
      var num = document.createElement('span');
      num.className = 'move-log-num';
      num.textContent = (i / 2 + 1) + '.';
      li.appendChild(num);
      var whiteSpan = document.createElement('span');
      whiteSpan.textContent = log[i].notation;
      li.appendChild(whiteSpan);
      if (log[i + 1]) {
        var blackSpan = document.createElement('span');
        blackSpan.textContent = log[i + 1].notation;
        li.appendChild(blackSpan);
      }
      moveLogEl.appendChild(li);
    }
    moveLogEl.scrollTop = moveLogEl.scrollHeight;
  }

  // ---------- 컨트롤 ----------

  function requestNewGame() {
    if (state.moveLog.length === 0) {
      startNewGame();
      return;
    }
    openDialog();
  }

  function startNewGame() {
    state = Engine.createState();
    clearSelection();
    pendingPromotion = null;
    promoOverlay.hidden = true;
    focus = { dr: 0, dc: 0 };
    render();
  }

  function openDialog() {
    dialogOverlay.hidden = false;
    dialogCancel.focus();
  }

  function closeDialog() {
    dialogOverlay.hidden = true;
  }

  dialogCancel.addEventListener('click', closeDialog);
  dialogConfirm.addEventListener('click', function () {
    startNewGame();
    closeDialog();
  });
  dialogOverlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDialog();
  });

  undoBtn.addEventListener('click', function () {
    if (pendingPromotion) return;
    if (Engine.undo(state)) {
      clearSelection();
      render();
    }
  });

  flipBtn.addEventListener('click', function () {
    orientation = orientation === 'white' ? 'black' : 'white';
    clearSelection();
    buildLabels();
    buildBoard();
    render();
  });

  claimFiftyBtn.addEventListener('click', function () {
    if (Engine.claimDraw(state, 'fifty')) {
      clearSelection();
      render();
    }
  });

  claimThreefoldBtn.addEventListener('click', function () {
    if (Engine.claimDraw(state, 'threefold')) {
      clearSelection();
      render();
    }
  });

  newGameBtn.addEventListener('click', requestNewGame);

  buildLabels();
  buildBoard();
  render();
})();
