/* ---------- Clés de stockage partagé ---------- */
const STORE_TASKS = 'tasks';
const STORE_BIBLIO = 'biblio';
const STORE_NOTES = 'notes';
const STORE_NAME = 'username';
const STORE_SEED = 'notesSeeded';

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function esc(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function now(){ return new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
// Date du jour en heure locale (format YYYY-MM-DD). toISOString() donne l'heure
// UTC : comme la France est en avance sur UTC, ça pouvait faire retomber
// "aujourd'hui" sur la veille selon l'heure de la journée.
function todayLocal(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ---------- Stockage ----------
   window.storage n'existe que dans l'aperçu Artifact de Claude. Une fois le
   site publié sur GitHub Pages (ou tout autre hébergement statique), cette
   API n'existe plus : les anciens safeGet/safeSet échouaient donc en
   silence et RIEN n'était sauvegardé (tâches, biblio, notes disparaissaient
   au moindre rechargement).
   On utilise window.storage quand il est disponible, sinon on bascule sur
   localStorage pour que le site fonctionne aussi une fois publié.
   Limite à connaître : localStorage est propre à chaque navigateur/appareil.
   Sans backend partagé (Firebase, Supabase…), les collaborateurs ne
   verront donc pas les mêmes données tant qu'ils ne les importent pas via
   la sauvegarde (voir plus bas). */
const hasSharedBackend = !!(window.storage && typeof window.storage.get === 'function');

function localKey(key, shared){ return 'carnet_' + (shared ? 'shared_' : 'local_') + key; }

async function safeGet(key, shared){
  try{
    if(hasSharedBackend){
      const r = await window.storage.get(key, shared);
      return r ? JSON.parse(r.value) : null;
    }
    const raw = localStorage.getItem(localKey(key, shared));
    return raw ? JSON.parse(raw) : null;
  } catch(e){ return null; }
}
async function safeSet(key, value, shared){
  try{
    if(hasSharedBackend){
      await window.storage.set(key, JSON.stringify(value), shared);
    } else {
      localStorage.setItem(localKey(key, shared), JSON.stringify(value));
    }
  } catch(e){ console.error('storage set failed', key, e); }
}

/* ---------- Identité (stockage personnel, non partagé) ---------- */
let myName = '';
function getCookie(name){
  const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(name, value){
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000`;
}
async function ensureName(){
  myName = getCookie(STORE_NAME);
  if(!myName){
    myName = await safeGet(STORE_NAME, false);
  }
  if(!myName){
    myName = prompt("Ton prénom (pour identifier tes ajouts) :") || "Anonyme";
  }
  setCookie(STORE_NAME, myName);
  await safeSet(STORE_NAME, myName, false);
  renderWho();
  injectBackupUI();
  return myName;
}
function renderWho(){
  const box = document.getElementById('whoBox');
  if(!box) return;
  box.innerHTML = `Connecté·e comme<br><strong>${esc(myName)}</strong> <button id="changeNameBtn">changer</button>
    ${!hasSharedBackend ? '<div class="local-note">stockage local à ce navigateur — pas encore synchronisé entre appareils</div>' : ''}`;
  document.getElementById('changeNameBtn').onclick = async () => {
    const n = prompt("Ton prénom :", myName);
    if(n){ myName = n; setCookie(STORE_NAME, myName); await safeSet(STORE_NAME, myName, false); renderWho(); }
  };
}

/* ---------- Sauvegarde / restauration (export-import JSON) ---------- */
async function exportBackup(){
  const tasks = (await safeGet(STORE_TASKS, true)) || [];
  const biblio = (await safeGet(STORE_BIBLIO, true)) || [];
  const notes = (await safeGet(STORE_NOTES, true)) || [];
  const data = { exportedAt: new Date().toISOString(), exportedBy: myName, tasks, biblio, notes };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `carnet-projet-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function importBackup(file){
  const text = await file.text();
  let data;
  try{ data = JSON.parse(text); } catch(e){ alert('Fichier de sauvegarde invalide.'); return; }
  if(!confirm('Importer va remplacer les tâches, la bibliographie et les notes actuelles par le contenu du fichier. Continuer ?')) return;
  if(data.tasks) await safeSet(STORE_TASKS, data.tasks, true);
  if(data.biblio) await safeSet(STORE_BIBLIO, data.biblio, true);
  if(data.notes) await safeSet(STORE_NOTES, data.notes, true);
  location.reload();
}

function injectBackupUI(){
  const foot = document.querySelector('.sidebar-foot');
  if(!foot || document.getElementById('backupBox')) return;
  const box = document.createElement('div');
  box.id = 'backupBox';
  box.className = 'backup-box';
  box.innerHTML = `
    <button class="btn ghost small" id="exportBtn" type="button">⭳ Exporter</button>
    <label class="btn ghost small" id="importLabel">⭱ Importer
      <input type="file" id="importInput" accept="application/json" style="display:none;">
    </label>`;
  foot.appendChild(box);
  document.getElementById('exportBtn').onclick = exportBackup;
  document.getElementById('importInput').onchange = e => { if(e.target.files[0]) importBackup(e.target.files[0]); };
}

/* ---------- Fil de commentaires réutilisable (tâches + biblio) ---------- */
function commentsHtml(items, parentType, parentId){
  const list = items.map(c => `<div class="comment"><span class="author">${esc(c.author)}</span><span class="at">${esc(c.at)}</span><div>${esc(c.text)}</div></div>`).join('');
  return `
    <button class="comment-toggle" data-open="${parentType}-${parentId}">Commentaires (${items.length})</button>
    <div class="comments" id="comments-${parentType}-${parentId}">
      ${list || '<div class="empty" style="font-size:0.8rem;">Aucun commentaire.</div>'}
      <div class="comment-form">
        <input type="text" placeholder="Ajouter un commentaire…" data-ctype="${parentType}" data-cid="${parentId}">
        <button data-send="${parentType}-${parentId}">Envoyer</button>
      </div>
    </div>`;
}

/* ---------- Rendu markdown-lite (titres, gras, italique, listes, code) ---------- */
function renderMd(src){
  const lines = esc(src||'').split('\n');
  let html = ''; let inList = false;
  for(let line of lines){
    if(/^###\s+/.test(line)){ if(inList){html+='</ul>';inList=false;} html += '<h4>'+line.replace(/^###\s+/,'')+'</h4>'; continue; }
    if(/^#\s+/.test(line)){ if(inList){html+='</ul>';inList=false;} html += '<h3>'+line.replace(/^#\s+/,'')+'</h3>'; continue; }
    if(/^-\s+/.test(line)){ if(!inList){html+='<ul>';inList=true;} html += '<li>'+line.replace(/^-\s+/,'')+'</li>'; continue; }
    if(inList){ html += '</ul>'; inList = false; }
    if(line.trim() === ''){ continue; }
    html += '<p>'+line+'</p>';
  }
  if(inList) html += '</ul>';
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
             .replace(/\*(.+?)\*/g, '<em>$1</em>')
             .replace(/`(.+?)`/g, '<code>$1</code>');
  return html || '<p style="color:var(--ink-soft);font-style:italic;">Vide…</p>';
}

/* ---------- Dashboard stats, utilisé par index.html mais dispo partout ---------- */
function computeStats(tasks, biblio, notes){
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const pct = total ? Math.round(done/total*100) : 0;
  return { total, done, pct, refCount: biblio.length, noteCount: notes.length };
}

/* ---------- Frise des phases du projet (utilisée par le tableau de bord) ----------
   À ajuster si les dates changent — pas de valeur pour la fin de la rédaction
   / la soutenance tant qu'elles ne sont pas connues. */
const PROJECT_DATES = {
  tpStart: '2026-11-22',
  tpEnd: '2026-12-22', // estimation à 1 mois de TP, à corriger si besoin
};

function formatFr(dateStr){
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function renderPhaseTimeline(){
  const box = document.getElementById('phaseTimeline');
  if(!box) return;
  const today = todayLocal();
  const phases = [
    { id: 'elaboration', label: 'Élaboration', end: PROJECT_DATES.tpStart },
    { id: 'tp', label: 'TP', end: PROJECT_DATES.tpEnd },
    { id: 'redaction', label: 'Rédaction & soutenance', end: null },
  ];
  let currentPhase = 'elaboration';
  if(today >= PROJECT_DATES.tpEnd) currentPhase = 'redaction';
  else if(today >= PROJECT_DATES.tpStart) currentPhase = 'tp';

  let statusLine;
  if(currentPhase === 'elaboration'){
    const days = Math.ceil((new Date(PROJECT_DATES.tpStart) - new Date(today)) / 86400000);
    statusLine = `J-${days} avant le début des TP (${formatFr(PROJECT_DATES.tpStart)})`;
  } else if(currentPhase === 'tp'){
    const dayNum = Math.floor((new Date(today) - new Date(PROJECT_DATES.tpStart)) / 86400000) + 1;
    statusLine = `Jour ${dayNum} des TP — fin estimée le ${formatFr(PROJECT_DATES.tpEnd)}`;
  } else {
    statusLine = `TP terminés — place à la rédaction et à la soutenance`;
  }

  box.innerHTML = `
    <div class="phase-track">
      ${phases.map(p => `<div class="phase-seg ${p.id === currentPhase ? 'current' : ''} ${p.end && today > p.end ? 'past' : ''}"><span>${p.label}</span></div>`).join('')}
    </div>
    <div class="phase-status">${statusLine}</div>`;
}

/* ---------- Calendrier mensuel des tâches (utilisé par le tableau de bord) ---------- */
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let calSelected = null; // date 'YYYY-MM-DD' du jour actuellement détaillé

function renderCalendar(tasks){
  const box = document.getElementById('taskCalendar');
  if(!box) return;
  const byDate = {};
  tasks.forEach(t => { if(t.due){ (byDate[t.due] = byDate[t.due] || []).push(t); } });

  const first = new Date(calYear, calMonth, 1);
  const startDow = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = todayLocal();
  const monthLabel = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // si le jour sélectionné n'existe plus dans ce mois, on referme le détail
  if(calSelected && !calSelected.startsWith(`${calYear}-${String(calMonth + 1).padStart(2, '0')}`)) calSelected = null;

  let cells = '';
  for(let i = 0; i < startDow; i++) cells += `<div class="cal-cell empty"></div>`;
  for(let d = 1; d <= daysInMonth; d++){
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayTasks = byDate[dateStr] || [];
    const pending = dayTasks.filter(t => !t.done).length;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === calSelected;
    cells += `
      <div class="cal-cell ${isToday ? 'today' : ''} ${dayTasks.length ? 'has-tasks' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
        <span class="cal-day">${d}</span>
        ${pending ? `<span class="cal-dot">${pending}</span>` : (dayTasks.length ? `<span class="cal-dot done">${dayTasks.length}</span>` : '')}
      </div>`;
  }

  box.innerHTML = `
    <div class="cal-head">
      <button class="btn ghost small" id="calPrev" type="button">‹</button>
      <span class="cal-month">${monthLabel}</span>
      <button class="btn ghost small" id="calNext" type="button">›</button>
    </div>
    <div class="cal-grid">
      ${['L','M','M','J','V','S','D'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells}
    </div>
    <div id="calDetails" class="cal-details"></div>`;

  document.getElementById('calPrev').onclick = () => { calMonth--; if(calMonth < 0){ calMonth = 11; calYear--; } renderCalendar(tasks); };
  document.getElementById('calNext').onclick = () => { calMonth++; if(calMonth > 11){ calMonth = 0; calYear++; } renderCalendar(tasks); };

  box.querySelectorAll('.cal-cell.has-tasks').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateStr = cell.dataset.date;
      calSelected = (calSelected === dateStr) ? null : dateStr;
      renderCalendar(tasks);
    });
  });

  renderCalDetails(byDate[calSelected] || null, calSelected);
}

function renderCalDetails(dayTasks, dateStr){
  const box = document.getElementById('calDetails');
  if(!box) return;
  if(!dateStr || !dayTasks){ box.innerHTML = ''; return; }
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  box.innerHTML = `
    <div class="cal-details-head">${esc(label)}</div>
    ${dayTasks.map(t => `
      <div class="cal-details-item ${t.done ? 'done' : ''}">
        <div class="cal-details-title">${esc(t.title)}</div>
        <div class="cal-details-meta">${t.who ? esc(t.who) : 'Non assigné·e'} · ${t.done ? 'Terminée' : 'À faire'}${t.createdBy ? ' · créée par ' + esc(t.createdBy) : ''}</div>
        ${(t.comments && t.comments.length) ? `<div class="cal-details-comments">${t.comments.map(c => `<div class="comment"><span class="author">${esc(c.author)}</span><span class="at">${esc(c.at)}</span><div>${esc(c.text)}</div></div>`).join('')}</div>` : ''}
      </div>`).join('')}`;
}
