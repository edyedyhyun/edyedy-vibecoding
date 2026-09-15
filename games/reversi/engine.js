// engine.js — 뒤집는 한 수 (Reversi/Othello) 순수 게임 엔진
// CommonJS + 브라우저(window.ReversiEngine) 겸용, 외부 의존성 없음.

(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  }
  if (root) {
    root.ReversiEngine = mod;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null), function () {
  'use strict';

  var SIZE = 8;
  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;

  var DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];

  function isInBounds(row, col) {
    return Number.isInteger(row) && Number.isInteger(col) &&
      row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  function isValidPlayer(player) {
    return player === BLACK || player === WHITE;
  }

  function opponent(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function cloneBoard(board) {
    return board.map(function (row) { return row.slice(); });
  }

  function createEmptyBoard() {
    var board = [];
    for (var r = 0; r < SIZE; r++) {
      board.push(new Array(SIZE).fill(EMPTY));
    }
    return board;
  }

  function createState() {
    var board = createEmptyBoard();
    // 초기 배치: 흰돌 D4/E5, 흑돌 E4/D5 (1-indexed 열=D~E, 행=4~5)
    // 0-indexed: 행3=4, 행4=5, 열3=D, 열4=E
    board[3][3] = WHITE; // D4
    board[4][4] = WHITE; // E5
    board[4][3] = BLACK; // D5
    board[3][4] = BLACK; // E4

    return {
      board: board,
      turn: BLACK,
      status: 'playing',
      winner: 0,
      history: [],
      lastMove: null,
      lastFlips: [],
      notice: '',
      moveNumber: 0
    };
  }

  // 특정 좌표에 player가 놓았을 때 뒤집히는 모든 좌표 목록 반환
  function getFlips(board, row, col, player) {
    if (!isInBounds(row, col) || !isValidPlayer(player)) {
      return [];
    }
    if (board[row][col] !== EMPTY) {
      return [];
    }
    var opp = opponent(player);
    var flips = [];

    for (var d = 0; d < DIRECTIONS.length; d++) {
      var dr = DIRECTIONS[d][0];
      var dc = DIRECTIONS[d][1];
      var r = row + dr;
      var c = col + dc;
      var line = [];

      while (isInBounds(r, c) && board[r][c] === opp) {
        line.push({ row: r, col: c });
        r += dr;
        c += dc;
      }

      if (line.length > 0 && isInBounds(r, c) && board[r][c] === player) {
        flips = flips.concat(line);
      }
    }

    return flips;
  }

  // player가 둘 수 있는 모든 합법 좌표 목록 ({row, col})
  function legalMoves(board, player) {
    if (!isValidPlayer(player)) {
      return [];
    }
    var moves = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === EMPTY) {
          var flips = getFlips(board, r, c, player);
          if (flips.length > 0) {
            moves.push({ row: r, col: c });
          }
        }
      }
    }
    return moves;
  }

  function counts(board) {
    var result = { black: 0, white: 0, empty: 0 };
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = board[r][c];
        if (v === BLACK) result.black++;
        else if (v === WHITE) result.white++;
        else result.empty++;
      }
    }
    return result;
  }

  function playerLabel(player) {
    return player === BLACK ? '흑' : '백';
  }

  // 불변 스냅샷 생성 (undo용)
  function snapshot(state) {
    return {
      board: cloneBoard(state.board),
      turn: state.turn,
      status: state.status,
      winner: state.winner,
      lastMove: state.lastMove ? { row: state.lastMove.row, col: state.lastMove.col } : null,
      lastFlips: state.lastFlips.map(function (f) { return { row: f.row, col: f.col }; }),
      notice: state.notice,
      moveNumber: state.moveNumber
    };
  }

  // 두 플레이어 모두 둘 곳이 없는지 확인하고, 필요하면 자동 패스 처리
  // notice 문자열을 설정하고 status/winner를 갱신한다.
  function resolveTurn(state) {
    var currentMoves = legalMoves(state.board, state.turn);
    if (currentMoves.length > 0) {
      state.notice = '';
      return;
    }

    var other = opponent(state.turn);
    var otherMoves = legalMoves(state.board, other);

    if (otherMoves.length > 0) {
      // 자동 패스
      state.notice = playerLabel(state.turn) + '이(가) 둘 곳이 없어 차례를 넘겼습니다. 다음은 ' +
        playerLabel(other) + ' 차례입니다.';
      state.turn = other;
    } else {
      // 양쪽 다 둘 곳 없음 -> 게임 종료
      var final = counts(state.board);
      state.status = 'over';
      if (final.black > final.white) {
        state.winner = BLACK;
        state.notice = '더 이상 둘 곳이 없습니다. 흑 승리! (흑 ' + final.black + ' : 백 ' + final.white + ')';
      } else if (final.white > final.black) {
        state.winner = WHITE;
        state.notice = '더 이상 둘 곳이 없습니다. 백 승리! (흑 ' + final.black + ' : 백 ' + final.white + ')';
      } else {
        state.winner = 0;
        state.notice = '더 이상 둘 곳이 없습니다. 무승부입니다. (흑 ' + final.black + ' : 백 ' + final.white + ')';
      }
    }
  }

  // row/col에 현재 턴 플레이어가 착수 시도. 성공하면 true.
  function play(state, row, col) {
    if (!state || state.status !== 'playing') {
      return false;
    }
    if (!isInBounds(row, col)) {
      return false;
    }
    if (!isValidPlayer(state.turn)) {
      return false;
    }
    var flips = getFlips(state.board, row, col, state.turn);
    if (flips.length === 0) {
      return false;
    }

    // undo를 위한 이전 상태 저장
    state.history.push(snapshot(state));

    var player = state.turn;
    state.board[row][col] = player;
    for (var i = 0; i < flips.length; i++) {
      state.board[flips[i].row][flips[i].col] = player;
    }

    state.lastMove = { row: row, col: col };
    state.lastFlips = flips.map(function (f) { return { row: f.row, col: f.col }; });
    state.moveNumber += 1;
    state.turn = opponent(player);
    state.status = 'playing';
    state.winner = 0;

    resolveTurn(state);

    return true;
  }

  // 가장 최근 한 수를 되돌린다. 히스토리가 없으면 false.
  function undo(state) {
    if (!state || state.history.length === 0) {
      return false;
    }
    var prev = state.history.pop();
    state.board = prev.board;
    state.turn = prev.turn;
    state.status = prev.status;
    state.winner = prev.winner;
    state.lastMove = prev.lastMove;
    state.lastFlips = prev.lastFlips;
    state.notice = prev.notice;
    state.moveNumber = prev.moveNumber;
    return true;
  }

  // state를 새 게임으로 초기화 (동일 객체 참조 유지, 필드만 갱신)
  function reset(state) {
    var fresh = createState();
    state.board = fresh.board;
    state.turn = fresh.turn;
    state.status = fresh.status;
    state.winner = fresh.winner;
    state.history = fresh.history;
    state.lastMove = fresh.lastMove;
    state.lastFlips = fresh.lastFlips;
    state.notice = fresh.notice;
    state.moveNumber = fresh.moveNumber;
    return state;
  }

  return {
    SIZE: SIZE,
    EMPTY: EMPTY,
    BLACK: BLACK,
    WHITE: WHITE,
    createState: createState,
    getFlips: getFlips,
    legalMoves: legalMoves,
    play: play,
    undo: undo,
    reset: reset,
    counts: counts
  };
});
