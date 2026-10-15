/* Pure local economy rules: no DOM, timers, storage or network. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.CoinEconomy = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const GOAL = 100;
  const TOOL_PRICE = 50;
  function initialState() { return { money: 0, workCount: 0, totalEarned: 0, toolOwned: false }; }
  function validate(state) {
    if (!state || ['money', 'workCount', 'totalEarned'].some(key => !Number.isSafeInteger(state[key]) || state[key] < 0) ||
        typeof state.toolOwned !== 'boolean' || state.totalEarned < state.money) {
      throw new TypeError('Invalid local economy state');
    }
  }
  function income(state) { validate(state); return state.toolOwned ? 2 : 1; }
  function goalView(state) {
    validate(state);
    return { complete: state.totalEarned >= GOAL, progress: Math.min(state.totalEarned, GOAL), remaining: Math.max(0, GOAL - state.totalEarned) };
  }
  function earn(state) {
    const reward = income(state);
    if (state.money > Number.MAX_SAFE_INTEGER - reward || state.totalEarned > Number.MAX_SAFE_INTEGER - reward || state.workCount === Number.MAX_SAFE_INTEGER) {
      return { state: { ...state }, reward: 0, goalReached: false };
    }
    const next = { ...state, money: state.money + reward, workCount: state.workCount + 1, totalEarned: state.totalEarned + reward };
    return { state: next, reward, goalReached: state.totalEarned < GOAL && next.totalEarned >= GOAL };
  }
  function toolView(state) {
    validate(state);
    return { owned: state.toolOwned, canBuy: !state.toolOwned && state.money >= TOOL_PRICE, shortage: Math.max(0, TOOL_PRICE - state.money), price: TOOL_PRICE };
  }
  function buyTool(state) {
    validate(state);
    if (state.toolOwned) return { state: { ...state }, purchased: false, reason: 'owned', spent: 0 };
    if (state.money < TOOL_PRICE) return { state: { ...state }, purchased: false, reason: 'insufficient', spent: 0 };
    return { state: { ...state, money: state.money - TOOL_PRICE, toolOwned: true }, purchased: true, reason: 'purchased', spent: TOOL_PRICE };
  }
  return Object.freeze({ GOAL, TOOL_PRICE, initialState, income, goalView, earn, toolView, buyTool });
});
