/**
 * Gomoku (오목) pure game engine.
 * No DOM/UI dependencies. Freestyle rules: no forbidden moves,
 * win = 5 OR MORE contiguous stones (horizontal/vertical/either diagonal).
 *
 * State shape:
 * {
 *   board: number[15][15]   // 0 empty, 1 black, 2 white
 *   turn: 1 | 2             // player to move next
 *   moves: { row, col, player }[]
 *   status: 'playing' | 'won' | 'draw'
 *   winner: 0 | 1 | 2
 *   winningCells: { row, col }[]
 * }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GomokuEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BOARD_SIZE = 15;
  var WIN_LENGTH = 5;

  function createBoard() {
    var board = new Array(BOARD_SIZE);
    for (var r = 0; r < BOARD_SIZE; r++) {
      board[r] = new Array(BOARD_SIZE).fill(0);
    }
    return board;
  }

  function createState() {
    return {
      board: createBoard(),
      turn: 1,
      moves: [],
      status: 'playing',
      winner: 0,
      winningCells: []
    };
  }

  function isValidCoord(row, col) {
    return (
      Number.isInteger(row) &&
      Number.isInteger(col) &&
      row >= 0 &&
      row < BOARD_SIZE &&
      col >= 0 &&
      col < BOARD_SIZE
    );
  }

  function isBoardFull(board) {
    for (var r = 0; r < BOARD_SIZE; r++) {
      for (var c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 0) return false;
      }
    }
    return true;
  }

  var DIRECTIONS = [
    { dr: 0, dc: 1 },  // horizontal
    { dr: 1, dc: 0 },  // vertical
    { dr: 1, dc: 1 },  // diagonal \
    { dr: 1, dc: -1 }  // diagonal /
  ];

  function findWinningCells(board, row, col, player) {
    for (var d = 0; d < DIRECTIONS.length; d++) {
      var dr = DIRECTIONS[d].dr;
      var dc = DIRECTIONS[d].dc;
      var cells = [{ row: row, col: col }];

      var r = row + dr;
      var c = col + dc;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        cells.push({ row: r, col: c });
        r += dr;
        c += dc;
      }

      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        cells.push({ row: r, col: c });
        r -= dr;
        c -= dc;
      }

      if (cells.length >= WIN_LENGTH) {
        return cells;
      }
    }
    return null;
  }

  function place(state, row, col) {
    if (!state || state.status !== 'playing') return false;
    if (!isValidCoord(row, col)) return false;
    if (state.board[row][col] !== 0) return false;

    var player = state.turn;
    state.board[row][col] = player;
    state.moves.push({ row: row, col: col, player: player });

    var winningCells = findWinningCells(state.board, row, col, player);
    if (winningCells) {
      state.status = 'won';
      state.winner = player;
      state.winningCells = winningCells;
      return true;
    }

    if (isBoardFull(state.board)) {
      state.status = 'draw';
      state.winner = 0;
      state.winningCells = [];
      return true;
    }

    state.turn = player === 1 ? 2 : 1;
    return true;
  }

  function undo(state) {
    if (!state || state.moves.length === 0) return false;

    var last = state.moves.pop();
    state.board[last.row][last.col] = 0;
    state.turn = last.player;
    state.status = 'playing';
    state.winner = 0;
    state.winningCells = [];
    return true;
  }

  function reset(state) {
    var fresh = createState();
    state.board = fresh.board;
    state.turn = fresh.turn;
    state.moves = fresh.moves;
    state.status = fresh.status;
    state.winner = fresh.winner;
    state.winningCells = fresh.winningCells;
    return state;
  }

  return {
    BOARD_SIZE: BOARD_SIZE,
    WIN_LENGTH: WIN_LENGTH,
    createState: createState,
    place: place,
    undo: undo,
    reset: reset
  };
});
