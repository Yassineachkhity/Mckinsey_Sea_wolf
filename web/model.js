/* Shared state rules, also exercised by Node's built-in unit test runner. */
const OceanModel = (() => {
  const attributes = ['Attribute 1', 'Attribute 2', 'Attribute 3'];
  const attributeKeys = ['attribute1', 'attribute2', 'attribute3'];
  const legacyTraits = ['Pressure Resistant', 'Hydrophilic', 'Aerobic', 'Heat Resistant'];
  const blank = () => ({traitNames:[], traitDraft:'', ranges:[['',''],['',''],['','']], desired:'', undesired:'',
    microbes:Array.from({length:10},()=>({name:'',values:['','',''],traits:[]}))});
  const normalize = name => name.toLowerCase().replace(/[\s_-]+/gu, '');
  function validateTraitNames(names) {
    if(!Array.isArray(names) || names.length < 2) throw new Error('Enter at least two trait names for different desired and excluded traits.');
    if(names.some(name=>typeof name!=='string' || !normalize(name))) throw new Error('Each trait needs a non-empty name.');
    const cleaned = names.map(name=>name.trim());
    if(new Set(cleaned.map(normalize)).size!==cleaned.length) throw new Error('Trait names must be unique, ignoring case, spaces, hyphens and underscores.');
    return cleaned;
  }
  const parseTraitNames = text => validateTraitNames(text.split(/\r?\n/u).map(name=>name.trim()).filter(Boolean));
  function applyTraitNames(state, names) {
    const traitNames = validateTraitNames(names);
    return {...state, traitNames, traitDraft:traitNames.join('\n'),
      desired:traitNames.includes(state.desired)?state.desired:'',
      undesired:traitNames.includes(state.undesired)?state.undesired:'',
      microbes:state.microbes.map(m=>({...m, traits:m.traits.filter(name=>traitNames.includes(name))}))};
  }
  function restoreState(stored) {
    if(!stored || typeof stored!=='object') return blank();
    try {
      const traitNames = stored.traitNames===undefined ? legacyTraits.slice() :
        Array.isArray(stored.traitNames)&&stored.traitNames.length===0 ? [] : validateTraitNames(stored.traitNames);
      const strings = (values, count) => Array.isArray(values)&&values.length===count&&values.every(v=>typeof v==='string');
      if(!Array.isArray(stored.ranges)||stored.ranges.length!==3||!stored.ranges.every(r=>strings(r,2)) ||
        !Array.isArray(stored.microbes)||stored.microbes.length!==10||!stored.microbes.every(m=>m&&strings(m.values,3)&&Array.isArray(m.traits)&&m.traits.every(t=>traitNames.includes(t))) ||
        !['',...traitNames].includes(stored.desired)||!['',...traitNames].includes(stored.undesired)) return blank();
      return {...stored, traitNames, traitDraft:typeof stored.traitDraft==='string'?stored.traitDraft:traitNames.join('\n'),
        microbes:stored.microbes.map(m=>({...m,name:typeof m.name==='string'?m.name.slice(0,40):''}))};
    } catch { return blank(); }
  }
  function withExample(state) {
    const names = validateTraitNames(state.traitNames);
    const neutral = names.filter(name=>name!==state.undesired);
    const desired = state.desired || neutral[0];
    const excluded = state.undesired || names[names.length-1];
    const a = neutral[0], b = neutral[1] || a;
    const values = [[4,5,6],[5,6,4],[6,4,5],[8,3,7],[3,7,4],[7,2,6],[4,6,5],[9,8,2],[5,5,5],[2,4,8]];
    const selections = [[desired],[a],[b],[excluded],[desired,a],[b],[a],[excluded,desired],[desired],[b,a]];
    return {...state,microbes:values.map((row,i)=>({name:'',values:row.map(String),traits:[...new Set(selections[i])]}))};
  }
  const escapeHTML = text => String(text).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  return {attributes, attributeKeys, blank, validateTraitNames, parseTraitNames, applyTraitNames, restoreState, withExample, escapeHTML};
})();
if(typeof module!=='undefined') module.exports = OceanModel;
