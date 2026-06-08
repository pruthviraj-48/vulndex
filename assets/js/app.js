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
let state = { q:'', sev:'all', cat:'all' };

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
      ctx.fillStyle='rgba(5,6,12,.14)'; ctx.fillRect(0,0,w,h);
      ctx.font='14px JetBrains Mono';
      for(let i=0;i<cols;i++){
        const ch = glyphs[Math.floor(Math.random()*glyphs.length)];
        ctx.fillStyle = Math.random()>.985 ? '#ff2bd6' : '#22e7ff';
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
  if(state.q){
    const q=state.q.toLowerCase();
    const hay=[v.name,v.category,v.summary,(v.tags||[]).join(' '),(v.tools||[]).map(t=>t.name||t).join(' ')].join(' ').toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
}
function renderGrid(){
  const grid = $('#grid'); const list = VULNS.filter(matches);
  $('#empty').hidden = list.length>0;
  grid.innerHTML = list.map(v=>`
    <article class="card ${Store.has(v.id)?'done':''}" data-slug="${v.slug}">
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
    </article>`).join('');
  $$('.card',grid).forEach(c=>c.onclick=()=>location.hash='#/vuln/'+c.dataset.slug);
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
function renderDetail(slug){
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
    {k:'ctf',      t:'CTF Lab',    i:'⚑'},
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
          ${v.cwe?`<span class="tag">${esc(v.cwe)}</span>`:''}
          ${(v.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}
        </div>
      </div>
      <button class="mark-done ${Store.has(v.id)?'on':''}" id="markdone">${Store.has(v.id)?'✓ Practiced':'◌ Mark Practiced'}</button>
    </div>

    <div class="detail-layout">
      <div class="tabs">${tabs.map((tb,i)=>`<button class="tab ${i===0?'on':''}" data-tab="${tb.k}"><span class="ti">${tb.i}</span>${tb.t}</button>`).join('')}</div>
      <div class="panels">

        <div class="panel on" data-panel="overview">
          <h3>What it is</h3>
          <p class="lead">${esc(v.summary)}</p>
          <p>${esc(v.description||'')}</p>
          ${notes.length? `<div class="notes"><div class="notes-h">⚐ Field notes &amp; gotchas <span class="src">// distilled from HackTricks</span></div><ul class="bullets">${notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>`:''}
          <div class="callout legal"><span class="ci">⚠</span><p><b>Authorized use only.</b> Test these techniques exclusively against systems you own or have explicit written permission to assess (your own lab, a CTF, or a scoped engagement).</p></div>
        </div>

        <div class="panel" data-panel="test">
          <h3>How to test — A → Z</h3>
          <ol class="steps">${(v.howToTest||[]).map((s,i)=>{const d=(v.testNotes&&v.testNotes[i])?`<span class="step-desc">↳ ${esc(v.testNotes[i])}</span>`:'';return `<li><span class="step-act">${esc(s)}</span>${d}</li>`;}).join('')||'<li>Methodology coming soon.</li>'}</ol>
        </div>

        <div class="panel" data-panel="lab">
          <h3>Build a practice lab</h3>
          ${lab.length?`<ol class="steps">${lab.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:'<p>Use a deliberately vulnerable app (DVWA, OWASP Juice Shop, PortSwigger Academy, bWAPP) to reproduce this safely.</p>'}
        </div>

        <div class="panel" data-panel="payloads">
          <h3>Payloads &amp; probes</h3>
          ${(v.payloads&&v.payloads.length)? codeList(v.payloads) : '<p>No raw payloads for this class — see the Test A→Z and Bypass tabs.</p>'}
          ${apl.length? `<h4 class="sub">⌁ Annotated payloads — what each one does</h4>${apl.map(a=>`<div class="apl"><button class="copy">copy</button><code>${esc(a.p)}</code><div class="apl-c"># ${esc(a.c)}</div></div>`).join('')}`:''}
        </div>

        <div class="panel" data-panel="bypass">
          <h3>Bypassing WAF / filters / defenses</h3>
          ${(v.bypass&&v.bypass.length)? `<ul class="bullets">${v.bypass.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>` : '<p>No specific filter bypasses documented for this class.</p>'}
        </div>

        <div class="panel" data-panel="ctf">
          <h3>CTF lab walkthrough</h3>
          ${renderCtf(ctf)}
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
  $$('.tab',root).forEach(tb=>tb.onclick=()=>{
    $$('.tab',root).forEach(x=>x.classList.remove('on')); tb.classList.add('on');
    $$('.panel',root).forEach(p=>p.classList.toggle('on',p.dataset.panel===tb.dataset.tab));
  });
  $$('.copy',root).forEach(b=>b.onclick=()=>{
    navigator.clipboard?.writeText(b.nextElementSibling.textContent).then(()=>toast('Copied to clipboard'));
  });
  scrollTo(0,0);
}

/* ================= ABOUT / FIELD MANUAL ================= */
function renderAbout(){
  $('#view-about').innerHTML = `
  <div class="about-wrap">
    <div class="back-link" onclick="location.hash='#/'">⟵ back to codex</div>
    <h1>Field Manual</h1>
    <p>VULNDEX is a study console for the <b>${VULNS.length}</b> web application vulnerabilities in the OWASP-style catalog.
       Every entry is a dossier with the same seven sections so your testing workflow becomes muscle memory.</p>

    <div class="callout legal"><span class="ci">⚠</span><p><b>Rules of engagement.</b> This material is for authorized penetration testing, CTF practice and education. Never run these techniques against systems you do not own or lack written permission to test. Unauthorized testing is illegal.</p></div>

    <h2>How each dossier is structured</h2>
    <div class="about-card">
      <ul class="bullets">
        <li><b>Overview</b> — what the bug is and why it matters.</li>
        <li><b>Test A→Z</b> — the full manual methodology, step by step.</li>
        <li><b>Lab Setup</b> — how to stand up a safe, reproducible practice target.</li>
        <li><b>Payloads</b> — copy-paste probes and exploit strings.</li>
        <li><b>WAF Bypass</b> — defeating filters, WAFs and weak blocklists.</li>
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
}

/* ================= ROUTER ================= */
function route(){
  const h = location.hash || '#/';
  const showHome  = h==='#/'||h==='';
  const m = h.match(/^#\/vuln\/(.+)$/);
  const about = h==='#/about';
  $('#view-home').hidden   = !showHome;
  $('#view-detail').hidden = !m;
  $('#view-about').hidden  = !about;
  if(m) renderDetail(decodeURIComponent(m[1]));
  else if(about) renderAbout();
  else { renderGrid(); renderProgress(); renderStats(); }
}

/* ================= COMMAND PALETTE ================= */
const Palette = {
  open(){ const p=$('#palette'); p.hidden=false; $('#palette-q').value=''; this.render(''); $('#palette-q').focus(); },
  close(){ $('#palette').hidden=true; },
  render(q){
    const list = !q ? VULNS.slice(0,8) : VULNS.filter(v=>{
      const s=q.toLowerCase();
      return [v.name,v.category,(v.tags||[]).join(' ')].join(' ').toLowerCase().includes(s);
    }).slice(0,40);
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
  $('#filter-q').addEventListener('input',e=>{ state.q=e.target.value.trim(); renderGrid(); });
  $('#cta-explore').onclick=()=>$('#grid').scrollIntoView({behavior:'smooth'});
  $('#open-search').onclick=()=>Palette.open();
  $('#reset-progress').onclick=()=>{ if(confirm('Reset all practiced progress?')){ Store.reset(); route(); toast('Progress reset'); } };

  $('#palette-q').addEventListener('input',e=>Palette.render(e.target.value.trim()));
  $('#palette').addEventListener('click',e=>{ if(e.target.id==='palette') Palette.close(); });

  addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); $('#palette').hidden?Palette.open():Palette.close(); }
    if(!$('#palette').hidden){
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
    $('#grid').innerHTML='<p class="empty">// vulnerability data not loaded — assets/js/vulns.js missing</p>';
  }
  boot(); matrix(); renderStats(); renderChips(); renderCats(); renderProgress(); bindGlobal(); route();
}
document.readyState==='loading'?addEventListener('DOMContentLoaded',init):init();

})();
