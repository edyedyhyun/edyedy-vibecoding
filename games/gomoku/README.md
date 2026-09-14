# 한 수 쉬어 가는 오목

오프라인에서 동작하는 HTML5 로컬 2인용 오목(五目) 게임입니다. 외부 자산이나 네트워크 요청 없이 동작합니다.

## 규칙

- 15×15 교차점 위에 흑돌이 먼저 두고 이후 번갈아 착수합니다.
- **자유 오목**: 가로/세로/두 대각선 방향으로 5개 이상 연속된 돌이면 승리합니다 (장목 승리 포함).
- **금수 없음**: 삼삼, 사사, 장목 등 어떤 금지 수도 없습니다.
- AI 상대나 시간 제한이 없는 순수 2인용 게임입니다.

## 파일 구성

- `engine.js` — UI와 완전히 분리된 순수 게임 로직 (CommonJS `module.exports` 및 `window.GomokuEngine` 양쪽 지원).
- `app.js` — DOM 렌더링, 입력 처리(마우스/터치/키보드), 접근성 로직.
- `index.html` — 마크업과 인라인 CSS, `engine.js`/`app.js`를 `<script src>`로 불러옵니다.
- `build.py` — `index.html`에 `engine.js`와 `app.js`를 인라인으로 삽입해 단일 파일 `gomoku.html`을 생성하는 빌드 스크립트.
- `gomoku.html` — 배포/공유용 단일 파일 산출물 (외부 의존성 없음, 더블클릭으로 바로 실행 가능).

## 실행 방법

- 개발 중: `index.html`을 브라우저로 열면 `engine.js`, `app.js`를 각각 로드합니다.
- 배포용 단일 파일 재생성: `python3 build.py` 실행 후 `gomoku.html` 확인.

## 엔진 API

```js
const state = GomokuEngine.createState();
GomokuEngine.place(state, row, col); // boolean 반환
GomokuEngine.undo(state);            // boolean 반환
GomokuEngine.reset(state);           // state를 초기 상태로 되돌림
```

`state` 구조:

```js
{
  board: number[15][15], // 0 빈칸, 1 흑, 2 백
  turn: 1 | 2,
  moves: { row, col, player }[],
  status: 'playing' | 'won' | 'draw',
  winner: 0 | 1 | 2,
  winningCells: { row, col }[]
}
```

`place`는 범위를 벗어나거나 정수가 아닌 좌표, 이미 돌이 있는 칸, 게임이 이미 끝난 상태에서의 호출을 모두 거부하고 `false`를 반환하며 상태를 변경하지 않습니다.

## UI 동작 요약

- 판은 접근 가능한 버튼 그리드(`role="grid"`/`role="gridcell"`)로 구성되며, 방향키로 이동하는 로빙 탭인덱스와 `Home`/`End`(행 끝 이동), `Enter`/`Space`(착수)를 지원합니다.
- 마지막 착수는 코랄색 마커로, 승리 시 연결된 돌은 코랄 테두리로 강조됩니다.
- 승리 또는 무승부가 확정되면 추가 착수가 막힙니다.
- "한 수 무르기"는 승리 이후에도 포함해 마지막 한 수를 되돌리며, 되돌리면 상태가 다시 진행중으로 바뀝니다. 기록이 없으면 버튼이 비활성화됩니다.
- "새 게임"은 이미 둔 수가 있으면 네이티브 `confirm` 대화상자로 확인하며, 취소 시 보드를 그대로 유지합니다.
- 1280px 데스크톱부터 320px 폭 모바일까지 반응형 레이아웃을 지원합니다.

## 검증

`node --test test-engine.js`: 착수 거부, 교대, 네 방향 승리, 장목, 무승부, 무르기와 초기화 등 10개 검사. 브라우저에서 실제 착수·중복 착수 거부·무르기·9수째 승리·승리 후 착수 차단·새 게임·키보드 착수를 확인했습니다.
