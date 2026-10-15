(function(root){
  'use strict';
  function runEconomyChecks(e){
    const results=[];
    const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`);};
    const check=(name,fn)=>{try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}};
    const at=n=>({...e.initialState(),money:n,totalEarned:n,workCount:n});
    const earn=(n)=>{let s=e.initialState();for(let i=0;i<n;i++)s=e.earn(s).state;return s;};
    check('초기 잔액 0원 · 클릭당 1원',()=>{eq(e.initialState().money,0);eq(e.income(e.initialState()),1);});
    check('17회 → 17원 · 83원 남음',()=>{eq(earn(17).money,17);eq(e.goalView(earn(17)).remaining,83);});
    check('이전 상태 불변',()=>{const s=Object.freeze(at(3));eq(e.earn(s).state.money,4);eq(s.money,3);});
    check('99 → 100 첫 목표 도달',()=>eq(e.earn(at(99)).goalReached,true));
    check('100 → 101 알림 재발생 없음',()=>{const r=e.earn(at(100));eq(r.state.money,101);eq(r.goalReached,false);});
    check('1만 회 누적 계산 일치',()=>{const s=earn(10000);eq(s.money,10000);eq(s.totalEarned,10000);});
    check('안전 정수 상한에서 수입 중단',()=>eq(e.earn(at(Number.MAX_SAFE_INTEGER)).reward,0));
    check('잘못된 숫자 상태 거부',()=>{for(const n of [-1,.5,NaN,Infinity]){let rejected=false;try{e.earn({...at(0),money:n});}catch{rejected=true;}eq(rejected,true);}});
    check('초기 상태 서로 독립',()=>{const a=e.initialState(),b=e.initialState();a.money=7;eq(b.money,0);});
    check('49원 구매 실패 · 차감 없음',()=>{const s=Object.freeze(at(49)),r=e.buyTool(s);eq(r.purchased,false);eq(r.state.money,49);eq(r.reason,'insufficient');});
    check('50원 구매 성공 → 잔액 0원',()=>{const r=e.buyTool(at(50));eq(r.purchased,true);eq(r.state.money,0);eq(r.state.totalEarned,50);eq(e.income(r.state),2);});
    check('구매 후 1회 작업 → 2원',()=>eq(e.earn(e.buyTool(at(50)).state).state.money,2));
    check('반복 구매 → 추가 차감 없음',()=>{const s=e.buyTool(at(100)).state,r=e.buyTool(s);eq(r.reason,'owned');eq(r.spent,0);eq(r.state,s);});
    check('구매 함수가 이전 상태를 바꾸지 않음',()=>{const s=Object.freeze(at(50));e.buyTool(s);eq(s.money,50);eq(s.toolOwned,false);});
    check('100원 달성 뒤 구매해도 목표 유지',()=>{const s=e.buyTool(at(100)).state;eq(s.money,50);eq(e.goalView(s).complete,true);eq(s.totalEarned,100);});
    check('총 75회 작업 → 보유 50원 · 누적 100원',()=>{let s=e.buyTool(earn(50)).state;for(let i=0;i<25;i++)s=e.earn(s).state;eq(s.money,50);eq(s.totalEarned,100);eq(s.workCount,75);});
    check('도구 수입 2원은 상한 넘기기 전에 중단',()=>{const s={...at(Number.MAX_SAFE_INTEGER-1),toolOwned:true};eq(e.earn(s).reward,0);});
    check('재시작 시 도구 미보유',()=>eq(e.initialState().toolOwned,false));
    return results;
  }
  if(typeof module==='object'&&module.exports)module.exports=runEconomyChecks;else root.runEconomyChecks=runEconomyChecks;
})(typeof globalThis!=='undefined'?globalThis:this);
