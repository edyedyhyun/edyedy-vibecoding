/*
 * 윷 한 판 - 게임 엔진 (순수 함수/상태 머신, DOM 의존 없음)
 *
 * 보드 그래프: 외곽 20칸(o1~o20, 반시계 방향) + 대각선 지름길 8칸(a1,a2,a4,a5 / b1,b2,b4,b5) + 중앙(C) = 29개 노드.
 *   - o5(우상단 모서리), o10(좌상단 모서리), o15(좌하단 모서리), o20(우하단 모서리/출구)
 *   - "말이 그 모서리에서 이동을 시작할 때만" 지름길 사용: o5에서 시작 -> a1,a2,C,a4,a5,o15 (o15부터 다시 외곽)
 *     o10에서 시작 -> b1,b2,C,b4,b5,o20 (o20 도착 후 다음 한 칸에 완주)
 *   - 중앙(C)에서 말이 쉬고 있다가 새로 이동을 시작하면 항상 b4 방향(우하단, "B" 경로)으로 진행한다.
 *   - 같은 이동(한 번의 이동) 안에서 지나가는 경우는 원래 경로 방향을 유지한다 (a2->C->a4 또는 b2->C->b4).
 *
 * 상태(state) 모양:
 * {
 *   turn: 'CHEONG' | 'HONG',
 *   pieces: { CHEONG: [{pos}], HONG: [{pos}] },   // pos: 'OUT' | 노드id | 'FINISH', 4개씩
 *   queue: [{value, label}],                       // 아직 사용하지 않은 던지기 결과들(순서 무관, 개별 선택)
 *   canRoll: boolean,                               // 지금 (다시) 던질 수 있는지
 *   pendingBonusExtraRoll: boolean,                 // 잡기로 얻은 보너스 던지기가 남아있는지
 *   lastRoll: {flatCount, value, label} | null,
 *   winner: 'CHEONG' | 'HONG' | null,
 *   log: [string],
 * }
 *
 * 공개 API:
 *   createState()                         -> 새 게임 상태
 *   roll(state, flatCount)                -> state (변형됨). flatCount: 0~4 (뒤집힌/평평한 면 개수)
 *   moves(state, resultIndex)             -> 그 결과로 움직일 수 있는 pieceIndex 배열
 *   move(state, resultIndex, pieceIndex)  -> boolean (성공 여부), state 변형
 *   undo(state)                           -> boolean (되돌릴 수 있었는지), state 변형
 *   NODE_POS                              -> {nodeId: {x,y}} 500x500 좌표 (렌더링용)
 *   NODE_ORDER                             -> 노드 id 배열 (렌더링 순회용)
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  }
  root.YutEngine = mod;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var FACE_BY_FLAT = {
    1: { value: 1, label: '도' },
    2: { value: 2, label: '개' },
    3: { value: 3, label: '걸' },
    4: { value: 4, label: '윷' },
    0: { value: 5, label: '모' },
  };

  var RING = ['o1','o2','o3','o4','o5','o6','o7','o8','o9','o10',
              'o11','o12','o13','o14','o15','o16','o17','o18','o19','o20'];

  var NEXT_DEFAULT = { OUT: 'o1' };
  for (var i = 0; i < RING.length; i++) {
    NEXT_DEFAULT[RING[i]] = (i + 1 < RING.length) ? RING[i + 1] : 'FINISH';
  }
  NEXT_DEFAULT.a1 = 'a2';
  NEXT_DEFAULT.a4 = 'a5';
  NEXT_DEFAULT.a5 = 'o15';
  NEXT_DEFAULT.b1 = 'b2';
  NEXT_DEFAULT.b4 = 'b5';
  NEXT_DEFAULT.b5 = 'o20';
  NEXT_DEFAULT.FINISH = 'FINISH';

  function lerp(p0, p1, t) {
    return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
  }

  var CORNER = { o5: { x: 460, y: 40 }, o10: { x: 40, y: 40 }, o15: { x: 40, y: 460 }, o20: { x: 460, y: 460 } };
  var NODE_POS = { OUT: { x: 500, y: 500 } };
  var order = ['o1','o2','o3','o4'];
  for (i = 0; i < 4; i++) NODE_POS[order[i]] = lerp({ x: 460, y: 460 }, CORNER.o5, (i + 1) / 5);
  NODE_POS.o5 = CORNER.o5;
  order = ['o6','o7','o8','o9'];
  for (i = 0; i < 4; i++) NODE_POS[order[i]] = lerp(CORNER.o5, CORNER.o10, (i + 1) / 5);
  NODE_POS.o10 = CORNER.o10;
  order = ['o11','o12','o13','o14'];
  for (i = 0; i < 4; i++) NODE_POS[order[i]] = lerp(CORNER.o10, CORNER.o15, (i + 1) / 5);
  NODE_POS.o15 = CORNER.o15;
  order = ['o16','o17','o18','o19'];
  for (i = 0; i < 4; i++) NODE_POS[order[i]] = lerp(CORNER.o15, CORNER.o20, (i + 1) / 5);
  NODE_POS.o20 = CORNER.o20;

  NODE_POS.a1 = lerp(CORNER.o5, CORNER.o15, 1 / 6);
  NODE_POS.a2 = lerp(CORNER.o5, CORNER.o15, 2 / 6);
  NODE_POS.C = lerp(CORNER.o5, CORNER.o15, 3 / 6);
  NODE_POS.a4 = lerp(CORNER.o5, CORNER.o15, 4 / 6);
  NODE_POS.a5 = lerp(CORNER.o5, CORNER.o15, 5 / 6);

  NODE_POS.b1 = lerp(CORNER.o10, CORNER.o20, 1 / 6);
  NODE_POS.b2 = lerp(CORNER.o10, CORNER.o20, 2 / 6);
  NODE_POS.b4 = lerp(CORNER.o10, CORNER.o20, 4 / 6);
  NODE_POS.b5 = lerp(CORNER.o10, CORNER.o20, 5 / 6);

  var NODE_ORDER = RING.concat(['a1','a2','a4','a5','b1','b2','b4','b5','C']);

  function createState() {
    return {
      turn: 'CHEONG',
      pieces: {
        CHEONG: [0, 1, 2, 3].map(function () { return { pos: 'OUT' }; }),
        HONG: [0, 1, 2, 3].map(function () { return { pos: 'OUT' }; }),
      },
      queue: [],
      canRoll: true,
      pendingBonusExtraRoll: false,
      lastRoll: null,
      winner: null,
      log: [],
      history: [],
    };
  }

  function clone(state) {
    return JSON.parse(JSON.stringify({
      turn: state.turn, pieces: state.pieces, queue: state.queue,
      canRoll: state.canRoll, pendingBonusExtraRoll: state.pendingBonusExtraRoll,
      lastRoll: state.lastRoll, winner: state.winner, log: state.log,
    }));
  }

  function pushHistory(state) {
    state.history.push(clone(state));
    if (state.history.length > 200) state.history.shift();
  }

  function teamName(t) { return t === 'CHEONG' ? '청팀' : '홍팀'; }
  function otherTeam(t) { return t === 'CHEONG' ? 'HONG' : 'CHEONG'; }

  function nextNode(path) {
    var cur = path[path.length - 1];
    var prev = path.length > 1 ? path[path.length - 2] : null;
    if (cur === 'C') {
      if (path.length === 1) return 'b4';
      return prev === 'a2' ? 'a4' : 'b4';
    }
    if (cur === 'o5' && path.length === 1) return 'a1';
    if (cur === 'o10' && path.length === 1) return 'b1';
    if (cur === 'a2') return 'C';
    if (cur === 'b2') return 'C';
    return NEXT_DEFAULT[cur];
  }

  function computePath(startPos, steps) {
    var path = [startPos === 'FINISH' ? 'FINISH' : startPos];
    for (var s = 0; s < steps; s++) {
      var cur = path[path.length - 1];
      if (cur === 'FINISH') break;
      path.push(nextNode(path));
      if (path[path.length - 1] === 'FINISH') break;
    }
    return path;
  }

  function piecesAt(state, team, pos) {
    var out = [];
    state.pieces[team].forEach(function (p, idx) { if (p.pos === pos) out.push(idx); });
    return out;
  }

  function roll(state, flatCount) {
    if (state.winner) return state;
    if (!state.canRoll || !Number.isInteger(flatCount) || flatCount < 0 || flatCount > 4) return state;
    pushHistory(state);
    var face = FACE_BY_FLAT[flatCount];
    state.queue.push({ value: face.value, label: face.label });
    state.lastRoll = { flatCount: flatCount, value: face.value, label: face.label };
    state.log.push(teamName(state.turn) + ': ' + face.label + ' (' + face.value + '칸) 결과 추가');
    state.pendingBonusExtraRoll = false;
    state.canRoll = face.value >= 4;
    return state;
  }

  function moves(state, resultIndex) {
    if (state.winner) return [];
    if (state.canRoll || !Number.isInteger(resultIndex) || resultIndex < 0 || resultIndex >= state.queue.length) return [];
    var team = state.turn;
    var out = [];
    state.pieces[team].forEach(function (p, idx) { if (p.pos !== 'FINISH') out.push(idx); });
    return out;
  }

  function move(state, resultIndex, pieceIndex) {
    if (state.winner) return false;
    if (state.canRoll || !Number.isInteger(resultIndex) || resultIndex < 0 || resultIndex >= state.queue.length || !Number.isInteger(pieceIndex)) return false;
    var team = state.turn;
    var piece = state.pieces[team][pieceIndex];
    if (!piece || piece.pos === 'FINISH') return false;

    pushHistory(state);
    var chip = state.queue[resultIndex];
    var startPos = piece.pos;
    var path = computePath(startPos, chip.value);
    var dest = path[path.length - 1];
    var movingIdxs = startPos === 'OUT' ? [pieceIndex] : piecesAt(state, team, startPos);

    state.queue.splice(resultIndex, 1);

    if (dest === 'FINISH') {
      movingIdxs.forEach(function (idx) { state.pieces[team][idx].pos = 'FINISH'; });
      state.log.push(teamName(team) + ': ' + chip.label + '로 말 완주 (' + movingIdxs.length + '개)');
      var allFinished = state.pieces[team].every(function (p) { return p.pos === 'FINISH'; });
      if (allFinished) {
        state.winner = team;
        state.log.push(teamName(team) + ' 승리!');
      }
    } else {
      var opp = otherTeam(team);
      var oppAt = piecesAt(state, opp, dest);
      movingIdxs.forEach(function (idx) { state.pieces[team][idx].pos = dest; });
      state.log.push(teamName(team) + ': ' + chip.label + '로 이동 (' + movingIdxs.length + '개 말)');
      if (oppAt.length > 0) {
        oppAt.forEach(function (idx) { state.pieces[opp][idx].pos = 'OUT'; });
        state.log.push(teamName(team) + '이(가) ' + teamName(opp) + ' 말 ' + oppAt.length + '개를 잡았다!');
        if (chip.value >= 1 && chip.value <= 3) {
          state.pendingBonusExtraRoll = true;
        }
      }
    }

    if (state.winner) {
      state.canRoll = false;
    } else if (state.pendingBonusExtraRoll) {
      state.canRoll = true;
    } else if (state.queue.length === 0) {
      state.turn = otherTeam(team);
      state.canRoll = true;
    } else {
      state.canRoll = false;
    }
    return true;
  }

  function undo(state) {
    if (!state.history || state.history.length === 0) return false;
    var prev = state.history.pop();
    state.turn = prev.turn;
    state.pieces = prev.pieces;
    state.queue = prev.queue;
    state.canRoll = prev.canRoll;
    state.pendingBonusExtraRoll = prev.pendingBonusExtraRoll;
    state.lastRoll = prev.lastRoll;
    state.winner = prev.winner;
    state.log = prev.log;
    return true;
  }

  return {
    createState: createState,
    roll: roll,
    moves: moves,
    move: move,
    undo: undo,
    computePath: computePath,
    NODE_POS: NODE_POS,
    NODE_ORDER: NODE_ORDER,
  };
});
