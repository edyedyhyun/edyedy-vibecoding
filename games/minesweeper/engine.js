/*
 * 지뢰찾기 순수 로직 엔진 (state/render 분리 - 이 파일은 렌더링을 전혀 하지 않음)
 *
 * 브라우저에서는 <script src="engine.js"></script> 로 불러오면
 * 전역 MinesweeperEngine 객체로 사용할 수 있고,
 * Node.js 등 CommonJS 환경에서는 require('./engine.js') 로 사용할 수 있다.
 * (나중에 stage 2 이후 node 기반 테스트 코드 작성을 위해 두 방식 모두 지원)
 *
 * rng는 항상 옵션으로 주입할 수 있다 (기본값 Math.random). 테스트에서
 * 지뢰 배치를 고정하려면 0~1 사이 값을 순서대로 반환하는 함수를 넘기면 된다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MinesweeperEngine = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DIFFICULTY = {
    BEGINNER: { width: 9, height: 9, mines: 10 }
  };

  function defaultRng() {
    return Math.random();
  }

  function indexOf(state, x, y) {
    return y * state.width + x;
  }

  function isInBounds(state, x, y) {
    return x >= 0 && x < state.width && y >= 0 && y < state.height;
  }

  function getNeighborIndexes(state, x, y) {
    var result = [];
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        var nx = x + dx;
        var ny = y + dy;
        if (isInBounds(state, nx, ny)) {
          result.push(indexOf(state, nx, ny));
        }
      }
    }
    return result;
  }

  // status: 'ready' | 'playing' | 'won' | 'lost'
  // 'ready'일 때는 아직 지뢰가 배치되지 않은 상태 (첫 클릭 이후에 배치됨).
  function createGame(options) {
    options = options || {};
    var width = options.width || DIFFICULTY.BEGINNER.width;
    var height = options.height || DIFFICULTY.BEGINNER.height;
    var mineCount = (options.mines !== undefined) ? options.mines : DIFFICULTY.BEGINNER.mines;
    var rng = options.rng || defaultRng;

    var totalCells = width * height;
    // 안전장치: 지뢰 수가 보드 크기 이상이면(=첫 클릭 후 안전 칸이 하나도
    // 남지 않음) 최소 1칸은 항상 안전하게 남도록 지뢰 수를 줄인다.
    if (mineCount >= totalCells) {
      mineCount = totalCells - 1;
    }
    if (mineCount < 0) {
      mineCount = 0;
    }

    var cells = new Array(totalCells);
    for (var i = 0; i < totalCells; i++) {
      cells[i] = { mine: false, revealed: false, flagged: false, adjacent: 0 };
    }

    return {
      width: width,
      height: height,
      mineCount: mineCount,
      cells: cells,
      minesPlaced: false,
      status: 'ready',
      revealedCount: 0, // 지뢰가 아닌 칸을 연 횟수 (승리 판정에 사용)
      flagCount: 0,
      explodedIndex: null, // 패배를 유발한 칸의 인덱스 (화면 강조용)
      rng: rng
    };
  }

  // 첫 클릭 이후에만 호출된다. requiredExcludeIndex(방금 클릭한 칸)에는
  // 반드시 지뢰를 놓지 않는다(첫 클릭 안전 보장, 항상 지켜야 함).
  // preferredExtraExcludes(클릭한 칸의 이웃들)는 "가능하면" 추가로
  // 제외한다: 이렇게 하면 초급판(9x9, 지뢰 10개)처럼 여유 있는 보드에서는
  // 첫 클릭에 숫자 0짜리 빈 칸이 트여서 플러드 리빌이 넓게 일어나고,
  // 지뢰가 빽빽한 커스텀 보드에서 이웃까지 다 빼면 남은 후보가
  // mineCount보다 적어지는 경우에는 이 추가 제외를 포기하고 클릭한 칸
  // 하나만 제외한다(지뢰 수를 그대로 유지하기 위함).
  function placeMines(state, requiredExcludeIndex, preferredExtraExcludes) {
    var totalCells = state.width * state.height;
    var extra = preferredExtraExcludes || [];

    var excludeSet = {};
    excludeSet[requiredExcludeIndex] = true;
    for (var e = 0; e < extra.length; e++) excludeSet[extra[e]] = true;

    var excludedCount = 0;
    for (var key in excludeSet) {
      if (excludeSet.hasOwnProperty(key)) excludedCount++;
    }
    if (totalCells - excludedCount < state.mineCount) {
      // 이웃까지 빼면 지뢰를 다 놓을 자리가 부족함 -> 클릭한 칸만 제외.
      excludeSet = {};
      excludeSet[requiredExcludeIndex] = true;
    }

    var candidates = [];
    for (var i = 0; i < totalCells; i++) {
      if (!excludeSet[i]) candidates.push(i);
    }

    // Fisher-Yates 셔플 후 앞에서 mineCount개를 지뢰 위치로 선택한다.
    for (var j = candidates.length - 1; j > 0; j--) {
      var k = Math.floor(state.rng() * (j + 1));
      var tmp = candidates[j];
      candidates[j] = candidates[k];
      candidates[k] = tmp;
    }

    var mineIndexes = candidates.slice(0, state.mineCount);
    for (var m = 0; m < mineIndexes.length; m++) {
      state.cells[mineIndexes[m]].mine = true;
    }

    // 지뢰가 아닌 칸마다 인접 지뢰 수를 계산해 둔다.
    for (var y = 0; y < state.height; y++) {
      for (var x = 0; x < state.width; x++) {
        var idx = indexOf(state, x, y);
        if (state.cells[idx].mine) continue;
        var neighbors = getNeighborIndexes(state, x, y);
        var count = 0;
        for (var n = 0; n < neighbors.length; n++) {
          if (state.cells[neighbors[n]].mine) count++;
        }
        state.cells[idx].adjacent = count;
      }
    }

    state.minesPlaced = true;
  }

  // 인접 지뢰가 0개인 칸에서 시작해 연결된 빈 칸과 그 경계의 숫자 칸까지
  // 한 번에 열어준다(플러드 리빌). 인접 지뢰가 0개인 칸의 이웃은 절대
  // 지뢰일 수 없으므로 큐에 넣는 것만으로 안전하다.
  function floodReveal(state, startIndex) {
    var queue = [startIndex];
    while (queue.length > 0) {
      var idx = queue.shift();
      var cell = state.cells[idx];
      if (cell.revealed || cell.flagged || cell.mine) continue;

      cell.revealed = true;
      state.revealedCount++;

      if (cell.adjacent === 0) {
        var x = idx % state.width;
        var y = Math.floor(idx / state.width);
        var neighbors = getNeighborIndexes(state, x, y);
        for (var n = 0; n < neighbors.length; n++) {
          var nCell = state.cells[neighbors[n]];
          if (!nCell.revealed && !nCell.flagged) {
            queue.push(neighbors[n]);
          }
        }
      }
    }
  }

  function revealAllMines(state) {
    for (var i = 0; i < state.cells.length; i++) {
      if (state.cells[i].mine) state.cells[i].revealed = true;
    }
  }

  // 좌클릭(칸 열기). 깃발이 꽂힌 칸이나 이미 연 칸, 게임이 끝난 뒤에는
  // 아무 효과가 없다(no-op).
  function revealCell(state, x, y) {
    if (state.status === 'won' || state.status === 'lost') return state;
    if (!isInBounds(state, x, y)) return state;

    var index = indexOf(state, x, y);
    var cell = state.cells[index];
    if (cell.revealed || cell.flagged) return state;

    if (!state.minesPlaced) {
      placeMines(state, index, getNeighborIndexes(state, x, y));
      state.status = 'playing';
    }

    if (cell.mine) {
      cell.revealed = true;
      state.explodedIndex = index;
      state.status = 'lost';
      revealAllMines(state);
      return state;
    }

    floodReveal(state, index);

    var safeTotal = state.width * state.height - state.mineCount;
    if (state.revealedCount >= safeTotal) {
      state.status = 'won';
    }

    return state;
  }

  // 우클릭(또는 키보드) 깃발 표시/해제. 이미 연 칸이나 게임 종료 후에는
  // 아무 효과가 없다.
  function toggleFlag(state, x, y) {
    if (state.status === 'won' || state.status === 'lost') return state;
    if (!isInBounds(state, x, y)) return state;

    var index = indexOf(state, x, y);
    var cell = state.cells[index];
    if (cell.revealed) return state;

    cell.flagged = !cell.flagged;
    state.flagCount += cell.flagged ? 1 : -1;
    return state;
  }

  // 남은 지뢰 수 표시용 값. 깃발을 지뢰 수보다 많이 꽂으면 음수가 될 수
  // 있다(정식 지뢰찾기와 동일한 동작).
  function getRemainingMines(state) {
    return state.mineCount - state.flagCount;
  }

  function resetGame(state) {
    return createGame({
      width: state.width,
      height: state.height,
      mines: state.mineCount,
      rng: state.rng
    });
  }

  return {
    DIFFICULTY: DIFFICULTY,
    createGame: createGame,
    revealCell: revealCell,
    toggleFlag: toggleFlag,
    resetGame: resetGame,
    getRemainingMines: getRemainingMines
  };
}));
