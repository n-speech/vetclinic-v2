let pets = [];
let editingPetId = null;
let tempVaccines = [];

// ── Инициализация ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const user = await Auth.init();
  if (!user) { window.location.href = 'login.html'; return; }
  document.getElementById('user-email').textContent = user.email;
  await loadPets();
  setupModal();
});

// ── Загрузка питомцев ──────────────────────────────────────
async function loadPets() {
  try {
    pets = await API.getPets();
    renderPets();
  } catch (err) {
    showError('Ошибка загрузки: ' + err.message);
  }
}

// ── Модальное окно ─────────────────────────────────────────
function setupModal() {
  document.getElementById('btn-add-pet').addEventListener('click', openCreateModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', savePet);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
}

// ── Рендер питомцев ────────────────────────────────────────
function renderPets() {
  const c = document.getElementById('pets-container');
  if (!pets.length) {
    c.innerHTML = '<div class="empty-state">Питомцев пока нет. Нажмите «+ Добавить питомца».</div>';
    return;
  }
  c.innerHTML = pets.map(renderPetCard).join('');
}

function renderPetCard(pet) {
  const icon = pet.type === 'Кошка' ? '🐈' : pet.type === 'Другое' ? '🐇' : '🐕';
  const age  = pet.birth_date ? calcAge(pet.birth_date) + ' · ' : '';

  // Иконка питомца — фото или эмодзи
  const petIconHtml = pet.photo_url
    ? `<div class="pet-icon pet-icon-photo" style="background-image:url('${pet.photo_url}')"></div>`
    : `<div class="pet-icon">${icon}</div>`;

  const vacRows = (pet.vaccines || [])
    .slice()
    .sort((a, b) => new Date(a.date_next || '9999') - new Date(b.date_next || '9999'))
    .map(v => `
      <div class="vac-row-desktop">
        <div style="font-size:13px;font-weight:500">${esc(v.name)}</div>
        <div style="display:flex;align-items:center;gap:4px">
          ${v.date_done ? `<span style="color:#1D9E75">✓</span><span style="font-size:13px;color:#374151">${fmtDate(v.date_done)}</span>` : ''}
        </div>
        <div>${v.date_next ? `<span class="badge badge-next" style="font-size:13px">↻ ${fmtDate(v.date_next)}</span>` : ''}</div>
      </div>
      <div class="vac-row-mobile">
        <div class="vac-mobile-name">${esc(v.name)}</div>
        <div class="vac-mobile-dates">
          ${v.date_done ? `<span class="vac-mobile-done"><span style="color:#1D9E75;font-size:14px;line-height:1">✓</span> ${fmtDate(v.date_done)}</span>` : ''}
          ${v.date_next ? `<span class="badge badge-next vac-badge-mobile"><span class="vac-arrow">↻</span> ${fmtDate(v.date_next)}</span>` : ''}
        </div>
      </div>`).join('');

  const vacBlock = pet.vaccines?.length
    ? `<div class="vaccine-list"><div class="vaccine-section-title">БЛИЖАЙШАЯ ПРОФИЛАКТИКА</div>${vacRows}</div>`
    : '<div class="no-vaccines">Прививки не добавлены</div>';

  return `
    <div class="card" id="pet-${pet.id}">
      <div class="pet-row">
        ${petIconHtml}
        <div class="pet-info">
          <div class="pet-name">${esc(pet.name)}</div>
          <div class="pet-meta">${esc(pet.breed || pet.type)} · ${age}${pet.sex || ''}</div>
        </div>
        <div class="pet-actions">
          <button class="icon-btn" onclick="openEditModal('${pet.id}')">✏️</button>
          <button class="icon-btn danger" onclick="deletePet('${pet.id}')">🗑</button>
        </div>
      </div>
      ${vacBlock}
    </div>`;
}

// ── Создание питомца ───────────────────────────────────────
function openCreateModal() {
  editingPetId = null;
  tempVaccines = [];
  fillForm({ name:'', type:'Собака', breed:'', birth_date:'', sex:'Самец', notes:'', photo_url:'' });
  document.getElementById('modal-title').textContent = 'Новый питомец';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('photo-input').value = '';
  openModal();
}

// ── Редактирование питомца ─────────────────────────────────
window.openEditModal = function(id) {
  const pet = pets.find(p => p.id === id);
  if (!pet) return;
  editingPetId = id;
  tempVaccines = JSON.parse(JSON.stringify(pet.vaccines || []));
  fillForm(pet);
  document.getElementById('modal-title').textContent = 'Редактировать питомца';

  // Показать текущее фото если есть
  const preview = document.getElementById('photo-preview');
  if (pet.photo_url) {
    preview.src = pet.photo_url;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
  document.getElementById('photo-input').value = '';
  openModal();
};

function fillForm(pet) {
  document.getElementById('f-name').value  = pet.name || '';
  document.getElementById('f-type').value  = pet.type || 'Собака';
  document.getElementById('f-breed').value = pet.breed || '';
  document.getElementById('f-birth').value = pet.birth_date ? pet.birth_date.split('T')[0] : '';
  document.getElementById('f-sex').value   = pet.sex || 'Самец';
  document.getElementById('f-notes').value = pet.notes || '';
  renderVaccineInputs();
}

// ── Предпросмотр фото ──────────────────────────────────────
window.previewPhoto = function(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('photo-preview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
};

function renderVaccineInputs() {
  document.getElementById('vaccine-inputs').innerHTML = tempVaccines.map((v, i) => `
    <div class="vaccine-form-row">
      <div class="form-field">
        <label class="form-label">Название</label>
        <input class="form-input" id="vn-${i}" value="${esc(v.name)}" placeholder="Бешенство...">
      </div>
      <div class="form-field">
        <label class="form-label">Сделана</label>
        <input class="form-input" type="date" id="vd-${i}" value="${v.date_done || ''}">
      </div>
      <div class="form-field">
        <label class="form-label">Следующая</label>
        <input class="form-input" type="date" id="vn2-${i}" value="${v.date_next || ''}">
      </div>
      <div class="form-field">
        <label class="form-label">Статус</label>
        <select class="form-input" id="vs-${i}">
          <option value="done" ${v.status==='done'?'selected':''}>Сделана</option>
          <option value="soon" ${v.status==='soon'?'selected':''}>Скоро</option>
          <option value="next" ${v.status==='next'?'selected':''}>Следующая</option>
        </select>
      </div>
      <button class="del-vac-btn" onclick="removeVaccine(${i})">✕</button>
    </div>`).join('');
}

function syncVaccines() {
  tempVaccines.forEach((v, i) => {
    v.name      = document.getElementById('vn-'+i)?.value  || '';
    v.date_done = document.getElementById('vd-'+i)?.value  || null;
    v.date_next = document.getElementById('vn2-'+i)?.value || null;
    v.status    = document.getElementById('vs-'+i)?.value  || 'done';
  });
}

window.addVaccine = function() {
  syncVaccines();
  tempVaccines.push({ name:'', date_done:'', date_next:'', status:'done' });
  renderVaccineInputs();
};

window.removeVaccine = function(i) {
  syncVaccines();
  tempVaccines.splice(i, 1);
  renderVaccineInputs();
};

// ── Сохранение ─────────────────────────────────────────────
async function savePet() {
  syncVaccines();
  const petData = {
    name:       document.getElementById('f-name').value.trim(),
    type:       document.getElementById('f-type').value,
    breed:      document.getElementById('f-breed').value.trim(),
    birth_date: document.getElementById('f-birth').value || null,
    sex:        document.getElementById('f-sex').value,
    notes:      document.getElementById('f-notes').value.trim()
  };
  if (!petData.name) { alert('Введите кличку'); return; }
  const validVacs = tempVaccines.filter(v => v.name.trim());
  const photoFile = document.getElementById('photo-input').files[0];

  setSaving(true);
  try {
    if (editingPetId) {
      const updated = await API.updatePet(editingPetId, petData);
      const pet = pets.find(p => p.id === editingPetId);
      for (const v of (pet.vaccines || [])) await API.deleteVaccine(v.id);
      const newVacs = [];
      for (const v of validVacs) newVacs.push(await API.createVaccine({ ...v, pet_id: editingPetId }));
      let photoUrl = pet.photo_url || null;
      if (photoFile) photoUrl = await API.uploadPhoto(editingPetId, photoFile);
      pets[pets.findIndex(p => p.id === editingPetId)] = { ...updated, vaccines: newVacs, photo_url: photoUrl };
    } else {
      const created = await API.createPet(petData);
      const newVacs = [];
      for (const v of validVacs) newVacs.push(await API.createVaccine({ ...v, pet_id: created.id }));
      let photoUrl = null;
      if (photoFile) photoUrl = await API.uploadPhoto(created.id, photoFile);
      pets.push({ ...created, vaccines: newVacs, photo_url: photoUrl });
    }
    closeModal();
    renderPets();
  } catch (err) {
    showError(err.message);
  } finally {
    setSaving(false);
  }
}

// ── Удаление питомца ───────────────────────────────────────
window.deletePet = async function(id) {
  if (!confirm('Удалить питомца и все прививки?')) return;
  try {
    const pet = pets.find(p => p.id === id);
    if (pet?.photo_url) await API.deletePhoto(id, pet.photo_url);
    await API.deletePet(id);
    pets = pets.filter(p => p.id !== id);
    renderPets();
  } catch (err) {
    showError(err.message);
  }
};

// ── Утилиты ────────────────────────────────────────────────
function openModal()  { document.getElementById('modal-overlay').style.display = 'flex'; }
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

function setSaving(on) {
  const btn = document.getElementById('btn-save');
  btn.textContent = on ? 'Сохранение...' : 'Сохранить';
  btn.disabled = on;
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  const mon = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][m-1];
  return `${parseInt(day)} ${mon} ${y}`;
}

function calcAge(b) {
  const y = new Date().getFullYear() - new Date(b).getFullYear();
  return y === 1 ? '1 год' : y < 5 ? y + ' года' : y + ' лет';
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}
