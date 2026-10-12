// Event-contract checks. Browser/device checks are recorded separately.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
function environment(reduce = false) {
  const nodes = new Map();
  function element() {
    const listeners = {};
    const children = [];
    return {
      textContent: '', checked: true, hidden: true, style: {}, children,
      classList: { add(){}, remove(){}, toggle(){} },
      addEventListener(type, callback) { listeners[type] = callback; },
      emit(type, event = {}) { listeners[type]?.(event); },
      append(child) { children.push(child); child.remove = () => children.splice(children.indexOf(child), 1); },
      replaceChildren() { children.length = 0; },
      get firstElementChild() { return children[0]; },
      getBoundingClientRect() { return { left: 100, top: 100, width: 320, height: 64 }; }
    };
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const document = { getElementById: get, querySelector: () => get('goal-card'), createElement: element };
  vm.runInNewContext(readFileSync(join(__dirname, '../app.js'), 'utf8'), {
    document, matchMedia: () => ({ matches: reduce, addEventListener(){} }),
    setTimeout: () => 1, clearTimeout(){}
  });
  return { get, click: () => get('earnButton').emit('click', { detail: 1, clientX: 160, clientY: 130 }) };
}
let e = environment();
for (let i = 0; i < 50; i++) e.click();
assert.equal(e.get('money').textContent, '50');
assert.equal(e.get('workCount').textContent, '50');
assert.ok(e.get('effectsLayer').children.length <= 12);
e.get('earnButton').emit('pointerdown');
e.get('earnButton').emit('touchend');
assert.equal(e.get('money').textContent, '50');
let prevented = false;
e.get('earnButton').emit('keydown', { key:'Enter', repeat:true, preventDefault(){ prevented=true; } });
assert.equal(prevented,true);
e.get('feedbackToggle').checked = false;
e.get('feedbackToggle').emit('change');
e.click();
assert.equal(e.get('money').textContent, '51');
assert.equal(e.get('effectsLayer').children.length, 0);
e = environment(true); e.click();
assert.equal(e.get('money').textContent,'1');
assert.equal(e.get('effectsLayer').children.length,0);
for (let i = 0; i < 99; i++) e.click();
assert.equal(e.get('goalState').textContent,'달성!');
assert.equal(e.get('milestone').hidden,false);
e.get('resetButton').emit('click');
assert.equal(e.get('money').textContent,'0');
assert.equal(e.get('milestone').hidden,true);
console.log('Passed: rapid input, effect bound, income entry point, repeat guard, effects off, reduced motion, milestone/reset');
