# BUILD-NOTES

- 엔진(`engine.js`)은 DOM을 전혀 참조하지 않는 순수 함수 모음이며, UMD 스타일로 CommonJS(`module.exports`)와 브라우저(`window.ReversiEngine`) 양쪽에서 동일하게 동작하도록 작성했습니다.
- 상태(state) 객체는 `history` 배열에 매 수마다 전체 보드/턴/상태 스냅샷(깊은 복사)을 push하는 방식으로 undo를 구현했습니다. `undo`는 스냅샷을 pop하여 그대로 복원하므로 자동 패스·종료 판정까지 함께 되돌아갑니다.
- 자동 패스와 게임 종료 판정은 `play()` 내부의 `resolveTurn()`에서 매 수 이후 즉시 계산해 `notice` 문자열에 반영합니다.
- UI(`app.js`)는 실제 64개의 `<button role="gridcell">` 요소를 생성하고, 방향키 이동 시 `tabindex`를 하나만 0으로 유지하는 로빙 tabindex 패턴을 사용합니다. 클릭/포커스 이동 모두 동일한 `focusPos` 상태를 공유합니다.
- 뒤집힌 돌에는 `flipped` 클래스를 부여해 400ms 미만의 CSS 애니메이션을 적용하고, `prefers-reduced-motion: reduce`에서는 애니메이션을 제거합니다.
- 새 게임 확인은 네이티브 `confirm()`을 쓰지 않고 오버레이 + `role="alertdialog"` 커스텀 다이얼로그로 구현했습니다. 취소 시 상태는 전혀 변경되지 않습니다.
- `build.py`는 표준 라이브러리만 사용해 `index.html`의 두 `<script src="...">` 태그를 각각 `engine.js`, `app.js` 내용으로 치환하여 `reversi.html`을 생성합니다.
- 실제로 브라우저나 Python 인터프리터를 실행해 테스트하지는 않았습니다(사용 가능한 도구가 파일 읽기/쓰기/편집으로 제한됨). 코드 검토 기준으로 작성했습니다.


## 실행 확인
- 칸 경계가 배경색에 묻혀 밝은 선으로 수정, 착수 가능 표시 대비 개선.
- 엔진 테스트 10개 통과.
- 브라우저 D3 착수 후 흑4/백1, 무르기 후 흑2/백2 확인. Enter 착수 확인.
- 화면의 착수 가능 칸을 순서대로 선택해 60수 종료: 흑19/백45. 전략 대국이 아닌 동작 확인.
