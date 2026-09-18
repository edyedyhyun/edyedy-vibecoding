(function () {
  'use strict';
  var E = window.YutEngine;
  var state = E.createState();
  var selectedResult = null;
  var selectedPiece = null;
  var lastBits = [1, 1, 1, 1];

  var boardEl = document.getElementById('board');
  var teamLabelEl = document.getElementById('teamLabel');
  var sticksEl = document.getElementById('sticks');
  var lastResultEl = document.getElementById('lastResult');
  var rollBtn = document.getElementById('rollBtn');
  var resultsEl = document.getElementById('results');
  var reserveEl = document.getElementById('reserve');
  var instructionEl = document.getElementById('instruction');
  var logEl = document.getElementById('log');
  var undoBtn = document.getElementById('undoBtn');
  var newGameBtn = document.getElementById('newGameBtn');
  var winnerBanner = document.getElementById('winnerBanner');
  var helpToggle = document.getElementById('helpToggle');
  var helpBody = document.getElementById('helpBody');

  function teamLabel(t) { return t === 'CHEONG' ? '청팀' : '홍팀'; }

  function buildBoard() {
    boardEl.innerHTML = '';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 500 500');
    svg.setAttribute('class', 'boardSvg');
    var ring = ['o1','o2','o3','o4','o5','o6','o7','o8','o9','o10','o11','o12','o13','o14','o15','o16','o17','o18','o19','o20','o1'];
    var pts = ring.map(function (id) { return E.NODE_POS[id].x + ',' + E.NODE_POS[id].y; }).join(' ');
    var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', pts);
    poly.setAttribute('class', 'ringLine');
    svg.appendChild(poly);
    [['o5', 'o15'], ['o10', 'o20']].forEach(function (pair) {
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      var p0 = E.NODE_POS[pair[0]], p1 = E.NODE_POS[pair[1]];
      line.setAttribute('x1', p0.x); line.setAttribute('y1', p0.y);
      line.setAttribute('x2', p1.x); line.setAttribute('y2', p1.y);
      line.setAttribute('class', 'diagLine');
      svg.appendChild(line);
    });
    boardEl.appendChild(svg);

    E.NODE_ORDER.forEach(function (id) {
      var pos = E.NODE_POS[id];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'node' + (id === 'C' ? ' nodeCenter' : /^o(5|10|15|20)$/.test(id) ? ' nodeCorner' : '');
      btn.style.left = (pos.x / 5) + '%';
      btn.style.top = (pos.y / 5) + '%';
      btn.dataset.node = id;
      btn.setAttribute('aria-label', nodeKoreanLabel(id) + ' 칸');
      btn.addEventListener('click', function () { onNodeClick(id); });
      boardEl.appendChild(btn);
    });

  }

  function nodeKoreanLabel(id) {
    if (id === 'C') return '중앙';
    if (id === 'o5') return '우상단 모서리(o5)';
    if (id === 'o10') return '좌상단 모서리(o10)';
    if (id === 'o15') return '좌하단 모서리(o15)';
    if (id === 'o20') return '우하단 모서리(o20, 출구)';
    return id;
  }

  function renderPieces() {
    boardEl.querySelectorAll('.tokenStack').forEach(function (n) { n.remove(); });
    ['CHEONG', 'HONG'].forEach(function (team) {
      var byPos = {};
      state.pieces[team].forEach(function (p, idx) {
        if (p.pos === 'OUT' || p.pos === 'FINISH') return;
        byPos[p.pos] = byPos[p.pos] || [];
        byPos[p.pos].push(idx);
      });
      Object.keys(byPos).forEach(function (pos) {
        var idxs = byPos[pos];
        var el = document.createElement('div');
        el.className = 'tokenStack ' + (team === 'CHEONG' ? 'teamCheong' : 'teamHong');
        var p = E.NODE_POS[pos];
        el.style.left = (p.x / 5) + '%';
        el.style.top = (p.y / 5) + '%';
        el.textContent = (team === 'CHEONG' ? '청' : '홍') + idxs.map(function(i){ return i + 1; }).join('+');
        boardEl.appendChild(el);
      });
    });
  }

  function renderSticks(bits) {
    sticksEl.innerHTML = '';
    bits.forEach(function (b) {
      var s = document.createElement('div');
      s.className = 'stick ' + (b === null ? 'unthrown' : b ? 'flat' : 'round');
      s.setAttribute('aria-label', b === null ? '던지기 전' : b ? '평평한 면' : '둥근 면');
      s.textContent = b === 1 ? '×' : '';
      s.setAttribute('role', 'img');
      sticksEl.appendChild(s);
    });
  }

  function renderResults() {
    resultsEl.innerHTML = '';
    state.queue.forEach(function (chip, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.disabled = state.canRoll || !!state.winner;
      b.className = 'chip' + (idx === selectedResult ? ' chipSelected' : '');
      b.textContent = chip.label + '(' + chip.value + ')';
      b.setAttribute('aria-label', chip.label + ' 결과, ' + chip.value + '칸 이동');
      b.addEventListener('click', function () {
        selectedResult = (selectedResult === idx) ? null : idx;
        selectedPiece = null;
        render();
      });
      resultsEl.appendChild(b);
    });
  }

  function renderReserve() {
    reserveEl.innerHTML = '';
    ['CHEONG', 'HONG'].forEach(function (team) {
      var out = state.pieces[team].filter(function (p) { return p.pos === 'OUT'; }).length;
      var fin = state.pieces[team].filter(function (p) { return p.pos === 'FINISH'; }).length;
      var row = document.createElement('div');
      row.className = 'reserveRow';
      row.textContent = teamLabel(team) + ' - 대기 ' + out + ' / 완주 ' + fin + ' / 4';
      reserveEl.appendChild(row);
      var tray = document.createElement('div'); tray.className = 'reserveTray';
      state.pieces[team].forEach(function(p,idx){
        if(p.pos !== 'OUT') return;
        var b = document.createElement('button'); b.type='button';
        b.textContent=(team === 'CHEONG' ? '청' : '홍')+(idx+1);
        b.className='reserveToken '+(team==='CHEONG'?'teamCheong':'teamHong')+(selectedPiece===idx&&state.turn===team?' chosen':'');
        b.setAttribute('aria-label',teamLabel(team)+' '+(idx+1)+'번 말 대기');
        b.disabled=team!==state.turn||selectedResult===null||state.canRoll||!!state.winner;
        b.addEventListener('click',function(){selectedPiece=idx;render();});tray.appendChild(b);
      }); reserveEl.appendChild(tray);
    });
  }

  function renderPieceButtons() {
    boardEl.querySelectorAll('.pieceBtnLayer').forEach(function (n) { n.remove(); });
    if (selectedResult === null || state.winner) return;
    var team = state.turn;
    var choices = E.moves(state, selectedResult);
    var seen = {};
    choices.forEach(function (idx) {
      var p = state.pieces[team][idx];
      if(p.pos === 'OUT') return;
      var key = p.pos + '|' + team;
      if (seen[key]) return;
      seen[key] = true;
      var pos = E.NODE_POS[p.pos] || E.NODE_POS.OUT;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pieceBtnLayer pieceSelectBtn' + (selectedPiece === idx ? ' pieceSelected' : '');
      btn.style.left = (pos.x / 5) + '%';
      btn.style.top = (pos.y / 5) + '%';
      var stackCount = state.pieces[team].filter(function (q) { return q.pos === p.pos; }).length;
      btn.setAttribute('aria-label', teamLabel(team) + ' 말 (' + nodeKoreanLabel(p.pos === 'OUT' ? 'OUT' : p.pos) + ', ' + stackCount + '개 묶음) 선택');
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        selectedPiece = idx;
        render();
      });
      boardEl.appendChild(btn);
    });
  }

  function renderPreview() {
    boardEl.querySelectorAll('.previewMark').forEach(function (n) { n.remove(); });
    if (selectedResult === null || selectedPiece === null || state.winner) return;
    var chip = state.queue[selectedResult];
    if (!chip) return;
    var piece = state.pieces[state.turn][selectedPiece];
    if (!piece) return;
    var path = E.computePath(piece.pos, chip.value);
    var dest = path[path.length - 1];
    if (dest === 'FINISH') return;
    var pos = E.NODE_POS[dest];
    var mark = document.createElement('div');
    mark.className = 'previewMark';
    mark.style.left = (pos.x / 5) + '%';
    mark.style.top = (pos.y / 5) + '%';
    boardEl.appendChild(mark);
  }

  function onNodeClick(nodeId) {
    if (selectedResult === null || state.winner) return;
    var team = state.turn;
    var choices = E.moves(state, selectedResult);
    var match = choices.find(function (idx) { return state.pieces[team][idx].pos === nodeId; });
    if (match !== undefined) {
      selectedPiece = match;
      render();
    }
  }

  function doMove(resultIndex, pieceIndex) {
    var ok = E.move(state, resultIndex, pieceIndex);
    if (ok) {
      selectedResult = null;
      selectedPiece = null;
    }
    render();
  }

  function doRoll() {
    if (!state.canRoll || state.winner) return;
    var bits = [0, 0, 0, 0].map(function () { return Math.random() < 0.5 ? 1 : 0; });
    var flatCount = bits.reduce(function (a, b) { return a + b; }, 0);
    E.roll(state, flatCount);
    state.lastRoll.bits = bits;
    selectedResult = null; selectedPiece = null;
    render();
  }

  function updateInstruction() {
    if (state.winner) {
      instructionEl.textContent = teamLabel(state.winner) + ' 승리! 새 게임을 시작하세요.';
      return;
    }
    if (state.canRoll && state.queue.length === 0) {
      instructionEl.textContent = teamLabel(state.turn) + '의 차례입니다. 윷을 던지세요.';
    } else if (state.canRoll) {
      instructionEl.textContent = '추가 던지기를 먼저 마친 뒤 결과와 말을 고르세요.';
    } else if (selectedResult === null) {
      instructionEl.textContent = '이동할 결과를 먼저 선택하세요.';
    } else if (selectedPiece === null) {
      instructionEl.textContent = '판 위 말이나 대기 말을 고르세요.';
    } else {
      instructionEl.textContent = '도착할 칸을 확인하고 ‘선택한 말 이동’을 누르세요.';
    }
  }

  function renderLog() {
    logEl.innerHTML = state.log.slice(-50).reverse().map(function (l) {
      return '<div>' + escapeHtml(l) + '</div>';
    }).join('');
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function render() {
    teamLabelEl.textContent = teamLabel(state.turn) + ' 차례';
    teamLabelEl.className = state.turn === 'CHEONG' ? 'teamPill teamCheongBg' : 'teamPill teamHongBg';
    renderSticks(state.lastRoll ? (state.lastRoll.bits || [0,1,2,3].map(function(i){return i < state.lastRoll.flatCount ? 1 : 0;})) : [null,null,null,null]);
    document.getElementById('moveBtn').disabled = state.canRoll || selectedResult === null || selectedPiece === null || !!state.winner;
    lastResultEl.textContent = state.lastRoll ? ('마지막 결과: ' + state.lastRoll.label + ' (' + state.lastRoll.value + '칸)') : '마지막 결과: 없음';
    rollBtn.disabled = !state.canRoll || !!state.winner;
    renderResults();
    renderReserve();
    renderPieces();
    renderPieceButtons();
    renderPreview();
    updateInstruction();
    renderLog();
    undoBtn.disabled = !state.history || state.history.length === 0;
    winnerBanner.hidden = !state.winner;
    winnerBanner.textContent = state.winner ? (teamLabel(state.winner) + ' 승리!') : '';
  }

  rollBtn.addEventListener('click', doRoll);
  undoBtn.addEventListener('click', function () {
    if (E.undo(state)) {
      selectedResult = null;
      selectedPiece = null;
      render();
    }
  });
  document.getElementById('moveBtn').addEventListener('click',function(){doMove(selectedResult,selectedPiece);});
  var resetDialog=document.getElementById('resetDialog');
  newGameBtn.addEventListener('click',function(){resetDialog.hidden=false;document.getElementById('cancelReset').focus();});
  document.getElementById('cancelReset').addEventListener('click',function(){resetDialog.hidden=true;newGameBtn.focus();});
  document.getElementById('confirmReset').addEventListener('click',function(){state=E.createState();selectedResult=null;selectedPiece=null;resetDialog.hidden=true;render();rollBtn.focus();});
  resetDialog.addEventListener('keydown',function(e){if(e.key==='Escape'){resetDialog.hidden=true;newGameBtn.focus();}});
  helpToggle.addEventListener('click', function () {
    var expanded = helpToggle.getAttribute('aria-expanded') === 'true';
    helpToggle.setAttribute('aria-expanded', String(!expanded));
    helpBody.hidden = expanded;
  });

  buildBoard();
  render();
})();
