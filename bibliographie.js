let biblio = [];
let filterTag = '';
let filterStatus = '';

const STATUS_LABEL = { 'a-lire': 'À lire', 'en-cours': 'En cours', 'lu': 'Lu' };

function renderFilters(){
  const box = document.getElementById('biblioFilters');
  if(!box) return;
  const tags = [...new Set(biblio.flatMap(b => b.tags || []))].sort();
  box.innerHTML = `
    <select id="filterTagSel">
      <option value="">Tous les tags</option>
      ${tags.map(t => `<option value="${esc(t)}" ${filterTag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
    </select>
    <div class="status-filter-group">
      ${[['', 'Tous'], ['a-lire', 'À lire'], ['en-cours', 'En cours'], ['lu', 'Lu']].map(([v, l]) =>
        `<button type="button" class="status-filter-btn ${filterStatus === v ? 'active' : ''}" data-status="${v}">${l}</button>`).join('')}
    </div>`;
  document.getElementById('filterTagSel').onchange = e => { filterTag = e.target.value; renderBiblio(); };
  box.querySelectorAll('.status-filter-btn').forEach(btn => {
    btn.onclick = () => { filterStatus = btn.dataset.status; renderFilters(); renderBiblio(); };
  });
}

function renderBiblio(){
  const box = document.getElementById('biblioList');
  const filtered = biblio.filter(b =>
    (!filterTag || (b.tags || []).includes(filterTag)) &&
    (!filterStatus || b.status === filterStatus));
  if(!filtered.length){
    box.innerHTML = `<div class="empty">Aucune référence${(filterTag || filterStatus) ? ' pour ce filtre.' : ' pour l\u2019instant.'}</div>`;
    return;
  }
  box.innerHTML = filtered.map(b => `
    <div class="biblio-card" data-id="${b.id}">
      <div class="row">
        <div>
          <span class="type-pill">${esc(b.type || 'Autre')}</span>
          <select class="status-select" data-id="${b.id}">
            <option value="a-lire" ${b.status === 'a-lire' ? 'selected' : ''}>À lire</option>
            <option value="en-cours" ${b.status === 'en-cours' ? 'selected' : ''}>En cours</option>
            <option value="lu" ${b.status === 'lu' ? 'selected' : ''}>Lu</option>
          </select>
          <span class="ref-title">${b.link ? `<a href="${esc(b.link)}" target="_blank" rel="noopener">${esc(b.title)}</a>` : esc(b.title)}</span>
          ${b.authors ? `<div class="authors">${esc(b.authors)}${b.year ? ' · ' + esc(b.year) : ''}</div>` : (b.year ? `<div class="authors">${esc(b.year)}</div>` : '')}
        </div>
        <button class="del-small" style="background:none;border:none;color:var(--margin-red);cursor:pointer;">✕</button>
      </div>
      ${b.tags && b.tags.length ? `<div style="margin-top:6px;">${b.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      ${b.notes ? `<div class="notes">${esc(b.notes)}</div>` : ''}
      ${b.synthese ? `<div class="synthese"><strong>Synthèse :</strong> ${esc(b.synthese)}</div>` : ''}
      <div class="meta">ajouté par ${esc(b.addedBy || '?')}</div>
      ${commentsHtml(b.comments || [], 'biblio', b.id)}
    </div>
  `).join('');
}

document.getElementById('biblioForm').addEventListener('submit', async e => {
  e.preventDefault();
  const b = {
    id: uid(), title: document.getElementById('bTitle').value.trim(),
    type: document.getElementById('bType').value,
    status: document.getElementById('bStatus').value,
    authors: document.getElementById('bAuthors').value.trim(),
    year: document.getElementById('bYear').value.trim(),
    link: document.getElementById('bLink').value.trim(),
    tags: document.getElementById('bTags').value.split(',').map(s => s.trim()).filter(Boolean),
    notes: document.getElementById('bNotes').value.trim(),
    synthese: document.getElementById('bSynthese').value.trim(),
    addedBy: myName, comments: []
  };
  if(!b.title) return;
  biblio.unshift(b);
  await safeSet(STORE_BIBLIO, biblio, true);
  e.target.reset();
  renderFilters();
  renderBiblio();
});

document.getElementById('biblioList').addEventListener('click', async e => {
  const card = e.target.closest('.biblio-card');
  if(!card) return;
  const id = card.dataset.id;
  if(e.target.classList.contains('del-small')){
    biblio = biblio.filter(x => x.id !== id);
    await safeSet(STORE_BIBLIO, biblio, true); renderFilters(); renderBiblio();
  } else if(e.target.classList.contains('comment-toggle')){
    document.getElementById('comments-' + e.target.dataset.open).classList.toggle('open');
  } else if(e.target.dataset.send){
    const input = card.querySelector(`input[data-ctype][data-cid="${id}"]`);
    const text = input.value.trim(); if(!text) return;
    biblio.find(x => x.id === id).comments.push({ id: uid(), author: myName, text, at: now() });
    await safeSet(STORE_BIBLIO, biblio, true); renderBiblio();
    document.getElementById('comments-biblio-' + id).classList.add('open');
  }
});

document.getElementById('biblioList').addEventListener('change', async e => {
  if(e.target.classList.contains('status-select')){
    const item = biblio.find(x => x.id === e.target.dataset.id);
    if(item){ item.status = e.target.value; await safeSet(STORE_BIBLIO, biblio, true); }
  }
});

async function init(){
  await ensureName();
  biblio = (await safeGet(STORE_BIBLIO, true)) || [];
  biblio.forEach(b => {
    if(!b.comments) b.comments = [];
    if(!b.type) b.type = 'Autre';
    if(!b.status) b.status = 'a-lire';
    if(b.synthese === undefined) b.synthese = '';
  });
  renderFilters();
  renderBiblio();
}
init();
