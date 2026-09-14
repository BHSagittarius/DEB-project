let notes = [];
let figCounter = 0;

function blockHtml(block){
  if(block.type === 'text'){
    return `
      <div class="block block-text" data-bid="${block.id}">
        <div class="block-actions"><button class="del-small" data-delblock="${block.id}">✕</button></div>
        <textarea class="raw" placeholder="Écrire ici… (# Titre, **gras**, *italique*, - liste)">${esc(block.content||'')}</textarea>
        <div class="rendered">${renderMd(block.content||'')}</div>
      </div>`;
  }
  figCounter++;
  const label = 'Fig. ' + figCounter;
  return `
    <div class="block block-image" data-bid="${block.id}">
      <div class="block-actions"><button class="del-small" data-delblock="${block.id}">✕</button></div>
      <div class="img-edit">
        <input type="text" data-field="url" placeholder="URL de l'image / du schéma" value="${esc(block.url||'')}">
        <input type="text" data-field="caption" placeholder="Légende (ex : Coupe transversale de la tige, x40)" value="${esc(block.caption||'')}">
        <input type="text" data-field="scale" placeholder="Échelle (ex : 1 cm = 10 µm, ou grossissement x40)" value="${esc(block.scale||'')}">
      </div>
      <figure class="sci-figure">
        ${block.url ? `<img src="${esc(block.url)}" alt="${esc(block.caption||'')}">` : `<div style="padding:30px;color:var(--ink-soft);font-style:italic;">Ajoute une URL d'image ci-dessus…</div>`}
        <figcaption><span class="fig-label">${label}</span> — ${esc(block.caption||'sans légende')}${block.scale ? `<span class="scale">${esc(block.scale)}</span>` : ''}</figcaption>
      </figure>
    </div>`;
}

function renderNotes(){
  const box = document.getElementById('noteList');
  if(!notes.length){ box.innerHTML = '<div class="empty">Aucune section pour l\u2019instant.</div>'; return; }
  figCounter = 0;
  box.innerHTML = notes.map(n => `
    <div class="note-card" data-id="${n.id}">
      <div class="note-title">
        <span>${esc(n.title)} <span class="stamp">— maj par ${esc(n.updatedBy||'?')} · ${esc(n.updatedAt||'')}</span></span>
        <button class="del-small" data-delnote="${n.id}" style="background:none;border:none;color:var(--margin-red);cursor:pointer;">✕ section</button>
      </div>
      <div class="blocks">${n.blocks.map(blockHtml).join('') || '<div class="empty">Section vide — ajoute un bloc ci-dessous.</div>'}</div>
      <div class="add-block-row">
        <button class="btn ghost small" data-addblock="text">+ Texte</button>
        <button class="btn ghost small" data-addblock="image">+ Image / schéma</button>
      </div>
    </div>
  `).join('');
}

function touchNote(n){ n.updatedBy = myName; n.updatedAt = now(); }

document.getElementById('noteForm').addEventListener('submit', async e => {
  e.preventDefault();
  const title = document.getElementById('noteTitle').value.trim();
  if(!title) return;
  notes.unshift({ id: uid(), title, blocks: [], updatedBy: myName, updatedAt: now() });
  await safeSet(STORE_NOTES, notes, true);
  e.target.reset();
  renderNotes();
});

document.getElementById('noteList').addEventListener('click', async e => {
  const card = e.target.closest('.note-card');
  if(!card) return;
  const n = notes.find(x => x.id === card.dataset.id);

  if(e.target.dataset.delnote){
    notes = notes.filter(x => x.id !== e.target.dataset.delnote);
    await safeSet(STORE_NOTES, notes, true); renderNotes(); return;
  }
  if(e.target.dataset.addblock){
    const type = e.target.dataset.addblock;
    n.blocks.push(type === 'text' ? {id:uid(), type:'text', content:''} : {id:uid(), type:'image', url:'', caption:'', scale:''});
    touchNote(n); await safeSet(STORE_NOTES, notes, true); renderNotes(); return;
  }
  if(e.target.dataset.delblock){
    n.blocks = n.blocks.filter(b => b.id !== e.target.dataset.delblock);
    touchNote(n); await safeSet(STORE_NOTES, notes, true); renderNotes(); return;
  }
});

let noteSaveTimer = null;
document.getElementById('noteList').addEventListener('input', e => {
  const card = e.target.closest('.note-card');
  if(!card) return;
  const n = notes.find(x => x.id === card.dataset.id);
  const blockEl = e.target.closest('.block');
  const b = n.blocks.find(x => x.id === blockEl.dataset.bid);

  if(e.target.classList.contains('raw')){
    b.content = e.target.value;
    blockEl.querySelector('.rendered').innerHTML = renderMd(b.content);
  } else if(e.target.dataset.field){
    b[e.target.dataset.field] = e.target.value;
    const fig = blockEl.querySelector('.sci-figure');
    fig.innerHTML = (b.url ? `<img src="${esc(b.url)}" alt="${esc(b.caption||'')}">` : `<div style="padding:30px;color:var(--ink-soft);font-style:italic;">Ajoute une URL d'image ci-dessus…</div>`)
      + `<figcaption><span class="fig-label">Fig.</span> — ${esc(b.caption||'sans légende')}${b.scale ? `<span class="scale">${esc(b.scale)}</span>` : ''}</figcaption>`;
  }
  touchNote(n);
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(() => safeSet(STORE_NOTES, notes, true), 600);
});

async function init(){
  await ensureName();
  notes = (await safeGet(STORE_NOTES, true)) || [];
  notes.forEach(n => { if(!n.blocks) n.blocks = n.content ? [{id:uid(),type:'text',content:n.content}] : []; });
  renderNotes();
}
init();
