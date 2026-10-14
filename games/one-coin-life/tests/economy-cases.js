(function (root) {
  'use strict';
  function runEconomyChecks(e) {
    const results = [];
    function check(name, test) {
      try { test(); results.push({ name, passed: true }); }
      catch (error) { results.push({ name, passed: false, error: error.message }); }
    }
    const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
    check('초기 잔액 0원 · 작업 0회', () => eq(e.initialState(), { money:0, workCount:0 }));
    check('17회 작업 → 17원 · 83원 남음', () => {
      let s=e.initialState(); for(let i=0;i<17;i++) s=e.earn(s).state;
      eq(s,{money:17,workCount:17}); eq(e.goalView(s).remaining,83);
    });
    check('이전 상태를 직접 바꾸지 않음', () => {
      const s=Object.freeze({money:3,workCount:3}); const r=e.earn(s);
      eq(s,{money:3,workCount:3}); eq(r.state,{money:4,workCount:4}); if(r.state===s) throw new Error('same reference');
    });
    check('99 → 100에서만 첫 목표 알림', () => { const r=e.earn({money:99,workCount:99}); eq(r.goalReached,true); eq(e.goalView(r.state),{complete:true,progress:100,remaining:0}); });
    check('100 → 101 수입 계속 · 목표 알림 반복 없음', () => { const r=e.earn({money:100,workCount:100}); eq(r.state.money,101);eq(r.goalReached,false);eq(e.goalView(r.state).remaining,0); });
    check('1만 회 작업 후 정수 잔액 일치', () => { let s=e.initialState();for(let i=0;i<10000;i++)s=e.earn(s).state;eq(s,{money:10000,workCount:10000}); });
    check('잔액 안전 정수 상한에서 수입 중단', () => { const r=e.earn({money:Number.MAX_SAFE_INTEGER,workCount:1});eq(r.reward,0);eq(r.state.money,Number.MAX_SAFE_INTEGER); });
    check('작업 횟수 상한에서도 함께 중단', () => { const r=e.earn({money:1,workCount:Number.MAX_SAFE_INTEGER});eq(r.reward,0);eq(r.state.money,1); });
    check('음수·소수·NaN·Infinity 상태 거부', () => {
      for(const n of [-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {
        let rejected=false;try{e.earn({money:n,workCount:0});}catch{rejected=true;}if(!rejected)throw new Error('invalid money accepted');
        rejected=false;try{e.earn({money:0,workCount:n});}catch{rejected=true;}if(!rejected)throw new Error('invalid count accepted');
      }
    });
    check('새 초기 상태는 서로 독립적', () => { const a=e.initialState(),b=e.initialState();a.money=9;eq(b.money,0); });
    return results;
  }
  if (typeof module === 'object' && module.exports) module.exports = runEconomyChecks;
  else root.runEconomyChecks=runEconomyChecks;
})(typeof globalThis !== 'undefined' ? globalThis : this);
