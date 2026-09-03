const $ = selector => document.querySelector(selector);

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function coverUrl(portada) {
  if (!portada) return '';
  if (typeof portada === 'string') {
    try { return coverUrl(JSON.parse(portada)); } catch { return portada; }
  }
  if (Array.isArray(portada)) return coverUrl(portada[0]);
  return portada.url || portada.publicUrl || portada.src || portada.path || '';
}

function empty(container, text, isError = false) {
  container.innerHTML = `<p class="state${isError ? ' error' : ''}">${escapeHtml(text)}</p>`;
}

function renderDiscos(discos) {
  discos = discos.filter(disco => disco && (disco.nombre || disco.banda));
  $('#discosCount').textContent = `${discos.length} ${discos.length === 1 ? 'disco' : 'discos'}`;
  if (!discos.length) return empty($('#discosGrid'), 'Todavía no hay discos publicados.');
  $('#discosGrid').innerHTML = discos.map(disco => {
    const image = coverUrl(disco.portada);
    const details = [disco.genero, disco['país'], disco.sello].filter(Boolean).map(escapeHtml).join(' · ');
    return `<article class="album-card"><div class="cover">${image ? `<img src="${escapeHtml(image)}" alt="Portada de ${escapeHtml(disco.nombre || disco.banda)}" loading="lazy">` : '<div class="cover-fallback">MW</div>'}</div>${disco.nombre ? `<h3>${escapeHtml(disco.nombre)}</h3>` : ''}<div class="meta"><strong>${escapeHtml(disco.banda || '')}</strong>${disco.fecha ? ` · ${escapeHtml(new Date(disco.fecha).getFullYear())}` : ''}<br>${details}</div></article>`;
  }).join('');
}

function renderReviews(reviews) {
  reviews = reviews.filter(review => review && (review.disco || review.reviewer || review.notas));
  $('#reviewsCount').textContent = `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`;
  if (!reviews.length) return empty($('#reviewsGrid'), 'Todavía no hay reviews publicadas.');
  $('#reviewsGrid').innerHTML = reviews.map(review => `<article class="review-card"><div class="review-score">${escapeHtml(review.puntuacion ?? '—')}</div><div>${review.disco ? `<h3>${escapeHtml(review.disco)}</h3>` : ''}<div class="meta">${review.reviewer ? `Por ${escapeHtml(review.reviewer)}` : ''}${review.reviewer && (review.fechareview || review.created_at) ? ' · ' : ''}${escapeHtml(formatDate(review.fechareview || review.created_at))}</div></div>${review.recomendado ? '<span class="recommended">Recomendado</span>' : ''}${review.notas ? `<p class="review-notes">${escapeHtml(review.notas)}</p>` : ''}</article>`).join('');
}

function renderUsers(users) {
  users = users.filter(user => user && user.nombre);
  $('#usersCount').textContent = `${users.length} ${users.length === 1 ? 'miembro' : 'miembros'}`;
  if (!users.length) return empty($('#usersGrid'), 'Todavía no hay miembros visibles.');
  $('#usersGrid').innerHTML = users.map(user => {
    const name = user.nombre;
    return `<article class="user-card"><div class="avatar" aria-hidden="true">${escapeHtml(name.trim().charAt(0).toUpperCase())}</div><h3>${escapeHtml(name)}</h3>${user.role ? `<div class="role">${escapeHtml(user.role)}</div>` : ''}</article>`;
  }).join('');
}

async function loadContent() {
  ['#discosGrid', '#reviewsGrid', '#usersGrid'].forEach(selector => empty($(selector), 'Cargando datos…'));
  try {
    const response = await fetch('/api/metalwinds');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el contenido');
    renderDiscos(Array.isArray(data.discos) ? data.discos : []);
    renderReviews(Array.isArray(data.reviews) ? data.reviews : []);
    renderUsers(Array.isArray(data.users) ? data.users : []);
  } catch (error) {
    ['#discosGrid', '#reviewsGrid', '#usersGrid'].forEach(selector => empty($(selector), error.message, true));
  }
}

$('#menuButton').addEventListener('click', () => {
  const open = $('#mainNav').classList.toggle('open');
  $('#menuButton').setAttribute('aria-expanded', String(open));
});
$('#mainNav').addEventListener('click', () => { $('#mainNav').classList.remove('open'); $('#menuButton').setAttribute('aria-expanded', 'false'); });
loadContent();
