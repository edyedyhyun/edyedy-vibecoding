/*
 * 화면 표시 및 입력 처리 담당 (렌더링 계층).
 * 게임 규칙 자체는 engine.js 에만 있고, 여기서는 그 결과를 그리고
 * 마우스/터치/키보드 입력을 engine 함수 호출로 옮기는 역할만 한다.
 */
(function () {
  'use strict';

  var LEVEL = MinesweeperEngine.DIFFICULTY.BEGINNER; // stage 2도 초급(9x9, 지뢰 10개) 고정

  var boardEl = document.getElementById('board');
  var mineCountEl = document.getElementById('mine-count');
  var elapsedEl = document.getElementById('elapsed-time');
  var statusEl = document.getElementById('status-message');
  var restartButton = document.getElementById('restart-button');
  var modeRevealButton = document.getElementById('mode-reveal-button');
  var modeFlagButton = document.getElementById('mode-flag-button');

  var state = MinesweeperEngine.createGame({
    width: LEVEL.width,
    height: LEVEL.height,
    mines: LEVEL.mines
  });

  // state.cells와 같은 순서로 맞춘 <button> 참조 배열. 매 렌더마다 새로
  // 만들지 않고 속성만 갱신해서 다시 그린다.
  var cellButtons = [];

  // 'reveal' | 'flag' - 좌클릭/터치/Enter·Space가 어느 동작을 할지 결정한다.
  // 우클릭과 F 키는 이 모드와 무관하게 항상 깃발 토글이다.
  var mode = 'reveal';

  // roving tabindex: 보드 전체에서 tabindex="0"인 칸은 항상 하나뿐이고,
  // 나머지는 -1이다. 화살표 키로 이동할 때마다 이 값을 옮겨준다.
  var focusedIndex = 0;

  // 타이머: 첫 번째 성공적인 칸 열기(=지뢰가 배치되는 순간)에 시작하고,
  // 승리/패배 시 멈춘다(그 이후로는 화면 값이 고정된다). 다시하기를
  // 누르면 0으로 되돌린다. engine.js는 시간 개념이 전혀 없으므로 이
  // 타이머는 전적으로 app.js(렌더링 계층)의 책임이다.
  var timerIntervalId = null;
  var elapsedSeconds = 0;

  function setMode(newMode) {
    mode = newMode;
    modeRevealButton.setAttribute('aria-pressed', String(mode === 'reveal'));
    modeFlagButton.setAttribute('aria-pressed', String(mode === 'flag'));
    modeRevealButton.classList.toggle('active', mode === 'reveal');
    modeFlagButton.classList.toggle('active', mode === 'flag');
  }

  function renderElapsed() {
    elapsedEl.textContent = String(elapsedSeconds);
  }

  function startTimerIfNeeded() {
    if (timerIntervalId !== null) return;
    timerIntervalId = setInterval(function () {
      elapsedSeconds++;
      renderElapsed();
    }, 1000);
  }

  function stopTimer() {
    if (timerIntervalId !== null) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  function resetTimer() {
    stopTimer();
    elapsedSeconds = 0;
    renderElapsed();
  }

  // 좌클릭/터치/트랙패드 탭, 그리고 Enter·Space가 모두 이 함수를 거친다.
  // 우클릭과 F 키는 actionMode를 'flag'로 고정해서 호출한다.
  function applyAction(x, y, actionMode) {
    var wasPlaced = state.minesPlaced;

    if (actionMode === 'flag') {
      MinesweeperEngine.toggleFlag(state, x, y);
    } else {
      MinesweeperEngine.revealCell(state, x, y);
    }

    // 지뢰가 이번 호출에서 막 배치됐다 = 첫 번째 성공적인 칸 열기.
    if (!wasPlaced && state.minesPlaced) {
      startTimerIfNeeded();
    }
    if (state.status === 'won' || state.status === 'lost') {
      stopTimer();
    }

    render();
  }

  function handleCellClick(event) {
    var x = Number(event.currentTarget.dataset.x);
    var y = Number(event.currentTarget.dataset.y);
    applyAction(x, y, mode);
  }

  function handleCellContextMenu(event) {
    event.preventDefault(); // 브라우저 기본 우클릭 메뉴 대신 깃발 표시로 사용
    var x = Number(event.currentTarget.dataset.x);
    var y = Number(event.currentTarget.dataset.y);
    applyAction(x, y, 'flag');
  }

  var ARROW_DELTA = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowDown: [0, 1],
    ArrowUp: [0, -1]
  };

  function handleArrowNavigation(event) {
    var delta = ARROW_DELTA[event.key];
    if (!delta) return false;
    event.preventDefault();
    var x = Number(event.currentTarget.dataset.x) + delta[0];
    var y = Number(event.currentTarget.dataset.y) + delta[1];
    if (x < 0) x = 0;
    if (x >= state.width) x = state.width - 1;
    if (y < 0) y = 0;
    if (y >= state.height) y = state.height - 1;
    moveFocusTo(y * state.width + x);
    return true;
  }

  function moveFocusTo(index) {
    if (index === focusedIndex) {
      cellButtons[index].focus();
      return;
    }
    cellButtons[focusedIndex].tabIndex = -1;
    focusedIndex = index;
    cellButtons[focusedIndex].tabIndex = 0;
    cellButtons[focusedIndex].focus();
  }

  // 마우스 클릭 등 어떤 방식으로든 다른 칸에 포커스가 가면 roving
  // tabindex를 그 칸으로 옮겨서 다음 Tab 이동이 자연스럽게 이어지게 한다.
  function handleCellFocus(event) {
    var x = Number(event.currentTarget.dataset.x);
    var y = Number(event.currentTarget.dataset.y);
    var idx = y * state.width + x;
    if (idx !== focusedIndex) {
      cellButtons[focusedIndex].tabIndex = -1;
      focusedIndex = idx;
      cellButtons[focusedIndex].tabIndex = 0;
    }
  }

  // F 키로도 깃발을 꽂을 수 있게 한다(우클릭이 불편한 키보드/터치 전용
  // 사용자를 위한 보완). 키를 누르고 있어도 한 번만 반응하도록
  // event.repeat일 때는 무시한다. Enter/Space는 현재 모드(mode)에 따라
  // 칸 열기 또는 깃발 토글을 수행하고, 버튼의 기본 클릭 동작은 막아서
  // applyAction이 두 번 호출되지 않게 한다.
  function handleCellKeydown(event) {
    var x = Number(event.currentTarget.dataset.x);
    var y = Number(event.currentTarget.dataset.y);

    if (event.key === 'f' || event.key === 'F') {
      if (event.repeat) return;
      event.preventDefault();
      applyAction(x, y, 'flag');
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      applyAction(x, y, mode);
      return;
    }

    handleArrowNavigation(event);
  }

  // 보드 칸 버튼을 한 번만 생성한다. 게임을 다시 시작해도 크기(9x9)는
  // 바뀌지 않으므로 buildBoard는 최초 1회만 호출된다.
  function buildBoard() {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = 'repeat(' + state.width + ', 1fr)';
    boardEl.setAttribute('aria-rowcount', String(state.height));
    boardEl.setAttribute('aria-colcount', String(state.width));
    cellButtons = new Array(state.cells.length);

    for (var y = 0; y < state.height; y++) {
      for (var x = 0; x < state.width; x++) {
        var index = y * state.width + x;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell';
        btn.setAttribute('role', 'gridcell');
        btn.dataset.x = String(x);
        btn.dataset.y = String(y);
        // roving tabindex: 맨 처음엔 첫 칸(0번)만 Tab으로 잡히게 한다.
        btn.tabIndex = index === 0 ? 0 : -1;

        btn.addEventListener('click', handleCellClick);
        btn.addEventListener('contextmenu', handleCellContextMenu);
        btn.addEventListener('keydown', handleCellKeydown);
        btn.addEventListener('focus', handleCellFocus);

        boardEl.appendChild(btn);
        cellButtons[index] = btn;
      }
    }
  }

  function cellLabel(cell, x, y, index) {
    var pos = (y + 1) + '행 ' + (x + 1) + '열';
    if (cell.flagged && !cell.revealed) {
      // 패배 직후에만 "잘못된 깃발"을 알려준다. 게임이 끝났으니 새는
      // 정보가 아니라 결과 확인용 정보다. 그 전에는 깃발 여부만 말한다.
      if (state.status === 'lost' && !cell.mine) return pos + ', 잘못된 깃발';
      return pos + ', 깃발 표시됨';
    }
    if (!cell.revealed) return pos + ', 닫힌 칸';
    if (cell.mine) return pos + (index === state.explodedIndex ? ', 밟은 지뢰' : ', 지뢰');
    if (cell.adjacent === 0) return pos + ', 빈 칸';
    return pos + ', 인접 지뢰 ' + cell.adjacent + '개';
  }

  function render() {
    for (var i = 0; i < state.cells.length; i++) {
      var cell = state.cells[i];
      var x = i % state.width;
      var y = Math.floor(i / state.width);
      var btn = cellButtons[i];

      btn.className = 'cell';
      btn.textContent = '';

      if (cell.revealed) {
        btn.classList.add('revealed');
        if (cell.mine) {
          btn.classList.add('mine');
          if (i === state.explodedIndex) btn.classList.add('exploded');
          btn.textContent = '💣'; // 💣
        } else if (cell.adjacent > 0) {
          btn.classList.add('num-' + cell.adjacent);
          btn.textContent = String(cell.adjacent);
        }
      } else if (cell.flagged) {
        btn.classList.add('flagged');
        // 패배 시 지뢰가 아닌 칸에 꽂힌 깃발("잘못된 깃발")은 따로 표시한다.
        if (state.status === 'lost' && !cell.mine) {
          btn.classList.add('wrong-flag');
        }
        btn.textContent = '🚩'; // 🚩
      }

      btn.setAttribute('aria-label', cellLabel(cell, x, y, i));
    }

    mineCountEl.textContent = String(MinesweeperEngine.getRemainingMines(state));

    var finished = state.status === 'won' || state.status === 'lost';
    boardEl.classList.toggle('is-finished', finished);

    syncStatus();
  }

  function syncStatus() {
    if (state.status === 'ready') {
      statusEl.textContent = '첫 칸을 클릭하면 게임이 시작됩니다.';
    } else if (state.status === 'playing') {
      statusEl.textContent = '';
    } else if (state.status === 'won') {
      statusEl.textContent = '승리했습니다! 모든 안전한 칸을 열었어요.';
    } else if (state.status === 'lost') {
      statusEl.textContent = '지뢰를 밟았습니다. 다시하기를 눌러주세요.';
    }
  }

  function handleRestart() {
    state = MinesweeperEngine.resetGame(state);
    resetTimer();
    render();
  }

  restartButton.addEventListener('click', handleRestart);
  modeRevealButton.addEventListener('click', function () { setMode('reveal'); });
  modeFlagButton.addEventListener('click', function () { setMode('flag'); });

  setMode('reveal');
  renderElapsed();
  buildBoard();
  render();
})();
