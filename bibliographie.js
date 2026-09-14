let biblio = [];

function renderBiblio(){
  const box = document.getElementById('biblioList');
  if(!biblio.length){ box.innerHTML = '<div class="empty">Aucune référence pour l\u2019instant.</div>'; return; }
  box.innerHTML = biblio.map(b => `
    <div class="biblio-card" data-id="${b.id}">
      <div class="row">
        <div>
          <span class="type-pill">${esc(b.type||'Autre')}</span>
          <span class="ref-title">${b.link ? `<a href="${esc(b.link)}" target="_blank" rel="noopener">${esc(b.title)}</a>` : esc(b.title)}</span>
          ${b.authors ? `<div class="authors">${esc(b.authors)}${b.year ? ' · '+esc(b.year) : ''}</div>` : (b.year ? `<div class="authors">${esc(b.year)}</div>` : '')}
        </div>
        <button class="del-small" style="background:none;border:none;color:var(--margin-red);cursor:pointer;">✕</button>
      </div>
      ${b.tags && b.tags.length ? `<div style="margin-top:6px;">${b.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      ${b.notes ? `<div class="notes">${esc(b.notes)}</div>` : ''}
      <div class="meta">ajouté par ${esc(b.addedBy||'?')}</div>
      ${commentsHtml(b.comments||[], 'biblio', b.id)}
    </div>
  `).join('');
}

document.getElementById('biblioForm').addEventListener('submit', async e => {
  e.preventDefault();
  const b = { id: uid(), title: document.getElementById('bTitle').value.trim(),
    type: document.getElementById('bType').value,
    authors: document.getElementById('bAuthors').value.trim(),
    year: document.getElementById('bYear').value.trim(),
    link: document.getElementById('bLink').value.trim(),
    tags: document.getElementById('bTags').value.split(',').map(s=>s.trim()).filter(Boolean),
    notes: document.getElementById('bNotes').value.trim(),
    addedBy: myName, comments: [] };
  if(!b.title) return;
  biblio.unshift(b);
  await safeSet(STORE_BIBLIO, biblio, true);
  e.target.reset();
  renderBiblio();
});

document.getElementById('biblioList').addEventListener('click', async e => {
  const card = e.target.closest('.biblio-card');
  if(!card) return;
  const id = card.dataset.id;
  if(e.target.classList.contains('del-small')){
    biblio = biblio.filter(x => x.id !== id);
    await safeSet(STORE_BIBLIO, biblio, true); renderBiblio();
  } else if(e.target.classList.contains('comment-toggle')){
    document.getElementById('comments-'+e.target.dataset.open).classList.toggle('open');
  } else if(e.target.dataset.send){
    const input = card.querySelector(`input[data-ctype][data-cid="${id}"]`);
    const text = input.value.trim(); if(!text) return;
    biblio.find(x => x.id === id).comments.push({id:uid(), author: myName, text, at: now()});
    await safeSet(STORE_BIBLIO, biblio, true); renderBiblio();
    document.getElementById('comments-biblio-'+id).classList.add('open');
  }
});

async function init(){
  await ensureName();
  biblio = (await safeGet(STORE_BIBLIO, true)) || [];
  biblio.forEach(b => { if(!b.comments) b.comments = []; if(!b.type) b.type = 'Autre'; });
  renderBiblio();
}
init();
