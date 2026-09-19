(function () {
  'use strict';
  var E = window.JanggiEngine;
  var X0 = 40, Y0 = 45, DX = 50, DY = 50, W = 480, H = 540;
  var NS = 'http://www.w3.org/2000/svg';

  function $(id) { return document.getElementById(id); }

  var state = E.createState();
  var sel = null;          // {r,c}
  var cursor = { r: 9, c: 4 };
  var note = '';
  var cells = [];
  var confirmFn = null;

  // ---- 판 그리기 ----
  function px(c) { return X0 + DX * c; }
  function py(r) { return Y0 + DY * r; }

  function buildBoard() {
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ecc888"/><stop offset=".5" stop-color="#e2b672"/><stop offset="1" stop-color="#d9a860"/></linearGradient></defs>' +
      '<rect x="2" y="2" width="' + (W - 4) + '" height="' + (H - 4) + '" rx="12" fill="url(#wood)" stroke="#8a5a2b" stroke-width="3"/>';
    for (var g = 0; g < 14; g++) {
      var gy = 20 + g * 38;
      s += '<path d="M14 ' + gy + ' Q ' + (W / 2) + ' ' + (gy + (g % 2 ? 6 : -6)) + ' ' + (W - 14) + ' ' + gy +
        '" stroke="#b98443" stroke-opacity=".18" fill="none" stroke-width="1.5"/>';
    }
    s += '<g stroke="#4a2f14" stroke-width="1.8" stroke-linecap="round" fill="none">';
    var i;
    for (i = 0; i < 10; i++) s += '<line x1="' + px(0) + '" y1="' + py(i) + '" x2="' + px(8) + '" y2="' + py(i) + '"/>';
    for (i = 0; i < 9; i++) s += '<line x1="' + px(i) + '" y1="' + py(0) + '" x2="' + px(i) + '" y2="' + py(9) + '"/>';
    [0, 7].forEach(function (b) {
      s += '<line x1="' + px(3) + '" y1="' + py(b) + '" x2="' + px(5) + '" y2="' + py(b + 2) + '"/>';
      s += '<line x1="' + px(5) + '" y1="' + py(b) + '" x2="' + px(3) + '" y2="' + py(b + 2) + '"/>';
    });
    s += '</g><g font-size="15" font-weight="700" fill="#6b4520" text-anchor="middle" font-family="sans-serif">';
    for (i = 0; i < 9; i++) s += '<text x="' + px(i) + '" y="' + (H - 14) + '">' + String.fromCharCode(65 + i) + '</text>';
    for (i = 0; i < 10; i++) s += '<text x="17" y="' + (py(i) + 5) + '">' + (10 - i) + '</text>';
    s += '</g></svg>';

    var board = $('board');
    board.innerHTML = s;
    for (var r = 0; r < 10; r++) {
      cells.push([]);
      for (var c = 0; c < 9; c++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pt';
        b.style.left = (px(c) / W * 100) + '%';
        b.style.top = (py(r) / H * 100) + '%';
        b.dataset.r = r; b.dataset.c = c;
        board.appendChild(b);
        cells[r].push(b);
      }
    }
    board.addEventListener('click', function (e) {
      var b = e.target.closest('.pt');
      if (b) onCell(+b.dataset.r, +b.dataset.c);
    });
    board.addEventListener('keydown', function (e) {
      var b = e.target.closest('.pt');
      if (!b) return;
      var d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      var r = Math.max(0, Math.min(9, +b.dataset.r + d[0]));
      var c = Math.max(0, Math.min(8, +b.dataset.c + d[1]));
      cursor = { r: r, c: c };
      render();
      cells[r][c].focus();
    });
  }

  // ---- 상호작용 ----
  function onCell(r, c) {
    cursor = { r: r, c: c };
    note = '';
    closeConfirm();
    var p = state.board[r][c];
    if (state.result) { note = '대국이 끝났습니다. 새 게임을 시작하거나 무르기를 쓰세요.'; sel = null; return render(); }
    if (sel && legalDest(r, c)) {
      E.move(state, sel.r, sel.c, r, c);
      sel = null;
      return render();
    }
    if (sel && sel.r === r && sel.c === c) { sel = null; return render(); }
    if (p && p.side === state.turn) { sel = { r: r, c: c }; return render(); }
    sel = null;
    if (p) note = '지금은 ' + E.SIDE_NAME[state.turn] + ' 차례입니다. 상대 기물은 잡을 수 있는 칸에서만 누르세요.';
    render();
  }

  function legalList() { return sel ? E.legalMoves(state, sel.r, sel.c) : []; }
  function legalDest(r, c) { return legalList().some(function (m) { return m.r === r && m.c === c; }); }

  function askConfirm(text, fn) {
    confirmFn = fn;
    $('confirm-text').textContent = text;
    $('confirm').hidden = false;
    $('confirm-yes').focus();
  }
  function closeConfirm() { confirmFn = null; $('confirm').hidden = true; }

  function passReason() {
    if (state.result) return '대국이 끝났습니다.';
    if (E.isCheck(state, state.turn)) return '장군 상태에서는 쉴 수 없습니다.';
    if (E.kingsFace(state)) return '빅장 상태에서는 쉴 수 없습니다. 마주 봄을 풀거나 빅장 수락을 하세요.';
    return '';
  }

  function bind() {
    $('btn-undo').onclick = function () { closeConfirm(); E.undo(state); sel = null; note = '한 수 물렀습니다.'; render(); };
    $('btn-pass').onclick = function () {
      closeConfirm();
      note = E.pass(state) ? '' : passReason();
      sel = null; render();
    };
    $('btn-bikjang').onclick = function () { closeConfirm(); E.bikjangDraw(state); sel = null; note = ''; render(); };
    $('btn-draw').onclick = function () {
      askConfirm('두 사람이 합의했다면 무승부로 끝낼까요?', function () { E.agreeDraw(state); sel = null; render(); });
    };
    $('btn-resign').onclick = function () {
      askConfirm(E.SIDE_NAME[state.turn] + '이(가) 기권하고 상대의 승리로 끝낼까요?', function () { E.resign(state); sel = null; render(); });
    };
    $('btn-new').onclick = function () {
      askConfirm('현재 대국을 버리고 새 게임을 시작할까요? (배치 선택은 유지됩니다)', function () {
        state = E.createState({ setup: state.setup }); sel = null; note = ''; render();
      });
    };
    $('confirm-yes').onclick = function () { var f = confirmFn; closeConfirm(); if (f) f(); };
    $('confirm-no').onclick = closeConfirm;
    ['cho', 'han'].forEach(function (side) {
      ['left', 'right'].forEach(function (pos) {
        $('setup-' + side + '-' + pos).onchange = function () {
          var st = state.setup[side];
          var l = pos === 'left' ? this.value : st.left;
          var r = pos === 'right' ? this.value : st.right;
          if (!E.setSetup(state, side, l, r)) note = '대국이 시작된 뒤에는 배치를 바꿀 수 없습니다.';
          sel = null; render();
        };
      });
    });
  }

  // ---- 렌더 ----
  function resultText(res) {
    var w = res.winner ? E.SIDE_NAME[res.winner] + ' 승' : '무승부';
    var why = { checkmate: '외통(장군에서 벗어날 수 없음)', resign: '기권', bikjang: '빅장 수락', agreement: '합의', 'double-pass': '연속 두 번 쉼' }[res.reason];
    return w + ' — ' + why;
  }

  function chips(list, side) {
    if (!list.length) return '<span class="none">없음</span>';
    return list.map(function (t) {
      return '<span class="chip ' + side + '">' + E.PIECE_GLYPH[side][t] + '</span>';
    }).join('');
  }

  function render() {
    var legal = legalList();
    var lastEntry = state.log.length ? state.log[state.log.length - 1] : null;
    var last = lastEntry && lastEntry.kind === 'move' ? lastEntry : null;
    var chkSide = E.isCheck(state, state.turn) ? state.turn : null;
    var kp = chkSide ? E.findKing(state, chkSide) : null;
    var face = E.kingsFace(state);

    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var b = cells[r][c], p = state.board[r][c];
      var isDest = legal.some(function (m) { return m.r === r && m.c === c; });
      var cls = 'pt';
      if (isDest) cls += p ? ' dest cap' : ' dest';
      if (sel && sel.r === r && sel.c === c) cls += ' sel';
      if (last && ((last.from[0] === r && last.from[1] === c) || (last.to[0] === r && last.to[1] === c))) cls += ' last';
      if (kp && kp.r === r && kp.c === c) cls += ' checked';
      b.className = cls;
      var lab = E.label(r, c) + ' ' + (p ? E.SIDE_NAME[p.side] + ' ' + E.PIECE_NAME[p.side][p.type] : '빈 칸');
      if (isDest) lab += p ? ', 잡을 수 있음' : ', 이동 가능';
      if (sel && sel.r === r && sel.c === c) lab += ', 선택됨';
      b.setAttribute('aria-label', lab);
      b.tabIndex = (cursor.r === r && cursor.c === c) ? 0 : -1;
      b.innerHTML = p
        ? '<span class="sh"><span class="tok ' + p.side + ' t' + p.type + '"><span class="ch">' + E.PIECE_GLYPH[p.side][p.type] + '</span></span></span>'
        : '';
    }

    // 상태
    var turnName = state.turn === 'cho' ? '초 (파랑 · 아래)' : '한 (빨강 · 위)';
    var status;
    if (state.result) status = '대국 종료: ' + resultText(state.result);
    else {
      status = turnName + ' 차례';
      if (face && chkSide) status += ' · 빅장 + 장군!';
      else if (face) status += ' · 빅장! (마주 봄을 풀거나 빅장 수락)';
      else if (chkSide) status += ' · 장군!';
    }
    var st = $('status');
    st.textContent = status;
    st.className = 'status ' + (state.result ? 'end' : state.turn);

    // 선택 안내
    var info;
    if (!sel) info = state.result ? '' : '움직일 기물을 누르세요. 이동 가능한 칸이 점(빈 칸)과 붉은 고리(잡기)로 표시됩니다.';
    else {
      var sp = state.board[sel.r][sel.c];
      var nm = E.SIDE_NAME[sp.side] + ' ' + E.PIECE_NAME[sp.side][sp.type] + ' (' + E.label(sel.r, sel.c) + ')';
      info = legal.length
        ? nm + ' 선택 — 이동 가능 ' + legal.length + '곳. 도착 칸을 누르세요. 같은 기물을 다시 누르면 선택 해제.'
        : nm + ' 선택 — 움직일 수 없음: ' + E.explainNoMoves(state, sel.r, sel.c);
    }
    $('selinfo').textContent = info;
    $('msg').textContent = note;

    // 버튼
    var over = !!state.result;
    $('btn-undo').disabled = !state.history.length;
    $('btn-pass').disabled = !E.canPass(state);
    $('btn-bikjang').disabled = over || !face;
    $('btn-draw').disabled = over;
    $('btn-resign').disabled = over;

    // 배치
    var started = state.history.length > 0;
    ['cho', 'han'].forEach(function (side) {
      ['left', 'right'].forEach(function (pos) {
        var el = $('setup-' + side + '-' + pos);
        el.value = state.setup[side][pos];
        el.disabled = started;
      });
    });
    $('setup-note').textContent = started ? '대국이 시작되어 배치가 잠겼습니다. 새 게임에서 다시 고를 수 있습니다.' : '첫 수(또는 쉼)를 두기 전까지만 바꿀 수 있습니다.';

    // 잡은 기물 (초가 잡은 = 한의 손실)
    $('cap-cho').innerHTML = chips(state.lost.han, 'han');
    $('cap-han').innerHTML = chips(state.lost.cho, 'cho');

    // 기보
    var ol = $('log');
    ol.innerHTML = '';
    state.log.forEach(function (e) {
      var li = document.createElement('li');
      li.className = e.side;
      li.textContent = e.no + '. ' + e.text;
      ol.appendChild(li);
    });
    ol.parentNode.scrollTop = ol.parentNode.scrollHeight;
    $('log-empty').hidden = state.log.length > 0;
  }

  buildBoard();
  bind();
  render();
})();
