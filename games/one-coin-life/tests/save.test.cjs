const assert=require('node:assert/strict'),e=require('../economy.js'),s=require('../save.js');let count=0;
function check(name,f){f();count++;console.log('PASS '+name)}
let state=e.initialState();for(let i=0;i<50;i++)state=e.earn(state).state;state=e.buyTool(state).state;for(let i=0;i<50;i++)state=e.earn(state).state;state=e.hireWorker(state).state;state=e.advance(state,3750).state;
check('돈·도구·직원·누적·남은 시간 왕복 보존',()=>assert.deepEqual(s.decode(s.encode(state,10)).state,state));
check('기록 없음 → 새 게임',()=>assert.equal(s.decode(null).status,'empty'));
check('깨진 JSON → 보존용 오류 상태',()=>assert.equal(s.decode('{broken').status,'invalid'));
check('미지원 버전 → 자동 덮어쓰기 금지 신호',()=>assert.equal(s.decode('{"version":2}').status,'unsupported'));
check('음수와 누락 필드 거부',()=>{for(const x of [{...state,money:-1},{money:0}])assert.equal(s.decode(JSON.stringify({version:1,savedAt:0,state:x})).status,'invalid')});
check('구매 내역과 잔액 불일치 거부',()=>assert.equal(s.decode(JSON.stringify({version:1,savedAt:0,state:{...state,money:state.money+1}})).status,'invalid'));
check('직원 없이 직원 수입 존재 거부',()=>assert.throws(()=>s.encode({...state,workerOwned:false})));
check('0.5원·안전 정수 초과·잘못된 boolean 거부',()=>{for(const x of [{...state,money:.5},{...state,workCount:Number.MAX_SAFE_INTEGER+1},{...state,toolOwned:'yes'}])assert.throws(()=>s.encode(x))});
check('큰 저장문자열 거부',()=>assert.equal(s.decode(' '.repeat(10001)).status,'invalid'));
check('음수·누락 timestamp 거부',()=>{assert.throws(()=>s.encode(state,-1));assert.equal(s.decode('{"version":1,"state":{}}').status,'invalid')});
check('과거 timestamp로 오프라인 돈 지급 없음',()=>assert.deepEqual(s.decode(s.encode(state,0)).state,state));
check('get/set/remove 예외를 UI에 반환',()=>{const store=s.createStore(()=>{throw Error('denied')});assert.equal(store.load().status,'unavailable');assert.equal(store.save(state).ok,false);assert.equal(store.clear().ok,false)});
check('저장 성공·다시 읽기·해당 키만 삭제',()=>{const data=new Map([['other','keep']]);const store=s.createStore(()=>({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}));assert.equal(store.save(state).ok,true);assert.deepEqual(store.load().state,state);assert.equal(store.clear().ok,true);assert.equal(store.load().status,'empty');assert.equal(data.get('other'),'keep')});
check('추가 필드는 상태에 유입 안 됨',()=>assert.equal(s.decode(JSON.stringify({version:1,savedAt:1,state:{...state,admin:true}})).state.admin,undefined));
console.log(count+' save checks passed');
