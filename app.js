/* ---------- Clés de stockage partagé ---------- */
const STORE_TASKS = 'tasks';
const STORE_BIBLIO = 'biblio';
const STORE_NOTES = 'notes';
const STORE_NAME = 'username';

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function esc(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function now(){ return new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }

async function safeGet(key, shared){
  try{ const r = await window.storage.get(key, shared); return r ? JSON.parse(r.value) : null; }
  catch(e){ return null; }
}
async function safeSet(key, value, shared){
  try{ await window.storage.set(key, JSON.stringify(value), shared); }
  catch(e){ console.error('storage set failed', key, e); }
}

/* ---------- Identité (stockage personnel, non partagé) ---------- */
let myName = '';
async function ensureName(){
  try{ const r = await window.storage.get(STORE_NAME, false); myName = r ? JSON.parse(r.value) : null; }
  catch(e){ myName = null; }
  if(!myName){
    myName = prompt("Ton prénom (pour identifier tes ajouts) :") || "Anonyme";
    await safeSet(STORE_NAME, myName, false);
  }
  renderWho();
  return myName;
}
function renderWho(){
  const box = document.getElementById('whoBox');
  if(!box) return;
  box.innerHTML = `Connecté·e comme<br><strong>${esc(myName)}</strong> <button id="changeNameBtn">changer</button>`;
  document.getElementById('changeNameBtn').onclick = async () => {
    const n = prompt("Ton prénom :", myName);
    if(n){ myName = n; await safeSet(STORE_NAME, myName, false); renderWho(); }
  };
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
