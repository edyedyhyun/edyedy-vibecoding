/**
 * BreakoutEngine — pure, deterministic physics/state module.
 * UMD: works as CommonJS (module.exports) or browser global (window.BreakoutEngine).
 *
 * This module has NO DOM dependencies. It only deals with numbers/objects.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BreakoutEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Constants -----------------------------------------------------

  var WIDTH = 960;
  var HEIGHT = 600;

  var PADDLE_WIDTH = 110;
  var PADDLE_HEIGHT = 16;
  var PADDLE_Y = HEIGHT - 40;
  var PADDLE_SPEED = 620; // px/sec

  var BALL_RADIUS = 8;
  var BALL_SPEED_START = 320; // px/sec
  var BALL_SPEED_MAX = 460; // px/sec cap

  var BRICK_ROWS = 6;
  var BRICK_COLS = 10;
  var BRICK_TOP = 70;
  var BRICK_LEFT = 30;
  var BRICK_GAP = 8;
  var BRICK_WIDTH = (WIDTH - BRICK_LEFT * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
  var BRICK_HEIGHT = 24;
  var BRICK_SCORE = 10;

  var LIVES_START = 3;
  var FIXED_DT = 1 / 120; // fixed timestep for stepping
  var MAX_SUBSTEPS = 8; // safety cap on substeps per step() call

  var STATUS = {
    READY: 'ready', // ball resting on paddle, waiting for launch
    PLAYING: 'playing',
    PAUSED: 'paused',
    WON: 'won',
    LOST_BALL: 'lost_ball', // life lost, waiting for explicit continue
    GAME_OVER: 'game_over'
  };

  // ---- State -----------------------------------------------------------

  function createBricks() {
    var bricks = [];
    for (var row = 0; row < BRICK_ROWS; row++) {
      for (var col = 0; col < BRICK_COLS; col++) {
        bricks.push({
          x: BRICK_LEFT + col * (BRICK_WIDTH + BRICK_GAP),
          y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
          w: BRICK_WIDTH,
          h: BRICK_HEIGHT,
          row: row,
          col: col,
          alive: true
        });
      }
    }
    return bricks;
  }

  function ballRestPosition(paddleX) {
    return {
      x: paddleX + PADDLE_WIDTH / 2,
      y: PADDLE_Y - BALL_RADIUS
    };
  }

  /**
   * Creates a fresh game state.
   * Shape:
   * {
   *   status: STATUS.*,
   *   paddle: { x, y, w, h },
   *   ball: { x, y, vx, vy, r },
   *   bricks: [{ x, y, w, h, row, col, alive }],
   *   score: number,
   *   lives: number,
   *   bricksRemaining: number
   * }
   */
  function createState() {
    var paddleX = (WIDTH - PADDLE_WIDTH) / 2;
    var restPos = ballRestPosition(paddleX);
    var bricks = createBricks();
    return {
      status: STATUS.READY,
      paddle: { x: paddleX, y: PADDLE_Y, w: PADDLE_WIDTH, h: PADDLE_HEIGHT },
      ball: { x: restPos.x, y: restPos.y, vx: 0, vy: 0, r: BALL_RADIUS },
      bricks: bricks,
      score: 0,
      lives: LIVES_START,
      bricksRemaining: bricks.length
    };
  }

  /** Resets state in-place to the initial configuration. */
  function reset(state) {
    var fresh = createState();
    for (var key in fresh) {
      if (Object.prototype.hasOwnProperty.call(fresh, key)) {
        state[key] = fresh[key];
      }
    }
    return state;
  }

  /**
   * Launches the ball from resting position, if currently READY or LOST_BALL.
   * Fires at a fixed upward angle with slight horizontal randomness-free bias
   * (deterministic: always straight-ish up-right diagonal) so tests are stable.
   */
  function launch(state) {
    if (state.status !== STATUS.READY && state.status !== STATUS.LOST_BALL) {
      return state;
    }
    var angle = -Math.PI / 3; // 60 degrees up from horizontal, toward upper-right
    state.ball.vx = BALL_SPEED_START * Math.cos(angle);
    state.ball.vy = BALL_SPEED_START * Math.sin(angle);
    state.status = STATUS.PLAYING;
    return state;
  }

  function pause(state) {
    if (state.status === STATUS.PLAYING) {
      state.status = STATUS.PAUSED;
    }
    return state;
  }

  function resume(state) {
    if (state.status === STATUS.PAUSED) {
      state.status = STATUS.PLAYING;
    }
    return state;
  }

  // ---- Input -------------------------------------------------------------

  /**
   * input: { left: bool, right: bool }
   */
  function movePaddle(state, input, dt) {
    var dx = 0;
    if (input.left) dx -= PADDLE_SPEED * dt;
    if (input.right) dx += PADDLE_SPEED * dt;
    state.paddle.x += dx;
    if (state.paddle.x < 0) state.paddle.x = 0;
    if (state.paddle.x + state.paddle.w > WIDTH) state.paddle.x = WIDTH - state.paddle.w;
  }

  // ---- Collision helpers ---------------------------------------------

  function clampSpeed(ball) {
    var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > BALL_SPEED_MAX) {
      var scale = BALL_SPEED_MAX / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }
  }

  function circleRectOverlap(cx, cy, r, rx, ry, rw, rh) {
    var closestX = Math.max(rx, Math.min(cx, rx + rw));
    var closestY = Math.max(ry, Math.min(cy, ry + rh));
    var dx = cx - closestX;
    var dy = cy - closestY;
    return (dx * dx + dy * dy) < (r * r);
  }

  /**
   * Resolve ball vs paddle collision using conventional mirrored vertical
   * velocity while retaining incoming horizontal velocity.
   * Returns true if a collision was resolved.
   */
  var PADDLE_BOUNCE_MAX_ANGLE = Math.PI / 3; // 60deg from vertical, at the paddle edges

  function resolvePaddleCollision(ball, paddle) {
    if (ball.vy <= 0) return false; // only collide while moving downward
    // Only a legitimate top hit: ball center must still be above the
    // paddle's top edge (prevents scooping a ball already below it).
    if (ball.y > paddle.y) return false;
    if (!circleRectOverlap(ball.x, ball.y, ball.r, paddle.x, paddle.y, paddle.w, paddle.h)) {
      return false;
    }
    // Push ball to rest exactly on top of paddle to avoid repeated overlap.
    ball.y = paddle.y - ball.r;

    // Steer the bounce by landing position: center of paddle sends the ball
    // straight up, the edges send it up to ±60deg from vertical.
    var half = paddle.w / 2;
    var hitOffset = (ball.x - (paddle.x + half)) / half; // -1..1
    if (hitOffset < -1) hitOffset = -1;
    if (hitOffset > 1) hitOffset = 1;
    var angle = hitOffset * PADDLE_BOUNCE_MAX_ANGLE; // from vertical, + = right
    var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    ball.vx = speed * Math.sin(angle);
    ball.vy = -speed * Math.cos(angle);
    clampSpeed(ball);
    return true;
  }

  /**
   * Resolve ball vs single brick collision (axis-aligned), determining
   * whether the hit was on a vertical (left/right) or horizontal (top/bottom)
   * side based on penetration depth, then mirror the corresponding velocity
   * component. Returns true if a collision occurred.
   */
  function resolveBrickCollision(ball, brick) {
    if (!circleRectOverlap(ball.x, ball.y, ball.r, brick.x, brick.y, brick.w, brick.h)) {
      return false;
    }
    var closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
    var closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
    var dx = ball.x - closestX;
    var dy = ball.y - closestY;

    // Determine overlap on each axis to pick the shallower resolution axis.
    var overlapX = ball.r - Math.abs(dx);
    var overlapY = ball.r - Math.abs(dy);

    if (overlapX < overlapY) {
      // Side hit (left/right)
      ball.vx = -ball.vx;
      ball.x += dx > 0 ? overlapX : -overlapX;
    } else {
      // Top/bottom hit
      ball.vy = -ball.vy;
      ball.y += dy > 0 ? overlapY : -overlapY;
    }
    return true;
  }

  /**
   * Advances the ball by dt using swept substeps to avoid tunnelling through
   * thin objects at high speed. Handles walls, paddle, and bricks.
   * Mutates state in place. Returns nothing.
   */
  function advanceBall(state, dt) {
    var ball = state.ball;
    var remaining = dt;
    // Substep sized so the ball never travels more than ~half its radius
    // per substep, bounded by MAX_SUBSTEPS for safety.
    var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    var maxTravelPerStep = ball.r * 0.5;
    var steps = 1;
    if (speed > 0) {
      steps = Math.ceil((speed * dt) / maxTravelPerStep);
    }
    steps = Math.max(1, Math.min(MAX_SUBSTEPS, steps));
    var subDt = dt / steps;

    for (var s = 0; s < steps; s++) {
      ball.x += ball.vx * subDt;
      ball.y += ball.vy * subDt;

      // Wall collisions — only reflect when actually heading into the wall,
      // so a ball already moving back toward the interior isn't re-flipped.
      if (ball.x - ball.r < 0 && ball.vx < 0) {
        ball.x = ball.r;
        ball.vx = -ball.vx;
      } else if (ball.x + ball.r > WIDTH && ball.vx > 0) {
        ball.x = WIDTH - ball.r;
        ball.vx = -ball.vx;
      }
      if (ball.y - ball.r < 0 && ball.vy < 0) {
        ball.y = ball.r;
        ball.vy = -ball.vy;
      }

      // Paddle collision
      resolvePaddleCollision(ball, state.paddle);

      // Brick collisions: resolve at most one per substep (prevents double
      // scoring from overlapping bricks in the same substep) since bricks
      // don't move and gaps prevent simultaneous multi-brick overlap.
      for (var i = 0; i < state.bricks.length; i++) {
        var brick = state.bricks[i];
        if (!brick.alive) continue;
        if (resolveBrickCollision(ball, brick)) {
          brick.alive = false;
          state.score += BRICK_SCORE;
          state.bricksRemaining--;
          if (state.bricksRemaining <= 0) {
            // Win immediately and stop substepping, even mid-chunk on a
            // large dt — don't let the ball keep moving into a cleared board.
            state.status = STATUS.WON;
            return;
          }
          break;
        }
      }

      // Bottom loss check — stop substepping once ball is lost.
      if (ball.y - ball.r > HEIGHT) {
        loseLife(state);
        return;
      }
    }
  }

  function loseLife(state) {
    state.lives--;
    var restPos = ballRestPosition(state.paddle.x);
    state.ball.x = restPos.x;
    state.ball.y = restPos.y;
    state.ball.vx = 0;
    state.ball.vy = 0;
    if (state.lives <= 0) {
      state.status = STATUS.GAME_OVER;
    } else {
      state.status = STATUS.LOST_BALL;
    }
  }

  // ---- Main step ----------------------------------------------------------

  /**
   * Advances the simulation by dt seconds using fixed sub-steps of FIXED_DT.
   * input: { left: bool, right: bool }
   * No-ops for terminal/paused/ready states except paddle following the
   * ball in READY (ball rests on paddle before launch).
   */
  function step(state, dt, input) {
    input = input || { left: false, right: false };

    if (state.status === STATUS.WON || state.status === STATUS.GAME_OVER) {
      return state; // frozen terminal states
    }

    if (state.status === STATUS.PAUSED) {
      return state; // frozen until resumed
    }

    if (state.status === STATUS.READY || state.status === STATUS.LOST_BALL) {
      // Paddle still movable; ball follows paddle while resting.
      movePaddle(state, input, dt);
      var restPos = ballRestPosition(state.paddle.x);
      state.ball.x = restPos.x;
      state.ball.y = restPos.y;
      return state;
    }

    // PLAYING: advance using fixed sub-timesteps for determinism & stability.
    var remaining = dt;
    while (remaining > 0) {
      var chunk = Math.min(FIXED_DT, remaining);
      movePaddle(state, input, chunk);
      advanceBall(state, chunk);
      remaining -= chunk;
      if (state.status !== STATUS.PLAYING) break; // life lost or won mid-loop
    }

    if (state.bricksRemaining <= 0 && state.status === STATUS.PLAYING) {
      state.status = STATUS.WON;
    }

    return state;
  }

  return {
    STATUS: STATUS,
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    PADDLE_WIDTH: PADDLE_WIDTH,
    PADDLE_HEIGHT: PADDLE_HEIGHT,
    PADDLE_Y: PADDLE_Y,
    PADDLE_SPEED: PADDLE_SPEED,
    BALL_RADIUS: BALL_RADIUS,
    BALL_SPEED_START: BALL_SPEED_START,
    BALL_SPEED_MAX: BALL_SPEED_MAX,
    BRICK_ROWS: BRICK_ROWS,
    BRICK_COLS: BRICK_COLS,
    BRICK_WIDTH: BRICK_WIDTH,
    BRICK_HEIGHT: BRICK_HEIGHT,
    BRICK_SCORE: BRICK_SCORE,
    LIVES_START: LIVES_START,
    FIXED_DT: FIXED_DT,
    createState: createState,
    reset: reset,
    launch: launch,
    pause: pause,
    resume: resume,
    step: step
  };
});
