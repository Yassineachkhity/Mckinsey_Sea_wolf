const {attributes, attributeKeys, blank, parseTraitNames, applyTraitNames, restoreState, withExample, escapeHTML} = OceanModel;
const key = 'ocean-lab-v1';
let state = blank(), matches = [], revision = 0, screen = 'ocean';
const $ = s => document.querySelector(s);
try { state = restoreState(JSON.parse(localStorage.getItem(key))); } catch {}
const microbeName = i => state.microbes[i].name?.trim() || `Microbe ${i+1}`;
$('#ranges').innerHTML = attributes.map((a,i)=>`<div class="range-row"><label for="range-${i}-0">${a}</label><div class="range-inputs"><input id="range-${i}-0" data-range="${i}" data-end="0" type="number" step="any" placeholder="Min" aria-label="${a} minimum" required><span>to</span><input id="range-${i}-1" data-range="${i}" data-end="1" type="number" step="any" placeholder="Max" aria-label="${a} maximum" required></div></div>`).join('');
function renderTraitChoices() {
  for (const kind of ['desired','undesired']) {
    $('#'+kind).innerHTML=state.traitNames.map(name=>`<button type="button" class="trait-choice" data-kind="${kind}" data-trait="${escapeHTML(name)}" aria-pressed="false"><span>${escapeHTML(name)}</span></button>`).join('');
  }
  $('#legend-items').innerHTML=state.traitNames.map(name=>`<span>${escapeHTML(name)}</span>`).join('');
  document.querySelectorAll('.microbe-traits').forEach((el,i)=>{
    el.innerHTML='<span>Traits</span>'+state.traitNames.map(name=>`<button type="button" class="trait-choice microbe-trait" data-microbe="${i}" data-trait="${escapeHTML(name)}" aria-label="Microbe ${i+1}: ${escapeHTML(name)}" aria-pressed="false">${escapeHTML(name)}</button>`).join('');
  });
}
function applyTraitList() {
  try {
    state=applyTraitNames(state,parseTraitNames($('#trait-names').value));
    $('#trait-names').value=state.traitDraft;
    renderTraitChoices();changed();
    $('#trait-status').textContent=`${state.traitNames.length} traits available.`;
    return true;
  } catch(error) { showError(error.message,$('#trait-names'));return false; }
}
$('#apply-traits').addEventListener('click',applyTraitList);
$('#microbes').innerHTML=state.microbes.map((m,i)=>`<article class="microbe-card" id="microbe-${i}"><div class="card-header"><label class="card-title"><span class="microbe-number">${String(i+1).padStart(2,'0')}</span><input class="microbe-name" type="text" data-name="${i}" maxlength="40" placeholder="Microbe ${i+1}" aria-label="Name for microbe slot ${i+1}" title="Rename microbe" autocomplete="off" spellcheck="false"></label><span class="card-status">Awaiting values</span></div><div class="specimen" aria-hidden="true"><span class="specimen-cross">+</span><span class="organism organism-${i%5}"><i></i><i></i><i></i></span><span class="specimen-code">M-${String(i+1).padStart(2,'0')}</span></div><div class="values-row">${attributes.map((a,j)=>`<label>${a}<input type="number" step="any" data-microbe="${i}" data-attribute="${j}" placeholder="—" aria-label="Microbe ${i+1} ${a.toLowerCase()}" required></label>`).join('')}</div><div class="microbe-traits"></div><div class="card-meter" aria-hidden="true"><i></i><i></i><i></i><i></i></div></article>`).join('');
function ready(m) { return m.values.every(v=>v!==''&&Number.isFinite(Number(v))) && m.traits.length>0; }
function renderSummary() {
  $('#site-summary').innerHTML=`<dl class="note-ranges">${attributes.map((a,i)=>`<div><dt>${a}</dt><dd>${Number(state.ranges[i][0])} <span>—</span> ${Number(state.ranges[i][1])}</dd></div>`).join('')}</dl><div class="note-traits">${['desired','undesired'].map(kind=>state[kind]?`<div><span class="note-trait-label">${kind==='desired'?'Desired':'Excluded'}</span><span class="note-trait-value">${escapeHTML(state[kind])}</span></div>`:'').join('')}</div>`;
}
function setScreen(next, focus=true) {
  screen=next;
  const ocean=next==='ocean';
  $('#ocean-screen').hidden=!ocean;
  $('#ocean-screen').disabled=!ocean;
  $('#deck-screen').hidden=ocean;
  $('#deck-screen').disabled=ocean;
  document.body.classList.toggle('deck-view',!ocean);
  $('#step-ocean').toggleAttribute('aria-current',ocean);
  $('#step-deck').toggleAttribute('aria-current',!ocean);
  (ocean?$('#step-ocean'):$('#step-deck')).setAttribute('aria-current','step');
  $('#error').hidden=true;
  if(ocean) { revision++; $('#results').hidden=true; }
  else renderSummary();
  window.scrollTo({top:0,behavior:'instant'});
  if(focus) (ocean?$('#range-0-0'):$('#deck-title')).focus({preventScroll:true});
}
$('#edit-ocean').addEventListener('click',()=>setScreen('ocean'));
function continueToDeck() {
  if(!applyTraitList()) return;
  if(!$('#solver-form').reportValidity()) return;
  for(let i=0;i<3;i++) {
    const [low,high]=state.ranges[i].map(Number);
    if(!Number.isFinite(low)||!Number.isFinite(high)||Math.abs(high-low-2)>1e-10) {
      showError(`${attributes[i]} must have an upper value exactly 2 above its lower value.`,$(`#range-${i}-0`));return;
    }
  }
  if(!state.desired||!state.undesired||state.desired===state.undesired) {
    showError('Select a desired trait and a different excluded trait.', $(`#${!state.desired?'desired':'undesired'} button`));return;
  }
  changed();
  setScreen('deck');
}
function refresh() {
  $('#trait-names').value=state.traitDraft;
  renderTraitChoices();
  document.querySelectorAll('[data-range]').forEach(el=>el.value=state.ranges[+el.dataset.range][+el.dataset.end]);
  document.querySelectorAll('input[data-microbe]').forEach(el=>el.value=state.microbes[+el.dataset.microbe].values[+el.dataset.attribute]);
  document.querySelectorAll('[data-name]').forEach(el=>el.value=state.microbes[+el.dataset.name].name||'');
  refreshSelection();
}
function refreshSelection() {
  document.querySelectorAll('[data-trait]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.kind ? state[el.dataset.kind]===el.dataset.trait : state.microbes[+el.dataset.microbe].traits.includes(el.dataset.trait)));
  state.microbes.forEach((m,i)=>{
    const card=$('#microbe-'+i), done=ready(m);
    card.setAttribute('aria-label',microbeName(i));
    card.querySelectorAll('[data-attribute]').forEach(el=>el.setAttribute('aria-label',`${microbeName(i)} ${attributes[+el.dataset.attribute].toLowerCase()}`));
    card.querySelectorAll('[data-trait]').forEach(el=>el.setAttribute('aria-label',`${microbeName(i)}: ${el.dataset.trait}`));
    card.classList.toggle('ready',done);
    card.classList.remove('matched');
    const steps=m.values.filter(v=>v!==''&&Number.isFinite(Number(v))).length+(m.traits.length?1:0);
    card.querySelectorAll('.card-meter i').forEach((bar,j)=>bar.classList.toggle('filled',j<steps));
    card.querySelector('.card-status').textContent=done?'✓ Equipped':m.values.every(v=>v!=='')?'Select traits':'Empty slot';
  });
  $('.deck-progress').setAttribute('aria-valuenow',state.microbes.filter(ready).length);
  $('.deck-progress span').style.width=`${state.microbes.filter(ready).length*10}%`;
  $('#progress').textContent=`${state.microbes.filter(ready).length} of 10 microbes ready`;
}
function changed() {
  revision++;
  $('#error').hidden=true;
  document.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
  if(matches.length || $('#results').classList.contains('has-results')) {
    matches=[];
    $('#results').className='results panel';
    $('#results').innerHTML='';
    $('#results').hidden=true;
  }
  try { localStorage.setItem(key,JSON.stringify(state)); $('#save-status').textContent='Saved automatically in this browser.'; }
  catch { $('#save-status').textContent='Browser storage unavailable. Keep this tab open.'; }
  refreshSelection();
}
$('#solver-form').addEventListener('input',e=>{
  const el=e.target;
  if(el.id==='trait-names') {
    state.traitDraft=el.value;
    $('#trait-status').textContent='List edited. Apply it to update the choices.';
  } else if(el.dataset.name!==undefined) {
    state.microbes[+el.dataset.name].name=el.value.slice(0,40);
  } else if(el.dataset.range!==undefined) {
    const i=+el.dataset.range, end=+el.dataset.end;
    state.ranges[i][end]=el.value;
    // Editing either endpoint keeps the original algorithm's width-of-two rule.
    const other=el.value===''?'':String(Number((Number(el.value)+(end===0?2:-2)).toPrecision(14)));
    state.ranges[i][1-end]=other;
    $(`#range-${i}-${1-end}`).value=other;
  } else if(el.dataset.attribute!==undefined) state.microbes[+el.dataset.microbe].values[+el.dataset.attribute]=el.value;
  changed();
});
$('#microbes').addEventListener('keydown',e=>{
  if(e.target.matches('[data-name]') && e.key==='Enter') { e.preventDefault();e.target.blur(); }
});
$('#solver-form').addEventListener('click',e=>{
  const el=e.target.closest('[data-trait]');
  if(!el) return;
  const trait=el.dataset.trait;
  if(el.dataset.kind) {
    const kind=el.dataset.kind, other=kind==='desired'?'undesired':'desired';
    if(state[other]===trait) { showError('Choose different traits for desired and excluded.'); return; }
    state[kind]=state[kind]===trait?'':trait;
  } else {
    const m=state.microbes[+el.dataset.microbe];
    m.traits=m.traits.includes(trait)?m.traits.filter(t=>t!==trait):[...m.traits,trait];
  }
  changed();
});
$('#example').addEventListener('click',()=>{
  if(state.microbes.some(m=>m.name?.trim()||m.values.some(v=>v!=='')) && !confirm('Replace the current entries with an example?')) return;
  state=withExample(state); changed();refresh();
});
$('#reset').addEventListener('click',()=>{
  if(!confirm('Clear all ocean conditions and microbe entries?')) return;
  state=blank();$('#trait-status').textContent='';refresh();changed();setScreen('ocean');
});
function showError(message, focus) {
  $('#error').textContent=message;$('#error').hidden=false;
  if(focus) { focus.setAttribute('aria-invalid','true');focus.focus(); }
}
$('#solver-form').addEventListener('submit',async e=>{
  e.preventDefault();$('#error').hidden=true;
  if(screen==='ocean') { continueToDeck();return; }
  if(!state.desired || !state.undesired) { showError('Choose both a desired and an excluded ocean trait.', $(`#${!state.desired?'desired':'undesired'} button`));return; }
  const missing=state.microbes.findIndex(m=>!m.traits.length);
  if(missing>=0) { showError(`Select at least one trait for ${microbeName(missing)}.`,$(`#microbe-${missing} button`));return; }
  const rev=revision;
  $('#solve').disabled=true;$('#solve').textContent='Checking combinations…';
  try {
    const response=await fetch('/api/solve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
    const result=await response.json();
    if(rev!==revision) return;
    if(!response.ok) throw new Error(result.error||'Unable to check these entries.');
    matches=result.matches;
    $('#results').hidden=false;
    if(matches.length) renderRankedResults(result);
    else {
      $('#results').className='results panel has-results';
      $('#results').innerHTML='<div class="eyebrow">NO ELIGIBLE COMBINATIONS</div><h2>Fewer than three microbes remain.</h2><p></p>';
      $('#results p').textContent=`${result.eligible} of 10 microbes remain after excluding every microbe with ${state.undesired}. At least three are needed to form a combination. No excluded microbes are included in the results.`;
    }
    $('#results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
  } catch(error) { showError(error instanceof TypeError?'Cannot reach the solver. Make sure python server.py is still running.':error.message); }
  finally { $('#solve').disabled=false;$('#solve').innerHTML='Run match <span>→</span>'; }
});
function renderRankedResults(result) {
  const best=result.best_score;
  const bestCount=matches.filter(m=>m.score===best).length;
  const scores=[...new Set(matches.map(m=>m.score))];
  const excluded=result.excluded_ids.map(id=>`${microbeName(id-1)} (#${id})`).join(', ');
  $('#results').className='results panel has-results ranked-results';
  $('#results').innerHTML=`<div class="results-top"><div><div class="eyebrow">ALL ELIGIBLE COMBINATIONS</div><h2>Best achievable score: ${best}%</h2><p>${matches.length} combinations &middot; ${bestCount} ${bestCount===1?'combination at the top score':'tied for the top score'} &middot; ${result.eligible} eligible microbes</p></div><div class="best-score"><strong>${best}%</strong><span>BEST AVAILABLE</span></div></div>
    <div class="score-distribution" aria-label="Combination counts by score">${scores.map(score=>`<span class="score-count"><strong>${score}%</strong><span>${matches.filter(m=>m.score===score).length} combinations</span></span>`).join('')}</div>
    <div class="scoring-note"><p><strong>20% per check:</strong> Attribute 1 average, Attribute 2 average, Attribute 3 average, desired trait present, excluded trait absent. Range boundaries count as passing.</p><p>Equal scores share a rank; ties are listed by microbe number. These percentages measure the five checks, not a probability of success.</p><p><strong>Removed before scoring:</strong> ${escapeHTML(excluded||'None')}. Every listed combination passes the excluded-trait check (+20%).</p></div>
    <div class="ranked-table-wrap" role="region" aria-label="Ranked combinations, highest score first" tabindex="0"><table class="ranked-table"><caption class="sr-only">All ${matches.length} allowed combinations ranked by score. Each of the five conditions is worth 20 percent.</caption><thead><tr><th scope="col">Rank</th><th scope="col">Combination</th><th scope="col">Score</th>${attributes.map((a,i)=>`<th scope="col">${a}<small>Target ${Number(state.ranges[i][0])} &ndash; ${Number(state.ranges[i][1])}</small></th>`).join('')}<th scope="col">Desired<small>${escapeHTML(state.desired)}</small></th><th scope="col">Excluded<small>${escapeHTML(state.undesired)}</small></th></tr></thead><tbody>${matches.map(m=>{
      const rank=matches.findIndex(other=>other.score===m.score)+1;
      return `<tr class="${m.score===best?'top-ranked':''}"><td><span class="rank-number">${rank}</span></td><td><div class="combo-names">${m.ids.map(id=>`<span><small>#${id}</small>${escapeHTML(microbeName(id-1))}</span>`).join('')}</div></td><td><strong class="combo-score">${m.score}%</strong><span class="score-bar" aria-hidden="true"><span style="width:${m.score}%"></span></span><small>${m.score/20}/5 checks</small></td>${attributes.map((a,i)=>{
        const passed=m.checks[attributeKeys[i]];
        return `<td class="check-cell ${passed?'check-pass':'check-fail'}"><strong>${Number(m.decimals[i].toFixed(4))}</strong><span>${passed?'&#10003; In range':'&#10005; Outside'}</span><small class="exact-average">Exact: ${m.averages[i]}</small></td>`;
      }).join('')}<td class="check-cell ${m.checks.desired?'check-pass':'check-fail'}"><span>${m.checks.desired?'&#10003; Present':'&#10005; Missing'}</span><small>${m.checks.desired?escapeHTML(m.carriers.map(id=>microbeName(id-1)).join(', ')):'No carrier'}</small></td><td class="check-cell check-pass"><span>&#10003; Absent</span><small>+20%</small></td></tr>`;
    }).join('')}</tbody></table></div>`;
}

refresh();
setScreen('ocean',false);
