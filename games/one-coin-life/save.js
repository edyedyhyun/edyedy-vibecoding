/* Versioned local save boundary. No offline-income calculation. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./economy.js'));
  else root.CoinSave=factory(root.CoinEconomy);
})(typeof globalThis!=='undefined'?globalThis:this,function(economy){
  'use strict';
  const KEY='one-coin-life.save', VERSION=1;
  const fields=['money','workCount','totalEarned','toolOwned','workerOwned','workerEarned','workerRemainderMs'];
  function checkedState(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Invalid save state');
    const state=Object.fromEntries(fields.map(k=>[k,value[k]]));
    economy.goalView(state); // Shared numeric and boolean bounds.
    const spent=(state.toolOwned?economy.TOOL_PRICE:0)+(state.workerOwned?economy.WORKER_PRICE:0);
    const manual=state.totalEarned-state.workerEarned;
    if(state.totalEarned-state.money!==spent || (!state.workerOwned&&(state.workerEarned!==0||state.workerRemainderMs!==0)) ||
       (!state.toolOwned && manual!==state.workCount) || (state.toolOwned && (state.workCount<50 || manual<state.workCount || manual-state.workCount>state.workCount-50))) {
      throw new TypeError('Inconsistent save state');
    }
    return state;
  }
  function encode(state,savedAt=Date.now()){
    if(!Number.isSafeInteger(savedAt)||savedAt<0)throw new TypeError('Invalid timestamp');
    return JSON.stringify({version:VERSION,savedAt,state:checkedState(state)});
  }
  function decode(raw){
    if(raw===null)return {status:'empty',state:economy.initialState()};
    try{
      if(typeof raw!=='string'||raw.length>10000)throw new TypeError('Invalid data');
      const data=JSON.parse(raw);
      if(!data||typeof data!=='object'||!Number.isSafeInteger(data.version))throw new TypeError('Invalid version');
      if(data.version!==VERSION)return {status:'unsupported',state:economy.initialState()};
      if(!Number.isSafeInteger(data.savedAt)||data.savedAt<0)throw new TypeError('Invalid timestamp');
      return {status:'restored',state:checkedState(data.state),savedAt:data.savedAt};
    }catch{return {status:'invalid',state:economy.initialState()};}
  }
  function createStore(getStorage){
    function load(){try{return decode(getStorage().getItem(KEY));}catch{return {status:'unavailable',state:economy.initialState()};}}
    function save(state){try{const savedAt=Date.now();getStorage().setItem(KEY,encode(state,savedAt));return {ok:true,savedAt};}catch{return {ok:false};}}
    function clear(){try{getStorage().removeItem(KEY);return {ok:true};}catch{return {ok:false};}}
    return {load,save,clear};
  }
  return Object.freeze({KEY,VERSION,encode,decode,createStore});
});
