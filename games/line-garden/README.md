# 선을 잇는 정원 · LINE GARDEN

원본 그래픽으로 만든 1인용 땅따먹기 HTML5 게임. `line-garden.html`을 저장해 브라우저로 열면 됩니다. 외부 라이브러리·서버·인터넷 연결이 필요 없습니다.

## 규칙과 조작
- 방향키 / WASD 또는 화면 화살표를 누르는 동안 이동합니다.
- 연두색 땅은 안전합니다. 어두운 빈칸으로 나가면 노란 선이 생깁니다.
- 다시 안전한 땅에 연결하면 선이 확정되고, 적이 없는 닫힌 공간이 내 땅이 됩니다.
- 적 두 마리가 서로 다른 쪽에 있으면 양쪽 공간은 남고 선만 땅이 됩니다.
- 진행 중인 선을 역주행할 수 없습니다. 앞으로 돌아서 연결해야 합니다.
- 적이 미완성 선에 닿거나 플레이어가 적 칸에 진입하면 기회 1회 차감, 미완성 선만 사라집니다. 완성한 땅은 유지됩니다.
- 초기 테두리를 제외한 내부의 70%를 차지하면 승리. 기회는 3번.
- Space / P / Esc 또는 화면 버튼으로 일시정지. 탭을 떠나면 자동 정지.
- '새 게임'은 처음 화면으로, 종료 후 '다시 도전'은 새 판을 시작합니다.
- 단일 보드, 효과음·아이템·온라인 순위 없음.

## 개발
`engine.js` 규칙 / `app.js` 렌더링과 입력 / `index.html` 화면.

```sh
node --test games/line-garden/engine.test.js
python3 games/line-garden/build.py
```

테스트 12개: 열린 선 제외, 연결 후 영역 채움, 두 적의 영역 보존, 피격 복구, 일시정지, 역주행 금지, 승리/패배/재시작, 적 이동 경계.
브라우저에서 미완성 선 0.0%, 선 파괴 후 2회 잔여, 짧은 경로 완성 후 3.1%, 정지/재개/360px 배치를 확인했습니다. 실제 휴대폰 터치와 장시간 난이도 평가는 미검증입니다.

## 이미지
`images/cover.webp`는 built-in image_gen으로 만든 블로그 표지 일러스트입니다. 나머지는 실제 브라우저 캡처를 WebP로 변환한 이미지입니다. 이미지 속 첫 배치와 모바일 초안은 개선 중 단계입니다.

표지 프롬프트: Korean blog cover illustration for an original HTML5 territory capture game. Wide 16:9, paper-cut miniature garden of green tiles, ivory marker drawing a golden loop, two coral bugs. Korean title '선을 잇는 정원', subtitle '바이브코딩으로 땅따먹기 만들기'. Cover illustration, not screenshot, no copied game assets.
