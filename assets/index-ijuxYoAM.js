var ke=Object.defineProperty;var Ae=(e,t,a)=>t in e?ke(e,t,{enumerable:!0,configurable:!0,writable:!0,value:a}):e[t]=a;var oe=(e,t,a)=>Ae(e,typeof t!="symbol"?t+"":t,a);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const o of i)if(o.type==="childList")for(const l of o.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&s(l)}).observe(document,{childList:!0,subtree:!0});function a(i){const o={};return i.integrity&&(o.integrity=i.integrity),i.referrerPolicy&&(o.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?o.credentials="include":i.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(i){if(i.ep)return;i.ep=!0;const o=a(i);fetch(i.href,o)}})();const ue="ragi.session.token";let _=null;function pe(e){_=e,e?sessionStorage.setItem(ue,e):sessionStorage.removeItem(ue)}function ve(){return _||(_=sessionStorage.getItem(ue),_)}function me(){pe(null)}function qe(){return!!ve()}const Z="http://127.0.0.1:8787".replace(/\/$/,"");function we(){const e=location.hostname;return e==="localhost"||e==="127.0.0.1"||e==="[::1]"||!1}class F extends Error{constructor(a,s){const i=typeof s=="object"&&s?s:null,o=i!=null&&i.message?String(i.message):i!=null&&i.error?String(i.error).replaceAll("_"," "):`http_${a}`;super(o);oe(this,"status");oe(this,"body");this.status=a,this.body=s}}async function u(e,t={}){const a=new Headers(t.headers);if(!a.has("content-type")&&t.body&&a.set("content-type","application/json"),t.auth!==!1){const l=ve();l&&a.set("authorization",`Bearer ${l}`)}const s=await fetch(`${Z}${e}`,{...t,headers:a,credentials:"include"}),i=await s.text();let o=null;if(i)try{o=JSON.parse(i)}catch{o=i}if(!s.ok)throw new F(s.status,o);return o}async function he(){try{return!!(await u("/health",{auth:!1})).ok}catch{return!1}}function Ne(e){return u("/api/v1/auth/register",{method:"POST",auth:!1,body:JSON.stringify(e)})}function Ce(e){return u("/api/v1/auth/login",{method:"POST",auth:!1,body:JSON.stringify(e)})}function ye(){return u("/api/v1/auth/me")}function Se(){return u("/api/v1/auth/logout",{method:"POST"})}function je(){return u("/api/v1/mode")}function Me(e){return u("/api/v1/mode",{method:"PUT",body:JSON.stringify({mode:e})})}function Pe(){return u("/api/v1/briefing")}function He(){return u("/api/v1/jobs")}function Oe(e){return u("/api/v1/jobs",{method:"POST",body:JSON.stringify(e)})}function De(){return u("/api/v1/focus")}function Fe(e){return u(`/api/v1/focus/${e}/complete`,{method:"POST"})}function Ie(e){return u(`/api/v1/jobs/${e}`,{method:"DELETE"})}function Be(e){return u("/api/v1/focus",{method:"POST",body:JSON.stringify(e)})}function Ge(e,t){return u("/api/v1/ai/chat",{method:"POST",body:JSON.stringify({message:e,mode:t})})}function Re(){return u("/api/v1/notes")}function Je(e){return u("/api/v1/notes",{method:"POST",body:JSON.stringify(e)})}function Ue(){return u("/api/v1/storage/status")}function Ve(){return u("/api/v1/storage/snapshots")}function We(e){return u("/api/v1/storage/snapshot",{method:"POST",body:JSON.stringify({reason:e})})}function Ke(){return u("/api/v1/storage/export")}function _e(e){return u("/api/v1/storage/restore",{method:"POST",body:JSON.stringify({snapshotId:e,mode:"merge"})})}const te=["hall","home","forge","gold","clock","hub","map","den"],ze={vault:"Vault",hall:"Hall",home:"Home",forge:"Forge",gold:"Gold",clock:"Clock",hub:"Hub",map:"Map",den:"Den",void:"Void"};function R(e,t,a,s){const i=!(s!=null&&s.open)&&te.includes(e);return`<button type="button" data-room="${e}" class="${s!=null&&s.here?"is-here":""}"${s!=null&&s.here?' aria-current="page"':""}${i?" disabled":""}>
      <span class="room-code">${t}</span>
      <span class="room-name">${a}</span>
      ${i?'<span class="room-lock">Locked</span>':""}
    </button>`}function Ye(e){return e.innerHTML=`
    <a class="skip" href="#chamber">Skip to the room</a>
    <header class="mast">
      <div class="brand">
        <p class="eyebrow">Private secretary</p>
        <h1>RAGI</h1>
      </div>
      <div class="mast-meta">
        <time id="nowClock" class="now"></time>
        <p class="api-pill" id="apiPill" role="status">
          <span class="api-dot" aria-hidden="true"></span>
          <span class="api-copy">
            <span class="api-state">Checking the vault link</span>
            <span class="api-origin"></span>
          </span>
        </p>
        <p class="member-line" id="hpLine">Signed out</p>
        <button type="button" id="signOutBtn" class="ghost" hidden>Sign out</button>
      </div>
    </header>

    <div class="workspace">
      <nav class="rooms" aria-label="Rooms">
        ${R("vault","N-14","Vault",{here:!0,open:!0})}
        ${R("hall","W-02","Hall")}
        ${R("home","H-01","Home")}
        ${R("forge","F-33","Forge")}
        ${R("gold","G-55","Gold")}
        ${R("clock","C-88","Clock")}
        ${R("hub","G-77","Hub")}
        ${R("map","M-99","Map")}
        ${R("den","E-77","Den")}
        ${R("void","S-00","Void",{open:!0})}
      </nav>

      <main class="frame" id="chamber" tabindex="-1">
        <section id="roomVault" class="view is-on"></section>
        <section id="roomHall" class="view" aria-label="Hall"></section>
        <section id="roomHome" class="view" aria-label="Home"></section>
        <section id="roomForge" class="view" aria-label="Forge"></section>
        <section id="roomGold" class="view" aria-label="Gold"></section>
        <section id="roomClock" class="view" aria-label="Clock"></section>
        <section id="roomHub" class="view" aria-label="Hub"></section>
        <section id="roomMap" class="view" aria-label="Map"></section>
        <section id="roomDen" class="view" aria-label="Den">
          <header class="room-head">
            <p class="room-index">E-77</p>
            <h2 class="prompt" tabindex="-1">Den</h2>
          </header>
          <p class="lore">Notes live with your vault. A snapshot is an append-only copy of your account only. Restoring one merges it back. It does not wipe your seals, and it cannot see anyone else's book.</p>
          <p class="msg" data-room-msg role="status"></p>
          <div class="dash-grid">
            <section class="stat-box">
              <h3>Storage</h3>
              <div id="storeStatus" class="quiet">Loading the ledger…</div>
              <div class="form-actions">
                <button type="button" id="snapBtn" class="primary">Seal a snapshot</button>
                <button type="button" id="exportBtn" class="ghost">Export JSON</button>
              </div>
            </section>
            <section class="stat-box">
              <h3>Snapshots</h3>
              <ul class="jobs" id="snapList"><li class="entry is-empty"><p class="entry-title">None yet.</p></li></ul>
            </section>
            <section class="stat-box wide">
              <h3>Notes</h3>
              <ul class="jobs" id="noteList"><li class="entry is-empty"><p class="entry-title">Sign in to read your notes.</p></li></ul>
              <form class="stack" id="noteForm">
                <label class="field"><span>Title</span><input id="noteTitle" name="title" autocomplete="off" maxlength="160" /></label>
                <label class="field"><span>Note</span><textarea id="noteBody" name="body" maxlength="8000"></textarea></label>
                <button type="submit" id="noteAdd" class="primary">Inscribe</button>
              </form>
            </section>
          </div>
          <p class="hint">A restore merges into this account only.</p>
        </section>
        <section class="dead-end" id="voidMsg">
          <header class="room-head">
            <p class="room-index">S-00</p>
            <h2 class="prompt" tabindex="-1">Void</h2>
          </header>
          <p class="lore">Nothing is stored in this room. When you want the door again, return to the vault.</p>
          <button type="button" id="voidBack" class="primary">Back to the vault</button>
        </section>
      </main>
    </div>
    <footer class="colophon">
      <p>Arnova Group · Arnold-RG</p>
      <p>Your session stays in this tab. Your vault stays encrypted, on your account alone.</p>
    </footer>
  `,{vault:e.querySelector("#roomVault"),hall:e.querySelector("#roomHall"),home:e.querySelector("#roomHome"),forge:e.querySelector("#roomForge"),gold:e.querySelector("#roomGold"),clock:e.querySelector("#roomClock"),hub:e.querySelector("#roomHub"),map:e.querySelector("#roomMap"),den:e.querySelector("#roomDen"),voidMsg:e.querySelector("#voidMsg"),apiPill:e.querySelector("#apiPill"),hpLine:e.querySelector("#hpLine"),now:e.querySelector("#nowClock"),signOut:e.querySelector("#signOutBtn"),voidBack:e.querySelector("#voidBack"),nav:e.querySelector(".rooms"),navButtons:[...e.querySelectorAll(".rooms button")]}}function fe(e,t){const a=e.querySelector(".api-state"),s=e.querySelector(".api-origin");if(!we()){a&&(a.textContent="Account server not connected"),s&&(s.textContent="Sign-up here starts once VITE_API_ORIGIN is set."),e.classList.remove("ok"),e.classList.add("bad"),e.title="This deploy has no API origin yet.";return}a&&(a.textContent=t?"Vault link up":"Vault link down"),s&&(s.textContent=Z),e.classList.toggle("ok",t),e.classList.toggle("bad",!t),e.title=t?`Answering at ${Z}`:`No answer from ${Z}`}function W(e,t,a,s){t.voidMsg.classList.remove("is-on"),["vault","hall","home","forge","gold","clock","hub","map","den"].forEach(l=>t[l].classList.remove("is-on")),t.navButtons.forEach(l=>{l.classList.remove("is-here"),l.removeAttribute("aria-current")});const o=(l,n)=>{l!=="void"&&n.classList.add("is-on");const r=t.navButtons.find(d=>d.dataset.room===l);if(r==null||r.classList.add("is-here"),r==null||r.setAttribute("aria-current","page"),document.title=`${ze[l]} — RAGI`,s!=null&&s.focus){const d=(l==="void"?t.voidMsg:n).querySelector("h2");d==null||d.focus()}};if(e==="void"){t.voidMsg.classList.add("is-on"),o("void",t.voidMsg);return}if(te.includes(e)&&!a){o("vault",t.vault);return}o(e,t[e])}function Qe(e){e.nav.classList.add("is-open"),e.signOut.hidden=!1,e.navButtons.forEach(t=>{const a=t.dataset.room;te.includes(a)&&(t.disabled=!1)})}function re(e){e.nav.classList.remove("is-open"),e.signOut.hidden=!0,e.navButtons.forEach(t=>{const a=t.dataset.room;te.includes(a)&&(t.disabled=!0)})}function Xe(e,t){e.innerHTML=`
    <header class="room-head">
      <p class="room-index">N-14</p>
      <h2 class="prompt" tabindex="-1">Vault</h2>
    </header>
    <p class="lore">
      RAGI keeps a private record of work, money, time, and notes.
      Create an account with your email. The password is stored only as an Argon2id hash.
      What you write is encrypted for your account and is not readable by anyone else.
    </p>
    <div class="auth-switch" role="tablist" aria-label="Account">
      <button type="button" id="tabEnter" role="tab" aria-selected="true" aria-controls="enterPanel">Sign in</button>
      <button type="button" id="tabJoin" role="tab" aria-selected="false" aria-controls="joinPanel">Create account</button>
    </div>
    <p class="msg" data-room-msg role="status"></p>
    <form class="stack auth-form" id="enterPanel" aria-labelledby="tabEnter">
      <label class="field"><span>Email</span><input id="loginEmail" name="email" type="email" autocomplete="username" inputmode="email" required maxlength="254" /></label>
      <label class="field"><span>Password</span><input id="loginPassword" name="password" type="password" autocomplete="current-password" required maxlength="128" /></label>
      <div class="form-actions">
        <button type="submit" class="primary">Enter</button>
        <button type="button" class="ghost" data-reveal="loginPassword" aria-pressed="false">Show password</button>
      </div>
    </form>
    <form class="stack auth-form" id="joinPanel" hidden aria-labelledby="tabJoin">
      <label class="field"><span>Name</span><input id="joinHandle" name="handle" autocomplete="nickname" required minlength="2" maxlength="24" spellcheck="false" /></label>
      <p class="hint">Letters, numbers, and hyphens. This is how the house addresses you.</p>
      <label class="field"><span>Email</span><input id="joinEmail" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" /></label>
      <label class="field"><span>Password</span><input id="joinPassword" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
      <label class="field"><span>Confirm password</span><input id="joinPassword2" name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
      <p class="hint">At least 12 characters. A long passphrase is better than a clever short one.</p>
      <div class="form-actions">
        <button type="submit" class="primary">Create account</button>
        <button type="button" class="ghost" data-reveal="joinPassword" aria-pressed="false">Show password</button>
      </div>
    </form>
  `;const a=e.querySelector("[data-room-msg]");we()||(a.textContent="This public page is not pointed at an account server yet. The house is here. Sign-up starts when the API origin is set for the build.",a.className="msg",e.querySelectorAll("form button[type=submit]").forEach(d=>{d.disabled=!0}));const s=e.querySelector("#enterPanel"),i=e.querySelector("#joinPanel"),o=e.querySelector("#tabEnter"),l=e.querySelector("#tabJoin");function n(d){var m;const p=d==="join";s.hidden=p,i.hidden=!p,o.setAttribute("aria-selected",String(!p)),l.setAttribute("aria-selected",String(p)),a.textContent="",(m=p?e.querySelector("#joinHandle"):e.querySelector("#loginEmail"))==null||m.focus()}o.addEventListener("click",()=>n("enter")),l.addEventListener("click",()=>n("join")),e.querySelectorAll("[data-reveal]").forEach(d=>{d.addEventListener("click",()=>{const p=e.querySelector(`#${d.dataset.reveal}`);if(!p)return;const m=p.type==="password";p.type=m?"text":"password",d.textContent=m?"Hide password":"Show password",d.setAttribute("aria-pressed",String(m))})});function r(d){a.textContent=d instanceof F?d.message:"The vault could not open.",a.className="msg bad"}s.addEventListener("submit",d=>{d.preventDefault();const p=(e.querySelector("#loginEmail").value||"").trim(),m=e.querySelector("#loginPassword").value;a.textContent="Checking the seal…",a.className="msg",Ce({email:p,password:m}).then(f=>{pe(f.token),t()}).catch(r)}),i.addEventListener("submit",d=>{d.preventDefault();const p=(e.querySelector("#joinHandle").value||"").trim(),m=(e.querySelector("#joinEmail").value||"").trim(),f=e.querySelector("#joinPassword").value,S=e.querySelector("#joinPassword2").value;if(f!==S){a.textContent="The two passwords do not match.",a.className="msg bad";return}a.textContent="Cutting a key…",a.className="msg",Ne({email:m,handle:p,password:f}).then(b=>{pe(b.token),t()}).catch(r)})}function c(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function E(e,t,a=""){const s=e.querySelector("[data-room-msg]");s&&(s.textContent=t,s.className=a?`msg ${a}`:"msg")}async function v(e,t){try{await t()}catch(a){const s=a instanceof F?a.message:"The vault could not do that.";E(e,s,"bad")}}let Ze=0;function ee(e,t,a=""){const s=`meter-${++Ze}`,i=Math.max(0,Math.min(100,Math.round(t)));return`<div class="bar-row ${c(a)}">
    <span class="bar-label" id="${s}">${c(e)}</span>
    <div class="bar-track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${i}" aria-labelledby="${s}"><i style="width:${i}%"></i></div>
    <span class="bar-val">${i}%</span>
  </div>`}function Q(e,t,a,s){var p;const i=document.createElement("form");i.className="edit-form";for(const m of t){const f=document.createElement("label");f.className="field";const S=document.createElement("span");S.textContent=m.label;const b=m.multiline?document.createElement("textarea"):document.createElement("input");b.name=m.name,b.value=m.value,b instanceof HTMLInputElement&&(b.type=m.type??"text",m.type==="number"&&(b.inputMode="numeric"),m.min&&(b.min=m.min),m.max&&(b.max=m.max)),f.append(S,b),i.append(f)}const o=document.createElement("div");o.className="form-actions";const l=document.createElement("button");l.type="submit",l.className="primary",l.textContent="Save";const n=document.createElement("button");n.type="button",n.className="ghost",n.textContent="Cancel",n.addEventListener("click",s),o.append(l,n),i.append(o);const r=document.createElement("p");r.className="msg",r.setAttribute("role","status"),i.append(r),i.addEventListener("submit",m=>{m.preventDefault();const f={};for(const S of t){const b=i.elements.namedItem(S.name);f[S.name]=b instanceof HTMLInputElement||b instanceof HTMLTextAreaElement?b.value.trim():""}l.disabled=!0,a(f).catch(S=>{l.disabled=!1,r.textContent=S instanceof F?S.message:"Could not save that.",r.className="msg bad"})}),e.replaceChildren(i),(p=i.querySelector("input, textarea"))==null||p.dispatchEvent(new Event("focus"));const d=i.querySelector("input, textarea");d==null||d.focus()}function et(e){let t=!1,a=null,s=null,i=null,o=0,l=!1,n=0;function r(){t=!1,o&&cancelAnimationFrame(o),o=0,i==null||i.getTracks().forEach(p=>p.stop()),i=null,a==null||a.close(),a=null,s=null,e.onLevel(0)}async function d(){if(t)return;i=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0},video:!1}),a=new AudioContext,a.state==="suspended"&&await a.resume();const p=a.createMediaStreamSource(i);s=a.createAnalyser(),s.fftSize=512,s.smoothingTimeConstant=.4,p.connect(s),t=!0;const m=new Uint8Array(s.fftSize),f=()=>{if(!t||!s)return;s.getByteTimeDomainData(m);let S=0;for(let g=0;g<m.length;g++){const k=(m[g]-128)/128;S+=k*k}const b=Math.sqrt(S/m.length),I=Math.min(1,b*4.2);e.onLevel(I);const h=performance.now();I>.08&&!l&&h-n>260&&(l=!0,n=h,e.onSpeak(),window.setTimeout(()=>{l=!1},280)),o=requestAnimationFrame(f)};o=requestAnimationFrame(f)}return{start:d,stop:r,active:()=>t}}function ce(e,t){return`
    <div class="sprite ${e}" ${t?`id="${t}"`:""} aria-hidden="true">
      <div class="s-head"></div><div class="s-eye"></div><div class="s-eye r"></div>
      <div class="s-body"></div><div class="s-arm l"></div><div class="s-arm r"></div>
      <div class="s-leg l"></div><div class="s-leg r"></div>
    </div>`}async function tt(e,t){var P,H,G,T;e.innerHTML=`
    <header class="room-head">
      <p class="room-index">W-02</p>
      <h2 class="prompt" tabindex="-1">Hall</h2>
    </header>
    <p class="lore">The day starts here. The warden, the scribe, and the scout keep their posts. Talk listens on this device. Cast asks your secretary.</p>
    <p class="msg" data-room-msg role="status"></p>
    <div class="world">
      <div class="stage" id="hallStage">
        <div class="stage-wall" aria-hidden="true"></div>
        <div class="stage-window" aria-hidden="true"></div>
        <div class="stage-floor" aria-hidden="true"></div>
        <div class="torch l" aria-hidden="true"></div>
        <div class="torch r" aria-hidden="true"></div>
        <p class="speech" id="npcLine">The warden says the seals hold.</p>
        ${ce("guard")}
        ${ce("clerk amber","voiceJumper")}
        ${ce("scout blood")}
      </div>
      <div class="side-panel">
        <section class="stat-box">
          <h3>Align</h3>
          <div class="modes" role="group" aria-label="Mode">
            <button type="button" data-mode="work" aria-pressed="true">Work</button>
            <button type="button" data-mode="personal" aria-pressed="false">Personal</button>
          </div>
        </section>
        <section class="stat-box">
          <h3>Dawn scroll</h3>
          <p id="briefingLine">Opening the scroll…</p>
        </section>
        <section class="stat-box">
          <h3>Focus</h3>
          <p id="focusLine">—</p>
          <form class="stack" id="focusForm">
            <label class="field"><span>Label</span><input id="focusLabel" maxlength="120" autocomplete="off" /></label>
            <div class="form-actions">
              <button type="submit" class="primary">Add a 90 minute block</button>
              <button type="button" id="focusDone" class="ghost" hidden>Mark complete</button>
            </div>
          </form>
        </section>
        <section class="stat-box">
          <h3>Quest log</h3>
          <ul class="jobs" id="jobList"></ul>
          <form class="stack" id="jobForm">
            <label class="field"><span>Role</span><input id="jobTitle" maxlength="160" autocomplete="off" /></label>
            <label class="field"><span>Company</span><input id="jobCompany" maxlength="160" autocomplete="off" /></label>
            <button type="submit" class="primary">Add quest</button>
          </form>
        </section>
        <section class="stat-box">
          <button type="button" id="logoutBtn" class="ghost">Sign out</button>
          <button type="button" id="stillHall" class="ghost" aria-pressed="false">Still the hall</button>
        </section>
      </div>
    </div>

    <form class="cmd" id="castForm">
      <button type="button" id="micBtn" aria-pressed="false">Talk</button>
      <label class="sr-only" for="chatIn">Ask Ragi</label>
      <input id="chatIn" type="text" maxlength="4000" autocomplete="off" placeholder="Ask, or begin with Hey Ragi" />
      <button type="submit" id="sendBtn" class="primary">Cast</button>
    </form>
    <div class="voice-meter" id="voiceMeter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Microphone level"><span id="voiceLevel"></span></div>
    <div class="chat-log" id="chatLog" role="log" aria-live="polite" aria-relevant="additions"></div>
    <p class="hint">Talk opens the microphone and the amber scribe jumps when it hears you. Cast uses the local secretary, or Gemini when a key is set on the server. Home is the day’s board.</p>
  `;const a=e.querySelector("#npcLine"),s=e.querySelector("#voiceJumper"),i=e.querySelector("#voiceLevel"),o=e.querySelector("#voiceMeter"),l=e.querySelector("#briefingLine"),n=e.querySelector("#focusLine"),r=e.querySelector("#focusDone"),d=e.querySelector("#jobList"),p=e.querySelector("#chatLog"),m=e.querySelector("#chatIn"),f=e.querySelector("#micBtn"),S=e.querySelector("#hallStage"),b=e.querySelector("#stillHall");let I="work",h="";const g=["The warden says the seals hold.","The scribe has the dawn scroll ready.","The scout is watching the quests.","Say hello when you want a status.","Work and personal are both kept in this house."];let k=0;const w=window.setInterval(()=>{document.hidden||(k=(k+1)%g.length,f.classList.contains("is-hot")||(a.textContent=g[k]))},4200);sessionStorage.getItem("ragi.hall.still")==="1"&&(S.classList.add("is-still"),b.setAttribute("aria-pressed","true"),b.textContent="Let the hall move"),b.addEventListener("click",()=>{const y=!S.classList.contains("is-still");S.classList.toggle("is-still",y),b.setAttribute("aria-pressed",String(y)),b.textContent=y?"Let the hall move":"Still the hall",sessionStorage.setItem("ragi.hall.still",y?"1":"0")});const $=et({onLevel:y=>{const x=Math.round(y*100);i.style.width=`${x}%`,o.setAttribute("aria-valuenow",String(x))},onSpeak:()=>{s.classList.remove("is-jumping"),s.offsetWidth,s.classList.add("is-jumping"),a.textContent="The scribe hears you.",window.setTimeout(()=>s.classList.remove("is-jumping"),280)}});function B(y,x){const O=document.createElement("div");O.className=`line ${y}`;const C=document.createElement("span");C.className="who",C.textContent=y==="you"?"You":"Ragi";const D=document.createElement("p");D.textContent=x,O.append(C,D),p.appendChild(O),p.scrollTop=p.scrollHeight}async function N(){try{const[y,x,O,C]=await Promise.all([je(),Pe(),He(),De()]);I=y.mode==="personal"?"personal":"work",e.querySelectorAll("[data-mode]").forEach(A=>{A.setAttribute("aria-pressed",String(A.dataset.mode===I))}),l.textContent=x.briefing.summary;const D=C.blocks.filter(A=>!A.completed)[0];if(h=(D==null?void 0:D.id)??"",r.hidden=!D,n.textContent=D?`${D.label} · until ${new Date(D.endsAt).toLocaleTimeString()}`:"No active block.",d.replaceChildren(),O.jobs.length)for(const A of O.jobs.slice(0,6)){const ae=document.createElement("li");ae.className="entry";const se=document.createElement("div");se.className="entry-copy";const ne=document.createElement("p");ne.className="entry-title",ne.textContent=A.company?`${A.title} · ${A.company}`:A.title;const ie=document.createElement("p");ie.className="entry-meta",ie.textContent=A.status,se.append(ne,ie);const le=document.createElement("div");le.className="acts";const K=document.createElement("button");K.type="button",K.className="ghost",K.textContent="Archive",K.addEventListener("click",()=>{window.confirm("Archive this quest? A snapshot is sealed first.")&&L(async()=>{await Ie(A.id),await N()})}),le.append(K),ae.append(se,le),d.append(ae)}else{const A=document.createElement("li");A.className="entry is-empty",A.innerHTML='<p class="entry-title">No quests yet.</p>',d.append(A)}}catch(y){l.textContent=y instanceof F?y.message:"The secretary could not refresh."}}async function L(y){try{await y()}catch(x){E(e,x instanceof F?x.message:"The hall could not do that.","bad")}}e.querySelectorAll("[data-mode]").forEach(y=>{y.addEventListener("click",()=>{const x=y.dataset.mode==="personal"?"personal":"work";L(async()=>{await Me(x),I=x,await N()})})}),(P=e.querySelector("#jobForm"))==null||P.addEventListener("submit",y=>{y.preventDefault();const x=e.querySelector("#jobTitle").value.trim(),O=e.querySelector("#jobCompany").value.trim();if(!x){E(e,"Add a role title first.","bad");return}L(async()=>{await Oe({title:x,company:O||void 0,status:"watch"}),e.querySelector("#jobTitle").value="",e.querySelector("#jobCompany").value="",E(e,"Quest added.","good"),await N()})}),(H=e.querySelector("#focusForm"))==null||H.addEventListener("submit",y=>{y.preventDefault();const x=e.querySelector("#focusLabel").value.trim()||"Deep work",O=new Date,C=new Date(Date.now()+5400*1e3);L(async()=>{await Be({label:x,startsAt:O.toISOString(),endsAt:C.toISOString()}),e.querySelector("#focusLabel").value="",E(e,"Focus block started.","good"),await N()})}),r.addEventListener("click",()=>{h&&L(async()=>{await Fe(h),E(e,"Focus marked complete.","good"),await N()})}),f.addEventListener("click",()=>{if($.active()){$.stop(),s.classList.remove("is-listening"),f.classList.remove("is-hot"),f.textContent="Talk",f.setAttribute("aria-pressed","false");return}$.start().then(()=>{s.classList.add("is-listening"),f.classList.add("is-hot"),f.textContent="Live",f.setAttribute("aria-pressed","true"),a.textContent="The scribe is listening."},()=>{a.textContent="The microphone is blocked. Allow it in the browser if you want to talk."})});async function M(){const y=m.value.trim();if(!y)return;const O=/^hey\s+ragi\b/i.test(y)?y.replace(/^hey\s+ragi[,!\s]*/i,"").trim()||"Status report.":y;B("you",y),m.value="";try{const C=await Ge(O,I);B("ragi",C.reply),a.textContent=C.signal==="gemini"?"Ragi answered from the cloud.":"Ragi answered from your vault."}catch(C){const D=C instanceof F?C.message:"cast failed";B("ragi",`The signal dropped. ${D}`)}}(G=e.querySelector("#castForm"))==null||G.addEventListener("submit",y=>{y.preventDefault(),M()}),(T=e.querySelector("#logoutBtn"))==null||T.addEventListener("click",()=>{J()});async function J(){try{await Se()}catch{}$.stop(),window.clearInterval(w),me(),t()}return await N(),()=>{$.stop(),window.clearInterval(w)}}function at(){return u("/api/v1/dashboard")}function st(e){return u("/api/v1/projects",{method:"POST",body:JSON.stringify(e)})}function be(e,t){return u(`/api/v1/projects/${e}`,{method:"PATCH",body:JSON.stringify(t)})}function nt(e){return u(`/api/v1/projects/${e}`,{method:"DELETE"})}function it(e,t){return u(`/api/v1/goals/${e}`,{method:"PATCH",body:JSON.stringify(t)})}function lt(e){return u(`/api/v1/goals/${e}`,{method:"DELETE"})}function ot(e){return u(`/api/v1/activities/${e}`,{method:"DELETE"})}function rt(e){return u(`/api/v1/finance/${e}`,{method:"DELETE"})}function ct(e,t){return u(`/api/v1/finance/${e}`,{method:"PATCH",body:JSON.stringify(t)})}function dt(e){return u(`/api/v1/meetings/${e}`,{method:"DELETE"})}function ut(e){return u(`/api/v1/reminders/${e}`,{method:"DELETE"})}function pt(e){return u(`/api/v1/emergencies/${e}`,{method:"DELETE"})}function mt(e){return u(`/api/v1/notes/${e}`,{method:"DELETE"})}function ht(e,t){return u(`/api/v1/notes/${e}`,{method:"PATCH",body:JSON.stringify(t)})}function yt(e){return u("/api/v1/goals",{method:"POST",body:JSON.stringify(e)})}function ft(e){return u("/api/v1/activities",{method:"POST",body:JSON.stringify(e)})}function $e(e){return u(`/api/v1/activities/${e}/toggle`,{method:"POST"})}function bt(e){return u("/api/v1/finance",{method:"POST",body:JSON.stringify(e)})}function gt(e){return u("/api/v1/meetings",{method:"POST",body:JSON.stringify(e)})}function vt(e){return u("/api/v1/reminders",{method:"POST",body:JSON.stringify(e)})}function wt(e){return u(`/api/v1/reminders/${e}/complete`,{method:"POST"})}function St(e){return u("/api/v1/emergencies",{method:"POST",body:JSON.stringify(e)})}function $t(e){return u(`/api/v1/emergencies/${e}/resolve`,{method:"POST"})}function U(e){return`${e<0?"-":""}$${(Math.abs(e)/100).toFixed(2)}`}function de(e){if(!e)return new Date().toISOString();const t=new Date(e);return Number.isNaN(t.getTime())?new Date().toISOString():t.toISOString()}function Et(){return u("/api/v1/github/repos")}function ge(e){return u("/api/v1/github/login",{method:"PUT",body:JSON.stringify({login:e})})}function Lt(e,t){return u("/api/v1/github/progress",{method:"PUT",body:JSON.stringify({fullName:e,progress:t})})}function q(e,t,a){return`<header class="room-head">
      <p class="room-index">${c(e)}</p>
      <h2 class="prompt" tabindex="-1">${c(t)}</h2>
    </header>
    <p class="lore">${a}</p>
    <p class="msg" data-room-msg role="status"></p>`}function Ee(e){if(!e.length)return'<p class="empty">No cash trace yet. Post an entry in Gold.</p>';const t=e.map(n=>n.balance),a=Math.min(...t,0),s=Math.max(...t,1),i=Math.max(1,s-a),o=e.map((n,r)=>{const d=r/Math.max(1,e.length-1)*100,p=100-(n.balance-a)/i*100;return`${d},${p}`}).join(" "),l=`Cash from ${e[0].label} to ${e[e.length-1].label}`;return`<svg class="cash-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${c(l)}">
    <title>${c(l)}</title>
    <polyline fill="none" stroke="#c6a36a" stroke-width="2" vector-effect="non-scaling-stroke" points="${o}" />
  </svg>`}function Le(e){const t=e.charts.direction;return`<div class="dir-map">
    <div class="dir-path" aria-hidden="true"></div>
    <div class="dir-node" style="left:${t==="forward"?82:t==="steady"?50:18}%"></div>
    <div class="dir-labels"><span>Stalled</span><span>Steady</span><span>Forward</span></div>
    <p class="dir-readout">Direction is ${c(t==="forward"?"forward":t==="steady"?"steady":"stalled")}. Projects average ${e.charts.projectAvgProgress}%. Goals average ${e.charts.goalAvgProgress}%.</p>
  </div>`}async function X(e){try{return await at()}catch(t){const a=t instanceof F?t.message:"The board could not be opened.";return e.innerHTML=`${q("","Signal fault","")}<p class="msg bad" role="alert">${c(a)}</p>`,null}}async function xe(e){e.innerHTML=`${q("H-01","Home","Opening the board…")}`;const t=await X(e);if(!t)return;const a=t.focusActive?`${c(t.focusActive.label)} until ${c(new Date(t.focusActive.endsAt).toLocaleTimeString())}`:"None";e.innerHTML=`
    ${q("H-01","Home",`The board for today. Work and personal share one vault. The hall is set to <strong>${c(t.mode)}</strong>.`)}
    <div class="dash-grid">
      <section class="stat-box">
        <h3>Board</h3>
        <ul class="kpi">
          <li><span>Projects</span><b>${t.projects.length}</b></li>
          <li><span>Goals</span><b>${t.goals.length}</b></li>
          <li><span>Today</span><b>${t.activitiesToday.filter(s=>s.done).length}/${t.activitiesToday.length}</b></li>
          <li><span>Meetings</span><b>${t.meetingsUpcoming.length}</b></li>
          <li><span>Reminders</span><b>${t.reminders.length}</b></li>
          <li><span>Emergencies</span><b>${t.emergencies.filter(s=>s.active).length}</b></li>
          <li><span>Quests</span><b>${t.openJobs}</b></li>
          <li><span>Cash</span><b>${U(t.finance.balanceCents)}</b></li>
          <li><span>Focus</span><b>${a}</b></li>
        </ul>
      </section>
      <section class="stat-box">
        <h3>Speed</h3>
        ${t.charts.speedBars.length?t.charts.speedBars.map(s=>ee(s.label,s.value,s.realm)).join(""):'<p class="empty">Add projects in the Forge to draw the bars.</p>'}
      </section>
      <section class="stat-box wide">
        <h3>Direction</h3>
        ${Le(t)}
      </section>
      <section class="stat-box">
        <h3>Today</h3>
        <ul class="jobs" id="homeActs">
          ${t.activitiesToday.length?t.activitiesToday.map(s=>`<li class="entry"><div class="entry-copy"><p class="entry-title">${s.done?"Done · ":""}${c(s.title)}</p></div>
                      <div class="acts"><button type="button" class="ghost" data-act="${c(s.id)}">${s.done?"Undo":"Done"}</button></div></li>`).join(""):'<li class="entry is-empty"><p class="entry-title">Nothing planned for today.</p></li>'}
        </ul>
      </section>
      <section class="stat-box">
        <h3>Next meetings</h3>
        <ul class="jobs">
          ${t.meetingsUpcoming.length?t.meetingsUpcoming.slice(0,5).map(s=>`<li class="entry"><div class="entry-copy"><p class="entry-title">${c(s.title)}</p><p class="entry-meta">${c(new Date(s.startsAt).toLocaleString())}</p></div></li>`).join(""):'<li class="entry is-empty"><p class="entry-title">The calendar is clear.</p></li>'}
        </ul>
      </section>
    </div>
    <p class="hint">Forge holds projects and goals. Gold is the ledger. Clock keeps meetings. Map draws the charts.</p>
  `,e.querySelectorAll("[data-act]").forEach(s=>{s.addEventListener("click",()=>{v(e,async()=>{await $e(s.dataset.act),await xe(e)})})})}async function j(e){var i,o,l;e.innerHTML=`${q("F-33","Forge","Opening the forge…")}`;const t=await X(e);if(!t)return;e.innerHTML=`
    ${q("F-33","Forge","Projects, goals, and the shape of the day. Progress here is what the Map draws.")}
    <div class="dash-grid">
      <section class="stat-box">
        <h3>Projects</h3>
        <ul class="jobs" id="projList">
          ${t.projects.length?t.projects.map(n=>`<li class="entry" data-id="${c(n.id)}"><div class="entry-copy"><p class="entry-title">${c(n.title)}</p><p class="entry-meta">${c(n.realm)} · ${n.progress}%</p>${n.notes?`<p class="entry-note">${c(n.notes)}</p>`:""}</div>
                      <div class="acts">
                        <button type="button" class="ghost" data-bump="${c(n.id)}" data-p="${Math.min(100,n.progress+10)}">+10</button>
                        <button type="button" class="ghost" data-pedit="${c(n.id)}">Edit</button>
                        <button type="button" class="ghost" data-pdel="${c(n.id)}">Archive</button>
                      </div></li>`).join(""):'<li class="entry is-empty"><p class="entry-title">No projects yet.</p></li>'}
        </ul>
        <form class="stack" id="projForm">
          <label class="field"><span>Title</span><input id="projTitle" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Notes</span><input id="projNotes" maxlength="2000" autocomplete="off" /></label>
          <label class="field"><span>Realm</span><select id="projRealm"><option value="personal">Personal</option><option value="work">Work</option></select></label>
          <label class="field"><span>Progress</span><input id="projProgress" type="number" min="0" max="100" value="0" inputmode="numeric" /></label>
          <button type="submit" class="primary">Seal project</button>
        </form>
      </section>
      <section class="stat-box">
        <h3>Goals</h3>
        <ul class="jobs" id="goalList">
          ${t.goals.length?t.goals.map(n=>`<li class="entry"><div class="entry-copy"><p class="entry-title">${c(n.title)}</p><p class="entry-meta">${n.progress}%${n.target?` · ${c(n.target)}`:""}</p></div>
                      <div class="acts">
                        <button type="button" class="ghost" data-gedit="${c(n.id)}">Edit</button>
                        <button type="button" class="ghost" data-gdel="${c(n.id)}">Archive</button>
                      </div></li>`).join(""):'<li class="entry is-empty"><p class="entry-title">No goals yet.</p></li>'}
        </ul>
        <form class="stack" id="goalForm">
          <label class="field"><span>Goal</span><input id="goalTitle" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Target</span><input id="goalTarget" maxlength="240" autocomplete="off" /></label>
          <label class="field"><span>Realm</span><select id="goalRealm"><option value="personal">Personal</option><option value="work">Work</option></select></label>
          <button type="submit" class="primary">Set goal</button>
        </form>
      </section>
      <section class="stat-box wide">
        <h3>Today</h3>
        <ul class="jobs">
          ${t.activitiesToday.length?t.activitiesToday.map(n=>`<li class="entry"><div class="entry-copy"><p class="entry-title">${n.done?"Done · ":""}${c(n.title)}</p></div>
                      <div class="acts">
                        <button type="button" class="ghost" data-act="${c(n.id)}">${n.done?"Undo":"Done"}</button>
                        <button type="button" class="ghost" data-adel="${c(n.id)}">Archive</button>
                      </div></li>`).join(""):'<li class="entry is-empty"><p class="entry-title">The day is empty.</p></li>'}
        </ul>
        <form class="inline-form" id="actForm">
          <label class="field"><span>Activity</span><input id="actTitle" maxlength="160" autocomplete="off" /></label>
          <button type="submit" class="primary">Add</button>
        </form>
        <p class="hint">Archive seals a snapshot first. The row stays in vault memory.</p>
      </section>
    </div>
  `;const a=new Map(t.projects.map(n=>[n.id,n])),s=new Map(t.goals.map(n=>[n.id,n]));(i=e.querySelector("#projForm"))==null||i.addEventListener("submit",n=>{n.preventDefault();const r=e.querySelector("#projTitle").value.trim();if(!r)return E(e,"Add a title first.","bad");v(e,async()=>{await st({title:r,notes:e.querySelector("#projNotes").value.trim()||void 0,realm:e.querySelector("#projRealm").value,progress:Number(e.querySelector("#projProgress").value)||0}),await j(e)})}),e.querySelectorAll("[data-bump]").forEach(n=>{n.addEventListener("click",()=>{v(e,async()=>{await be(n.dataset.bump,{progress:Number(n.dataset.p)}),await j(e)})})}),e.querySelectorAll("[data-pedit]").forEach(n=>{n.addEventListener("click",()=>{const r=a.get(n.dataset.pedit),d=n.closest("li");!r||!d||Q(d,[{name:"title",label:"Title",value:r.title},{name:"notes",label:"Notes",value:r.notes,multiline:!0},{name:"progress",label:"Progress",value:String(r.progress),type:"number",min:"0",max:"100"}],async p=>{await be(r.id,{title:p.title||void 0,notes:p.notes,progress:Math.max(0,Math.min(100,Math.round(Number(p.progress)||0)))}),await j(e)},()=>void j(e))})}),e.querySelectorAll("[data-pdel]").forEach(n=>{n.addEventListener("click",()=>{window.confirm("Archive this project? A snapshot is sealed first.")&&v(e,async()=>{await nt(n.dataset.pdel),await j(e)})})}),e.querySelectorAll("[data-gedit]").forEach(n=>{n.addEventListener("click",()=>{const r=s.get(n.dataset.gedit),d=n.closest("li");!r||!d||Q(d,[{name:"title",label:"Title",value:r.title},{name:"target",label:"Target",value:r.target},{name:"progress",label:"Progress",value:String(r.progress),type:"number",min:"0",max:"100"}],async p=>{await it(r.id,{title:p.title||void 0,target:p.target,progress:Math.max(0,Math.min(100,Math.round(Number(p.progress)||0)))}),await j(e)},()=>void j(e))})}),e.querySelectorAll("[data-gdel]").forEach(n=>{n.addEventListener("click",()=>{window.confirm("Archive this goal? A snapshot is sealed first.")&&v(e,async()=>{await lt(n.dataset.gdel),await j(e)})})}),(o=e.querySelector("#goalForm"))==null||o.addEventListener("submit",n=>{n.preventDefault();const r=e.querySelector("#goalTitle").value.trim();if(!r)return E(e,"Add a goal first.","bad");v(e,async()=>{await yt({title:r,target:e.querySelector("#goalTarget").value.trim()||void 0,realm:e.querySelector("#goalRealm").value}),await j(e)})}),(l=e.querySelector("#actForm"))==null||l.addEventListener("submit",n=>{n.preventDefault();const r=e.querySelector("#actTitle").value.trim();if(!r)return E(e,"Name the activity first.","bad");v(e,async()=>{await ft({title:r}),await j(e)})}),e.querySelectorAll("[data-act]").forEach(n=>{n.addEventListener("click",()=>{v(e,async()=>{await $e(n.dataset.act),await j(e)})})}),e.querySelectorAll("[data-adel]").forEach(n=>{n.addEventListener("click",()=>{window.confirm("Archive this activity?")&&v(e,async()=>{await ot(n.dataset.adel),await j(e)})})})}async function z(e){var i;e.innerHTML=`${q("G-55","Gold","Opening the ledger…")}`;const t=await X(e);if(!t)return;const a=t.finance;e.innerHTML=`
    ${q("G-55","Gold","Income, expense, and what is left. The Map reads the same figures.")}
    <div class="dash-grid">
      <section class="stat-box">
        <h3>Balance</h3>
        <ul class="kpi">
          <li><span>Income</span><b>${U(a.incomeCents)}</b></li>
          <li><span>Expense</span><b>${U(a.expenseCents)}</b></li>
          <li><span>Balance</span><b>${U(a.balanceCents)}</b></li>
        </ul>
        <form class="stack" id="finForm">
          <label class="field"><span>Kind</span><select id="finKind"><option value="income">Income</option><option value="expense">Expense</option><option value="budget">Budget</option></select></label>
          <label class="field"><span>Amount</span><input id="finAmount" type="number" step="0.01" min="0" inputmode="decimal" /></label>
          <label class="field"><span>Label</span><input id="finLabel" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Category</span><input id="finCat" maxlength="80" autocomplete="off" /></label>
          <button type="submit" class="primary">Post entry</button>
        </form>
      </section>
      <section class="stat-box">
        <h3>Recent</h3>
        <ul class="jobs">
          ${a.recent.length?a.recent.map(o=>`<li class="entry"><div class="entry-copy"><p class="entry-title">${c(o.label)}</p><p class="entry-meta">${c(o.kind)} · ${U(o.amountCents)}</p></div>
                      <div class="acts">
                        <button type="button" class="ghost" data-fedit="${c(o.id)}">Edit</button>
                        <button type="button" class="ghost" data-fdel="${c(o.id)}">Archive</button>
                      </div></li>`).join(""):'<li class="entry is-empty"><p class="entry-title">The ledger is empty.</p></li>'}
        </ul>
      </section>
      <section class="stat-box wide">
        <h3>Cash trace</h3>
        <div class="cash-wrap">${Ee(t.charts.cashSeries)}</div>
      </section>
    </div>
  `;const s=new Map(a.recent.map(o=>[o.id,o]));e.querySelectorAll("[data-fedit]").forEach(o=>{o.addEventListener("click",()=>{const l=s.get(o.dataset.fedit),n=o.closest("li");!l||!n||Q(n,[{name:"label",label:"Label",value:l.label},{name:"amount",label:"Amount",value:(l.amountCents/100).toFixed(2),type:"number"}],async r=>{const d=Number(r.amount);if(!r.label||!(d>0))throw new F(400,{message:"Add a label and an amount."});await ct(l.id,{label:r.label,amount:d}),await z(e)},()=>void z(e))})}),e.querySelectorAll("[data-fdel]").forEach(o=>{o.addEventListener("click",()=>{window.confirm("Archive this entry? A snapshot is sealed first.")&&v(e,async()=>{await rt(o.dataset.fdel),await z(e)})})}),(i=e.querySelector("#finForm"))==null||i.addEventListener("submit",o=>{o.preventDefault();const l=Number(e.querySelector("#finAmount").value),n=e.querySelector("#finLabel").value.trim();if(!n||!(l>0))return E(e,"Add a label and an amount greater than zero.","bad");v(e,async()=>{await bt({kind:e.querySelector("#finKind").value,amount:l,label:n,category:e.querySelector("#finCat").value.trim()||void 0}),await z(e)})})}async function V(e){var s,i,o;e.innerHTML=`${q("C-88","Clock","Opening the clock…")}`;const t=await X(e);if(!t)return;e.innerHTML=`
    ${q("C-88","Clock","Meetings, reminders, and the plans you hope not to need.")}
    <div class="dash-grid">
      <section class="stat-box">
        <h3>Meetings</h3>
        <ul class="jobs">
          ${t.meetingsUpcoming.length?t.meetingsUpcoming.map(l=>`<li class="entry"><div class="entry-copy"><p class="entry-title">${c(l.title)}</p><p class="entry-meta">${l.place?`${c(l.place)} · `:""}${c(new Date(l.startsAt).toLocaleString())}</p></div>
                      <div class="acts"><button type="button" class="ghost" data-mdel="${c(l.id)}">Archive</button></div></li>`).join(""):'<li class="entry is-empty"><p class="entry-title">Nothing upcoming.</p></li>'}
        </ul>
        <form class="stack" id="meetForm">
          <label class="field"><span>Title</span><input id="meetTitle" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Place or link</span><input id="meetPlace" maxlength="240" autocomplete="off" /></label>
          <label class="field"><span>Starts</span><input id="meetStart" type="datetime-local" /></label>
          <label class="field"><span>Ends</span><input id="meetEnd" type="datetime-local" /></label>
          <button type="submit" class="primary">Schedule</button>
        </form>
      </section>
      <section class="stat-box">
        <h3>Reminders</h3>
        <ul class="jobs">
          ${t.reminders.length?t.reminders.map(l=>`<li class="entry"><div class="entry-copy"><p class="entry-title">${c(l.title)}</p><p class="entry-meta">${c(l.priority)} · ${c(new Date(l.dueAt).toLocaleString())}</p></div>
                      <div class="acts">
                        <button type="button" class="ghost" data-rem="${c(l.id)}">Done</button>
                        <button type="button" class="ghost" data-rdel="${c(l.id)}">Archive</button>
                      </div></li>`).join(""):'<li class="entry is-empty"><p class="entry-title">The board is clear.</p></li>'}
        </ul>
        <form class="stack" id="remForm">
          <label class="field"><span>Reminder</span><input id="remTitle" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Due</span><input id="remDue" type="datetime-local" /></label>
          <label class="field"><span>Priority</span><select id="remPri"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label>
          <button type="submit" class="primary">Set reminder</button>
        </form>
      </section>
      <section class="stat-box wide">
        <h3>Emergencies</h3>
        <ul class="jobs">
          ${t.emergencies.length?t.emergencies.map(l=>`<li class="entry"><div class="entry-copy"><p class="entry-title">${l.active?"Live · ":"Resolved · "}${c(l.severity)} · ${c(l.title)}</p><p class="entry-note">${c(l.body)}</p></div>
                      <div class="acts">
                        ${l.active?`<button type="button" class="ghost" data-em="${c(l.id)}">Resolve</button>`:""}
                        <button type="button" class="ghost" data-edel="${c(l.id)}">Archive</button>
                      </div></li>`).join(""):'<li class="entry is-empty"><p class="entry-title">No emergency plans.</p></li>'}
        </ul>
        <form class="stack" id="emForm">
          <label class="field"><span>Title</span><input id="emTitle" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Protocol</span><input id="emBody" maxlength="2000" autocomplete="off" /></label>
          <label class="field"><span>Severity</span><select id="emSev"><option value="high">High</option><option value="critical">Critical</option><option value="low">Low</option></select></label>
          <button type="submit" class="primary">Arm plan</button>
        </form>
      </section>
    </div>
  `;const a=(l,n,r)=>{e.querySelectorAll(`[${l}]`).forEach(d=>{d.addEventListener("click",()=>{window.confirm(r)&&v(e,async()=>{await n(d.dataset[l.slice(5)]),await V(e)})})})};a("data-mdel",dt,"Archive this meeting?"),a("data-rdel",ut,"Archive this reminder?"),a("data-edel",pt,"Archive this plan?"),(s=e.querySelector("#meetForm"))==null||s.addEventListener("submit",l=>{l.preventDefault();const n=e.querySelector("#meetTitle").value.trim(),r=e.querySelector("#meetStart").value,d=e.querySelector("#meetEnd").value;if(!n||!r||!d)return E(e,"Add a title, a start, and an end.","bad");const p=new Date(r),m=new Date(d);if(Number.isNaN(p.getTime())||Number.isNaN(m.getTime())||m<=p)return E(e,"The meeting should end after it starts.","bad");v(e,async()=>{await gt({title:n,place:e.querySelector("#meetPlace").value.trim()||void 0,startsAt:de(r),endsAt:de(d)}),await V(e)})}),(i=e.querySelector("#remForm"))==null||i.addEventListener("submit",l=>{l.preventDefault();const n=e.querySelector("#remTitle").value.trim(),r=e.querySelector("#remDue").value;if(!n||!r)return E(e,"Add a reminder and a time.","bad");v(e,async()=>{await vt({title:n,dueAt:de(r),priority:e.querySelector("#remPri").value}),await V(e)})}),e.querySelectorAll("[data-rem]").forEach(l=>{l.addEventListener("click",()=>{v(e,async()=>{await wt(l.dataset.rem),await V(e)})})}),(o=e.querySelector("#emForm"))==null||o.addEventListener("submit",l=>{l.preventDefault();const n=e.querySelector("#emTitle").value.trim();if(!n)return E(e,"Name the plan first.","bad");v(e,async()=>{await St({title:n,body:e.querySelector("#emBody").value.trim(),severity:e.querySelector("#emSev").value}),await V(e)})}),e.querySelectorAll("[data-em]").forEach(l=>{l.addEventListener("click",()=>{v(e,async()=>{await $t(l.dataset.em),await V(e)})})})}async function Y(e){var t,a;e.innerHTML=`${q("G-77","Hub","Asking GitHub…")}`;try{const s=await Et();if(s.needsLogin||!s.login){e.innerHTML=`
        ${q("G-77","Hub","Public repositories only. RAGI does not use a shared token, so one member's private code never appears in another's house.")}
        <form class="stack narrow" id="ghLoginForm">
          <label class="field"><span>GitHub username</span><input id="ghLogin" maxlength="39" autocomplete="off" spellcheck="false" /></label>
          <button type="submit" class="primary">Save</button>
        </form>
      `,(t=e.querySelector("#ghLoginForm"))==null||t.addEventListener("submit",i=>{i.preventDefault();const o=e.querySelector("#ghLogin").value.trim();if(!o)return E(e,"Enter a GitHub username.","bad");v(e,async()=>{await ge(o),await Y(e)})});return}e.innerHTML=`
      ${q("G-77","Hub",`${s.count} public repositories for ${c(s.login)}. Average done ${s.avgProgress}%, remaining ${s.avgRemaining}%.`)}
      <form class="inline-form" id="ghLoginForm">
        <label class="field"><span>GitHub username</span><input id="ghLogin" value="${c(s.login)}" maxlength="39" autocomplete="off" spellcheck="false" /></label>
        <button type="submit" class="ghost">Update</button>
      </form>
      <ul class="jobs gh-list">
        ${s.projects.length?s.projects.map(i=>`<li class="gh-row">
                    <div class="gh-head">
                      <a href="${c(i.url)}" target="_blank" rel="noreferrer">${c(i.name)}<span class="sr-only"> (opens in a new tab)</span></a>
                      <span>${i.progress}% done · ${i.remaining}% left · ${i.overridden?"set":"estimated"}</span>
                    </div>
                    ${ee(i.name,i.progress)}
                    <p class="gh-meta">${c(i.language||"No language")} · ${c((i.description||"No description").slice(0,120))}</p>
                    <div class="acts">
                      <button type="button" class="ghost" data-gh="${c(i.fullName)}" data-p="${i.progress}">Set percent</button>
                    </div>
                  </li>`).join(""):'<li class="entry is-empty"><p class="entry-title">No public repositories under that name.</p></li>'}
      </ul>
      <p class="hint">Estimated percent comes from public signals. A number you set is stored only on your account.</p>
    `,(a=e.querySelector("#ghLoginForm"))==null||a.addEventListener("submit",i=>{i.preventDefault();const o=e.querySelector("#ghLogin").value.trim();if(!o)return E(e,"Enter a GitHub username.","bad");v(e,async()=>{await ge(o),await Y(e)})}),e.querySelectorAll("[data-gh]").forEach(i=>{i.addEventListener("click",()=>{const o=i.closest(".gh-row");o&&Q(o,[{name:"progress",label:`Completion for ${i.dataset.gh}`,value:i.dataset.p??"0",type:"number",min:"0",max:"100"}],async l=>{const n=Math.min(100,Math.max(0,Number(l.progress)));if(Number.isNaN(n))throw new F(400,{message:"Enter a number from 0 to 100."});await Lt(i.dataset.gh,n),await Y(e)},()=>void Y(e))})})}catch(s){const i=s instanceof F?s.message:"GitHub did not answer.";e.innerHTML=`${q("G-77","Hub","")}<p class="msg bad" role="alert">${c(i)}</p>
      <p class="hint">The hub reads public repositories for the username on your account.</p>`}}async function xt(e){e.innerHTML=`${q("M-99","Map","Drawing the map…")}`;const t=await X(e);t&&(e.innerHTML=`
    ${q("M-99","Map","Progress, direction, and cash, drawn from your vault.")}
    <div class="dash-grid">
      <section class="stat-box wide">
        <h3>Direction</h3>
        ${Le(t)}
      </section>
      <section class="stat-box">
        <h3>Project speed</h3>
        ${t.charts.speedBars.length?t.charts.speedBars.map(a=>ee(a.label,a.value,a.realm)).join(""):'<p class="empty">Forge a project to fill this chart.</p>'}
      </section>
      <section class="stat-box">
        <h3>Goals</h3>
        ${t.goals.length?t.goals.slice(0,8).map(a=>ee(a.title,a.progress,"amber")).join(""):'<p class="empty">No goals yet.</p>'}
      </section>
      <section class="stat-box wide">
        <h3>Cash</h3>
        <div class="cash-wrap tall">${Ee(t.charts.cashSeries)}</div>
        <p class="hint">Balance ${U(t.finance.balanceCents)} · in ${U(t.finance.incomeCents)} · out ${U(t.finance.expenseCents)}</p>
      </section>
    </div>
  `)}async function Tt(e){var S,b,I;const t=Ye(e);let a=qe(),s=null,i=new Map;const o=await he();fe(t.apiPill,o);function l(){const h=new Date;t.now.dateTime=h.toISOString(),t.now.textContent=new Intl.DateTimeFormat(void 0,{weekday:"short",hour:"numeric",minute:"2-digit"}).format(h)}l();const n=6e4-Date.now()%6e4+200;window.setTimeout(()=>{l(),window.setInterval(l,6e4)},n);async function r(){if(!a)return;const h=t.den.querySelector("#noteList"),g=t.den.querySelector("#storeStatus"),k=t.den.querySelector("#snapList");if(!(!h||!g||!k)){try{const w=await Re();if(i=new Map(w.notes.map($=>[$.id,$])),h.replaceChildren(),w.notes.length)for(const $ of w.notes.slice(0,8)){const B=document.createElement("li");B.className="entry";const N=document.createElement("div");N.className="entry-copy";const L=document.createElement("p");L.className="entry-title",L.textContent=$.title;const M=document.createElement("p");M.className="entry-note",M.textContent=$.body,N.append(L,M);const J=document.createElement("div");J.className="acts";const P=document.createElement("button");P.type="button",P.className="ghost",P.textContent="Edit",P.addEventListener("click",()=>{const G=i.get($.id);G&&Q(B,[{name:"title",label:"Title",value:G.title},{name:"body",label:"Note",value:G.body,multiline:!0}],async T=>{if(!T.title)throw new F(400,{message:"A note needs a title."});await ht($.id,{title:T.title,body:T.body}),await r()},()=>void r())});const H=document.createElement("button");H.type="button",H.className="ghost",H.textContent="Archive",H.addEventListener("click",()=>{window.confirm("Archive this note? A snapshot is sealed first.")&&v(t.den,async()=>{await mt($.id),await r()})}),J.append(P,H),B.append(N,J),h.append(B)}else{const $=document.createElement("li");$.className="entry is-empty",$.innerHTML='<p class="entry-title">No notes yet.</p>',h.append($)}}catch{h.replaceChildren();const w=document.createElement("li");w.className="entry is-empty",w.innerHTML='<p class="entry-title">The ledger is unreachable.</p>',h.append(w)}try{const w=await Ue(),$=w.latestSnapshot?`${w.latestSnapshot.id} · ${new Date(w.latestSnapshot.createdAt).toLocaleString()}`:"None yet";g.replaceChildren();const B=[`Engine ${w.engine}`,`Durable ${w.durable?"yes":"no"}`,`Snapshots ${w.snapshotCount}`,`Latest ${$}`,w.note];for(const L of B){const M=document.createElement("p");M.textContent=L,g.append(M)}const N=await Ve();if(k.replaceChildren(),N.snapshots.length)for(const L of N.snapshots.slice(0,8)){const M=document.createElement("li");M.className="entry";const J=document.createElement("div");J.className="entry-copy";const P=document.createElement("p");P.className="entry-title",P.textContent=L.id;const H=document.createElement("p");H.className="entry-meta",H.textContent=`${Math.round(L.bytes/1024)} kb`,J.append(P,H);const G=document.createElement("div");G.className="acts";const T=document.createElement("button");T.type="button",T.className="ghost",T.textContent="Merge",T.addEventListener("click",()=>{T.disabled=!0,T.textContent="Merging",_e(L.id).then(async y=>{T.textContent=`+${y.added}`,await r()}).catch(()=>{T.textContent="Failed",T.disabled=!1})}),G.append(T),M.append(J,G),k.append(M)}else{const L=document.createElement("li");L.className="entry is-empty",L.innerHTML='<p class="entry-title">No snapshots yet.</p>',k.append(L)}}catch{g.textContent="Storage is unreachable."}}}(S=t.den.querySelector("#noteForm"))==null||S.addEventListener("submit",h=>{if(h.preventDefault(),!a)return;const g=t.den.querySelector("#noteTitle").value.trim(),k=t.den.querySelector("#noteBody").value.trim();if(!g)return E(t.den,"A note needs a title.","bad");v(t.den,async()=>{await Je({title:g,body:k,kind:"note"}),t.den.querySelector("#noteTitle").value="",t.den.querySelector("#noteBody").value="",E(t.den,"Note inscribed.","good"),await r()})}),(b=t.den.querySelector("#snapBtn"))==null||b.addEventListener("click",()=>{a&&v(t.den,async()=>{await We("manual-ui"),E(t.den,"Snapshot sealed.","good"),await r()})}),(I=t.den.querySelector("#exportBtn"))==null||I.addEventListener("click",()=>{a&&v(t.den,async()=>{const h=await Ke(),g=new Blob([JSON.stringify(h,null,2)],{type:"application/json"}),k=URL.createObjectURL(g),w=document.createElement("a");w.href=k,w.download=`ragi-vault-${new Date().toISOString().slice(0,10)}.json`,w.click(),URL.revokeObjectURL(k)})});async function d(h){a&&(h==="home"&&await xe(t.home),h==="forge"&&await j(t.forge),h==="gold"&&await z(t.gold),h==="clock"&&await V(t.clock),h==="hub"&&await Y(t.hub),h==="map"&&await xt(t.map),h==="den"&&await r())}async function p(){try{await Se()}catch{}s==null||s(),s=null,me(),a=!1,re(t),t.hpLine.textContent="Signed out",f(),W("vault",t,!1)}async function m(){a=!0,Qe(t),W("hall",t,a),s==null||s(),s=await tt(t.hall,()=>{a=!1,s=null,re(t),t.hpLine.textContent="Signed out",f(),W("vault",t,!1)}),await r();try{const h=await ye(),g=h.mode==="personal"?"personal":"work";t.hpLine.textContent=`${h.handle} · ${g}`}catch{t.hpLine.textContent="Session weak"}}function f(){Xe(t.vault,()=>{m()})}if(f(),a)try{await ye(),await m()}catch{me(),a=!1,re(t)}t.signOut.addEventListener("click",()=>{p()}),t.voidBack.addEventListener("click",()=>{W("vault",t,a,{focus:!0})}),t.navButtons.forEach(h=>{h.addEventListener("click",()=>{const g=h.dataset.room;if(g!=="vault"&&g!=="void"&&!a){E(t.vault,"That room opens after you sign in.","bad"),W("vault",t,a);return}W(g,t,a,{focus:!0}),d(g)})}),window.setInterval(()=>{document.hidden||he().then(h=>fe(t.apiPill,h))},2e4)}const Te=document.getElementById("app");if(!Te)throw new Error("#app missing");Tt(Te);
//# sourceMappingURL=index-ijuxYoAM.js.map
