// engine.js — 다음 한 수 (Chess) 순수 게임 엔진
// CommonJS + 브라우저(window.ChessEngine) 겸용, 외부 의존성 없음, DOM 비의존.
//
// ## 상태(state) 구조
// {
//   board: 8x8 배열, board[row][col] (row 0 = 1랭크, col 0 = a파일).
//          각 칸은 null 또는 색+기물 2글자 문자열('wP','bK' 등. P/N/B/R/Q/K).
//   turn: 'w' | 'b' — 현재 둘 차례.
//   castling: { w: {K:bool,Q:bool}, b: {K:bool,Q:bool} } — 캐슬링 권리.
//   enPassant: 앙파상 대상 칸 문자열('e3' 등) 또는 null.
//   halfmoveClock: 폰 이동/기물포획 이후 하프무브 수(50수 규칙용).
//   fullmoveNumber: 전체 수 번호(흑이 두고 나면 +1).
//   positionCounts: { positionKey: count } — 3회/5회 동형 반복 판정용.
//   history: 스냅샷 스택(무르기용, 내부 전용 — UI는 참조하지 말 것).
//   status: 'playing' | 'checkmate' | 'stalemate' | 'draw'.
//   winner: 'w' | 'b' | null.
//   reason: 상태 사유 코드(문자열) 또는 null.
//   lastMove: {from,to,promotion,piece,capture,castle} 또는 null.
//   moveLog: [{from,to,promotion,color,notation}, ...]
// }
//
// ## 공개 API
// createState() -> state
// loadFEN(fen) -> state
// legalMoves(state, from?) -> [{from,to,promotion?,flags}]  (from 생략 시 현재 차례의 모든 합법수)
// play(state, from, to, promotion?) -> boolean (성공 시 state를 직접 변형)
//   - 프로모션이 필요한 수인데 promotion 인자가 없으면 false를 반환하고 state를 변형하지 않는다.
//     (UI는 프로모션 모달을 띄운 뒤 promotion 값을 채워 다시 호출해야 한다.)
// undo(state) -> boolean (직전 수/무승부 선언을 포함해 한 단계 되돌림)
// status(state) -> {turn, status, winner, reason, inCheck, halfmoveClock, fullmoveNumber,
//                    canClaimFifty, canClaimThreefold}
// claimDraw(state, type) -> boolean  (type: 'fifty' | 'threefold')
// isAttacked(board, square, byColor) -> boolean (독립적인 공격 판정, 합법수 생성과 분리)
// findKing(board, color) -> square 문자열 | null
// toFEN(state) -> FEN 문자열

(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  }
  if (root) {
    root.ChessEngine = mod;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null), function () {
  'use strict';

  var FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  var PROMO_TYPES = ['Q', 'R', 'B', 'N'];

  // ---------- 기본 좌표 유틸 ----------

  function sq(row, col) {
    return FILES[col] + String(row + 1);
  }

  function parseSquare(s) {
    var col = s.charCodeAt(0) - 97;
    var row = Number(s[1]) - 1;
    return { row: row, col: col };
  }

  function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function allSquares() {
    var list = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        list.push({ row: r, col: c });
      }
    }
    return list;
  }

  function pieceColor(p) { return p ? p[0] : null; }
  function pieceType(p) { return p ? p[1] : null; }
  function opponent(color) { return color === 'w' ? 'b' : 'w'; }

  function cloneBoard(board) {
    return board.map(function (row) { return row.slice(); });
  }

  // ---------- 초기 상태 ----------

  function emptyBoard() {
    var board = [];
    for (var r = 0; r < 8; r++) board.push(new Array(8).fill(null));
    return board;
  }

  function createState() {
    var board = emptyBoard();
    var backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (var c = 0; c < 8; c++) {
      board[0][c] = 'w' + backRank[c];
      board[1][c] = 'wP';
      board[6][c] = 'bP';
      board[7][c] = 'b' + backRank[c];
    }

    var state = {
      board: board,
      turn: 'w',
      castling: { w: { K: true, Q: true }, b: { K: true, Q: true } },
      enPassant: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
      positionCounts: {},
      history: [],
      status: 'playing',
      winner: null,
      reason: null,
      lastMove: null,
      moveLog: []
    };
    state.positionCounts[positionKey(state)] = 1;
    return state;
  }

  function cloneState(state) {
    return {
      board: cloneBoard(state.board),
      turn: state.turn,
      castling: {
        w: { K: state.castling.w.K, Q: state.castling.w.Q },
        b: { K: state.castling.b.K, Q: state.castling.b.Q }
      },
      enPassant: state.enPassant,
      halfmoveClock: state.halfmoveClock,
      fullmoveNumber: state.fullmoveNumber,
      positionCounts: Object.assign({}, state.positionCounts),
      status: state.status,
      winner: state.winner,
      reason: state.reason,
      lastMove: state.lastMove ? Object.assign({}, state.lastMove) : null,
      moveLog: state.moveLog.slice()
    };
  }

  // ---------- 공격 판정 (합법수 생성과 독립적) ----------

  var KNIGHT_OFFSETS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  var KING_OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  var ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function isAttacked(board, square, byColor) {
    var pos = parseSquare(square);
    var row = pos.row, col = pos.col;

    // 폰 공격
    var pawnRow = byColor === 'w' ? row - 1 : row + 1;
    if (inBounds(pawnRow, col - 1) && board[pawnRow][col - 1] === byColor + 'P') return true;
    if (inBounds(pawnRow, col + 1) && board[pawnRow][col + 1] === byColor + 'P') return true;

    // 나이트 공격
    for (var i = 0; i < KNIGHT_OFFSETS.length; i++) {
      var nr = row + KNIGHT_OFFSETS[i][0], nc = col + KNIGHT_OFFSETS[i][1];
      if (inBounds(nr, nc) && board[nr][nc] === byColor + 'N') return true;
    }

    // 킹 공격
    for (var k = 0; k < KING_OFFSETS.length; k++) {
      var kr = row + KING_OFFSETS[k][0], kc = col + KING_OFFSETS[k][1];
      if (inBounds(kr, kc) && board[kr][kc] === byColor + 'K') return true;
    }

    // 슬라이딩: 룩/퀸 (직선)
    for (var d1 = 0; d1 < ROOK_DIRS.length; d1++) {
      var dr = ROOK_DIRS[d1][0], dc = ROOK_DIRS[d1][1];
      var r = row + dr, c = col + dc;
      while (inBounds(r, c)) {
        var p = board[r][c];
        if (p) {
          if (pieceColor(p) === byColor && (pieceType(p) === 'R' || pieceType(p) === 'Q')) return true;
          break;
        }
        r += dr; c += dc;
      }
    }

    // 슬라이딩: 비숍/퀸 (대각선)
    for (var d2 = 0; d2 < BISHOP_DIRS.length; d2++) {
      var bdr = BISHOP_DIRS[d2][0], bdc = BISHOP_DIRS[d2][1];
      var br = row + bdr, bc = col + bdc;
      while (inBounds(br, bc)) {
        var bp = board[br][bc];
        if (bp) {
          if (pieceColor(bp) === byColor && (pieceType(bp) === 'B' || pieceType(bp) === 'Q')) return true;
          break;
        }
        br += bdr; bc += bdc;
      }
    }

    return false;
  }

  function findKing(board, color) {
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        if (board[r][c] === color + 'K') return sq(r, c);
      }
    }
    return null;
  }

  // ---------- 수 생성 (의사 합법수) ----------

  function generatePseudoMoves(state, from) {
    var board = state.board;
    var turn = state.turn;
    var moves = [];
    var squares = from ? [parseSquare(from)] : allSquares();

    squares.forEach(function (pos) {
      var row = pos.row, col = pos.col;
      var p = board[row][col];
      if (!p || pieceColor(p) !== turn) return;
      var type = pieceType(p);

      if (type === 'P') addPawnMoves(row, col);
      else if (type === 'N') addStepMoves(row, col, KNIGHT_OFFSETS);
      else if (type === 'B') addSlidingMoves(row, col, BISHOP_DIRS);
      else if (type === 'R') addSlidingMoves(row, col, ROOK_DIRS);
      else if (type === 'Q') { addSlidingMoves(row, col, ROOK_DIRS); addSlidingMoves(row, col, BISHOP_DIRS); }
      else if (type === 'K') { addStepMoves(row, col, KING_OFFSETS); addCastlingMoves(row, col); }
    });

    return moves;

    function addPawnMoves(row, col) {
      var dir = turn === 'w' ? 1 : -1;
      var startRow = turn === 'w' ? 1 : 6;
      var promoRow = turn === 'w' ? 7 : 0;

      var r1 = row + dir;
      if (inBounds(r1, col) && !board[r1][col]) {
        pushPawnTarget(row, col, r1, col, false);
        var r2 = row + 2 * dir;
        if (row === startRow && !board[r2][col]) {
          moves.push({ from: sq(row, col), to: sq(r2, col), flags: { doublePush: true } });
        }
      }

      [-1, 1].forEach(function (dc) {
        var nc = col + dc, nr = row + dir;
        if (!inBounds(nr, nc)) return;
        var target = board[nr][nc];
        if (target && pieceColor(target) !== turn) {
          pushPawnTarget(row, col, nr, nc, true);
        } else if (!target && state.enPassant === sq(nr, nc)) {
          moves.push({ from: sq(row, col), to: sq(nr, nc), flags: { capture: true, enPassant: true } });
        }
      });

      function pushPawnTarget(fr, fc, tr, tc, isCapture) {
        if (tr === promoRow) {
          PROMO_TYPES.forEach(function (promo) {
            moves.push({ from: sq(fr, fc), to: sq(tr, tc), promotion: promo, flags: { capture: isCapture } });
          });
        } else {
          moves.push({ from: sq(fr, fc), to: sq(tr, tc), flags: { capture: isCapture } });
        }
      }
    }

    function addStepMoves(row, col, offsets) {
      offsets.forEach(function (o) {
        var nr = row + o[0], nc = col + o[1];
        if (!inBounds(nr, nc)) return;
        var target = board[nr][nc];
        if (!target) {
          moves.push({ from: sq(row, col), to: sq(nr, nc), flags: { capture: false } });
        } else if (pieceColor(target) !== turn) {
          moves.push({ from: sq(row, col), to: sq(nr, nc), flags: { capture: true } });
        }
      });
    }

    function addSlidingMoves(row, col, dirs) {
      dirs.forEach(function (d) {
        var r = row + d[0], c = col + d[1];
        while (inBounds(r, c)) {
          var target = board[r][c];
          if (!target) {
            moves.push({ from: sq(row, col), to: sq(r, c), flags: { capture: false } });
          } else {
            if (pieceColor(target) !== turn) {
              moves.push({ from: sq(row, col), to: sq(r, c), flags: { capture: true } });
            }
            break;
          }
          r += d[0]; c += d[1];
        }
      });
    }

    function addCastlingMoves(row, col) {
      var rights = state.castling[turn];
      var opp = opponent(turn);
      var homeRow = turn === 'w' ? 0 : 7;
      if (row !== homeRow || col !== 4) return;
      if (isAttacked(board, sq(homeRow, 4), opp)) return; // 현재 체크 중이면 캐슬링 불가

      if (rights.K && !board[homeRow][5] && !board[homeRow][6] &&
        board[homeRow][7] === turn + 'R' &&
        !isAttacked(board, sq(homeRow, 5), opp) && !isAttacked(board, sq(homeRow, 6), opp)) {
        moves.push({ from: sq(homeRow, 4), to: sq(homeRow, 6), flags: { castle: 'K' } });
      }
      if (rights.Q && !board[homeRow][3] && !board[homeRow][2] && !board[homeRow][1] &&
        board[homeRow][0] === turn + 'R' &&
        !isAttacked(board, sq(homeRow, 3), opp) && !isAttacked(board, sq(homeRow, 2), opp)) {
        moves.push({ from: sq(homeRow, 4), to: sq(homeRow, 2), flags: { castle: 'Q' } });
      }
    }
  }

  // ---------- 수 적용 (순수 보드 변형, 시뮬레이션/실제 착수 공용) ----------

  function executeMove(board, move) {
    var f = parseSquare(move.from), t = parseSquare(move.to);
    var piece = board[f.row][f.col];

    if (move.flags && move.flags.enPassant) {
      board[f.row][t.col] = null; // 잡힌 폰은 이동한 줄, 목표 칸의 열에 위치
    }

    board[f.row][f.col] = null;
    if (move.promotion) {
      piece = pieceColor(piece) + move.promotion;
    }
    board[t.row][t.col] = piece;

    if (move.flags && move.flags.castle) {
      var row = f.row;
      if (move.flags.castle === 'K') {
        board[row][5] = board[row][7];
        board[row][7] = null;
      } else {
        board[row][3] = board[row][0];
        board[row][0] = null;
      }
    }
  }

  // ---------- 합법수 (킹 안전성 필터 포함) ----------

  function legalMoves(state, from) {
    if (state.status !== 'playing') return [];
    if (from && !/^[a-h][1-8]$/.test(from)) return [];

    var pseudo = generatePseudoMoves(state, from);
    var legal = [];
    var turn = state.turn;

    pseudo.forEach(function (move) {
      var boardCopy = cloneBoard(state.board);
      executeMove(boardCopy, move);
      var kingSq = findKing(boardCopy, turn);
      if (!kingSq) return;
      if (!isAttacked(boardCopy, kingSq, opponent(turn))) {
        legal.push(move);
      }
    });

    return legal;
  }

  // ---------- 착수 ----------

  function updateCastlingRights(state, movingPiece, from, to) {
    var type = pieceType(movingPiece), color = pieceColor(movingPiece);
    if (type === 'K') {
      state.castling[color].K = false;
      state.castling[color].Q = false;
    }
    if (type === 'R') {
      if (color === 'w' && from === 'h1') state.castling.w.K = false;
      if (color === 'w' && from === 'a1') state.castling.w.Q = false;
      if (color === 'b' && from === 'h8') state.castling.b.K = false;
      if (color === 'b' && from === 'a8') state.castling.b.Q = false;
    }
    if (to === 'h1') state.castling.w.K = false;
    if (to === 'a1') state.castling.w.Q = false;
    if (to === 'h8') state.castling.b.K = false;
    if (to === 'a8') state.castling.b.Q = false;
  }

  function epTargetSquare(from, to) {
    var f = parseSquare(from), t = parseSquare(to);
    var midRow = (f.row + t.row) / 2;
    return sq(midRow, f.col);
  }

  function play(state, from, to, promotion) {
    if (state.status !== 'playing') return false;
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return false;

    var candidates = legalMoves(state, from).filter(function (m) { return m.to === to; });
    if (candidates.length === 0) return false;

    var requiresPromotion = candidates.some(function (m) { return !!m.promotion; });
    var move;
    if (requiresPromotion) {
      if (!promotion || PROMO_TYPES.indexOf(promotion) === -1) return false;
      move = candidates.filter(function (m) { return m.promotion === promotion; })[0];
      if (!move) return false;
    } else {
      move = candidates[0];
    }

    state.history.push(cloneState(state));

    var fPos = parseSquare(from);
    var movingPiece = state.board[fPos.row][fPos.col];
    var isCapture = !!(move.flags.capture || move.flags.enPassant);
    var isPawnMove = pieceType(movingPiece) === 'P';
    var movedColor = state.turn;

    executeMove(state.board, move);
    updateCastlingRights(state, movingPiece, from, to);
    state.enPassant = move.flags.doublePush ? epTargetSquare(from, to) : null;
    state.halfmoveClock = (isPawnMove || isCapture) ? 0 : state.halfmoveClock + 1;
    if (movedColor === 'b') state.fullmoveNumber += 1;
    state.turn = opponent(movedColor);

    var key = positionKey(state);
    state.positionCounts[key] = (state.positionCounts[key] || 0) + 1;

    var notation = from + '-' + to + (move.promotion ? '=' + move.promotion : '');
    state.lastMove = {
      from: from, to: to, promotion: move.promotion || null,
      piece: movingPiece, capture: isCapture, castle: move.flags.castle || null
    };
    state.moveLog.push({ from: from, to: to, promotion: move.promotion || null, color: movedColor, notation: notation });

    refreshStatus(state);
    return true;
  }

  function undo(state) {
    if (state.history.length === 0) return false;
    var prev = state.history.pop();
    state.board = prev.board;
    state.turn = prev.turn;
    state.castling = prev.castling;
    state.enPassant = prev.enPassant;
    state.halfmoveClock = prev.halfmoveClock;
    state.fullmoveNumber = prev.fullmoveNumber;
    state.positionCounts = prev.positionCounts;
    state.status = prev.status;
    state.winner = prev.winner;
    state.reason = prev.reason;
    state.lastMove = prev.lastMove;
    state.moveLog = prev.moveLog;
    return true;
  }

  // ---------- 종국 판정 ----------

  function isInsufficientMaterial(board) {
    var minors = { w: [], b: [] };
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (!p) continue;
        var type = pieceType(p), color = pieceColor(p);
        if (type === 'K') continue;
        if (type === 'P' || type === 'R' || type === 'Q') return false;
        minors[color].push({ type: type, row: r, col: c });
      }
    }
    var w = minors.w, b = minors.b;
    if (w.length === 0 && b.length === 0) return true;
    if (w.length === 1 && b.length === 0 && (w[0].type === 'N' || w[0].type === 'B')) return true;
    if (b.length === 1 && w.length === 0 && (b[0].type === 'N' || b[0].type === 'B')) return true;
    var all = w.concat(b);
    if (all.length && all.every(function(p) { return p.type === 'B'; })) {
      var squareColor = (all[0].row + all[0].col) % 2;
      if (all.every(function(p) { return (p.row + p.col) % 2 === squareColor; })) return true;
    }
    return false;
  }

  function refreshStatus(state) {
    var color = state.turn;
    var kingSq = findKing(state.board, color);
    var inCheck = kingSq ? isAttacked(state.board, kingSq, opponent(color)) : false;
    var moves = legalMoves(state);

    if (moves.length === 0) {
      if (inCheck) {
        state.status = 'checkmate';
        state.winner = opponent(color);
        state.reason = 'checkmate';
      } else {
        state.status = 'stalemate';
        state.winner = null;
        state.reason = 'stalemate';
      }
      return;
    }

    if (isInsufficientMaterial(state.board)) {
      state.status = 'draw'; state.winner = null; state.reason = 'insufficient';
      return;
    }
    if (state.halfmoveClock >= 150) {
      state.status = 'draw'; state.winner = null; state.reason = '75move';
      return;
    }
    var key = positionKey(state);
    if (state.positionCounts[key] >= 5) {
      state.status = 'draw'; state.winner = null; state.reason = 'fivefold';
      return;
    }

    state.status = 'playing';
    state.winner = null;
    state.reason = null;
  }

  function claimDraw(state, type) {
    if (state.status !== 'playing') return false;
    if (type === 'fifty' && state.halfmoveClock >= 100) {
      state.history.push(cloneState(state));
      state.status = 'draw'; state.winner = null; state.reason = 'fifty-claimed';
      return true;
    }
    if (type === 'threefold') {
      var key = positionKey(state);
      if ((state.positionCounts[key] || 0) >= 3) {
        state.history.push(cloneState(state));
        state.status = 'draw'; state.winner = null; state.reason = 'threefold-claimed';
        return true;
      }
    }
    return false;
  }

  function status(state) {
    var color = state.turn;
    var kingSq = findKing(state.board, color);
    var inCheck = state.status === 'playing' && kingSq ? isAttacked(state.board, kingSq, opponent(color)) : false;
    var key = positionKey(state);
    return {
      turn: state.turn,
      status: state.status,
      winner: state.winner,
      reason: state.reason,
      inCheck: inCheck,
      halfmoveClock: state.halfmoveClock,
      fullmoveNumber: state.fullmoveNumber,
      canClaimFifty: state.status === 'playing' && state.halfmoveClock >= 100,
      canClaimThreefold: state.status === 'playing' && (state.positionCounts[key] || 0) >= 3
    };
  }

  // ---------- FEN ----------

  function toFEN(state) {
    var rows = [];
    for (var r = 7; r >= 0; r--) {
      var runLen = 0, rowStr = '';
      for (var c = 0; c < 8; c++) {
        var p = state.board[r][c];
        if (!p) {
          runLen++;
        } else {
          if (runLen > 0) { rowStr += runLen; runLen = 0; }
          var letter = pieceType(p);
          rowStr += pieceColor(p) === 'w' ? letter : letter.toLowerCase();
        }
      }
      if (runLen > 0) rowStr += runLen;
      rows.push(rowStr);
    }
    var placement = rows.join('/');
    var castlingStr = '' +
      (state.castling.w.K ? 'K' : '') +
      (state.castling.w.Q ? 'Q' : '') +
      (state.castling.b.K ? 'k' : '') +
      (state.castling.b.Q ? 'q' : '');
    if (!castlingStr) castlingStr = '-';
    var ep = state.enPassant || '-';
    return [placement, state.turn, castlingStr, ep, state.halfmoveClock, state.fullmoveNumber].join(' ');
  }

  function positionKey(state) {
    var fen = toFEN(state);
    var parts = fen.split(' ').slice(0, 4);
    // En passant changes repetition identity only when a legal capture exists.
    if (state.enPassant && !legalMoves(state).some(function(m) { return m.flags.enPassant; })) parts[3] = '-';
    return parts.join(' ');
  }

  function loadFEN(fen) {
    var parts = fen.trim().split(/\s+/);
    var placement = parts[0], turn = parts[1] || 'w', castlingStr = parts[2] || '-',
      epStr = parts[3] || '-', halfmove = parseInt(parts[4], 10), fullmove = parseInt(parts[5], 10);

    var board = emptyBoard();
    var rows = placement.split('/');
    for (var i = 0; i < 8; i++) {
      var r = 7 - i;
      var row = rows[i];
      var col = 0;
      for (var j = 0; j < row.length; j++) {
        var ch = row[j];
        if (/[1-8]/.test(ch)) {
          col += Number(ch);
        } else {
          var color = ch === ch.toUpperCase() ? 'w' : 'b';
          board[r][col] = color + ch.toUpperCase();
          col++;
        }
      }
    }

    var state = {
      board: board,
      turn: turn === 'b' ? 'b' : 'w',
      castling: {
        w: { K: castlingStr.indexOf('K') !== -1, Q: castlingStr.indexOf('Q') !== -1 },
        b: { K: castlingStr.indexOf('k') !== -1, Q: castlingStr.indexOf('q') !== -1 }
      },
      enPassant: epStr === '-' ? null : epStr,
      halfmoveClock: isNaN(halfmove) ? 0 : halfmove,
      fullmoveNumber: isNaN(fullmove) ? 1 : fullmove,
      positionCounts: {},
      history: [],
      status: 'playing',
      winner: null,
      reason: null,
      lastMove: null,
      moveLog: []
    };
    state.positionCounts[positionKey(state)] = 1;
    refreshStatus(state);
    return state;
  }

  return {
    createState: createState,
    loadFEN: loadFEN,
    legalMoves: legalMoves,
    play: play,
    undo: undo,
    status: status,
    claimDraw: claimDraw,
    isAttacked: isAttacked,
    findKing: findKing,
    toFEN: toFEN
  };
});
