# 벽돌깨기 (Breakout)

공 하나, 벽돌 한 판. 오프라인 HTML5 벽돌깨기 게임입니다.

## 실행 방법

- `breakout.html`을 원본 파일로 내려받아 PC 브라우저로 열면 됩니다. 인터넷 연결이나 다른 파일은 필요 없습니다.
- 개발용 `index.html`은 `engine.js`, `app.js`와 같은 폴더에서 열면 됩니다.
- 또는 `python3 build.py`를 실행하면 모든 자원이 인라인된 단일 파일 `breakout.html`이 생성됩니다. 이 파일은 다른 파일 없이 그 자체로 동작합니다.

## 조작법

- 좌/우 화살표 또는 A/D: 패들 이동
- 마우스 드래그 / 터치 드래그: 패들 이동
- 스페이스바: 공 발사, 다음 공 이어하기, 일시정지 해제
- P: 일시정지 / 재개
- R: 재시작 (텍스트 입력 요소에 포커스가 있을 때는 동작하지 않음)
- 화면 버튼: 시작/다음 공/다시 하기, 일시정지/계속하기

브라우저 탭이 백그라운드로 전환되거나(blur) 숨겨지면(visibilitychange) 자동으로 일시정지되며, 명시적으로 재개해야 이어집니다.

## 파일 구성

- `engine.js` — 순수 물리/상태 엔진. DOM에 의존하지 않으며 UMD로 내보내져 `window.BreakoutEngine` 또는 CommonJS `require`로 사용할 수 있습니다.
- `app.js` — DOM 렌더링, 입력 처리, HUD 갱신 등 화면과 엔진을 연결하는 얇은 레이어.
- `index.html` — 게임 UI 마크업과 스타일.
- `build.py` — `engine.js`/`app.js`를 `index.html`에 인라인하여 `breakout.html` 단일 파일을 생성하는 표준 라이브러리 전용 빌드 스크립트.

## 엔진 공개 API (`engine.js`)

### 상수

- `WIDTH`, `HEIGHT` — 가상 캔버스 크기 (960×600)
- `PADDLE_WIDTH`, `PADDLE_HEIGHT`, `PADDLE_Y`, `PADDLE_SPEED`
- `BALL_RADIUS`, `BALL_SPEED_START`, `BALL_SPEED_MAX`
- `BRICK_ROWS` (6), `BRICK_COLS` (10), `BRICK_WIDTH`, `BRICK_HEIGHT`, `BRICK_SCORE` (10)
- `LIVES_START` (3), `FIXED_DT` (1/120)
- `STATUS` — 상태 열거값: `READY`, `PLAYING`, `PAUSED`, `WON`, `LOST_BALL`, `GAME_OVER`

### 함수

- `createState()` — 새 게임 상태 객체를 생성합니다.
- `reset(state)` — 상태를 초기 구성으로 되돌립니다(같은 객체를 in-place로 갱신).
- `launch(state)` — `READY` 또는 `LOST_BALL` 상태에서 공을 발사하고 `PLAYING`으로 전환합니다.
- `pause(state)` / `resume(state)` — `PLAYING` ↔ `PAUSED` 전환.
- `step(state, dt, input)` — `dt`초만큼 시뮬레이션을 진행합니다. `input`은 `{ left: bool, right: bool }`.

### 상태(state) 구조

```
{
  status: STATUS.*,
  paddle: { x, y, w, h },
  ball: { x, y, vx, vy, r },
  bricks: [{ x, y, w, h, row, col, alive }],  // 6*10 = 60개
  score: number,
  lives: number,
  bricksRemaining: number
}
```

### 게임 규칙 요약

- 벽돌은 6행 × 10열, 벽돌 1개당 1회 충돌로 파괴되며 10점을 획득합니다.
- 목숨은 3개로 시작하며, 공이 화면 하단으로 떨어지면 1개가 줄고 `LOST_BALL` 상태로 전환되어 다음 발사를 기다립니다. 목숨이 0이 되면 `GAME_OVER`.
- 모든 벽돌이 파괴되면 `WON` 상태가 되어 게임이 종료됩니다.
- `WON`/`GAME_OVER` 상태는 명시적인 재시작 전까지 완전히 정지(frozen)합니다.
- 패들-공 충돌은 착지 위치로 반사 각도를 조절합니다: 패들 중앙에 맞으면 수직으로, 좌/우 가장자리로 갈수록 수직 기준 최대 ±60°까지 좌우로 꺾여 반사됩니다(속력은 유지, 최소 상향 성분 보장). 위에서 아래로 내려오는 공만 충돌 처리되어, 이미 패들 아래로 지나간 공을 다시 퍼올리지 않습니다.
- 공은 `FIXED_DT`(1/120초) 단위 및 서브스텝(스윕 방식)으로 이동하여 얇은 패들/벽돌을 통과(터널링)하는 문제를 방지합니다.
- 공의 속력은 `BALL_SPEED_MAX`(약 460 px/s)로 제한됩니다.

## 테스트

엔진은 물리/상태 로직을 DOM과 완전히 분리해 두었으므로, `engine.js`를 직접 `require`하거나 브라우저에 로드해 `BreakoutEngine`을 대상으로 결정론적 단위 테스트를 작성할 수 있습니다. `node --test engine.test.js`로 포함된 규칙 검사를 실행할 수 있습니다.
