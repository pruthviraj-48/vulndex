/* ============================================================
   VULNDEX // app engine
   ============================================================ */
(() => {
'use strict';

const VULNS = (window.VULNS || []).slice().sort((a,b)=>a.id-b.id);
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SEV = ['Critical','High','Medium','Low'];
const LS_KEY = 'vulndex.done.v1';

/* ---------- progress store ---------- */
const Store = {
  done: new Set(JSON.parse(localStorage.getItem(LS_KEY)||'[]')),
  toggle(id){ this.done.has(id)?this.done.delete(id):this.done.add(id); this.save(); },
  has(id){ return this.done.has(id); },
  save(){ localStorage.setItem(LS_KEY, JSON.stringify([...this.done])); },
  reset(){ this.done.clear(); this.save(); }
};

/* ---------- state ---------- */
let state = { q:'', sev:'all', cat:'all', unpracticed:false };

/* ---------- search index (memoised per vuln) ---------- */
function searchHay(v){
  if(v._hay) return v._hay;
  const c = v.chain||{}, r = v.report||{};
  const parts = [
    v.name, v.category, v.summary, v.description, v.cwe,
    (v.tags||[]).join(' '),
    (v.tools||[]).map(t=>t.name||t).join(' '),
    (v.payloads||[]).join(' '),
    (v.bypass||[]).join(' '),
    (v.annotatedPayloads||[]).map(a=>(a.p||'')+' '+(a.c||'')).join(' '),
    (v.encoding||[]).map(e=>(e.layer||'')+' '+(e.sample||'')+' '+(e.note||'')).join(' '),
    (v.levels?['beginner','intermediate','advanced'].map(k=>(v.levels[k]||[]).map(s=>(s.step||'')+' '+(s.detail||'')+' '+(s.how?(s.how.t||'')+' '+(s.how.c||''):'')).join(' ')).join(' '):''),
    (c.feeders||[]).map(f=>(f.from||'')+' '+(f.how||'')).join(' '),
    (c.pivots||[]).map(p=>(p.to||'')+' '+(p.how||'')+' '+(p.gain||'')).join(' '),
    c.scenario ? (c.scenario.name||'')+' '+((c.scenario.steps||[]).join(' '))+' '+(c.scenario.result||'') : '',
    [r.title, r.summary, r.impact, (r.steps||[]).join(' '), (r.remediation||[]).join(' ')].join(' '),
    (v.notes||[]).join(' ')
  ];
  return v._hay = parts.join(' ').toLowerCase();
}

/* ================= BOOT INTRO ================= */
function boot(){
  const el = $('#boot-log'); const box = $('#boot');
  const lines = [
    '[ VULNDEX bootloader v1.21 ]',
    'initializing offensive knowledge core ...... OK',
    `loading vulnerability dossiers ............. ${VULNS.length} entries`,
    'mounting /labs /payloads /bypass /tools .... OK',
    'verifying scope: AUTHORIZED TESTING ONLY ... OK',
    'arming the codex ........................... READY',
    '',
    'root@vulndex:~$ ./launch --mode=study_'
  ];
  if(sessionStorage.getItem('booted')){ box.classList.add('done'); return; }
  let i=0,c=0,txt='';
  const skip=()=>{ box.classList.add('done'); sessionStorage.setItem('booted','1'); };
  $('#boot-skip').onclick=skip;
  (function type(){
    if(i>=lines.length){ setTimeout(skip,650); return; }
    if(c<=lines[i].length){ el.textContent = txt + lines[i].slice(0,c) + '▋'; c++; setTimeout(type, 12); }
    else { txt += lines[i] + '\n'; i++; c=0; setTimeout(type, 90); }
  })();
}

/* ================= MATRIX BG ================= */
function matrix(){
  const cv = $('#matrix'); if(!cv) return;
  if(getComputedStyle(cv).display==='none') return;   // backdrop fx disabled in the flat theme
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const ctx = cv.getContext('2d');
  let w,h,cols,drops;
  const glyphs = 'アカサタナ01██<>/{}#$%&XSSSQLiSSRF';
  function size(){ w=cv.width=innerWidth; h=cv.height=innerHeight; cols=Math.floor(w/16); drops=Array(cols).fill(0).map(()=>Math.random()*-50); }
  size(); addEventListener('resize', size);
  let t=0;
  (function draw(){
    t++;
    if(t%2===0){
      ctx.fillStyle='rgba(8,8,10,.16)'; ctx.fillRect(0,0,w,h);
      ctx.font='14px JetBrains Mono';
      for(let i=0;i<cols;i++){
        const ch = glyphs[Math.floor(Math.random()*glyphs.length)];
        ctx.fillStyle = Math.random()>.985 ? '#e11d2a' : '#33333a';
        ctx.fillText(ch, i*16, drops[i]*16);
        if(drops[i]*16>h && Math.random()>.975) drops[i]=0;
        drops[i]++;
      }
    }
    requestAnimationFrame(draw);
  })();
}

/* ================= HERO STATS ================= */
function renderStats(){
  $('#stat-total').textContent = VULNS.length;
  const crit = VULNS.filter(v=>v.severity==='Critical').length;
  const cats = new Set(VULNS.map(v=>v.category)).size;
  const done = Store.done.size;
  $('#hero-stats').innerHTML = `
    <div class="hstat c-cyan"><div class="num">${VULNS.length}</div><div class="lbl">VULNERABILITIES</div></div>
    <div class="hstat c-mag"><div class="num">${cats}</div><div class="lbl">ATTACK CLASSES</div></div>
    <div class="hstat c-amber"><div class="num">${crit}</div><div class="lbl">CRITICAL RATED</div></div>
    <div class="hstat c-lime"><div class="num" id="hs-done">${done}</div><div class="lbl">PRACTICED</div></div>`;
  $$('.hstat').forEach(s=>bindTilt(s,12));
}

/* ================= FILTER CONTROLS ================= */
function renderChips(){
  const wrap = $('#severity-chips');
  const items = ['all',...SEV];
  wrap.innerHTML = items.map(s=>`<button class="chip ${state.sev===s?'on':''}" data-sev="${s}">${s==='all'?'ALL':s.toUpperCase()}</button>`).join('');
  $$('.chip',wrap).forEach(c=>c.onclick=()=>{ state.sev=c.dataset.sev; renderChips(); renderGrid(); });
}
function renderCats(){
  const rail = $('#cat-rail');
  const counts = {};
  VULNS.forEach(v=>counts[v.category]=(counts[v.category]||0)+1);
  const cats = ['all',...Object.keys(counts)];
  rail.innerHTML = cats.map(c=>{
    const n = c==='all'?VULNS.length:counts[c];
    return `<button class="cat-pill ${state.cat===c?'on':''}" data-cat="${esc(c)}">${c==='all'?'◆ All':esc(c)}<span class="n">${n}</span></button>`;
  }).join('');
  $$('.cat-pill',rail).forEach(p=>p.onclick=()=>{ state.cat=p.dataset.cat; renderCats(); renderGrid(); });
}
function renderProgress(){
  const total = VULNS.length, done = Store.done.size;
  const pct = total? Math.round(done/total*100):0;
  $('#progress-fill').style.width = pct+'%';
  $('#progress-label').textContent = `${done} / ${total}  ·  ${pct}%`;
  const hs = $('#hs-done'); if(hs) hs.textContent = done;
}

/* ================= GRID ================= */
function matches(v){
  if(state.sev!=='all' && v.severity!==state.sev) return false;
  if(state.cat!=='all' && v.category!==state.cat) return false;
  if(state.unpracticed && Store.has(v.id)) return false;
  if(state.q && !searchHay(v).includes(state.q.toLowerCase())) return false;
  return true;
}
function renderGrid(){
  const grid = $('#grid'); const list = VULNS.filter(matches);
  const empty = $('#empty'); empty.hidden = list.length>0;
  empty.textContent = state.q
    ? `// no vulnerabilities match “${state.q}”${state.cat!=='all'?' in '+state.cat:''}`
    : '// no vulnerabilities match the current filter';
  grid.setAttribute('aria-label', `${list.length} of ${VULNS.length} vulnerabilities`);
  grid.innerHTML = list.map(v=>`
    <a class="card ${Store.has(v.id)?'done':''}" href="#/vuln/${v.slug}" data-slug="${v.slug}" aria-label="${esc(v.name)} — ${esc(v.severity)} severity, ${esc(v.category)}">
      <div class="card-top">
        <span class="card-id">#${String(v.id).padStart(3,'0')}</span>
        <span class="sev sev-${v.severity}">${v.severity}</span>
      </div>
      <h3 class="card-name">${esc(v.name)}</h3>
      <p class="card-sum">${esc(v.summary)}</p>
      <div class="card-foot">
        <span class="card-cat">${esc(v.category)}</span>
        <span class="card-done-flag">✓ practiced</span>
      </div>
    </a>`).join('');
  $$('.card',grid).forEach(c=>bindTilt(c,9));
}

/* ================= TILT (disabled — flat professional UI) ================= */
const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
function bindTilt(){ /* no-op: 3D cursor tilt removed for a flat, professional look */ }

/* ================= LEVELED METHODOLOGY ================= */
// uses v.levels {beginner,intermediate,advanced} when present; otherwise derives
// a graded path from the existing ordered methodology + bypass techniques.
function levelize(v){
  const L = v.levels;
  if(L && (L.beginner||L.intermediate||L.advanced)){
    const norm = a => (a||[]).map(s=> typeof s==='string'?{step:s,detail:'',how:null}:{step:s.step||s.act||'',detail:s.detail||s.note||'',how:s.how||null});
    return { beginner:norm(L.beginner), intermediate:norm(L.intermediate), advanced:norm(L.advanced) };
  }
  const steps = (v.howToTest||[]).map((s,i)=>({step:s, detail:(v.testNotes&&v.testNotes[i])||''}));
  const n = steps.length;
  if(!n) return null;
  const a = Math.ceil(n/3), b = Math.ceil(n*2/3);
  const advanced = steps.slice(b).concat((v.bypass||[]).map(bp=>({step:bp, detail:'filter / WAF bypass'})));
  return { beginner:steps.slice(0,a), intermediate:steps.slice(a,b), advanced };
}
const LEVELS = [
  {k:'beginner',     t:'Beginner',     i:'①', d:'Recon &amp; detection — map the surface and confirm the bug exists.'},
  {k:'intermediate', t:'Intermediate', i:'②', d:'Exploitation — turn the finding into concrete impact.'},
  {k:'advanced',     t:'Advanced',     i:'③', d:'Chaining, automation &amp; filter / WAF bypass — push it to maximum impact.'},
];
function stepLi(s){
  const step = typeof s==='string'?s:s.step;
  const det  = typeof s==='string'?'':s.detail;
  const h    = (s&&typeof s==='object')?s.how:null;
  const howHtml = (h&&(h.t||h.m||h.c))
    ? `<span class="step-how"><span class="sh-lead">▸ how to test</span>${h.t?`<span class="sh-t">⚙ ${esc(h.t)}</span>`:''}${h.m?`<span class="sh-m">${esc(h.m)}</span>`:''}${h.c?`<code class="sh-c">${esc(h.c)}</code>`:''}</span>`
    : '';
  return `<li><span class="step-act">${esc(step)}</span>${det?`<span class="step-desc">↳ ${esc(det)}</span>`:''}${howHtml}</li>`;
}
function renderLevels(v){
  const lv = levelize(v);
  if(!lv) return '<ol class="steps"><li>Methodology coming soon.</li></ol>';
  const seg = LEVELS.map((x,i)=>`<button class="lvl ${i===0?'on':''}" data-lvl="${x.k}"><span class="lvl-i">${x.i}</span>${x.t}<span class="lvl-n">${(lv[x.k]||[]).length}</span></button>`).join('');
  const panes = LEVELS.map((x,i)=>{
    const items = lv[x.k]||[];
    const body = items.length? `<ol class="steps">${items.map(stepLi).join('')}</ol>` : '<p>// no steps catalogued at this level yet — see the other levels and the Bypass / CTF tabs.</p>';
    return `<div class="lvl-pane lvl-${x.k} ${i===0?'on':''}" data-lvlpane="${x.k}"><p class="lvl-intro">${x.d}</p>${body}</div>`;
  }).join('');
  return `<div class="lvl-switch" data-lvlswitch>${seg}</div>${panes}`;
}

/* ================= DETAIL DOSSIER ================= */
function block(title){ return arr=>arr&&arr.length? arr : null; }
function codeList(arr){
  return `<div class="codeblock"><button class="copy">copy</button><pre>${arr.map(esc).join('\n')}</pre></div>`;
}
function statusChip(s){
  s=(s||'').toString().toLowerCase();
  const k = /win|pass|success|work|exec/.test(s)?'win' : /partial|maybe|pending|active/.test(s)?'partial' : /fail|block|no\b|❌/.test(s)?'fail' : 'note';
  const lbl={win:'WORKED',fail:'BLOCKED',partial:'PARTIAL',note:'NOTE'}[k];
  return `<span class="atk-st atk-${k}">${lbl}</span>`;
}
function renderCtf(c){
  if(!c || typeof c!=='object') return '<p>// hands-on lab walkthrough is being added for this class. Meanwhile use the Test A→Z and Payloads tabs against a PortSwigger lab or a CTF target you are authorized to test.</p>';
  let h='';
  if(c.scenario) h+=`<div class="ctf-scn"><span class="ctf-tag">⌖ SCENARIO</span><p>${esc(c.scenario)}</p></div>`;
  if(Array.isArray(c.walkthrough)&&c.walkthrough.length) h+=`<h4 class="sub">▸ Walkthrough — recon → confirm → exploit</h4><ol class="steps">${c.walkthrough.map(s=>`<li><span class="step-act">${esc(s)}</span></li>`).join('')}</ol>`;
  if(Array.isArray(c.attempts)&&c.attempts.length){
    h+=`<h4 class="sub">▸ Bypass attempts — what failed &amp; why</h4><div class="atk-list">`+
      c.attempts.map(a=>`<div class="atk"><div class="atk-top">${a.payload?`<code>${esc(a.payload)}</code>`:'<code>&nbsp;</code>'}${statusChip(a.status)}</div>${a.result?`<div class="atk-r"><b>↳ result:</b> ${esc(a.result)}</div>`:''}${a.why?`<div class="atk-w"># ${esc(a.why)}</div>`:''}</div>`).join('')+`</div>`;
  }
  if(c.working&&(c.working.payload||c.working.why)){
    h+=`<h4 class="sub">✓ Working exploit</h4>`;
    if(c.working.payload) h+=`<div class="ctf-win"><button class="copy">copy</button><code>${esc(c.working.payload)}</code></div>`;
    if(c.working.why) h+=`<p class="ctf-why">${esc(c.working.why)}</p>`;
  }
  if(Array.isArray(c.lessons)&&c.lessons.length) h+=`<h4 class="sub">▸ Key lessons</h4><ul class="bullets">${c.lessons.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`;
  if(Array.isArray(c.cheats)&&c.cheats.length) h+=`<h4 class="sub">▸ Reusable cheat sheet</h4>${codeList(c.cheats)}`;
  if(c.credit) h+=`<div class="ctf-credit">${esc(c.credit)}</div>`;
  return h || '<p>// walkthrough coming soon.</p>';
}
function cweTag(cwe){
  const m=/CWE-(\d+)/i.exec(cwe||'');
  return m
    ? `<a class="tag tag-cwe" href="https://cwe.mitre.org/data/definitions/${m[1]}.html" target="_blank" rel="noopener" title="MITRE CWE-${m[1]} definition">${esc(cwe)} ↗</a>`
    : `<span class="tag">${esc(cwe)}</span>`;
}
function dossierMarkdown(v){
  const lv = levelize(v) || {beginner:[],intermediate:[],advanced:[]};
  const tier = (t,arr)=> arr&&arr.length ? `\n### ${t}\n`+arr.map((s,i)=>{const h=s&&s.how; return `${i+1}. ${typeof s==='string'?s:s.step}${(s&&s.detail)?` — ${s.detail}`:''}${(h&&(h.t||h.c))?`\n   - _How to test:_ ${h.t||''}${h.m?` — ${h.m}`:''}${h.c?`  \`${h.c}\``:''}`:''}`;}).join('\n')+'\n' : '';
  const list = (h,arr,bul='-')=> arr&&arr.length ? `\n## ${h}\n`+arr.map(x=>`${bul} ${typeof x==='string'?x:(x.name||x)}`).join('\n')+'\n' : '';
  let m = `# ${v.name}\n\n`;
  m += `**Severity:** ${v.severity}`; if(v.cwe) m+=`  ·  **${v.cwe}**`; m+=`  ·  **Category:** ${v.category}\n\n`;
  m += `> ${v.summary}\n`;
  if(v.description) m += `\n${v.description}\n`;
  m += `\n## Test A→Z`;
  m += tier('Beginner — recon & detection', lv.beginner);
  m += tier('Intermediate — exploitation', lv.intermediate);
  m += tier('Advanced — chaining, automation & bypass', lv.advanced);
  m += list('Lab Setup', Array.isArray(v.labSetup)?v.labSetup:(v.labSetup?[v.labSetup]:[]));
  if(v.payloads&&v.payloads.length) m += `\n## Payloads\n\`\`\`\n${v.payloads.join('\n')}\n\`\`\`\n`;
  if(v.encoding&&v.encoding.length) m += `\n## Encode / Decode lab\n`+v.encoding.map(e=>`- **${e.layer}** — \`${e.sample}\`  \n  ${e.note}`).join('\n')+'\n';
  m += list('WAF / Filter Bypass', v.bypass);
  const c=v.chain;
  if(c){
    m += `\n## Chaining\n`;
    if((c.feeders||[]).length) m += `**Leads in:**\n`+c.feeders.map(f=>`- ${f.from} → ${v.name}: ${f.how}`).join('\n')+'\n';
    if((c.pivots||[]).length) m += `\n**Pivots out:**\n`+c.pivots.map(p=>`- ${v.name} → ${p.to}: ${p.how}${p.gain?` (${p.gain})`:''}`).join('\n')+'\n';
    if(c.scenario) m += `\n**Kill-chain — ${c.scenario.name||'worked example'}:**\n`+(c.scenario.steps||[]).map((s,i)=>`${i+1}. ${s}`).join('\n')+(c.scenario.result?`\n\n_Outcome: ${c.scenario.result}_`:'')+'\n';
  }
  if(v.report) m += `\n## Report Write-Up\n`+reportMarkdown(v,v.report);
  m += list('Tools', (v.tools||[]).map(t=>typeof t==='string'?t:(t.desc?`${t.name} — ${t.desc}`:t.name)));
  if(v.references&&v.references.length) m += `\n## References\n`+v.references.map(r=>`- [${r.title}](${r.url})`).join('\n')+'\n';
  return m;
}
function renderChain(v){
  const c = v.chain;
  if(!c || typeof c!=='object') return '<p>// attack-chaining map is being added for this class — meanwhile the Test A→Z <b>Advanced</b> tier lists chaining ideas.</p>';
  let h='';
  if(Array.isArray(c.feeders)&&c.feeders.length){
    h+=`<h4 class="sub">▣ Leads in — bugs that set this one up</h4><div class="chain-list">`+
      c.feeders.map(o=>`<div class="chain-row chain-in"><div class="chain-flow"><span class="chain-node chain-src">${o.slug?`<a class="chain-link" href="#/vuln/${esc(o.slug)}">${esc(o.from)}</a>`:esc(o.from)}</span><span class="chain-arrow">⟶</span><span class="chain-node chain-cur">${esc(v.name)}</span></div><div class="chain-how">${esc(o.how)}</div></div>`).join('')+`</div>`;
  }
  if(Array.isArray(c.pivots)&&c.pivots.length){
    h+=`<h4 class="sub">▶ Pivots out — where this attack escalates next</h4><div class="chain-list">`+
      c.pivots.map(o=>`<div class="chain-row chain-out"><div class="chain-flow"><span class="chain-node chain-cur">${esc(v.name)}</span><span class="chain-arrow">⟶</span><span class="chain-node chain-dst">${o.slug?`<a class="chain-link" href="#/vuln/${esc(o.slug)}">${esc(o.to)}</a>`:esc(o.to)}</span></div><div class="chain-how">${esc(o.how)}${o.gain?` <span class="chain-gain">▸ ${esc(o.gain)}</span>`:''}</div></div>`).join('')+`</div>`;
  }
  if(c.scenario&&(c.scenario.steps||c.scenario.name)){
    h+=`<h4 class="sub">⛓ Full kill-chain${c.scenario.name?` — ${esc(c.scenario.name)}`:''}</h4>`;
    if(Array.isArray(c.scenario.steps)&&c.scenario.steps.length) h+=`<ol class="steps chain-steps">${c.scenario.steps.map(s=>`<li><span class="step-act">${esc(s)}</span></li>`).join('')}</ol>`;
    if(c.scenario.result) h+=`<div class="chain-result"><b>↳ Outcome:</b> ${esc(c.scenario.result)}</div>`;
  }
  return h || '<p>// chaining map coming soon.</p>';
}
function reportMarkdown(v,r){
  const steps=Array.isArray(r.steps)?r.steps:[];
  const rem=Array.isArray(r.remediation)?r.remediation:(r.remediation?[r.remediation]:[]);
  let m=`# ${r.title||v.name}\n\n`;
  m+=`**Severity:** ${r.severity||v.severity}`;
  if(r.cvss) m+=`  \n**CVSS:** ${r.cvss}`;
  if(v.cwe) m+=`  \n**CWE:** ${v.cwe}`;
  m+=`\n\n`;
  if(r.summary) m+=`## Summary\n${r.summary}\n\n`;
  if(steps.length) m+=`## Steps to Reproduce\n`+steps.map((s,i)=>`${i+1}. ${s}`).join('\n')+`\n\n`;
  if(r.impact) m+=`## Impact\n${r.impact}\n\n`;
  if(rem.length) m+=`## Remediation\n`+rem.map(x=>`- ${x}`).join('\n')+`\n`;
  return m;
}
function renderReport(v){
  const r = v.report;
  if(!r || typeof r!=='object') return '<p>// vulnerability-report template is being added for this class.</p>';
  const steps=Array.isArray(r.steps)?r.steps:[];
  const rem=Array.isArray(r.remediation)?r.remediation:(r.remediation?[r.remediation]:[]);
  const sev=r.severity||v.severity;
  let h=`<p class="rep-intro">A ready-to-adapt write-up for this finding — the same skeleton a triager expects in a bug-bounty or pentest report. Fill the brackets with your target's specifics.</p>`;
  h+=`<div class="report-card">`;
  h+=`<div class="rep-row"><span class="rep-k">Title</span><span class="rep-v">${esc(r.title||v.name)}</span></div>`;
  h+=`<div class="rep-row"><span class="rep-k">Severity</span><span class="rep-v"><span class="sev sev-${esc(sev)}">${esc(sev)}</span>${r.cvss?`<span class="rep-cvss">${esc(r.cvss)}</span>`:''}${v.cwe?`<span class="rep-cwe">${esc(v.cwe)}</span>`:''}</span></div>`;
  if(r.summary) h+=`<div class="rep-sec"><div class="rep-h">① Summary</div><p>${esc(r.summary)}</p></div>`;
  if(steps.length) h+=`<div class="rep-sec"><div class="rep-h">② Steps to reproduce / PoC</div><ol class="steps">${steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>`;
  if(r.impact) h+=`<div class="rep-sec"><div class="rep-h">③ Business impact</div><p>${esc(r.impact)}</p></div>`;
  if(rem.length) h+=`<div class="rep-sec"><div class="rep-h">④ Remediation</div><ul class="bullets">${rem.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
  h+=`</div>`;
  h+=`<div class="rep-copy"><button class="copy">⧉ copy full report as Markdown</button><pre class="rep-md">${esc(reportMarkdown(v,r))}</pre></div>`;
  return h;
}
function activateTab(root, key, focusIt){
  $$('.tab',root).forEach(t=>{ const on=t.dataset.tab===key;
    t.classList.toggle('on',on); t.setAttribute('aria-selected',on?'true':'false'); t.tabIndex=on?0:-1;
    if(on&&focusIt) t.focus();
  });
  $$('.panel',root).forEach(p=>p.classList.toggle('on',p.dataset.panel===key));
}
function renderDetail(slug, tab){
  const v = VULNS.find(x=>x.slug===slug);
  const root = $('#view-detail');
  if(!v){ root.innerHTML='<p class="empty">// dossier not found</p>'; return; }

  const tools = (v.tools||[]).map(t=> typeof t==='string'?{name:t,desc:''}:t);
  const refs  = (v.references||[]);
  const lab   = Array.isArray(v.labSetup)? v.labSetup : (v.labSetup?[v.labSetup]:[]);

  const tabs = [
    {k:'overview', t:'Overview',   i:'◍'},
    {k:'test',     t:'Test A→Z',   i:'⌁'},
    {k:'lab',      t:'Lab Setup',  i:'⚒'},
    {k:'payloads', t:'Payloads',   i:'⟁'},
    {k:'bypass',   t:'WAF Bypass', i:'⛨'},
    {k:'chain',    t:'Chaining',   i:'⛓'},
    {k:'ctf',      t:'CTF Lab',    i:'⚑'},
    {k:'report',   t:'Write-Up',   i:'✍'},
    {k:'reports',  t:'Reports',    i:'❖'},
    {k:'tools',    t:'Tools',      i:'⚙'},
    {k:'refs',     t:'References', i:'⌖'},
  ];
  const reports = (v.reports||[]);
  const notes = (v.notes||[]);
  const apl = (v.annotatedPayloads||[]);
  const ctf = v.ctf || null;

  root.innerHTML = `
    <div class="back-link" id="back">⟵ back to codex</div>
    <div class="detail-head">
      <div>
        <span class="sev sev-${v.severity}">${v.severity}</span>
        <span class="card-id" style="margin-left:10px">#${String(v.id).padStart(3,'0')} · ${esc(v.category)}</span>
        <h1 class="detail-title">${esc(v.name)}</h1>
        <div class="detail-meta">
          ${v.cwe?cweTag(v.cwe):''}
          ${(v.tags||[]).map(t=>`<button class="tag tag-btn" data-tag="${esc(t)}" title="Filter the codex by #${esc(t)}">#${esc(t)}</button>`).join('')}
        </div>
      </div>
      <div class="detail-actions">
        <button class="ghost-btn" id="export-md" title="Copy this whole dossier as Markdown">⧉ Export .md</button>
        <button class="mark-done ${Store.has(v.id)?'on':''}" id="markdone">${Store.has(v.id)?'✓ Practiced':'◌ Mark Practiced'}</button>
      </div>
    </div>

    <div class="detail-layout">
      <div class="tabs" role="tablist" aria-label="Dossier sections">${tabs.map((tb,i)=>`<button class="tab ${i===0?'on':''}" data-tab="${tb.k}" role="tab" id="tab-${tb.k}" aria-controls="panel-${tb.k}" aria-selected="${i===0?'true':'false'}" tabindex="${i===0?'0':'-1'}"><span class="ti" aria-hidden="true">${tb.i}</span>${tb.t}</button>`).join('')}</div>
      <div class="panels">

        <div class="panel on" data-panel="overview">
          <h3>What it is</h3>
          <p class="lead">${esc(v.summary)}</p>
          <p>${esc(v.description||'')}</p>
          ${notes.length? `<div class="notes"><div class="notes-h">⚐ Field notes &amp; gotchas <span class="src">// distilled from HackTricks</span></div><ul class="bullets">${notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>`:''}
          <div class="callout legal"><span class="ci">⚠</span><p><b>Authorized use only.</b> Test these techniques exclusively against systems you own or have explicit written permission to assess (your own lab, a CTF, or a scoped engagement).</p></div>
        </div>

        <div class="panel" data-panel="test">
          <h3>How to test — Beginner → Advanced</h3>
          ${renderLevels(v)}
        </div>

        <div class="panel" data-panel="lab">
          <h3>Build a practice lab</h3>
          ${lab.length?`<ol class="steps">${lab.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:'<p>Use a deliberately vulnerable app (DVWA, OWASP Juice Shop, PortSwigger Academy, bWAPP) to reproduce this safely.</p>'}
        </div>

        <div class="panel" data-panel="payloads">
          <h3>Payloads &amp; probes</h3>
          ${(v.payloads&&v.payloads.length)? codeList(v.payloads) : '<p>No raw payloads for this class — see the Test A→Z and Bypass tabs.</p>'}
          ${apl.length? `<h4 class="sub">⌁ Annotated payloads — what each one does</h4>${apl.map(a=>`<div class="apl"><button class="copy">copy</button><code>${esc(a.p)}</code><div class="apl-c"># ${esc(a.c)}</div></div>`).join('')}`:''}
          ${(v.encoding&&v.encoding.length)? `<h4 class="sub">⇄ Encode / Decode lab — filter-evasion ladder</h4><p class="enc-intro">Same payload, every wire-form. When a probe is blocked, walk these layers: the winning one is whose decoder runs <b>after</b> the WAF but <b>before</b> the sink. Each shows the encoded string to paste and how to decode it back.</p><div class="enc-list">${v.encoding.map(e=>`<div class="enc"><button class="copy">copy</button><code>${esc(e.sample)}</code><div class="enc-meta"><span class="enc-layer">${esc(e.layer)}</span></div><div class="enc-n"># ${esc(e.note)}</div></div>`).join('')}</div>`:''}
        </div>

        <div class="panel" data-panel="bypass">
          <h3>Bypassing WAF / filters / defenses</h3>
          ${(v.bypass&&v.bypass.length)? `<ul class="bullets">${v.bypass.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>` : '<p>No specific filter bypasses documented for this class.</p>'}
        </div>

        <div class="panel" data-panel="chain">
          <h3>Chaining — one attack into the next</h3>
          ${renderChain(v)}
        </div>

        <div class="panel" data-panel="ctf">
          <h3>CTF lab walkthrough</h3>
          ${renderCtf(ctf)}
        </div>

        <div class="panel" data-panel="report">
          <h3>How to report it — vulnerability write-up</h3>
          ${renderReport(v)}
        </div>

        <div class="panel" data-panel="reports">
          <h3>Real-world reports &amp; write-ups</h3>
          ${reports.length? `<p>Disclosed bug-bounty reports, CVEs and research surfacing this class in the wild — study real attack chains and the exact bypasses that earned bounties.</p><div class="ref-list">${reports.map(r=>`<a class="ref" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="rk rk-${esc((r.platform||'ref').toLowerCase().replace(/[^a-z0-9]/g,''))}">${esc(r.platform||'report')}</span><span class="rt">${esc(r.title)}</span><span class="ra">↗</span></a>`).join('')}</div>` : `<p>Curated disclosed reports are being added for this class. Meanwhile, hunt live examples:</p><div class="ref-list">
            <a class="ref" href="https://hackerone.com/hacktivity?querystring=${encodeURIComponent(v.name)}" target="_blank" rel="noopener"><span class="rk rk-hackerone">HackerOne</span><span class="rt">Hacktivity — disclosed ${esc(v.name)} reports</span><span class="ra">↗</span></a>
            <a class="ref" href="https://www.google.com/search?q=${encodeURIComponent(v.name+' bug bounty writeup')}" target="_blank" rel="noopener"><span class="rk rk-writeup">Write-ups</span><span class="rt">${esc(v.name)} — bug-bounty write-ups</span><span class="ra">↗</span></a>
          </div>`}
        </div>

        <div class="panel" data-panel="tools">
          <h3>Tooling</h3>
          ${tools.length? `<div class="tool-grid">${tools.map(t=>`<div class="tool"><div class="tn">${esc(t.name)}</div>${t.desc?`<div class="td">${esc(t.desc)}</div>`:''}</div>`).join('')}</div>` : '<p>Burp Suite + browser dev tools cover most of this class.</p>'}
        </div>

        <div class="panel" data-panel="refs">
          <h3>References &amp; further reading</h3>
          <div class="ref-list">
            ${refs.map(r=>`<a class="ref" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="rk">${esc(r.kind||'ref')}</span><span class="rt">${esc(r.title)}</span><span class="ra">↗</span></a>`).join('')}
            <a class="ref" href="https://hacktricks.wiki/en/index.html" target="_blank" rel="noopener"><span class="rk">hacktricks</span><span class="rt">HackTricks — pentesting web index</span><span class="ra">↗</span></a>
            <a class="ref" href="https://github.com/0xKayala/A-to-Z-Vulnerabilities" target="_blank" rel="noopener"><span class="rk">A-to-Z</span><span class="rt">0xKayala / A-to-Z-Vulnerabilities</span><span class="ra">↗</span></a>
          </div>
        </div>

      </div>
    </div>`;

  // wiring
  $('#back').onclick = ()=>location.hash='#/';
  $('#markdone').onclick = e=>{ Store.toggle(v.id); const on=Store.has(v.id);
    e.target.classList.toggle('on',on); e.target.textContent = on?'✓ Practiced':'◌ Mark Practiced';
    toast(on?'Marked as practiced ✓':'Unmarked'); };
  // ARIA tabs: id/role/labels for panels, click + arrow-key nav, shareable deep-link
  $$('.panel',root).forEach(p=>{ const k=p.dataset.panel; p.setAttribute('role','tabpanel'); p.id='panel-'+k; p.setAttribute('aria-labelledby','tab-'+k); p.tabIndex=0; });
  const selHash = k => history.replaceState(null,'', '#/vuln/'+v.slug+'/'+k);
  $$('.tab',root).forEach(tb=>tb.onclick=()=>{ activateTab(root, tb.dataset.tab); selHash(tb.dataset.tab); });
  const tablist = $('.tabs',root);
  tablist.addEventListener('keydown',e=>{
    if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    e.preventDefault();
    const btns=$$('.tab',root); let i=btns.findIndex(b=>b.getAttribute('aria-selected')==='true'); if(i<0) i=0;
    if(e.key==='Home') i=0; else if(e.key==='End') i=btns.length-1;
    else if(e.key==='ArrowUp'||e.key==='ArrowLeft') i=(i-1+btns.length)%btns.length;
    else i=(i+1)%btns.length;
    activateTab(root, btns[i].dataset.tab, true); selHash(btns[i].dataset.tab);
  });
  // export full dossier as markdown
  $('#export-md').onclick = ()=>{ navigator.clipboard?.writeText(dossierMarkdown(v)).then(()=>toast('Dossier copied as Markdown ✓')); };
  // clickable tags → filter the codex
  $$('.tag-btn',root).forEach(b=>b.onclick=()=>{
    state.q=b.dataset.tag; state.sev='all'; state.cat='all'; state.unpracticed=false;
    const fi=$('#filter-q'); if(fi) fi.value=state.q;
    const ut=$('#toggle-unpracticed'); if(ut){ ut.setAttribute('aria-pressed','false'); ut.classList.remove('on'); ut.textContent='◌ Unpracticed'; }
    location.hash='#/';
  });
  $$('.lvl',root).forEach(b=>b.onclick=()=>{
    $$('.lvl',root).forEach(x=>x.classList.remove('on')); b.classList.add('on');
    $$('.lvl-pane',root).forEach(p=>p.classList.toggle('on',p.dataset.lvlpane===b.dataset.lvl));
  });
  $$('.copy',root).forEach(b=>b.onclick=()=>{
    navigator.clipboard?.writeText(b.nextElementSibling.textContent).then(()=>toast('Copied to clipboard'));
  });
  // glass-3D tilt on the dossier objects
  $$('.detail-head',root).forEach(e=>bindTilt(e,5));
  $$('.report-card',root).forEach(e=>bindTilt(e,9));
  $$('.chain-row',root).forEach(e=>bindTilt(e,7));
  $$('.tool',root).forEach(e=>bindTilt(e,13));
  $$('.ctf-win',root).forEach(e=>bindTilt(e,8));
  // deep-link: open the requested tab (#/vuln/<slug>/<tab>)
  if(tab && tabs.some(t=>t.k===tab)) activateTab(root, tab);
  scrollTo(0,0);
}

/* ================= ABOUT / FIELD MANUAL ================= */
function renderAbout(){
  $('#view-about').innerHTML = `
  <div class="about-wrap">
    <div class="back-link" onclick="location.hash='#/'">⟵ back to codex</div>
    <h1>Field Manual</h1>
    <p>VULNDEX is a study console for the <b>${VULNS.length}</b> web application vulnerabilities in the OWASP-style catalog.
       Every entry is a dossier with the same nine core sections so your testing workflow becomes muscle memory.</p>

    <div class="callout legal"><span class="ci">⚠</span><p><b>Rules of engagement.</b> This material is for authorized penetration testing, CTF practice and education. Never run these techniques against systems you do not own or lack written permission to test. Unauthorized testing is illegal.</p></div>

    <h2>How each dossier is structured</h2>
    <div class="about-card">
      <ul class="bullets">
        <li><b>Overview</b> — what the bug is and why it matters.</li>
        <li><b>Test A→Z</b> — the full manual methodology, step by step.</li>
        <li><b>Lab Setup</b> — how to stand up a safe, reproducible practice target.</li>
        <li><b>Payloads</b> — copy-paste probes and exploit strings.</li>
        <li><b>WAF Bypass</b> — defeating filters, WAFs and weak blocklists.</li>
        <li><b>Chaining</b> — what leads into this bug and where it pivots next; one worked end-to-end kill-chain.</li>
        <li><b>Write-Up</b> — a ready-to-adapt vulnerability report: title, severity/CVSS, PoC steps, impact, remediation.</li>
        <li><b>Tools</b> — the standard kit for that class.</li>
        <li><b>References</b> — HackTricks, PortSwigger Academy, OWASP, A-to-Z repo.</li>
      </ul>
    </div>

    <h2>Recommended practice targets</h2>
    <div class="about-card">
      <ul class="bullets">
        <li><b>PortSwigger Web Security Academy</b> — free, per-vuln interactive labs. <a href="https://portswigger.net/web-security" target="_blank" rel="noopener">portswigger.net/web-security</a></li>
        <li><b>OWASP Juice Shop</b> — modern JS app, every OWASP Top 10. <code>docker run -p 3000:3000 bkimminich/juice-shop</code></li>
        <li><b>DVWA</b> — classic PHP/MySQL, adjustable security levels. <code>docker run -p 80:80 vulnerables/web-dvwa</code></li>
        <li><b>bWAPP / WebGoat / VAmPI (API)</b> — broader coverage incl. APIs.</li>
        <li><b>HackTricks</b> — the offensive reference wiki. <a href="https://hacktricks.wiki/en/index.html" target="_blank" rel="noopener">hacktricks.wiki</a></li>
      </ul>
    </div>

    <h2>Core toolkit</h2>
    <div class="about-card">
      <ul class="bullets">
        <li><b>Burp Suite</b> / <b>OWASP ZAP</b> — intercepting proxy, repeater, intruder.</li>
        <li><b>ffuf</b> / <b>feroxbuster</b> — content + parameter fuzzing.</li>
        <li><b>sqlmap</b>, <b>nuclei</b>, <b>nmap</b>, <b>jwt_tool</b>, <b>commix</b> — class-specific automation.</li>
        <li>Browser <b>DevTools</b> + <b>curl</b> — never underestimate them.</li>
      </ul>
    </div>
  </div>`;
  $$('.about-card').forEach(e=>bindTilt(e,8));
}

/* ================= ATTACK CHAIN MAP ================= */
const SEV_COLOR = {Critical:'#ff3b4e', High:'#d23b46', Medium:'#c9c9d0', Low:'#76767e'};
function renderMap(){
  const root = $('#view-map');
  // order nodes by attack class so each class forms a contiguous arc
  const catOrder=[]; VULNS.forEach(v=>{ if(!catOrder.includes(v.category)) catOrder.push(v.category); });
  const nodes = VULNS.slice().sort((a,b)=> (catOrder.indexOf(a.category)-catOrder.indexOf(b.category)) || (a.id-b.id));
  const N=nodes.length, cx=500, cy=500, R=350;
  const pos={};
  nodes.forEach((v,i)=>{ const ang=(i/N)*2*Math.PI - Math.PI/2; pos[v.slug]={x:cx+R*Math.cos(ang), y:cy+R*Math.sin(ang), ang}; });

  // edges = documented pivots (this attack escalates into target)
  const edges=[];
  nodes.forEach(v=>{ (v.chain&&v.chain.pivots||[]).forEach(p=>{ if(p.slug&&pos[p.slug]) edges.push({a:v.slug,b:p.slug,sev:v.severity}); }); });
  const neigh={};
  edges.forEach(e=>{ (neigh[e.a]=neigh[e.a]||new Set()).add(e.b); (neigh[e.b]=neigh[e.b]||new Set()).add(e.a); });

  const edgeEls = edges.map(e=>{ const A=pos[e.a], B=pos[e.b];
    const mx=(A.x+B.x)/2, my=(A.y+B.y)/2, k=0.42; const px=cx+(mx-cx)*k, py=cy+(my-cy)*k;
    return `<path class="map-edge" data-a="${e.a}" data-b="${e.b}" d="M${A.x.toFixed(1)} ${A.y.toFixed(1)} Q${px.toFixed(1)} ${py.toFixed(1)} ${B.x.toFixed(1)} ${B.y.toFixed(1)}" stroke="${SEV_COLOR[e.sev]|| '#e11d2a'}"/>`;
  }).join('');
  const nodeEls = nodes.map(v=>{ const P=pos[v.slug];
    return `<g class="map-node" data-slug="${v.slug}" tabindex="0" role="link" aria-label="${esc(v.name)}, ${esc(v.severity)}" transform="translate(${P.x.toFixed(1)},${P.y.toFixed(1)})"><circle class="mn-hit" r="13" fill="transparent"/><circle class="mn-dot" r="6.5" fill="${SEV_COLOR[v.severity]|| '#e11d2a'}"/><title>${esc(v.name)} — ${esc(v.severity)} · ${esc(v.category)}</title></g>`;
  }).join('');
  const catEls = catOrder.map(cat=>{
    const idxs=nodes.map((v,i)=>v.category===cat?i:-1).filter(i=>i>=0); if(!idxs.length) return '';
    const mid=idxs[Math.floor(idxs.length/2)], ang=(mid/N)*2*Math.PI - Math.PI/2, lr=R+24;
    const x=cx+lr*Math.cos(ang), y=cy+lr*Math.sin(ang), deg=ang*180/Math.PI, flip=Math.cos(ang)<0;
    return `<text class="map-cat" x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${(flip?deg+180:deg).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" text-anchor="${flip?'end':'start'}">${esc(cat)}</text>`;
  }).join('');

  root.innerHTML = `
    <div class="map-wrap">
      <div class="back-link" onclick="location.hash='#/'">⟵ back to codex</div>
      <h1>Attack Chain Map</h1>
      <p class="map-intro">All <b>${N}</b> vulnerabilities as nodes, ringed by attack class. Each curve is a documented <b>pivot</b> — one attack escalating into another (<b>${edges.length}</b> links). Hover or focus a node to light its chains; click to open the dossier.</p>
      <div class="map-legend">${SEV.map(s=>`<span class="map-lg"><i style="background:${SEV_COLOR[s]}"></i>${s}</span>`).join('')}<span class="map-lg map-lg-sep">curve colour = source severity</span></div>
      <div class="map-stage">
        <svg viewBox="-170 -150 1340 1340" class="map-svg" role="img" aria-label="Interactive attack-chain map of all ${N} vulnerabilities and their ${edges.length} pivot links">
          <g class="map-edges">${edgeEls}</g>
          <g class="map-nodes">${nodeEls}</g>
          <g class="map-cats">${catEls}</g>
        </svg>
      </div>
      <div class="map-info" id="map-info" aria-live="polite">// hover or focus a node to inspect its chains</div>
    </div>`;

  const svg=$('.map-svg',root), info=$('#map-info',root);
  const edgeNodes=$$('.map-edge',root), nodeGs=$$('.map-node',root);
  function show(slug){
    const v=VULNS.find(x=>x.slug===slug); if(!v) return;
    const out=(v.chain&&v.chain.pivots||[]).length, inn=(v.chain&&v.chain.feeders||[]).length;
    info.innerHTML=`<b>${esc(v.name)}</b> <span class="sev sev-${v.severity}">${v.severity}</span> · ${esc(v.category)} — pivots out: <b>${out}</b>, leads in: <b>${inn}</b>`;
    edgeNodes.forEach(p=>{ const on=p.dataset.a===slug||p.dataset.b===slug; p.classList.toggle('hot',on); p.classList.toggle('dim',!on); });
    nodeGs.forEach(g=>{ const s=g.dataset.slug; g.classList.toggle('faded', s!==slug && !(neigh[slug]&&neigh[slug].has(s))); });
  }
  function clear(){ info.innerHTML='// hover or focus a node to inspect its chains'; edgeNodes.forEach(p=>p.classList.remove('hot','dim')); nodeGs.forEach(g=>g.classList.remove('faded')); }
  svg.addEventListener('mouseover',e=>{ const g=e.target.closest('.map-node'); if(g) show(g.dataset.slug); });
  svg.addEventListener('mouseout',e=>{ if(!svg.contains(e.relatedTarget)) clear(); });
  svg.addEventListener('focusin',e=>{ const g=e.target.closest('.map-node'); if(g) show(g.dataset.slug); });
  svg.addEventListener('click',e=>{ const g=e.target.closest('.map-node'); if(g) location.hash='#/vuln/'+g.dataset.slug; });
  svg.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ const g=e.target.closest('.map-node'); if(g){ e.preventDefault(); location.hash='#/vuln/'+g.dataset.slug; } } });
  scrollTo(0,0);
}

/* ================= ROUTER ================= */
function route(){
  const h = location.hash || '#/';
  const showHome  = h==='#/'||h==='';
  const m = h.match(/^#\/vuln\/([^/]+)(?:\/([a-z]+))?$/);
  const about = h==='#/about';
  const map = h==='#/map';
  $('#view-home').hidden   = !showHome;
  $('#view-detail').hidden = !m;
  $('#view-map').hidden    = !map;
  $('#view-about').hidden  = !about;
  if(m) renderDetail(decodeURIComponent(m[1]), m[2]);
  else if(map) renderMap();
  else if(about) renderAbout();
  else { renderChips(); renderCats(); renderGrid(); renderProgress(); renderStats(); }
}

/* ================= COMMAND PALETTE ================= */
const Palette = {
  open(){ const p=$('#palette'); p.hidden=false; $('#palette-q').value=''; this.render(''); $('#palette-q').focus(); },
  close(){ $('#palette').hidden=true; },
  render(q){
    const list = !q ? VULNS.slice(0,8) : VULNS.filter(v=>searchHay(v).includes(q.toLowerCase())).slice(0,40);
    $('#palette-results').innerHTML = list.map((v,i)=>`
      <li data-slug="${v.slug}" class="${i===0?'active':''}">
        <span class="pr-id">#${String(v.id).padStart(3,'0')}</span>
        <span class="pr-name">${esc(v.name)}</span>
        <span class="pr-cat">${esc(v.category)}</span>
      </li>`).join('') || '<li><span class="pr-name">no match</span></li>';
    $$('#palette-results li[data-slug]').forEach(li=>li.onclick=()=>{ location.hash='#/vuln/'+li.dataset.slug; Palette.close(); });
  },
  nav(dir){
    const items=$$('#palette-results li[data-slug]'); if(!items.length) return;
    let idx=items.findIndex(li=>li.classList.contains('active'));
    items[idx]?.classList.remove('active'); idx=(idx+dir+items.length)%items.length;
    items[idx].classList.add('active'); items[idx].scrollIntoView({block:'nearest'});
  },
  enter(){ const a=$('#palette-results li.active[data-slug]'); if(a){ location.hash='#/vuln/'+a.dataset.slug; Palette.close(); } }
};

/* ================= TOAST ================= */
let toastT;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,1800); }

/* ================= EVENTS ================= */
function bindGlobal(){
  // null-safe binder: a missing element (e.g. an older cached index.html) must
  // never throw and abort init — it just skips that one binding.
  const on=(sel,ev,fn)=>{ const el=$(sel); if(el) el.addEventListener(ev,fn); };
  on('#filter-q','input',e=>{ state.q=e.target.value.trim(); renderGrid(); });
  on('#cta-explore','click',()=>$('#grid')?.scrollIntoView({behavior:'smooth'}));
  on('#open-search','click',()=>Palette.open());
  on('#reset-progress','click',()=>{ if(confirm('Reset all practiced progress?')){ Store.reset(); route(); toast('Progress reset'); } });
  on('#random-vuln','click',()=>{ const v=VULNS[Math.floor(Math.random()*VULNS.length)]; if(v) location.hash='#/vuln/'+v.slug; });
  on('#toggle-unpracticed','click',e=>{ state.unpracticed=!state.unpracticed; const b=e.currentTarget;
    b.setAttribute('aria-pressed', state.unpracticed); b.classList.toggle('on', state.unpracticed);
    b.textContent = state.unpracticed?'● Unpracticed':'◌ Unpracticed';
    if(location.hash && location.hash!=='#/') location.hash='#/'; else renderGrid(); });

  on('#palette-q','input',e=>Palette.render(e.target.value.trim()));
  on('#palette','click',e=>{ if(e.target.id==='palette') Palette.close(); });

  addEventListener('keydown',e=>{
    const pal=$('#palette');
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); if(pal) (pal.hidden?Palette.open():Palette.close()); }
    if(pal && !pal.hidden){
      if(e.key==='Escape') Palette.close();
      if(e.key==='ArrowDown'){ e.preventDefault(); Palette.nav(1); }
      if(e.key==='ArrowUp'){ e.preventDefault(); Palette.nav(-1); }
      if(e.key==='Enter') Palette.enter();
    } else if(e.key==='/' && document.activeElement.tagName!=='INPUT'){ e.preventDefault(); Palette.open(); }
  });

  addEventListener('hashchange',route);
}

/* ================= INIT ================= */
function init(){
  if(!VULNS.length){
    const g=$('#grid'); if(g) g.innerHTML='<p class="empty">// vulnerability data not loaded — assets/js/vulns.js missing</p>';
  }
  // Each step isolated: one failure must not stop the grid from rendering.
  try{ boot(); }catch(e){ console.error('boot',e); }
  try{ matrix(); }catch(e){ console.error('matrix',e); }
  try{ renderStats(); }catch(e){ console.error('stats',e); }
  route();                       // render current view (grid) FIRST — always shows
  try{ bindGlobal(); }catch(e){ console.error('bindGlobal',e); }
  // PWA: register service worker for offline use (http/https only — not file://)
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
  }
}
document.readyState==='loading'?addEventListener('DOMContentLoaded',init):init();

})();
