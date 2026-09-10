/*
 * Snake 게임 순수 로직 엔진 (state/render 분리 - 이 파일은 렌더링을 전혀 하지 않음)
 *
 * 브라우저에서는 <script src="engine.js"></script> 로 불러오면
 * 전역 SnakeEngine 객체로 사용할 수 있고,
 * Node.js 등 CommonJS 환경에서는 require('./engine.js') 로 사용할 수 있다.
 * (나중에 stage 2 이후 node 기반 테스트 코드 작성을 위해 두 방식 모두 지원)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SnakeEngine = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var GRID_SIZE_DEFAULT = 20;

  var DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
  };

  var OPPOSITE = {
    UP: 'DOWN',
    DOWN: 'UP',
    LEFT: 'RIGHT',
    RIGHT: 'LEFT'
  };

  function createInitialSnake(gridSize) {
    var row = Math.floor(gridSize / 2);
    var headCol = Math.floor(gridSize / 2);
    // 머리가 배열의 첫 번째 요소. 처음엔 오른쪽을 향해 3칸짜리 몸으로 시작.
    return [
      { x: headCol, y: row },
      { x: headCol - 1, y: row },
      { x: headCol - 2, y: row }
    ];
  }

  function isOnSnake(snake, x, y) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    return false;
  }

  // 뱀이 차지하지 않은 칸 중 하나를 무작위로 골라 먹이로 놓는다.
  // 빈 칸이 하나도 없으면(=보드가 가득 참) null을 반환한다.
  function placeFood(snake, gridSize) {
    var emptyCells = [];
    for (var y = 0; y < gridSize; y++) {
      for (var x = 0; x < gridSize; x++) {
        if (!isOnSnake(snake, x, y)) {
          emptyCells.push({ x: x, y: y });
        }
      }
    }
    if (emptyCells.length === 0) return null;
    var idx = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[idx];
  }

  // status: 'ready' | 'running' | 'paused' | 'gameover' | 'cleared'
  function createGame(gridSize) {
    gridSize = gridSize || GRID_SIZE_DEFAULT;
    var snake = createInitialSnake(gridSize);
    return {
      gridSize: gridSize,
      snake: snake,
      direction: 'RIGHT',
      pendingDirection: null,
      food: placeFood(snake, gridSize),
      score: 0,
      status: 'ready'
    };
  }

  function startGame(state) {
    if (state.status === 'ready') {
      state.status = 'running';
    }
    return state;
  }

  function pauseGame(state) {
    if (state.status === 'running') {
      state.status = 'paused';
    }
    return state;
  }

  function resumeGame(state) {
    if (state.status === 'paused') {
      state.status = 'running';
    }
    return state;
  }

  function togglePause(state) {
    if (state.status === 'running') return pauseGame(state);
    if (state.status === 'paused') return resumeGame(state);
    return state;
  }

  // 방향 입력을 큐에 저장만 하고 실제 반영은 tick()에서 한 번만 한다.
  //
  // 규칙 (한 틱당 회전은 최대 한 번만 유효해야 한다):
  // 1) 이번 틱에 적용될 회전이 이미 예약돼 있으면(pendingDirection) 이후에
  //    들어오는 입력은 전부 무시한다. 큐에 쌓인 값을 다시 덮어쓰지 않는다.
  //    (버그 수정 전에는 두 번째 입력이 "직전에 예약된 방향"을 기준으로
  //    반대 방향인지만 검사해서 덮어썼기 때문에, 실제로는 아직 반영되지
  //    않은 실제 진행 방향(state.direction) 기준으로는 정반대인 회전이
  //    통과해버려 몸으로 파고드는 오류가 있었다.)
  // 2) 반대 방향 여부는 항상 "현재 실제로 이동 중인 방향"(state.direction)
  //    기준으로만 판단한다.
  // 3) 현재 진행 방향과 같은 키 입력은 회전을 예약하지 않는다(소모하지 않음).
  function setDirection(state, dirName) {
    if (!DIRECTIONS[dirName]) return state;
    if (state.status !== 'running' && state.status !== 'ready') return state;
    if (state.pendingDirection) return state;
    if (dirName === state.direction) return state;
    if (OPPOSITE[dirName] === state.direction) return state;
    state.pendingDirection = dirName;
    return state;
  }

  function tick(state) {
    if (state.status !== 'running') return state;

    var direction = state.pendingDirection || state.direction;
    state.direction = direction;
    state.pendingDirection = null;

    var vector = DIRECTIONS[direction];
    var head = state.snake[0];
    var newHead = { x: head.x + vector.x, y: head.y + vector.y };

    // 벽 충돌
    if (
      newHead.x < 0 ||
      newHead.x >= state.gridSize ||
      newHead.y < 0 ||
      newHead.y >= state.gridSize
    ) {
      state.status = 'gameover';
      return state;
    }

    var willEat = !!state.food && newHead.x === state.food.x && newHead.y === state.food.y;

    // 몸 충돌 검사: 먹이를 먹지 않으면 꼬리 칸은 이번 이동으로 비워지므로
    // 충돌 판정 대상에서 제외한다 (그렇지 않으면 꼬리를 바짝 뒤따라가는
    // 정상적인 이동도 충돌로 오판된다).
    var bodyToCheck = willEat ? state.snake : state.snake.slice(0, -1);
    if (isOnSnake(bodyToCheck, newHead.x, newHead.y)) {
      state.status = 'gameover';
      return state;
    }

    var newSnake = [newHead].concat(state.snake);
    if (!willEat) {
      newSnake.pop();
    }
    state.snake = newSnake;

    if (willEat) {
      state.score += 10;
    }

    // 보드를 완전히 채우면 게임 종료(클리어)
    if (state.snake.length >= state.gridSize * state.gridSize) {
      state.status = 'cleared';
      state.food = null;
      return state;
    }

    if (willEat) {
      state.food = placeFood(state.snake, state.gridSize);
      if (!state.food) {
        // 위 길이 체크에서 대부분 걸러지지만 만약을 위한 안전망
        state.status = 'cleared';
      }
    }

    return state;
  }

  function resetGame(state) {
    return createGame(state.gridSize);
  }

  return {
    GRID_SIZE_DEFAULT: GRID_SIZE_DEFAULT,
    DIRECTIONS: DIRECTIONS,
    createGame: createGame,
    startGame: startGame,
    pauseGame: pauseGame,
    resumeGame: resumeGame,
    togglePause: togglePause,
    setDirection: setDirection,
    tick: tick,
    resetGame: resetGame
  };
}));
