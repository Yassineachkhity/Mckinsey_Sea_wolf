const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = path.join(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');

function openApp(t, saved) {
  const dom=new JSDOM(read('web/index.html'),{url:'http://localhost/',runScripts:'outside-only'});
  t.after(()=>dom.window.close());
  const {window}=dom;
  window.scrollTo=()=>{};
  window.HTMLElement.prototype.scrollIntoView=()=>{};
  window.matchMedia=()=>({matches:true});
  window.confirm=()=>true;
  if(saved) window.localStorage.setItem('ocean-lab-v1',saved);
  window.eval(read('web/model.js')+'\n'+read('web/app.js'));
  const $=selector=>window.document.querySelector(selector);
  const all=selector=>[...window.document.querySelectorAll(selector)];
  const fill=(selector,value)=>{
    const el=$(selector);el.value=value;el.dispatchEvent(new window.Event('input',{bubbles:true}));
  };
  return {window,$,all,fill};
}
function setup(app,names) {
  app.fill('#trait-names',names.join('\n'));app.$('#apply-traits').click();
  for(let i=0;i<3;i++) app.fill(`#range-${i}-0`,'4');
  app.all('#desired button')[0].click();app.all('#undesired button').at(-1).click();
  app.$('#continue').click();
}

test('first-page custom names reach every card and render safely in results',async t=>{
  const app=openApp(t), {window,$,all}=app;
  const names=['<Light & "sensitive">', 'Salt tolerant', 'Cold resistant', 'Magnetic', 'Photosynthetic', "Heat's resistance"];
  assert.equal(all('#ranges input').length,6);
  assert.equal(all('#desired button').length,0);
  setup(app,names);
  assert.equal($('#deck-screen').hidden,false);
  assert.equal($('#ocean-screen').disabled,true);
  assert.equal(all('.microbe-trait').length,60);
  assert.equal(all('.values-row input').length,30);
  assert.equal($('#site-summary .note-trait-value').textContent,names[0]);
  assert.equal($('#site-summary light'),null);
  $('#example').click();
  assert.equal($('#progress').textContent,'10 of 10 microbes ready');
  let submitted;
  window.fetch=async (url,options)=>{
    assert.equal(url,'/api/solve');submitted=JSON.parse(options.body);
    return {ok:true,json:async()=>({eligible:8,excluded_ids:[4,8],best_score:80,matches:[{
      ids:[1,2,3],carriers:[1],averages:['5','5','7'],decimals:[5,5,7],score:80,
      checks:{attribute1:true,attribute2:true,attribute3:false,desired:true,excluded:true}
    }]})};
  };
  $('#solve').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(submitted.traitNames,names);
  assert.ok(submitted.microbes.every(m=>m.traits.every(name=>names.includes(name))));
  assert.equal($('#results').hidden,false);
  assert.equal(all('.ranked-table tbody tr').length,1);
  assert.equal(all('.ranked-table .check-fail').length,1);
  assert.match($('#results').textContent,/Attribute 1/);
  assert.ok($('#results').textContent.includes(names[0]));
  assert.equal($('#results light'),null);
});

test('edits invalidate results, clear removed selections, and preserve microbe data across reload',t=>{
  const app=openApp(t), {$,fill,all}=app;
  setup(app,['Light sensitive','Salt tolerant','Cold resistant']);
  $('#example').click();fill('[data-name="0"]','My saved microbe');
  const values=all('#microbe-0 [data-attribute]').map(el=>el.value);
  $('#results').hidden=false;$('#results').classList.add('has-results');
  $('#edit-ocean').click();
  fill('#trait-names','Salt tolerant\nMagnetic');$('#apply-traits').click();
  assert.equal($('#results').hidden,true);
  assert.equal(all('#desired [aria-pressed="true"]').length,0);
  assert.equal(all('#undesired [aria-pressed="true"]').length,0);
  assert.equal($('#microbe-0 [data-name]').value,'My saved microbe');
  assert.deepEqual(all('#microbe-0 [data-attribute]').map(el=>el.value),values);
  assert.equal(all('.microbe-trait').length,20);
  const restored=openApp(t,app.window.localStorage.getItem('ocean-lab-v1'));
  assert.equal(restored.$('#trait-names').value,'Salt tolerant\nMagnetic');
  assert.equal(restored.$('#microbe-0 [data-name]').value,'My saved microbe');
  assert.equal(restored.$('#ocean-screen').hidden,false);
});

test('invalid lists and identical desired/excluded choices are blocked in the form',t=>{
  const app=openApp(t), {$,fill,all}=app;
  fill('#trait-names','Light sensitive\nlight-sensitive');$('#apply-traits').click();
  assert.match($('#error').textContent,/unique/);
  assert.equal(all('#desired button').length,0);
  fill('#trait-names','Light sensitive\nSalt tolerant');$('#apply-traits').click();
  all('#desired button')[0].click();all('#undesired button')[0].click();
  assert.match($('#error').textContent,/different/);
  assert.equal(all('#undesired [aria-pressed="true"]').length,0);
});

test('clear all removes the configured list and resets the three attributes',t=>{
  const app=openApp(t);
  setup(app,['Light sensitive','Salt tolerant']);
  app.$('#example').click();app.$('#reset').click();
  assert.equal(app.$('#ocean-screen').hidden,false);
  assert.equal(app.$('#trait-names').value,'');
  assert.equal(app.all('.microbe-trait').length,0);
  assert.ok(app.all('#ranges input,.values-row input').every(el=>el.value===''));
});
