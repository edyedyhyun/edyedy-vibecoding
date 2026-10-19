(() => {
  'use strict';
  const economy = CoinEconomy;
  const store = CoinSave.createStore(() => localStorage);
  const restored = store.load();
  let state = restored.state;
  // Preserve damaged/future-format saves until the player explicitly clears them.
  let saveBlocked = ['invalid','unsupported'].includes(restored.status);
  const goal = economy.GOAL;
  const get = id => document.getElementById(id);
  const card = document.querySelector('.goal-card');
  const button = get('earnButton');
  const effects = get('effectsLayer');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let animationTimer;
  let statusTimer;
  let milestoneTimer;
  let lastTick = performance.now();
  let pageActive = !document.hidden;
  function persist() {
    if (saveBlocked) return;
    const result = store.save(state);
    get('saveStatus').textContent = result.ok ? '이 브라우저에 저장됨' : '저장 실패 · 이번 진행은 새로고침하면 잃을 수 있습니다';
    get('saveStatus').classList.toggle('save-error', !result.ok);
  }
  function settle(now = performance.now()) {
    const elapsed = Math.max(0, Math.floor(now - lastTick));
    // Retain the sub-millisecond fraction; rebasing while hidden prevents offline rewards.
    lastTick += elapsed;
    if (!pageActive) return;
    const result = economy.advance(state, elapsed);
    state = result.state;
    if (result.reward > 0) { get('workerReceipt').textContent = `+${result.reward}원 · 직원 수입`; persist(); }
  }


  function render() {
    const view = economy.goalView(state);
    const complete = view.complete;
    get('money').textContent = state.money.toLocaleString('ko-KR');
    get('workCount').textContent = state.workCount.toLocaleString('ko-KR');
    get('goalProgress').value = view.progress;
    get('goalAmount').textContent = `누적 ${state.totalEarned.toLocaleString('ko-KR')} / ${goal}원`;
    const tool = economy.toolView(state);
    get('earnAmount').textContent = `+${economy.income(state)}원`;
    get('rateNote').textContent = `작은 일 한 번에 ${economy.income(state)}원`;
    get('buyTool').disabled = !tool.canBuy;
    get('buyTool').textContent = tool.owned ? '구매 완료' : tool.canBuy ? '작업 도구 구매 · 50원' : `구매까지 ${tool.shortage}원 필요`;
    get('toolState').textContent = tool.owned ? '보유 중 · 클릭당 2원' : '클릭당 1원 → 2원';
    get('room').classList.toggle('upgraded', tool.owned);
    const worker = economy.workerView(state);
    get('hireWorker').disabled = !worker.canHire;
    get('hireWorker').textContent = worker.owned ? '고용 완료 · 직원 1명' : worker.canHire ? '첫 직원 고용 · 100원' : `고용까지 ${worker.shortage}원 필요`;
    get('workerState').textContent = worker.owned ? (pageActive ? '근무 중 · 초당 1원' : '다른 탭에서는 쉬는 중') : '직원 1명 · 초당 1원';
    get('workerEarned').textContent = state.workerEarned.toLocaleString('ko-KR');
    get('manualEarned').textContent = (state.totalEarned - state.workerEarned).toLocaleString('ko-KR');
    get('workerProgress').value = state.workerOwned ? state.workerRemainderMs : 0;
    get('room').classList.toggle('staffed', worker.owned);
    get('remaining').textContent = complete ? '첫 목표 달성' : `${view.remaining}원 남음`;
    get('goalState').textContent = complete ? '달성!' : state.totalEarned === 0 ? '시작 전' : '모으는 중';
    get('goalMessage').textContent = complete ? '누적 수입 100원 달성. 구매해도 기록은 남습니다.' : '쓴 돈을 포함해 총 100원을 벌어보세요.';
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

  function showFeedback(event, amount) {
    // Animation is decoration. Disabling it never changes income.
    get('lastReward').textContent = `+${amount}원 · 작업 완료`;
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
    reward.textContent = `+${amount}원`;
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
    settle();
    const result = economy.earn(state);
    if (result.reward === 0) return;
    state = result.state;
    persist();
    get('resetNotice').textContent = '';
    render();
    showFeedback(event, result.reward);
    if (result.goalReached) {
      get('milestone').hidden = false;
      milestoneTimer = setTimeout(() => { get('milestone').hidden = true; }, 2800);
    }
  });

  button.addEventListener('keydown', event => {
    if (event.repeat && ['Enter', ' ', 'Spacebar'].includes(event.key)) event.preventDefault();
  });

  get('buyTool').addEventListener('click', () => {
    settle();
    const result = economy.buyTool(state);
    if (!result.purchased) return;
    state = result.state;
    persist();
    clearFeedback();
    render();
    get('lastReward').textContent = '−50원 · 작업 도구 구매';
    get('purchaseStatus').textContent = '작업 도구를 샀습니다. 이제 한 번에 2원을 법니다.';
  });

  get('hireWorker').addEventListener('click', () => {
    settle();
    const result = economy.hireWorker(state);
    if (!result.hired) return;
    state = result.state;
    persist();
    lastTick = performance.now();
    get('workerReceipt').textContent = '−100원 · 첫 직원 고용';
    render();
  });
  // Exactly one timer for the whole session. Hiring and resetting never create another.
  setInterval(() => { settle(); render(); }, 250);
  document.addEventListener('visibilitychange', () => {
    settle();
    persist();
    pageActive = !document.hidden;
    lastTick = performance.now();
    render();
  });
  // BFCache restores must not pay for time spent away.
  addEventListener('pagehide', () => { settle(); persist(); pageActive = false; });
  addEventListener('pageshow', () => { pageActive = !document.hidden; lastTick = performance.now(); render(); });

  get('feedbackToggle').addEventListener('change', clearFeedback);
  reducedMotion.addEventListener('change', clearFeedback);
  get('resetButton').addEventListener('click', () => get('resetDialog').showModal());
  get('cancelReset').addEventListener('click', () => get('resetDialog').close());
  get('confirmReset').addEventListener('click', () => {
    get('resetDialog').close();
    if (!store.clear().ok) {
      get('saveStatus').textContent = '기록을 지우지 못해 초기화하지 않았습니다. 브라우저 저장 권한을 확인해 주세요.';
      get('saveStatus').classList.add('save-error');
      return;
    }
    saveBlocked = false;
    state = economy.initialState();
    get('restoreNotice').textContent = '새 기록으로 시작합니다.';
    get('saveStatus').textContent = '저장 기록을 지웠습니다';
    get('saveStatus').classList.remove('save-error');
    lastTick = performance.now();
    get('workerReceipt').textContent = '아직 직원 수입이 없습니다';
    clearFeedback();
    get('lastReward').textContent = '첫 작은 일을 시작해보세요';
    get('purchaseStatus').textContent = '';
    render();
    get('resetNotice').textContent = '작은 방에서 다시 시작합니다.';
  });
  const notices = {
    empty: '처음 시작합니다. 작은 일부터 해보세요.',
    restored: '이전 기록을 불러왔습니다. 자리를 비운 동안의 보상은 아직 없습니다.',
    invalid: '저장 데이터가 올바르지 않아 불러오지 않았습니다. 기존 기록은 보존합니다. 새로 저장하려면 기록을 지우고 다시 시작하세요.',
    unsupported: '다른 버전의 저장 데이터입니다. 기존 기록을 보존하며 이번 진행은 저장하지 않습니다. 기록을 지우면 새로 시작할 수 있습니다.',
    unavailable: '브라우저 저장소에 접근하지 못했습니다. 지금 플레이할 수 있지만 진행이 저장되지 않을 수 있습니다.'
  };
  get('restoreNotice').textContent = notices[restored.status];
  get('saveStatus').textContent = restored.status === 'restored' ? '저장 기록 불러오기 완료' : saveBlocked ? '기존 기록 보호 중 · 자동 저장 중지' : restored.status === 'unavailable' ? '저장소 접근 불가' : '아직 저장할 진행이 없습니다';
  get('saveStatus').classList.toggle('save-error', ['invalid','unsupported','unavailable'].includes(restored.status));
  render();
})();
