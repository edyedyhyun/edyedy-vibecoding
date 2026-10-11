(() => {
  'use strict';
  const state = { money: 0, workCount: 0 };
  const goal = 100;
  const get = id => document.getElementById(id);
  const card = document.querySelector('.goal-card');
  let animationTimer;

  function render() {
    const complete = state.money >= goal;
    get('money').textContent = state.money.toLocaleString('ko-KR');
    get('workCount').textContent = state.workCount.toLocaleString('ko-KR');
    get('goalProgress').value = Math.min(state.money, goal);
    get('goalAmount').textContent = `${Math.min(state.money, goal)} / ${goal}원`;
    get('remaining').textContent = complete ? '첫 목표 달성' : `${goal - state.money}원 남음`;
    get('goalState').textContent = complete ? '달성!' : state.money === 0 ? '시작 전' : '모으는 중';
    get('goalMessage').textContent = complete ? '첫 100원을 직접 모았습니다. 계속 일을 할 수도 있어요.' : '처음 모으는 돈은 직접 벌어봅니다.';
    get('sceneMessage').textContent = complete ? '첫 100원. 이제 다음 단계를 생각해볼 차례입니다.' : '아직 작지만, 여기서 시작합니다.';
    card.classList.toggle('complete', complete);
  }

  get('earnButton').addEventListener('click', () => {
    if (state.money >= Number.MAX_SAFE_INTEGER) return;
    state.money += 1;
    state.workCount += 1;
    get('resetNotice').textContent = '';
    render();
    clearTimeout(animationTimer);
    get('coinPop').classList.remove('pop');
    get('room').classList.remove('working');
    void get('coinPop').offsetWidth;
    get('coinPop').classList.add('pop');
    get('room').classList.add('working');
    animationTimer = setTimeout(() => {
      get('coinPop').classList.remove('pop');
      get('room').classList.remove('working');
    }, 650);
  });

  get('resetButton').addEventListener('click', () => {
    state.money = 0;
    state.workCount = 0;
    clearTimeout(animationTimer);
    get('coinPop').classList.remove('pop');
    get('room').classList.remove('working');
    render();
    get('resetNotice').textContent = '작은 방에서 다시 시작합니다.';
  });
  render();
})();
