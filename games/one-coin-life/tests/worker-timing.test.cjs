const {readFileSync}=require('node:fs');
const vm=require('node:vm'),assert=require('node:assert/strict');
const economy=require('../economy.js');
let now=0,intervals=0,tick;const nodes=new Map(),docEvents={},winEvents={};
function node(){const events={};return{textContent:'',checked:false,hidden:false,children:[],style:{},showModal(){},close(){},classList:{toggle(){},add(){},remove(){}},addEventListener(k,f){events[k]=f},emit(k,e={}){events[k]?.(e)},replaceChildren(){this.children=[]}}}
function get(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)}
const document={hidden:false,getElementById:get,querySelector:()=>get('goal'),addEventListener(k,f){docEvents[k]=f}};
vm.runInNewContext(readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8'),{CoinEconomy:economy,CoinSave:require('../save.js'),localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document,performance:{now:()=>now},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval(f){intervals++;tick=f},setTimeout(){return 1},clearTimeout(){},addEventListener(k,f){winEvents[k]=f}});
function click(){get('earnButton').emit('click',{detail:0})}
for(let i=0;i<100;i++)click();now=50000;get('hireWorker').emit('click');
assert.equal(get('money').textContent,'0'); // No reward for the 50 seconds before hire.
now+=3700;tick();assert.equal(get('money').textContent,'3');
assert.equal(get('workerEarned').textContent,'3');assert.equal(get('workCount').textContent,'100');
document.hidden=true;docEvents.visibilitychange();now+=60000;tick();
assert.equal(get('money').textContent,'3');
document.hidden=false;docEvents.visibilitychange();now+=300;tick();
assert.equal(get('money').textContent,'4'); // Visible remainder 700ms + 300ms, not hidden 60s.
get('hireWorker').emit('click');now+=2000;tick();assert.equal(get('workerEarned').textContent,'6');assert.equal(intervals,1);
click();assert.equal(get('manualEarned').textContent,'101');assert.equal(get('workerEarned').textContent,'6');
winEvents.pagehide();now+=10000;winEvents.pageshow();tick();assert.equal(get('workerEarned').textContent,'6');
get('resetButton').emit('click');get('confirmReset').emit('click');now+=10000;tick();assert.equal(get('money').textContent,'0');assert.equal(get('workerEarned').textContent,'0');assert.equal(intervals,1);
console.log('PASS delayed callback, pre-hire time, hidden pause/resume, single timer, manual/worker split, BFCache, reset');
