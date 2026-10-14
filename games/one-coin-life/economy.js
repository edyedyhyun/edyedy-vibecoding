/* Pure local economy rules: no DOM, timers, storage or network. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.CoinEconomy = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const GOAL = 100;
  const REWARD = 1;
  function initialState() { return { money: 0, workCount: 0 }; }
  function validate(state) {
    if (!state || !Number.isSafeInteger(state.money) || state.money < 0 ||
        !Number.isSafeInteger(state.workCount) || state.workCount < 0) {
      throw new TypeError('money and workCount must be non-negative safe integers');
    }
  }
  function goalView(state) {
    validate(state);
    return {
      complete: state.money >= GOAL,
      progress: Math.min(state.money, GOAL),
      remaining: Math.max(0, GOAL - state.money)
    };
  }
  function earn(state) {
    validate(state);
    if (state.money > Number.MAX_SAFE_INTEGER - REWARD || state.workCount === Number.MAX_SAFE_INTEGER) {
      return { state: { ...state }, reward: 0, goalReached: false };
    }
    const next = { money: state.money + REWARD, workCount: state.workCount + 1 };
    return {
      state: next,
      reward: REWARD,
      goalReached: state.money < GOAL && next.money >= GOAL
    };
  }
  return Object.freeze({ GOAL, REWARD, initialState, goalView, earn });
});
