/**
 * engine.js — pure game logic for "블록 한 줄" (falling-block puzzle).
 * No DOM access. Works as CommonJS module and as window.BlockEngine.
 *
 * State shape (see README.md "State shape" section for full docs):
 * {
 *   board: number[BOARD_H][BOARD_W]   // 0 = empty, otherwise piece id (1..7)
 *   current: { type, rot, x, y }      // active piece, x/y = grid position of 4x4 box origin
 *   bagQueue: string[]                // upcoming piece types (kept >= 3 for preview)
 *   next: string[3]                   // next three piece types (preview)
 *   rngState: number                  // internal seeded RNG state
 *   score: number
 *   lines: number
 *   status: 'idle' | 'running' | 'paused' | 'gameover'
 *   gravityAcc: number                // ms accumulated toward next gravity tick
 *   lockAcc: number | null            // ms accumulated while piece is grounded, null if not grounded
 *   lockResets: number                // count of lock-delay resets used for current piece
 *   softDrop: boolean                 // whether soft-drop is currently held
 * }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BlockEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BOARD_W = 10;
  var BOARD_H = 20;
  var GRAVITY_MS = 700;
  var LOCK_DELAY_MS = 350;
  var LOCK_MAX_RESETS = 15;
  var DAS_MS = 150;
  var REPEAT_MS = 45;
  var SCORE_TABLE = { 1: 100, 2: 300, 3: 500, 4: 800 };

  var PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  var PIECE_IDS = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };

  // Each piece: 4 rotation states, each a 4x4 grid of 0/1 (row-major).
  var SHAPES = {
    I: [
      ['....', 'XXXX', '....', '....'],
      ['..X.', '..X.', '..X.', '..X.'],
      ['....', 'XXXX', '....', '....'],
      ['..X.', '..X.', '..X.', '..X.']
    ],
    O: [
      ['.XX.', '.XX.', '....', '....'],
      ['.XX.', '.XX.', '....', '....'],
      ['.XX.', '.XX.', '....', '....'],
      ['.XX.', '.XX.', '....', '....']
    ],
    T: [
      ['.X..', 'XXX.', '....', '....'],
      ['.X..', '.XX.', '.X..', '....'],
      ['....', 'XXX.', '.X..', '....'],
      ['.X..', 'XX..', '.X..', '....']
    ],
    S: [
      ['.XX.', 'XX..', '....', '....'],
      ['.X..', '.XX.', '..X.', '....'],
      ['.XX.', 'XX..', '....', '....'],
      ['.X..', '.XX.', '..X.', '....']
    ],
    Z: [
      ['XX..', '.XX.', '....', '....'],
      ['..X.', '.XX.', '.X..', '....'],
      ['XX..', '.XX.', '....', '....'],
      ['..X.', '.XX.', '.X..', '....']
    ],
    J: [
      ['X...', 'XXX.', '....', '....'],
      ['.XX.', '.X..', '.X..', '....'],
      ['....', 'XXX.', '..X.', '....'],
      ['.X..', '.X..', 'XX..', '....']
    ],
    L: [
      ['..X.', 'XXX.', '....', '....'],
      ['.X..', '.X..', '.XX.', '....'],
      ['....', 'XXX.', 'X...', '....'],
      ['XX..', '.X..', '.X..', '....']
    ]
  };

  // Modest wall-kick offsets tried after a rotation, in order. This is a
  // simplified kick table (not the full SRS kick tables per rotation pair) —
  // it simply nudges the piece left/right/up by a small amount until a
  // non-colliding placement is found.
  var KICK_OFFSETS = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: -1 }
  ];

  function shapeCells(type, rot) {
    var grid = SHAPES[type][rot % 4];
    var cells = [];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (grid[r][c] === 'X') cells.push({ x: c, y: r });
      }
    }
    return cells;
  }

  // Deterministic seeded RNG (mulberry32). Returns a function state-updater
  // stored as a plain number so it can live inside serializable state.
  function nextRandom(state) {
    var t = (state.rngState += 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    var value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return value;
  }

  function makeBag(state) {
    var bag = PIECE_TYPES.slice();
    for (var i = bag.length - 1; i > 0; i--) {
      var j = Math.floor(nextRandom(state) * (i + 1));
      var tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
    return bag;
  }

  function refillQueue(state) {
    while (state.bagQueue.length < 3) {
      state.bagQueue = state.bagQueue.concat(makeBag(state));
    }
  }

  function emptyBoard() {
    var board = [];
    for (var r = 0; r < BOARD_H; r++) {
      board.push(new Array(BOARD_W).fill(0));
    }
    return board;
  }

  function createState(seed) {
    var state = {
      board: emptyBoard(),
      current: null,
      bagQueue: [],
      next: [],
      rngState: (seed >>> 0) || 1,
      score: 0,
      lines: 0,
      status: 'idle',
      gravityAcc: 0,
      lockAcc: null,
      lockResets: 0,
      softDrop: false
    };
    refillQueue(state);
    state.next = state.bagQueue.slice(0, 3);
    return state;
  }

  function collides(state, type, rot, x, y) {
    var cells = shapeCells(type, rot);
    for (var i = 0; i < cells.length; i++) {
      var bx = x + cells[i].x;
      var by = y + cells[i].y;
      if (bx < 0 || bx >= BOARD_W || by >= BOARD_H) return true;
      if (by < 0) continue; // above the visible board, allowed
      if (state.board[by][bx] !== 0) return true;
    }
    return false;
  }

  function spawnPiece(state) {
    refillQueue(state);
    var type = state.bagQueue.shift();
    refillQueue(state); // shifting can drop the queue below 3, top it up again
    state.next = state.bagQueue.slice(0, 3);
    var rot = 0;
    var x = Math.floor((BOARD_W - 4) / 2);
    var y = 0; // spawn fully on the visible board so top-out collisions are real
    state.current = { type: type, rot: rot, x: x, y: y };
    state.gravityAcc = 0;
    state.lockAcc = null;
    state.lockResets = 0;
    state.softDrop = false;
    if (collides(state, type, rot, x, y)) {
      state.status = 'gameover';
    }
  }

  function start(state) {
    if (state.status === 'gameover') return state;
    state.status = 'running';
    if (!state.current) spawnPiece(state);
    return state;
  }

  function pause(state) {
    if (state.status === 'running') {
      state.status = 'paused';
      state.softDrop = false;
    }
    return state;
  }

  function resume(state) {
    if (state.status === 'paused') {
      state.status = 'running';
    }
    return state;
  }

  function reset(state, seed) {
    var fresh = createState(seed);
    for (var key in fresh) {
      if (Object.prototype.hasOwnProperty.call(fresh, key)) state[key] = fresh[key];
    }
    return state;
  }

  function isGrounded(state) {
    var c = state.current;
    return collides(state, c.type, c.rot, c.x, c.y + 1);
  }

  function lockPiece(state) {
    var c = state.current;
    var cells = shapeCells(c.type, c.rot);
    var id = PIECE_IDS[c.type];
    var overflowed = false;
    for (var i = 0; i < cells.length; i++) {
      var bx = c.x + cells[i].x;
      var by = c.y + cells[i].y;
      if (by < 0) {
        overflowed = true; // locked above the visible board: stack topped out
        continue;
      }
      if (by < BOARD_H && bx >= 0 && bx < BOARD_W) {
        state.board[by][bx] = id;
      }
    }
    clearLines(state);
    state.current = null;
    if (overflowed) {
      state.status = 'gameover';
      return;
    }
    if (state.status !== 'gameover') spawnPiece(state);
  }

  function clearLines(state) {
    var remaining = state.board.filter(function (row) {
      return row.some(function (cell) { return cell === 0; });
    });
    var cleared = BOARD_H - remaining.length;
    if (cleared > 0) {
      var newRows = [];
      for (var i = 0; i < cleared; i++) newRows.push(new Array(BOARD_W).fill(0));
      state.board = newRows.concat(remaining);
      state.lines += cleared;
      state.score += SCORE_TABLE[cleared] || 0;
    }
  }

  function canAct(state) {
    return state.status === 'running' && state.current;
  }

  function move(state, dir) {
    if (!canAct(state)) return state;
    var c = state.current;
    var dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    if (dx === 0) return state;
    if (!collides(state, c.type, c.rot, c.x + dx, c.y)) {
      c.x += dx;
      registerMovementResetsLockDelay(state);
    }
    return state;
  }

  function rotate(state) {
    if (!canAct(state)) return state;
    var c = state.current;
    var newRot = (c.rot + 1) % 4;
    for (var i = 0; i < KICK_OFFSETS.length; i++) {
      var kx = c.x + KICK_OFFSETS[i].x;
      var ky = c.y + KICK_OFFSETS[i].y;
      if (!collides(state, c.type, newRot, kx, ky)) {
        c.rot = newRot;
        c.x = kx;
        c.y = ky;
        registerMovementResetsLockDelay(state);
        return state;
      }
    }
    return state; // no valid kick found, rotation ignored
  }

  function registerMovementResetsLockDelay(state) {
    if (state.lockAcc === null) return;
    // lockResets is a lifetime-per-piece budget; it is never reset by lifting
    // off the floor, only by spawning a new piece. Once the budget is spent,
    // leave the running lock timer untouched so kicking the piece airborne
    // repeatedly can no longer grant it unlimited time before it locks.
    if (state.lockResets >= LOCK_MAX_RESETS) return;
    // Consume one reset for this movement regardless of whether it lands the
    // piece back on the floor or lifts it off a ledge, closing the loophole
    // where sliding off an edge granted an unlimited extra airborne timer.
    state.lockResets += 1;
    if (isGrounded(state)) {
      state.lockAcc = 0;
    } else {
      state.lockAcc = null;
    }
  }

  function softDrop(state, held) {
    if (!canAct(state)) return state;
    state.softDrop = !!held;
    return state;
  }

  function landingY(state) {
    if (!state.current) return null;
    var c = state.current;
    var y = c.y;
    while (!collides(state, c.type, c.rot, c.x, y + 1)) y++;
    return y;
  }

  function hardDrop(state) {
    if (!canAct(state)) return state;
    var c = state.current;
    c.y = landingY(state);
    lockPiece(state);
    return state;
  }

  function step(state, dtSeconds) {
    if (state.status !== 'running' || !state.current) return state;
    var dtMs = dtSeconds * 1000;
    var speed = state.softDrop ? GRAVITY_MS / 8 : GRAVITY_MS;
    state.gravityAcc += dtMs;
    while (state.gravityAcc >= speed) {
      state.gravityAcc -= speed;
      var c = state.current;
      if (!collides(state, c.type, c.rot, c.x, c.y + 1)) {
        c.y += 1;
        // Only clear the lock timer while the reset budget still has room;
        // once it's exhausted, preserve the running timer so airborne kicks
        // can't stall the lock indefinitely.
        if (state.lockResets < LOCK_MAX_RESETS) state.lockAcc = null;
      } else {
        if (state.lockAcc === null) state.lockAcc = 0;
      }
    }
    if (state.current && isGrounded(state)) {
      if (state.lockAcc === null) state.lockAcc = 0;
      state.lockAcc += dtMs;
      if (state.lockAcc >= LOCK_DELAY_MS) {
        lockPiece(state);
      }
    } else if (state.current) {
      if (state.lockResets < LOCK_MAX_RESETS) state.lockAcc = null;
    }
    return state;
  }

  return {
    BOARD_W: BOARD_W,
    BOARD_H: BOARD_H,
    GRAVITY_MS: GRAVITY_MS,
    LOCK_DELAY_MS: LOCK_DELAY_MS,
    LOCK_MAX_RESETS: LOCK_MAX_RESETS,
    DAS_MS: DAS_MS,
    REPEAT_MS: REPEAT_MS,
    SCORE_TABLE: SCORE_TABLE,
    PIECE_TYPES: PIECE_TYPES,
    PIECE_IDS: PIECE_IDS,
    shapeCells: shapeCells,
    createState: createState,
    start: start,
    pause: pause,
    resume: resume,
    reset: reset,
    move: move,
    rotate: rotate,
    softDrop: softDrop,
    hardDrop: hardDrop,
    step: step,
    landingY: landingY
  };
}));
