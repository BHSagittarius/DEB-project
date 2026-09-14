async function init(){
  await ensureName();
  const tasks = (await safeGet(STORE_TASKS, true)) || [];
  const biblio = (await safeGet(STORE_BIBLIO, true)) || [];
  const notes = (await safeGet(STORE_NOTES, true)) || [];

  const s = computeStats(tasks, biblio, notes);
  document.getElementById('stats').innerHTML = `
    <div class="stat">
      <div class="n">${s.pct}%</div>
      <div class="l">tâches terminées (${s.done}/${s.total})</div>
      <div class="progress-track"><div class="progress-fill" style="width:${s.pct}%"></div></div>
    </div>
    <div class="stat"><div class="n">${s.refCount}</div><div class="l">références bibliographiques</div></div>
    <div class="stat"><div class="n">${s.noteCount}</div><div class="l">sections de notes / méthodes</div></div>
  `;

  const upcoming = tasks.filter(t => !t.done && t.due).sort((a,b) => a.due.localeCompare(b.due)).slice(0,6);
  document.getElementById('upcoming').innerHTML = upcoming.length ? upcoming.map(t => `
    <div class="upcoming-item"><span>${esc(t.title)}${t.who ? ' — <em>'+esc(t.who)+'</em>' : ''}</span><span class="due">${t.due}</span></div>
  `).join('') : '<div class="empty">Aucune échéance planifiée. Ajoute des dates depuis l\u2019onglet Tâches.</div>';
}
init();
