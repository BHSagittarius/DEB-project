let tasks = [];

function populateAssignee(){
  const names = new Set([myName]);
  tasks.forEach(t => { if(t.who) names.add(t.who); });
  const sel = document.getElementById('taskWho');
  sel.innerHTML = '<option value="">Assigné à…</option>' +
    [...names].map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('') +
    '<option value="__new__">Autre…</option>';
}

function renderTasks(){
  const list = document.getElementById('taskList');
  if(!tasks.length){ list.innerHTML = '<li class="empty">Aucune tâche pour l\u2019instant.</li>'; return; }
  const sorted = [...tasks].sort((a,b) => (a.done - b.done) || (a.due||'9999').localeCompare(b.due||'9999'));
  list.innerHTML = sorted.map(t => `
    <li class="task ${t.done ? 'done':''}" data-id="${t.id}">
      <div class="row">
        <input type="checkbox" ${t.done?'checked':''}>
        <div class="body">
          <div class="title">${esc(t.title)}</div>
          <div class="meta">${t.who ? esc(t.who)+' · ' : ''}${t.due ? 'échéance '+t.due : 'pas d\u2019échéance'}</div>
          ${commentsHtml(t.comments||[], 'task', t.id)}
        </div>
        <button class="del">✕</button>
      </div>
    </li>
  `).join('');
}

document.getElementById('taskForm').addEventListener('submit', async e => {
  e.preventDefault();
  let who = document.getElementById('taskWho').value;
  if(who === '__new__'){ who = prompt('Nom :') || ''; }
  const t = { id: uid(), title: document.getElementById('taskTitle').value.trim(),
    due: document.getElementById('taskDue').value, who, done: false, createdBy: myName, comments: [] };
  if(!t.title) return;
  tasks.push(t);
  await safeSet(STORE_TASKS, tasks, true);
  e.target.reset();
  renderTasks(); populateAssignee();
});

document.getElementById('taskList').addEventListener('click', async e => {
  const li = e.target.closest('li.task');
  if(!li) return;
  const id = li.dataset.id;
  if(e.target.matches('input[type=checkbox]')){
    tasks.find(x => x.id === id).done = e.target.checked;
    await safeSet(STORE_TASKS, tasks, true); renderTasks();
  } else if(e.target.classList.contains('del')){
    tasks = tasks.filter(x => x.id !== id);
    await safeSet(STORE_TASKS, tasks, true); renderTasks();
  } else if(e.target.classList.contains('comment-toggle')){
    document.getElementById('comments-'+e.target.dataset.open).classList.toggle('open');
  } else if(e.target.dataset.send){
    const input = li.querySelector(`input[data-ctype][data-cid="${id}"]`);
    const text = input.value.trim(); if(!text) return;
    tasks.find(x => x.id === id).comments.push({id:uid(), author: myName, text, at: now()});
    await safeSet(STORE_TASKS, tasks, true); renderTasks();
    document.getElementById('comments-task-'+id).classList.add('open');
  }
});

async function init(){
  await ensureName();
  tasks = (await safeGet(STORE_TASKS, true)) || [];
  tasks.forEach(t => { if(!t.comments) t.comments = []; });
  renderTasks(); populateAssignee();
}
init();
