/*
 * 장기 엔진 (UMD / CommonJS). 좌표: row 0=위(한), 9=아래(초), col 0..8.
 * 기물: {side:'cho'|'han', type:'K'|'A'|'H'|'E'|'R'|'C'|'P'}
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JanggiEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ROWS = 10, COLS = 9;
  var SIDE_NAME = { cho: '초', han: '한' };
  var PIECE_NAME = {
    cho: { K: '초', A: '사', H: '마', E: '상', R: '차', C: '포', P: '졸' },
    han: { K: '한', A: '사', H: '마', E: '상', R: '차', C: '포', P: '병' }
  };
  var ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function other(s) { return s === 'cho' ? 'han' : 'cho'; }
  function inBoard(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  function label(r, c) { return String.fromCharCode(65 + c) + (10 - r); }

  // 궁성: 한 rows 0..2 → base 0, 초 rows 7..9 → base 7, cols 3..5. 아니면 -1.
  function palaceBase(r, c) {
    if (c < 3 || c > 5) return -1;
    if (r <= 2) return 0;
    if (r >= 7) return 7;
    return -1;
  }
  // 궁성의 대각선이 지나는 점 (모서리 4 + 중앙)
  function onDiag(r, c) {
    var b = palaceBase(r, c);
    return b >= 0 && ((r - b) + (c - 3)) % 2 === 0;
  }
  // (r,c)→(nr,nc) 대각 1칸이 실제로 그어진 선인가
  function diagOk(r, c, nr, nc) {
    var b = palaceBase(r, c);
    return b >= 0 && b === palaceBase(nr, nc) && onDiag(r, c) && onDiag(nr, nc);
  }

  function emptyBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) { b.push([]); for (var c = 0; c < COLS; c++) b[r].push(null); }
    return b;
  }
  function cloneBoard(b) {
    return b.map(function (row) { return row.map(function (p) { return p ? { side: p.side, type: p.type } : null; }); });
  }

  function normalizeSetup(s) {
    var ok = function (v, d) { return v === 'HE' || v === 'EH' ? v : d; };
    s = s || {};
    return {
      cho: { left: ok(s.cho && s.cho.left, 'HE'), right: ok(s.cho && s.cho.right, 'EH') },
      han: { left: ok(s.han && s.han.left, 'HE'), right: ok(s.han && s.han.right, 'EH') }
    };
  }

  // left: cols 1,2 의 왼쪽→오른쪽 순서, right: cols 6,7 의 순서. 기본 HE / EH
  function buildBoard(setup) {
    var b = emptyBoard();
    var conf = { han: { back: 0, king: 1, cannon: 2, soldier: 3 }, cho: { back: 9, king: 8, cannon: 7, soldier: 6 } };
    ['han', 'cho'].forEach(function (side) {
      var k = conf[side], st = setup[side];
      var l = st.left.split(''), rr = st.right.split('');
      var back = ['R', l[0], l[1], 'A', null, 'A', rr[0], rr[1], 'R'];
      back.forEach(function (t, c) { if (t) b[k.back][c] = { side: side, type: t }; });
      b[k.king][4] = { side: side, type: 'K' };
      b[k.cannon][1] = { side: side, type: 'C' };
      b[k.cannon][7] = { side: side, type: 'C' };
      [0, 2, 4, 6, 8].forEach(function (c) { b[k.soldier][c] = { side: side, type: 'P' }; });
    });
    return b;
  }

  function createState(opts) {
    opts = opts || {};
    var setup = normalizeSetup(opts.setup);
    return {
      board: buildBoard(setup), turn: 'cho', result: null,
      history: [], log: [], lost: { cho: [], han: [] }, passes: 0, setup: setup
    };
  }
  // 테스트 픽스처용: 빈 판
  function createEmptyState(turn) {
    return {
      board: emptyBoard(), turn: turn || 'cho', result: null,
      history: [], log: [], lost: { cho: [], han: [] }, passes: 0, setup: normalizeSetup()
    };
  }

  // 시작 전(기록 없음)에만 배치를 바꿀 수 있다.
  function setSetup(state, side, left, right) {
    if (state.history.length || state.result || (side !== 'cho' && side !== 'han')) return false;
    var okv = function (v) { return v === 'HE' || v === 'EH'; };
    if (!okv(left) || !okv(right)) return false;
    state.setup[side] = { left: left, right: right };
    state.board = buildBoard(state.setup);
    return true;
  }

  // ---- 기물별 이동 생성 (attack=true 면 왕 위치도 목적지로 포함: 장군 판정용) ----
  function gen(state, r, c, attack) {
    var board = state.board, p = board[r][c], out = [];
    if (!p) return out;
    var side = p.side;

    function add(nr, nc) {
      if (!inBoard(nr, nc)) return;
      var t = board[nr][nc];
      if (t) {
        if (t.side === side) return;
        if (t.type === 'K' && !attack) return;
      }
      out.push({ r: nr, c: nc });
    }
    // 직선/궁성 대각 진행이 유효한가 (대각은 같은 궁성의 선 위)
    function stepOk(nr, nc, diag) {
      if (!inBoard(nr, nc)) return false;
      if (!diag) return true;
      return palaceBase(nr, nc) === palaceBase(r, c) && onDiag(nr, nc);
    }
    function dirs() {
      var d = ORTH.map(function (x) { return { d: x, diag: false }; });
      if (onDiag(r, c)) DIAG.forEach(function (x) { d.push({ d: x, diag: true }); });
      return d;
    }

    switch (p.type) {
      case 'K':
      case 'A': {
        var pb = side === 'han' ? 0 : 7;
        ORTH.forEach(function (d) {
          var nr = r + d[0], nc = c + d[1];
          if (palaceBase(nr, nc) === pb) add(nr, nc);
        });
        DIAG.forEach(function (d) {
          var nr = r + d[0], nc = c + d[1];
          if (diagOk(r, c, nr, nc) && palaceBase(nr, nc) === pb) add(nr, nc);
        });
        break;
      }
      case 'R':
        dirs().forEach(function (o) {
          var nr = r + o.d[0], nc = c + o.d[1];
          while (stepOk(nr, nc, o.diag)) {
            if (board[nr][nc]) { add(nr, nc); break; }
            out.push({ r: nr, c: nc });
            nr += o.d[0]; nc += o.d[1];
          }
        });
        break;
      case 'C':
        dirs().forEach(function (o) {
          var nr = r + o.d[0], nc = c + o.d[1], screen = null;
          while (stepOk(nr, nc, o.diag)) {
            if (board[nr][nc]) { screen = board[nr][nc]; break; }
            nr += o.d[0]; nc += o.d[1];
          }
          if (!screen || screen.type === 'C') return;
          nr += o.d[0]; nc += o.d[1];
          while (stepOk(nr, nc, o.diag)) {
            var t = board[nr][nc];
            if (!t) out.push({ r: nr, c: nc });
            else { if (t.type !== 'C') add(nr, nc); break; }
            nr += o.d[0]; nc += o.d[1];
          }
        });
        break;
      case 'H':
        ORTH.forEach(function (d) {
          var lr = r + d[0], lc = c + d[1];
          if (!inBoard(lr, lc) || board[lr][lc]) return;
          [-1, 1].forEach(function (s) {
            if (d[0] !== 0) add(r + 2 * d[0], c + s);
            else add(r + s, c + 2 * d[1]);
          });
        });
        break;
      case 'E':
        ORTH.forEach(function (d) {
          var lr = r + d[0], lc = c + d[1];
          if (!inBoard(lr, lc) || board[lr][lc]) return;
          [-1, 1].forEach(function (s) {
            var mr, mc, tr, tc;
            if (d[0] !== 0) { mr = r + 2 * d[0]; mc = c + s; tr = r + 3 * d[0]; tc = c + 2 * s; }
            else { mr = r + s; mc = c + 2 * d[1]; tr = r + 2 * s; tc = c + 3 * d[1]; }
            if (!inBoard(mr, mc) || board[mr][mc]) return;
            add(tr, tc);
          });
        });
        break;
      case 'P': {
        var f = side === 'cho' ? -1 : 1;
        add(r + f, c); add(r, c - 1); add(r, c + 1);
        [-1, 1].forEach(function (s) {
          if (diagOk(r, c, r + f, c + s)) add(r + f, c + s);
        });
        break;
      }
    }
    return out;
  }

  function pseudoMoves(state, r, c) { return gen(state, r, c, false); }

  // side 의 기물이 공격하는 칸 → 10x9 boolean 격자 (왕 위치 포함)
  function pseudoAttacks(state, side) {
    var g = [];
    for (var r = 0; r < ROWS; r++) { g.push([]); for (var c = 0; c < COLS; c++) g[r].push(false); }
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      var p = state.board[r][c];
      if (p && p.side === side) gen(state, r, c, true).forEach(function (m) { g[m.r][m.c] = true; });
    }
    return g;
  }

  function findKing(state, side) {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var p = state.board[r][c];
      if (p && p.side === side && p.type === 'K') return { r: r, c: c };
    }
    return null;
  }

  function isCheck(state, side) {
    var k = findKing(state, side);
    if (!k) return false;
    return pseudoAttacks(state, other(side))[k.r][k.c];
  }

  // 빅장: 두 왕이 같은 줄에서 사이에 기물 없이 마주 봄 (공격이 아님)
  function kingsFace(state) {
    var a = findKing(state, 'cho'), b = findKing(state, 'han');
    if (!a || !b || a.c !== b.c) return false;
    for (var r = Math.min(a.r, b.r) + 1; r < Math.max(a.r, b.r); r++) {
      if (state.board[r][a.c]) return false;
    }
    return true;
  }

  // 수를 두었을 때 위반: null(합법) | 'check' | 'bikjang'
  function evalMove(state, fr, fc, tr, tc) {
    var p = state.board[fr][fc];
    var sim = { board: cloneBoard(state.board) };
    sim.board[tr][tc] = sim.board[fr][fc];
    sim.board[fr][fc] = null;
    if (isCheck(sim, p.side)) return 'check';
    if (p.side === state.turn && kingsFace(state) && kingsFace(sim)) return 'bikjang';
    return null;
  }

  function legalMoves(state, r, c) {
    if (state.result) return [];
    var p = state.board[r] && state.board[r][c];
    if (!p) return [];
    return pseudoMoves(state, r, c).filter(function (m) { return evalMove(state, r, c, m.r, m.c) === null; });
  }

  function hasLegalMove(state, side) {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var p = state.board[r][c];
      if (p && p.side === side && legalMoves(state, r, c).length) return true;
    }
    return false;
  }

  function explainNoMoves(state, r, c) {
    if (state.result) return '대국이 이미 끝났습니다.';
    var p = state.board[r][c];
    if (!p) return '빈 칸입니다.';
    if (p.side !== state.turn) return '지금은 ' + SIDE_NAME[state.turn] + ' 차례입니다.';
    var pm = pseudoMoves(state, r, c);
    if (!pm.length) {
      if (p.type === 'C') return '포는 다른 기물 하나를 넘어야 움직입니다. 포를 넘거나 잡을 수는 없습니다. 지금은 이 조건에 맞는 도착 칸이 없습니다.';
      if (p.type === 'H') return '마는 첫 직선 길목이 비어 있어야 합니다. 길목과 도착 칸이 막혀 있는지 확인하세요.';
      if (p.type === 'E') return '상은 두 중간 길목이 모두 비어 있어야 합니다. 길목과 도착 칸을 확인하세요.';
      return '기물 규칙상 갈 수 있는 칸이 없습니다(막혀 있거나 아군 기물·경계에 걸림).';
    }
    var nChk = 0, nFace = 0;
    pm.forEach(function (m) {
      var v = evalMove(state, r, c, m.r, m.c);
      if (v === 'check') nChk++; else if (v === 'bikjang') nFace++;
    });
    var parts = [];
    if (nChk) parts.push(isCheck(state, state.turn)
      ? '왕이 장군을 받고 있는데 이 기물의 수로는 장군을 풀 수 없습니다.'
      : '움직이면 자기 왕이 장군에 놓입니다.');
    if (nFace) parts.push('빅장(왕이 마주 봄) 상태라 마주 봄을 풀지 못하는 수는 둘 수 없습니다.');
    return parts.join(' ');
  }

  // ---- 상태 변경 ----
  function snapshot(state) {
    return JSON.parse(JSON.stringify({
      board: state.board, turn: state.turn, result: state.result,
      lost: state.lost, passes: state.passes, log: state.log
    }));
  }
  function pushHistory(state) { state.history.push(snapshot(state)); }

  function undo(state) {
    if (!state.history.length) return false;
    var s = state.history.pop();
    state.board = s.board; state.turn = s.turn; state.result = s.result;
    state.lost = s.lost; state.passes = s.passes; state.log = s.log;
    return true;
  }

  function addLog(state, kind, side, text, extra) {
    var e = { no: state.log.length + 1, kind: kind, side: side, text: text };
    if (extra) for (var k in extra) e[k] = extra[k];
    state.log.push(e);
  }

  function move(state, fr, fc, tr, tc) {
    if (state.result || !inBoard(fr, fc) || !inBoard(tr, tc)) return false;
    var p = state.board[fr][fc];
    if (!p || p.side !== state.turn) return false;
    var ok = legalMoves(state, fr, fc).some(function (m) { return m.r === tr && m.c === tc; });
    if (!ok) return false;
    pushHistory(state);
    var cap = state.board[tr][tc];
    if (cap) state.lost[cap.side].push(cap.type);
    state.board[tr][tc] = p;
    state.board[fr][fc] = null;
    state.passes = 0;
    state.turn = other(p.side);
    var chk = isCheck(state, state.turn), face = kingsFace(state);
    var mate = !face && chk && !hasLegalMove(state, state.turn);
    var text = SIDE_NAME[p.side] + ' ' + PIECE_NAME[p.side][p.type] + ' ' + label(fr, fc) + '→' + label(tr, tc);
    if (cap) text += ' (' + PIECE_NAME[cap.side][cap.type] + ' 잡음)';
    if (mate) text += ' 장군·외통';
    else if (chk) text += ' 장군';
    if (face) text += ' 빅장';
    addLog(state, 'move', p.side, text, { from: [fr, fc], to: [tr, tc] });
    if (mate) state.result = { winner: p.side, reason: 'checkmate' };
    return true;
  }

  function canPass(state) {
    return !state.result && !isCheck(state, state.turn) && !kingsFace(state);
  }

  function pass(state) {
    if (!canPass(state)) return false;
    pushHistory(state);
    var side = state.turn;
    state.passes++;
    state.turn = other(side);
    addLog(state, 'pass', side, SIDE_NAME[side] + ' 한 수 쉼');
    if (state.passes >= 2) {
      state.result = { winner: null, reason: 'double-pass' };
      addLog(state, 'end', side, '연속 두 번 쉼 → 무승부');
    }
    return true;
  }

  // 빅장 수락: 마주 본 상태에서 차례인 쪽이 무승부로 끝냄 (장군과 동시여도 허용)
  function bikjangDraw(state) {
    if (state.result || !kingsFace(state)) return false;
    pushHistory(state);
    state.result = { winner: null, reason: 'bikjang' };
    addLog(state, 'end', state.turn, SIDE_NAME[state.turn] + ' 빅장 수락 → 무승부');
    return true;
  }

  // 합의 무승부 (반복 수 자동 판정은 없음)
  function agreeDraw(state) {
    if (state.result) return false;
    pushHistory(state);
    state.result = { winner: null, reason: 'agreement' };
    addLog(state, 'end', state.turn, '합의 무승부');
    return true;
  }

  // 차례인 쪽이 기권
  function resign(state) {
    if (state.result) return false;
    pushHistory(state);
    var side = state.turn;
    state.result = { winner: other(side), reason: 'resign' };
    addLog(state, 'end', side, SIDE_NAME[side] + ' 기권');
    return true;
  }

  return {
    ROWS: ROWS, COLS: COLS, SIDE_NAME: SIDE_NAME, PIECE_NAME: PIECE_NAME,
    other: other, label: label, cloneBoard: cloneBoard,
    createState: createState, createEmptyState: createEmptyState, setSetup: setSetup,
    pseudoMoves: pseudoMoves, pseudoAttacks: pseudoAttacks, legalMoves: legalMoves,
    hasLegalMove: hasLegalMove, explainNoMoves: explainNoMoves,
    isCheck: isCheck, kingsFace: kingsFace, findKing: findKing,
    move: move, pass: pass, canPass: canPass, undo: undo, resign: resign,
    bikjangDraw: bikjangDraw, agreeDraw: agreeDraw
  };
});
