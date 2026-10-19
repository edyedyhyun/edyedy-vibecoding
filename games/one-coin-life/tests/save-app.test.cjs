const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const economy=require('../economy.js'),save=require('../save.js');
function start(data=new Map(),fail={}){
 const nodes=new Map(),events={};let writes=0;
 function el(){const e={};return{textContent:'',checked:false,hidden:false,children:[],classList:{add(){},remove(){},toggle(){}},addEventListener(k,f){e[k]=f},emit(k){e[k]?.({detail:0})},replaceChildren(){},showModal(){this.open=true},close(){this.open=false}}}
 function get(k){if(!nodes.has(k))nodes.set(k,el());return nodes.get(k)}
 const storage={getItem:k=>{if(fail.read)throw Error();return data.get(k)??null},setItem:(k,v)=>{if(fail.write)throw Error();writes++;data.set(k,v)},removeItem:k=>{if(fail.clear)throw Error();data.delete(k)}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),{CoinEconomy:economy,CoinSave:save,localStorage:storage,performance:{now:()=>0},document:{hidden:false,getElementById:get,querySelector:()=>get('goal'),addEventListener(){}},matchMedia:()=>({matches:false,addEventListener(){}}),setTimeout(){},clearTimeout(){},setInterval(){},addEventListener(k,f){events[k]=f}});
 return {get,click:()=>get('earnButton').emit('click'),data,writes:()=>writes};
}
let a=start();for(let i=0;i<17;i++)a.click();let b=start(a.data);assert.equal(b.get('money').textContent,'17');assert.equal(b.get('workCount').textContent,'17');
for(const raw of ['{broken','{"version":2}']){const data=new Map([[save.KEY,raw]]),x=start(data);x.click();assert.equal(x.writes(),0);assert.equal(data.get(save.KEY),raw);}
let denied=start(new Map(),{read:true,write:true});denied.click();assert.equal(denied.get('money').textContent,'1');assert.match(denied.get('saveStatus').textContent,/저장 실패/);
b.get('resetButton').emit('click');b.get('cancelReset').emit('click');assert.equal(b.get('money').textContent,'17');assert.ok(b.data.has(save.KEY));
let failClear=start(a.data,{clear:true});failClear.get('resetButton').emit('click');failClear.get('confirmReset').emit('click');assert.equal(failClear.get('money').textContent,'17');assert.match(failClear.get('saveStatus').textContent,/초기화하지 않았/);
b.get('resetButton').emit('click');b.get('confirmReset').emit('click');assert.equal(b.get('money').textContent,'0');assert.equal(b.data.has(save.KEY),false);
console.log('PASS app reload, damaged/future preservation, save failure, cancel, clear failure, confirmed reset');
