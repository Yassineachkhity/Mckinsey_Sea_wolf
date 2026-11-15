const {test} = require('node:test');
const assert = require('node:assert/strict');
const {attributes, attributeKeys, blank, parseTraitNames, applyTraitNames, restoreState, withExample, escapeHTML} = require('../web/model.js');

test('exactly three generic attributes and no predefined traits for new entries',()=>{
  assert.deepEqual(attributes,['Attribute 1','Attribute 2','Attribute 3']);
  assert.deepEqual(attributeKeys,['attribute1','attribute2','attribute3']);
  assert.deepEqual(blank().traitNames,[]);
  assert.equal(blank().ranges.length,3);
  assert.ok(blank().microbes.every(m=>m.values.length===3));
});
test('variable trait list sizes, whitespace, and full names',()=>{
  for(const count of [2,3,5,12,100]) {
    const names=Array.from({length:count},(_,i)=>`Light sensitive ${i}`);
    assert.deepEqual(parseTraitNames('\n '+names.join(' \r\n ')+' \n'),names);
    assert.deepEqual(applyTraitNames(blank(),names).traitNames,names);
  }
});
test('empty, one-entry and ambiguous duplicate lists are rejected',()=>{
  for(const text of ['', 'Only one', 'A\na', 'Light sensitive\nlight-SENSITIVE', 'A\n___'])
    assert.throws(()=>parseTraitNames(text));
});
test('changing the catalog retains values and names but clears removed selections',()=>{
  let state=applyTraitNames(blank(),['Light sensitive','Salt tolerant','Cold resistant']);
  state.desired='Light sensitive';state.undesired='Salt tolerant';
  state.microbes[0]={name:'Custom microbe',values:['4','5','6'],traits:['Light sensitive','Cold resistant']};
  const next=applyTraitNames(state,['Cold resistant','Magnetic']);
  assert.equal(next.desired,'');assert.equal(next.undesired,'');
  assert.deepEqual(next.microbes[0],{name:'Custom microbe',values:['4','5','6'],traits:['Cold resistant']});
  assert.equal(state.desired,'Light sensitive');
});
test('reordering or expanding a catalog preserves all selections',()=>{
  let state=applyTraitNames(blank(),['Light sensitive','Salt tolerant']);
  state.desired='Light sensitive';state.undesired='Salt tolerant';state.microbes[0].traits=['Light sensitive'];
  const next=applyTraitNames(state,['Extra','Salt tolerant','Light sensitive']);
  assert.equal(next.desired,state.desired);assert.equal(next.undesired,state.undesired);
  assert.deepEqual(next.microbes,state.microbes);
});
test('custom data and pending edits survive a save/reload',()=>{
  let state=applyTraitNames(blank(),['Light sensitive','Salt tolerant']);
  state.desired='Light sensitive';state.undesired='Salt tolerant';
  state.microbes[0].traits=['Light sensitive'];state.traitDraft+='\nPending name';
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))),state);
  assert.deepEqual(restoreState(blank()),blank());
});
test('legacy saves are migrated without losing names, values or traits',()=>{
  const legacy=blank();delete legacy.traitNames;delete legacy.traitDraft;
  legacy.desired='Aerobic';legacy.undesired='Heat Resistant';
  legacy.microbes[0]={name:'Saved microbe',values:['1','2','3'],traits:['Aerobic','Hydrophilic']};
  const restored=restoreState(legacy);
  assert.equal(restored.traitNames.length,4);
  assert.equal(restored.desired,'Aerobic');
  assert.deepEqual(restored.microbes,legacy.microbes);
});
test('corrupt stored data falls back to a clean state',()=>{
  for(const stored of [null,{}, {...blank(),microbes:[null]}, {...blank(),traitNames:['A','a']}, {...blank(),desired:'Unknown'}])
    assert.deepEqual(restoreState(stored),blank());
});
test('examples work for small and large custom lists and preserve ocean settings',()=>{
  for(const count of [2,6,100]) {
    const names=Array.from({length:count},(_,i)=>`Custom ${i}`);
    let state=applyTraitNames(blank(),names);
    state.desired=names[0];state.undesired=names.at(-1);state.ranges=[['4','6'],['1','3'],['6','8']];
    const example=withExample(state);
    assert.deepEqual(example.traitNames,names);assert.deepEqual(example.ranges,state.ranges);
    assert.equal(example.desired,state.desired);assert.equal(example.undesired,state.undesired);
    assert.equal(example.microbes.length,10);
    assert.ok(example.microbes.every(m=>m.values.length===3&&m.traits.length>0&&m.traits.every(t=>names.includes(t))));
  }
});
test('custom labels are escaped before use in HTML and attributes',()=>{
  assert.equal(escapeHTML('<Light & "sensitive">\' special'), '&lt;Light &amp; &quot;sensitive&quot;&gt;&#39; special');
});
