# 블록 한 줄 (falling-blocks)

오프라인에서 동작하는 원본 낙하 블록 퍼즐입니다. 외부 자산/네트워크/오디오 없이
`index.html`, `engine.js`, `app.js`만으로 동작하며, `build.py`로 단일 파일
`falling-blocks.html`을 만들 수 있습니다.

## 실행

- 개발 중: `index.html`을 브라우저로 엽니다 (engine.js, app.js를 별도 로드).
- 배포용 단일 파일: `python3 build.py` 실행 후 `falling-blocks.html`을 엽니다.

## 조작

| 입력 | 동작 |
| --- | --- |
| ← / → | 좌우 이동 (DAS 150ms, 반복 45ms) |
| ↓ | 소프트 드롭 (누르는 동안 중력 가속) |
| ↑ 또는 X | 시계 방향 회전 |
| Space | 하드 드롭 |
| P | 일시정지 / 재개 |
| R | 리셋 |
| 화면 버튼 | 위 기능과 동일 (터치 지원, pointer capture) |

키보드 게임 키는 `preventDefault()`로 스크롤 및 포커스된 버튼의 네이티브
재활성화(Space/Enter 중복 트리거)를 막습니다.

## engine.js API

CommonJS(`module.exports`)와 `window.BlockEngine` 양쪽으로 노출되는 순수 로직
모듈입니다. DOM에 접근하지 않으며 모든 함수는 `state` 객체를 직접 변형한 뒤
반환합니다.

### 상수

`BOARD_W` (10), `BOARD_H` (20), `GRAVITY_MS` (700), `LOCK_DELAY_MS` (350),
`LOCK_MAX_RESETS` (15), `DAS_MS` (150), `REPEAT_MS` (45), `SCORE_TABLE`
(`{1:100, 2:300, 3:500, 4:800}`), `PIECE_TYPES`, `PIECE_IDS`.

### 함수

- `createState(seed)` — 시드 기반 결정적 초기 상태를 생성합니다 (mulberry32
  PRNG). 같은 시드는 항상 같은 7-bag 순서를 만듭니다.
- `start(state)` — 상태를 `running`으로 전환하고 첫 블록을 스폰합니다.
- `pause(state)` / `resume(state)` — `running` ↔ `paused` 전환.
- `reset(state, seed)` — 상태를 새 시드로 초기화(같은 객체를 재사용).
- `move(state, 'left' | 'right')` — 수평 이동, 접지 중이면 락 지연을 리셋.
- `rotate(state)` — 시계 방향 회전, 아래 "회전/킥" 설명 참고.
- `softDrop(state, boolean)` — 소프트 드롭 유지 여부 설정.
- `hardDrop(state)` — 즉시 착지 위치로 이동 후 고정.
- `step(state, dtSeconds)` — 중력/락 지연 진행. 매 프레임 호출.
- `landingY(state)` — 현재 블록이 하드 드롭 시 도달할 y 좌표(고스트/드롭 공용
  충돌 계산에 사용, 실제로 상태를 바꾸지 않음).

`move`, `rotate`, `softDrop`, `hardDrop`은 `state.status === 'running'`이고
`state.current`가 있을 때만 동작합니다(일시정지/게임오버 시 무시).

### 상태(state) 형태

```js
{
  board: number[20][10],   // 0=빈칸, 1..7=고정된 블록 색상 id
  current: { type, rot, x, y } | null,
  bagQueue: string[],       // 내부 7-bag 대기열(항상 next 미리보기 이상 유지)
  next: string[3],          // 다음 3개 블록 종류 미리보기
  rngState: number,         // 시드 PRNG 내부 상태
  score: number,
  lines: number,
  status: 'idle' | 'running' | 'paused' | 'gameover',
  gravityAcc: number,       // 다음 중력 틱까지 누적된 ms
  lockAcc: number | null,   // 접지 후 누적된 ms (접지 아니면 null)
  lockResets: number,       // 현재 블록의 락 지연 리셋 횟수
  softDrop: boolean
}
```

### 회전과 킥

전체 SRS(Super Rotation System)를 구현하지 않았습니다. 회전 시
`[0, -1, +1, -2, +2]` 순서의 x축 오프셋과 위로 1칸(`y:-1`) 오프셋을 순서대로
시도해 충돌하지 않는 첫 위치를 채택하는 단순화된 킥만 지원합니다. 벽/바닥
근처에서 자연스러운 회전을 돕는 정도이며, T-스핀 등 SRS 특유의 동작은
재현하지 않습니다.

### 락 지연(lock delay)

블록이 접지하면 `lockAcc`가 누적되기 시작합니다. `LOCK_DELAY_MS`(350ms)
이내에 좌우 이동이나 회전으로 착지 위치가 바뀌면 지연이 리셋됩니다.
`lockResets`는 현재 블록이 스폰된 이후 사용한 리셋 횟수를 세는 값으로,
바닥에서 떠오르거나 중력으로 내려가는 것만으로는 초기화되지 않고 오직 새
블록이 스폰될 때만 0으로 돌아갑니다. `LOCK_MAX_RESETS`(15회)를 넘기면 더
이상 리셋을 받지 않지만, 그렇다고 즉시 고정되지는 않습니다 — 남아있던
`lockAcc` 타이머가 `LOCK_DELAY_MS`까지 마저 진행되어야 고정됩니다. 리셋
예산을 다 쓴 상태에서 공중에 떠 있는 동안에는 `lockAcc`를 `null`로 지우지
않고 그대로 보존하므로, 킥으로 반복해서 공중에 띄워도 고정을 무한정
미룰 수 없습니다.

### 줄 삭제와 게임오버

새 블록은 보드 최상단(`y=0`)에 스폰되며, 스폰 위치가 이미 다른 블록과
충돌하면 `status`가 곧바로 `gameover`로 바뀝니다. `lockPiece`는 고정 직후
가득 찬 줄을 모두 지우고 점수를 더한 뒤 다음 블록을 스폰합니다. 회전 킥
등으로 블록의 일부가 보드 맨 위 칸(`y<0`)에서 고정되는 경우, 그 칸은
보드에 기록될 수 없으므로(=쌓인 블록이 보드를 넘침) 조용히 버리지 않고
`status`를 `gameover`로 바꿔 게임을 안전하게 종료합니다.

## app.js

`engine.js`가 만든 순수 상태를 렌더링하고 입력을 연결하는 계층입니다.

- 캔버스(`#board`)에 보드/현재 블록/고스트를 그립니다. 고스트는
  `landingY()`가 반환하는 좌표를 그대로 사용하므로 하드 드롭과 항상 같은
  결과를 보여줍니다(순수 시각 요소, 자체 충돌 계산 없음).
- 점수/줄/상태/다음 블록 이름은 값이 바뀔 때만 텍스트를 갱신합니다(매 프레임
  다시 쓰지 않음).
- `visibilitychange`/`blur` 시 자동으로 일시정지하고 DAS 상태와 소프트드롭을
  초기화합니다. P 키/버튼으로 수동 일시정지할 때도 동일하게 DAS 상태를
  지우므로, 일시정지 중 눌려 있던 방향키가 재개 순간 큐에 쌓인 반복
  이동으로 튀어나오지 않습니다. 재개는 항상 사용자가 P 키 또는 버튼으로
  명시적으로 눌러야 합니다.
- 방향키를 누른 시점의 `state.status`가 `running`이 아니면(일시정지/대기 중)
  DAS 타이머를 새로 걸지 않습니다 — 그렇지 않으면 일시정지 중 누른 키가
  재개 후 지연 없이 즉시 반복 이동으로 처리될 수 있습니다.
- 터치 버튼은 `pointerdown`/`pointerup`/`pointercancel`/`pointerleave`로
  눌림 상태를 추적하며 `setPointerCapture`를 사용합니다. 키보드로 버튼에
  포커스를 두고 Enter/Space로 활성화하면 pointer 이벤트 없이 `click`만
  발생하므로, `click` 핸들러를 추가해 이 경우에만(누름+뗌을 즉시 실행)
  동작을 실행합니다. 실제 포인터 클릭 뒤에도 `click`이 한 번 더 발생하지만
  `MouseEvent.detail`이 0보다 큰 값으로 오므로(키보드로 합성된 클릭은
  `detail === 0`) 중복 실행 없이 걸러냅니다.
- 시작 버튼은 `status === 'idle'`일 때만 활성화됩니다. 실행/일시정지/게임오버
  상태에서 `start()`는 아무 효과가 없으므로 버튼도 비활성 상태로 맞춰
  둡니다(게임오버에서 다시 시작하려면 리셋을 눌러야 합니다).

## 결정적 테스트를 위한 사용 예

```js
const Engine = require('./engine.js');
const state = Engine.createState(42);
Engine.start(state);
Engine.step(state, 0.1);
Engine.move(state, 'left');
```

같은 시드로 생성한 두 상태는 동일한 블록 순서와 동일한 물리 결과를
보장합니다.

## 검증

`node --test test-engine.js`로 14개 엔진 검사를 실행합니다. 줄 1~4개 삭제와 점수, 회전 경계, 착지 예상 위치, 종료, 일시정지, 낙하와 고정 지연 등을 확인합니다. 브라우저 UI에서는 회전과 하드 드롭으로 실제 한 줄을 삭제해 100점을 확인했고, 블록 누적 시 종료도 확인했습니다.
