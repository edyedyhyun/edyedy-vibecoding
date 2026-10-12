(() => {
  'use strict';
  const state = { money: 0, workCount: 0 };
  const goal = 100;
  const get = id => document.getElementById(id);
  const card = document.querySelector('.goal-card');
  const button = get('earnButton');
  const effects = get('effectsLayer');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let animationTimer;
  let statusTimer;
  let milestoneTimer;

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

  function clearFeedback() {
    clearTimeout(animationTimer);
    clearTimeout(statusTimer);
    clearTimeout(milestoneTimer);
    effects.replaceChildren();
    get('room').classList.remove('working');
    get('money').classList.remove('earned');
    get('milestone').hidden = true;
    get('inputStatus').textContent = '';
  }

  function showFeedback(event) {
    // Animation is decoration. Disabling it never changes income.
    get('lastReward').textContent = '+1원 · 작업 완료';
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      get('inputStatus').textContent = `${state.workCount}회 작업, ${state.money}원`;
    }, 180);
    if (!get('feedbackToggle').checked || reducedMotion.matches) return;
    const rect = button.getBoundingClientRect();
    const pointer = event.detail > 0;
    const x = pointer ? Math.max(16, Math.min(rect.width - 16, event.clientX - rect.left)) : rect.width / 2;
    const y = pointer ? Math.max(16, Math.min(rect.height - 12, event.clientY - rect.top)) : rect.height / 2;
    // Bound simultaneous DOM effects during rapid input.
    while (effects.children.length > 10) effects.firstElementChild.remove();
    const reward = document.createElement('span');
    reward.className = 'reward-pop';
    reward.textContent = '+1원';
    reward.style.left = `${x}px`;
    reward.style.top = `${y}px`;
    effects.append(reward);
    reward.addEventListener('animationend', () => reward.remove(), { once: true });
    const ring = document.createElement('span');
    ring.className = 'tap-ring';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    effects.append(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
    clearTimeout(animationTimer);
    get('room').classList.remove('working');
    get('money').classList.remove('earned');
    void get('money').offsetWidth;
    get('room').classList.add('working');
    get('money').classList.add('earned');
    animationTimer = setTimeout(() => {
      get('room').classList.remove('working');
      get('money').classList.remove('earned');
    }, 350);
  }

  // One income entry point: native click covers mouse, touch and keyboard.
  // There is deliberately no additional income on pointerdown or touchend.
  button.addEventListener('click', event => {
    if (state.money >= Number.MAX_SAFE_INTEGER) return;
    state.money += 1;
    state.workCount += 1;
    get('resetNotice').textContent = '';
    render();
    showFeedback(event);
    if (state.money === goal) {
      get('milestone').hidden = false;
      milestoneTimer = setTimeout(() => { get('milestone').hidden = true; }, 2800);
    }
  });

  button.addEventListener('keydown', event => {
    if (event.repeat && ['Enter', ' ', 'Spacebar'].includes(event.key)) event.preventDefault();
  });

  get('feedbackToggle').addEventListener('change', clearFeedback);
  reducedMotion.addEventListener('change', clearFeedback);
  get('resetButton').addEventListener('click', () => {
    state.money = 0;
    state.workCount = 0;
    clearFeedback();
    get('lastReward').textContent = '첫 작은 일을 시작해보세요';
    render();
    get('resetNotice').textContent = '작은 방에서 다시 시작합니다.';
  });
  render();
})();
