# 장기 한 판

한 화면에서 두 사람이 번갈아 두는 오프라인 장기. 서버·네트워크·AI 없음.

## 파일

- `engine.js` — 규칙 엔진 (UMD: 브라우저 `window.JanggiEngine` / Node `require`)
- `app.js` — UI (SVG 판 + 교차점마다 퍼센트 위치의 `<button>`)
- `index.html` — 개발용 진입점 (스크립트를 외부 파일로 참조)
- `build.py` — 표준 라이브러리만으로 `janggi.html` 단일 파일 생성: `python3 build.py`

## 좌표와 상태

row 0=위(한), 9=아래(초), col 0..8. 화면 라벨은 A~I(왼→오), 10~1(위→아래). 즉 `A1`=(9,0), `E9`... 는 `label(r,c)` = 열 문자 + (10-r).

```js
state = { board[10][9] of null|{side:'cho'|'han', type:'K'|'A'|'H'|'E'|'R'|'C'|'P'},
          turn, result: null|{winner:'cho'|'han'|null, reason}, history, log, lost, passes, setup }
```

`reason`: `checkmate | resign | bikjang | agreement | double-pass`.

## API

| 함수 | 설명 |
| --- | --- |
| `createState({setup})` | 초기 상태(초 선공). 기본 배치는 아래·위 모두 `차 마 상 사 . 사 상 마 차`, 왕 (8,4)/(1,4), 포 (7,1)(7,7)/(2,1)(2,7), 졸 6행/병 3행 열 0,2,4,6,8 |
| `createEmptyState(turn)` | 빈 판 (테스트 픽스처용; `state.board[r][c] = {...}`로 직접 배치) |
| `setSetup(state, side, left, right)` | `left`/`right` = `'HE'`(마·상) 또는 `'EH'`(상·마). 열 1,2 / 6,7의 화면상 왼→오 순서. 기본 left `HE`, right `EH`. 기록이 있으면 `false` |
| `pseudoMoves(state,r,c)` | 자기 왕 안전을 보지 않는 기물 규칙 이동 `[{r,c}]` |
| `pseudoAttacks(state,side)` | side가 공격하는 칸의 10×9 boolean 격자(왕 위치 포함) |
| `legalMoves(state,r,c)` | 자기 왕이 장군에 놓이지 않고, 빅장 중이면 마주 봄을 푸는 수만 |
| `move(state,fr,fc,tr,tc)` | 차례·합법성 검사 후 실행, 성공 시 `true` |
| `isCheck(state,side)`, `kingsFace(state)` | 장군 / 빅장(마주 봄) |
| `pass`, `canPass`, `bikjangDraw`, `agreeDraw`, `resign`, `undo` | 상태 변경. 모두 성공 여부 반환 |
| `explainNoMoves(state,r,c)` | 이동 불가 이유 문장 |

장군 판정은 `pseudoAttacks` 기반이라 `legalMoves`/외통 판정과 서로 재귀하지 않는다.

## 구현한 규칙

- 왕·사: 자기 궁성(행 0..2 / 7..9, 열 3..5) 안에서 직선 1칸 또는 그어진 대각선 1칸.
- 차: 직선 무제한, 궁성에서는 모서리-중앙-반대 모서리 대각선. 막히면 정지.
- 포: 반드시 포가 아닌 기물 정확히 하나를 넘어야 하며(빈 칸 이동·잡기 모두), 포를 넘거나 잡을 수 없다. 궁성 대각선은 모서리→반대 모서리로 중앙의 비(非)포 기물을 넘을 때만.
- 마: 직선 1 + 대각 1, 직선 첫 칸이 막히면 불가. 상: 직선 1 + 대각 2(3,2), 두 중간 지점 어느 쪽이든 막히면 불가.
- 졸/병: 앞 1칸 또는 옆 1칸, 뒤로 불가. 앞 대각은 실제 궁성 선 위에서만.
- 아군·왕은 잡을 수 없다(엔진은 왕을 잡는 수를 만들지 않고, 장군은 별도 공격 지도로 판정).
- 플라잉 제너럴식 장군은 없다. 왕끼리 마주 봄은 **빅장**이며 공격이 아니다.
- 빅장 응답: 마주 본 상태에서 차례인 쪽은 `빅장 수락`으로 무승부를 내거나, 마주 봄을 푸는 수를 둬야 한다. 장군과 동시에 걸려도 수락할 수 있다(이 프로그램의 결정). 이때 한 수 쉼은 불가.
- 외통: 장군 상태이고 빅장이 아니며 합법수가 없으면 상대 승. 왕을 직접 잡지 않는다.
- 한 수 쉼: 장군·빅장이 아닐 때만. 연속 두 번 쉬면 무승부(캐주얼 하우스 규칙).
- 반복 수에 의한 자동 판정은 **구현하지 않았다**. 대신 확인창이 있는 `무승부 합의` 버튼.
- 기권은 차례인 쪽이 한다(확인창). 새 게임도 확인창. 종료 후에는 착수 불가, `무르기`로 기권·무승부·쉼·이동을 모두 되돌릴 수 있다(잡힌 기물 포함).
- 점수 계산·시계·AI 없음. 초기 배치는 첫 수 전까지만 선택 가능(초·한 각각 좌/우 마상 순서 4가지 조합).

## 빌드와 확인

```sh
python3 build.py        # janggi.html 생성 (더블클릭으로 열림)
node -e "const E=require('./engine.js');const s=E.createState();console.log(E.move(s,6,0,5,0),s.turn)"
```

규칙 검증: `node --test test-engine.cjs` (18개 테스트). 마·상의 길막, 포의 다리와 잡기 제한, 궁성 대각선, 장군·빅장·외통, 배치와 무르기를 확인한다.

규칙 참고: https://www.pychess.org/variants/janggi
