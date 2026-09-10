/*
 * engine.js 대상 유닛 테스트.
 * Node.js 내장 테스트 러너(node:test)만 사용하며 외부 패키지 의존 없음.
 * 실행: node --test engine.test.js  (혹은 node --test)
 *
 * 이 파일을 작성한 사람은 로컬에서 실행/통과 여부를 확인하지 않았다.
 * 실제 실행 및 결과 확인은 사용자가 수행한다.
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var engine = require('./engine.js');

function snakeCells(state) {
  return state.snake.map(function (seg) {
    return seg.x + ',' + seg.y;
  });
}

test('회귀 버그: UP 예약 후 같은 틱에 LEFT를 눌러도 UP만 적용되어야 한다', function () {
  var s = engine.createGame(20);
  engine.startGame(s);
  var beforeDirection = s.direction; // 'RIGHT'
  engine.setDirection(s, 'UP');
  engine.setDirection(s, 'LEFT'); // 이미 UP이 예약돼 있으므로 무시되어야 함
  engine.tick(s);

  assert.equal(beforeDirection, 'RIGHT');
  assert.equal(s.direction, 'UP');
  assert.notEqual(s.status, 'gameover');
});

test('정반대 방향으로의 직접 반전은 거부된다', function () {
  var s = engine.createGame(20);
  engine.startGame(s); // 초기 방향 RIGHT
  engine.setDirection(s, 'LEFT'); // RIGHT의 정반대이므로 무시되어야 함
  engine.tick(s);

  assert.equal(s.direction, 'RIGHT');
  assert.notEqual(s.status, 'gameover');
});

test('같은 방향 입력은 회전 예약을 소모하지 않는다', function () {
  var s = engine.createGame(20);
  engine.startGame(s); // 초기 방향 RIGHT
  engine.setDirection(s, 'RIGHT'); // 현재 방향과 동일 -> 예약되지 않아야 함
  engine.setDirection(s, 'UP'); // 여전히 예약 슬롯이 비어 있으므로 이 회전이 들어가야 함
  engine.tick(s);

  assert.equal(s.direction, 'UP');
});

test('같은 회전 키를 연타해도 틱당 회전은 한 번만 반영된다', function () {
  var s = engine.createGame(20);
  engine.startGame(s);
  engine.setDirection(s, 'UP');
  engine.setDirection(s, 'UP'); // 중복 입력, pendingDirection을 다시 세팅하지 않아야 함
  engine.tick(s);

  assert.equal(s.direction, 'UP');
  assert.notEqual(s.status, 'gameover');
});

test('먹이를 먹으면 점수가 오르고 몸 길이가 늘어나며 새 먹이가 배치된다', function () {
  var s = engine.createGame(10);
  engine.startGame(s);
  var head = s.snake[0];
  var beforeLength = s.snake.length;
  // 머리 바로 오른쪽에 먹이를 강제로 배치 (현재 진행 방향 RIGHT)
  s.food = { x: head.x + 1, y: head.y };

  engine.tick(s);

  assert.equal(s.score, 10);
  assert.equal(s.snake.length, beforeLength + 1);
  assert.notEqual(s.food, null);
  assert.notEqual(s.status, 'gameover');
});

test('꼬리가 비워지는 칸으로 이동하는 것은 충돌로 취급하지 않는다', function () {
  var s = {
    gridSize: 10,
    snake: [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
      { x: 4, y: 5 }
    ],
    direction: 'UP',
    pendingDirection: null,
    food: { x: 9, y: 9 }, // 이동 경로와 무관한 위치
    score: 0,
    status: 'running'
  };

  engine.setDirection(s, 'LEFT'); // UP 기준 유효한 회전
  engine.tick(s);

  assert.notEqual(s.status, 'gameover');
  assert.deepEqual(snakeCells(s), ['4,5', '5,5', '5,6', '4,6']);
});

test('꼬리가 아닌 몸통 칸으로 이동하면 게임오버가 된다', function () {
  var s = {
    gridSize: 10,
    snake: [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
      { x: 4, y: 5 },
      { x: 4, y: 4 }
    ],
    direction: 'UP',
    pendingDirection: null,
    food: { x: 9, y: 9 },
    score: 0,
    status: 'running'
  };

  engine.setDirection(s, 'LEFT'); // 머리가 (4,5)로 이동 -> 꼬리가 아닌 몸통과 충돌
  engine.tick(s);

  assert.equal(s.status, 'gameover');
});

test('벽에 부딪히면 게임오버가 된다', function () {
  var s = {
    gridSize: 5,
    snake: [
      { x: 4, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 2 }
    ],
    direction: 'RIGHT',
    pendingDirection: null,
    food: { x: 0, y: 0 },
    score: 0,
    status: 'running'
  };

  engine.tick(s);

  assert.equal(s.status, 'gameover');
});

test('보드를 가득 채우면 cleared 상태로 종료된다', function () {
  var s = {
    gridSize: 2,
    snake: [
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 }
    ],
    direction: 'RIGHT',
    pendingDirection: null,
    food: { x: 1, y: 1 }, // 남은 마지막 한 칸
    score: 0,
    status: 'running'
  };

  engine.setDirection(s, 'DOWN'); // RIGHT 기준 유효한 회전
  engine.tick(s);

  assert.equal(s.status, 'cleared');
  assert.equal(s.snake.length, 4);
  assert.equal(s.food, null);
});

test('일시정지 상태에서는 tick이 아무것도 진행시키지 않는다', function () {
  var s = engine.createGame(20);
  engine.startGame(s);
  engine.pauseGame(s);
  var before = snakeCells(s);
  var beforeScore = s.score;

  engine.tick(s);

  assert.equal(s.status, 'paused');
  assert.deepEqual(snakeCells(s), before);
  assert.equal(s.score, beforeScore);
});

test('resetGame은 동일한 gridSize로 초기 상태를 새로 만든다', function () {
  var s = engine.createGame(15);
  engine.startGame(s);
  s.score = 50;
  engine.tick(s);

  var fresh = engine.resetGame(s);

  assert.equal(fresh.gridSize, 15);
  assert.equal(fresh.status, 'ready');
  assert.equal(fresh.score, 0);
  assert.equal(fresh.snake.length, 3);
});
