'use strict';

/* ================== Configuration ================== */
const APP_VERSION = '1.0.0';
const STORAGE_KEY = 'carnetPing.matches.v1';
const SETTINGS_KEY = 'carnetPing.settings.v1';
const MAX_SETS = 5;

const TAGS = [
  'Service', 'Remise', 'Coup droit', 'Revers', 'Top spin', 'Bloc',
  'Poussette', 'Flip', 'Déplacement', 'Tactique', 'Mental',
  'Régularité', 'Physique', 'Fins de set', 'Prise d\'initiative'
];

const RATINGS = [
  ['niveau', 'Niveau de jeu global'],
  ['concentration', 'Concentration'],
  ['confiance', 'Confiance'],
  ['regularite', 'Régularité'],
  ['physique', 'Condition physique'],
  ['plaisir', 'Plaisir de jeu'],
];

/* ================== Stockage ================== */
function loadMatches() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveMatches() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
}
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let matches = loadMatches();
let settings = loadSettings();
let editingId = null;

// Demande au navigateur de ne pas effacer les données
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

/* ================== Utilitaires ================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pct = (w, n) => n ? Math.round(100 * w / n) : 0;
const num = (v) => (v === '' || v == null || isNaN(+v)) ? null : +v;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2500);
}

function sortedMatches() {
  return [...matches].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
}

/* ================== Navigation ================== */
function showView(name) {
  $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + name; });
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo(0, 0);
  if (name === 'list') renderList();
  if (name === 'stats') renderStats();
  if (name === 'data') renderDataInfo();
}

$$('.tabbar button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.view === 'form') openForm(null);
  else showView(b.dataset.view);
}));

/* ================== Formulaire ================== */
const form = $('#matchForm');

function buildFormWidgets() {
  // Sets
  const sb = $('#setsBox');
  sb.innerHTML = '';
  for (let i = 0; i < MAX_SETS; i++) {
    sb.insertAdjacentHTML('beforeend', `
      <div class="set-row">
        <span>Set ${i + 1}</span>
        <input type="number" inputmode="numeric" min="0" max="99" data-set="${i}" data-side="0" placeholder="moi">
        <span class="dash">–</span>
        <input type="number" inputmode="numeric" min="0" max="99" data-set="${i}" data-side="1" placeholder="adv">
        <span class="res" data-res="${i}"></span>
      </div>`);
  }
  // Tags
  $$('.chips').forEach(box => {
    box.innerHTML = TAGS.map(t => `<button type="button" data-v="${esc(t)}">${esc(t)}</button>`).join('');
  });
  // Notes de ressenti
  $('#ratingsBox').innerHTML = RATINGS.map(([k, label]) => `
    <div class="rating">
      <span>${label}</span>
      <div class="seg" data-rating="${k}">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-v="${n}">${n}</button>`).join('')}
      </div>
    </div>`).join('');
}
buildFormWidgets();

// Boutons segmentés à choix unique (cliquer à nouveau = désélectionner)
form.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-v]');
  if (!btn) return;
  const group = btn.parentElement;
  if (group.classList.contains('chips')) {
    btn.classList.toggle('on');
  } else if (group.classList.contains('seg')) {
    const wasOn = btn.classList.contains('on');
    $$('button', group).forEach(b => b.classList.remove('on'));
    if (!wasOn) btn.classList.add('on');
  }
});

form.addEventListener('input', (e) => {
  if (e.target.dataset.set !== undefined) updateScorePreview();
});

function readSets() {
  const sets = [];
  for (let i = 0; i < MAX_SETS; i++) {
    const a = num($(`input[data-set="${i}"][data-side="0"]`).value);
    const b = num($(`input[data-set="${i}"][data-side="1"]`).value);
    if (a != null && b != null && a !== b) sets.push([a, b]);
  }
  return sets;
}

function updateScorePreview() {
  const sets = readSets();
  for (let i = 0; i < MAX_SETS; i++) {
    const a = num($(`input[data-set="${i}"][data-side="0"]`).value);
    const b = num($(`input[data-set="${i}"][data-side="1"]`).value);
    const el = $(`[data-res="${i}"]`);
    if (a != null && b != null && a !== b) {
      el.textContent = a > b ? '✓' : '✗';
      el.style.color = a > b ? 'var(--win)' : 'var(--loss)';
    } else el.textContent = '';
  }
  if (!sets.length) { $('#scorePreview').textContent = ''; return; }
  const w = sets.filter(s => s[0] > s[1]).length, l = sets.length - w;
  $('#scorePreview').innerHTML = w === l
    ? `Score : ${w}–${l}`
    : `Score : ${w}–${l} → <span style="color:var(${w > l ? '--win' : '--loss'})">${w > l ? 'Victoire' : 'Défaite'}</span>`;
}

function setSeg(name, value) {
  const g = $(`.seg[data-name="${name}"]`);
  $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.v === value));
}
function getSeg(name) {
  const on = $(`.seg[data-name="${name}"] button.on`);
  return on ? on.dataset.v : '';
}

function refreshOpponentList() {
  const names = [...new Set(matches.map(m => m.oppName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  $('#oppNames').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
}

// Pré-remplissage si l'adversaire est déjà connu
form.oppName.addEventListener('change', () => {
  if (editingId) return;
  const last = sortedMatches().find(m => m.oppName && m.oppName.toLowerCase() === form.oppName.value.trim().toLowerCase());
  if (!last) return;
  if (!form.oppClub.value) form.oppClub.value = last.oppClub || '';
  if (!form.oppStyle.value) form.oppStyle.value = last.oppStyle || '';
  if (!form.oppMaterial.value) form.oppMaterial.value = last.oppMaterial || '';
  if (!getSeg('oppHand') && last.oppHand) setSeg('oppHand', last.oppHand);
  if (!form.oppPoints.value && last.oppPoints) form.oppPoints.value = last.oppPoints;
  const n = matches.filter(m => m.oppName.toLowerCase() === last.oppName.toLowerCase());
  const w = n.filter(m => m.result === 'V').length;
  toast(`Déjà affronté ${n.length} fois (${w}V – ${n.length - w}D)`);
});

function openForm(id) {
  editingId = id;
  form.reset();
  buildFormWidgets();
  setSeg('oppHand', '');
  setSeg('tightness', '');
  refreshOpponentList();
  const m = id ? matches.find(x => x.id === id) : null;
  $('#formTitle').textContent = m ? 'Modifier le match' : 'Nouveau match';
  $('#deleteBtn').hidden = !m;

  if (m) {
    const fields = ['date', 'myPoints', 'context', 'competitionDetail', 'oppName', 'oppPoints', 'oppClub',
      'oppStyle', 'oppMaterial', 'whyResult', 'doDifferently', 'comment', 'conditions'];
    fields.forEach(f => { if (form[f]) form[f].value = m[f] ?? ''; });
    setSeg('oppHand', m.oppHand || '');
    setSeg('tightness', m.tightness || '');
    (m.sets || []).forEach((s, i) => {
      if (i >= MAX_SETS) return;
      $(`input[data-set="${i}"][data-side="0"]`).value = s[0];
      $(`input[data-set="${i}"][data-side="1"]`).value = s[1];
    });
    if (!(m.sets || []).length) {
      form.manualWon.value = m.setsWon ?? '';
      form.manualLost.value = m.setsLost ?? '';
    }
    ['strengths', 'weaknesses'].forEach(k => {
      $$(`.chips[data-name="${k}"] button`).forEach(b => b.classList.toggle('on', (m[k] || []).includes(b.dataset.v)));
    });
    RATINGS.forEach(([k]) => {
      const v = m.ratings && m.ratings[k];
      $$(`.seg[data-rating="${k}"] button`).forEach(b => b.classList.toggle('on', +b.dataset.v === v));
    });
  } else {
    form.date.value = today();
    form.myPoints.value = settings.myPoints || '';
    if (settings.lastContext) form.context.value = settings.lastContext;
  }
  updateScorePreview();
  showView('form');
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === 'form' && !m));
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const sets = readSets();
  let won, lost;
  if (sets.length) {
    won = sets.filter(s => s[0] > s[1]).length;
    lost = sets.length - won;
  } else {
    won = num(form.manualWon.value);
    lost = num(form.manualLost.value);
  }
  if (won == null || lost == null || won === lost) {
    toast('Saisis le score : détail des sets ou score direct (pas d\'égalité).');
    return;
  }

  const ratings = {};
  RATINGS.forEach(([k]) => {
    const on = $(`.seg[data-rating="${k}"] button.on`);
    if (on) ratings[k] = +on.dataset.v;
  });

  const old = editingId ? matches.find(x => x.id === editingId) : null;
  const m = {
    id: old ? old.id : uid(),
    date: form.date.value,
    context: form.context.value,
    competitionDetail: form.competitionDetail.value.trim(),
    myPoints: num(form.myPoints.value),
    oppName: form.oppName.value.trim(),
    oppPoints: num(form.oppPoints.value),
    oppClub: form.oppClub.value.trim(),
    oppHand: getSeg('oppHand'),
    oppStyle: form.oppStyle.value,
    oppMaterial: form.oppMaterial.value,
    sets,
    setsWon: won,
    setsLost: lost,
    result: won > lost ? 'V' : 'D',
    tightness: getSeg('tightness'),
    strengths: $$('.chips[data-name="strengths"] button.on').map(b => b.dataset.v),
    weaknesses: $$('.chips[data-name="weaknesses"] button.on').map(b => b.dataset.v),
    whyResult: form.whyResult.value.trim(),
    doDifferently: form.doDifferently.value.trim(),
    ratings,
    comment: form.comment.value.trim(),
    conditions: form.conditions.value.trim(),
    createdAt: old ? old.createdAt : Date.now(),
    updatedAt: Date.now(),
  };

  if (old) matches[matches.indexOf(old)] = m;
  else matches.push(m);
  saveMatches();

  if (m.myPoints) settings.myPoints = m.myPoints;
  settings.lastContext = m.context;
  saveSettings();

  toast(old ? 'Match modifié ✓' : (m.result === 'V' ? 'Victoire enregistrée 💪' : 'Défaite enregistrée – on analyse ça !'));
  editingId = null;
  showView('list');
});

$('#cancelBtn').addEventListener('click', () => { editingId = null; showView('list'); });
$('#deleteBtn').addEventListener('click', () => {
  if (!editingId || !confirm('Supprimer définitivement ce match ?')) return;
  matches = matches.filter(m => m.id !== editingId);
  saveMatches();
  editingId = null;
  toast('Match supprimé');
  showView('list');
});

/* ================== Liste ================== */
$('#search').addEventListener('input', renderList);

function renderList() {
  const all = sortedMatches();
  const w = all.filter(m => m.result === 'V').length;
  $('#summary').innerHTML = `
    <div class="kpi"><b>${all.length}</b><small>matchs</small></div>
    <div class="kpi"><b style="color:var(--win)">${w}</b><small>victoires</small></div>
    <div class="kpi"><b>${pct(w, all.length)}%</b><small>réussite</small></div>`;
  $('#headerInfo').textContent = settings.myPoints ? `${settings.myPoints} pts` : '';

  const q = $('#search').value.trim().toLowerCase();
  const list = q ? all.filter(m => [m.oppName, m.oppClub, m.context, m.competitionDetail, m.comment, m.whyResult]
    .join(' ').toLowerCase().includes(q)) : all;

  if (!all.length) {
    $('#matchList').innerHTML = `<div class="empty">Aucun match pour l'instant.<br><br>
      <button class="btn primary" onclick="openForm(null)">➕ Ajouter mon premier match</button></div>`;
    return;
  }
  $('#matchList').innerHTML = list.map(m => {
    const diff = (m.oppPoints && m.myPoints) ? m.oppPoints - m.myPoints : null;
    const setsTxt = (m.sets || []).map(s => `${s[0]}-${s[1]}`).join(' ');
    return `
      <div class="match" data-id="${m.id}">
        <div class="badge ${m.result}">${m.result}</div>
        <div class="info">
          <div class="name">${esc(m.oppName)}${m.oppPoints ? ` <span class="muted">(${m.oppPoints}${diff != null ? `, ${diff > 0 ? '+' : ''}${diff}` : ''})</span>` : ''}</div>
          <div class="meta">${fmtDate(m.date)} · ${esc(m.context)}${m.competitionDetail ? ' · ' + esc(m.competitionDetail) : ''}</div>
          ${setsTxt ? `<div class="meta">${setsTxt}</div>` : ''}
        </div>
        <div class="score">${m.setsWon}–${m.setsLost}</div>
      </div>`;
  }).join('') || '<div class="empty">Aucun résultat.</div>';
}

$('#matchList').addEventListener('click', (e) => {
  const el = e.target.closest('.match');
  if (el) openForm(el.dataset.id);
});

/* ================== Statistiques ================== */
function statRow(label, list) {
  const w = list.filter(m => m.result === 'V').length;
  return `<div class="stat-row"><span class="lbl">${esc(label)}</span>
    <div class="bar"><i style="width:${pct(w, list.length)}%"></i></div>
    <span class="val">${w}V-${list.length - w}D</span></div>`;
}

function groupBy(list, fn) {
  const g = new Map();
  list.forEach(m => {
    const k = fn(m);
    if (k == null || k === '') return;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(m);
  });
  return g;
}

function avg(list, f) {
  const v = list.map(f).filter(x => typeof x === 'number');
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–';
}

function renderStats() {
  const all = sortedMatches();
  if (!all.length) { $('#stats').innerHTML = '<div class="empty">Ajoute des matchs pour voir tes statistiques.</div>'; return; }
  const wins = all.filter(m => m.result === 'V'), losses = all.filter(m => m.result === 'D');
  let html = '';

  // Forme récente
  const last = all.slice(0, 15).reverse();
  html += `<div class="card"><h3>Forme récente</h3><div class="form-dots">${last.map(m =>
    `<span class="badge ${m.result}" style="flex:0 0 26px;height:26px;font-size:.75rem">${m.result}</span>`).join('')}</div>
    <p class="muted" style="margin-top:8px">10 derniers : ${all.slice(0, 10).filter(m => m.result === 'V').length}V / ${Math.min(10, all.length) - all.slice(0, 10).filter(m => m.result === 'V').length}D</p></div>`;

  // Par contexte
  html += `<div class="card"><h3>Par contexte</h3>${[...groupBy(all, m => m.context)].map(([k, l]) => statRow(k, l)).join('')}</div>`;

  // Par écart de classement
  const bands = [
    ['Bien moins classé (< -200)', d => d < -200],
    ['Moins classé (-200 à -50)', d => d >= -200 && d < -50],
    ['Proche (±50)', d => d >= -50 && d <= 50],
    ['Mieux classé (+50 à +200)', d => d > 50 && d <= 200],
    ['Bien mieux classé (> +200)', d => d > 200],
  ];
  const withDiff = all.filter(m => m.oppPoints && m.myPoints);
  if (withDiff.length) {
    html += `<div class="card"><h3>Selon l'écart de points</h3>${bands.map(([label, f]) => {
      const l = withDiff.filter(m => f(m.oppPoints - m.myPoints));
      return l.length ? statRow(label, l) : '';
    }).join('')}`;
    const contres = losses.filter(m => m.oppPoints && m.myPoints && m.oppPoints < m.myPoints);
    const perfs = wins.filter(m => m.oppPoints && m.myPoints && m.oppPoints > m.myPoints);
    html += `<p class="muted">Contre-perfs : <b>${contres.length}</b> · Perfs : <b>${perfs.length}</b></p></div>`;
  }

  // Profil adversaire
  const hand = groupBy(all, m => m.oppHand);
  const style = groupBy(all, m => m.oppStyle);
  const mat = groupBy(all, m => m.oppMaterial || 'Classique');
  html += `<div class="card"><h3>Selon l'adversaire</h3>
    ${[...hand].map(([k, l]) => statRow(k, l)).join('')}
    ${[...style].map(([k, l]) => statRow(k, l)).join('')}
    ${mat.size > 1 ? [...mat].map(([k, l]) => statRow(k, l)).join('') : ''}</div>`;

  // Belle / sets décisifs
  const decisive = all.filter(m => (m.sets || []).length && m.sets.length === (Math.max(m.setsWon, m.setsLost) * 2 - 1));
  const tight = all.flatMap(m => (m.sets || []).filter(s => Math.abs(s[0] - s[1]) === 2 && Math.max(...s) >= 11));
  if (decisive.length || tight.length) {
    const tw = tight.filter(s => s[0] > s[1]).length;
    html += `<div class="card"><h3>Moments serrés</h3>
      ${decisive.length ? statRow('Matchs à la belle', decisive) : ''}
      ${tight.length ? `<div class="stat-row"><span class="lbl">Sets à 2 pts d'écart</span><div class="bar"><i style="width:${pct(tw, tight.length)}%"></i></div><span class="val">${tw}G-${tight.length - tw}P</span></div>` : ''}
    </div>`;
  }

  // Ressenti
  html += `<div class="card"><h3>Ressenti moyen</h3><table>
    <tr><th></th><th>Victoires</th><th>Défaites</th></tr>
    ${RATINGS.map(([k, label]) => `<tr><td>${label}</td><td>${avg(wins, m => m.ratings && m.ratings[k])}</td><td>${avg(losses, m => m.ratings && m.ratings[k])}</td></tr>`).join('')}
  </table></div>`;

  // Tags
  const count = (list, key) => {
    const c = {};
    list.forEach(m => (m[key] || []).forEach(t => { c[t] = (c[t] || 0) + 1; }));
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6);
  };
  const tagHtml = (arr) => arr.length ? arr.map(([t, n]) => `<div class="stat-row"><span class="lbl">${esc(t)}</span><span class="val">${n} fois</span></div>`).join('') : '<p class="muted">Aucun tag saisi.</p>';
  html += `<div class="card"><h3>❌ Problèmes récurrents dans les défaites</h3>${tagHtml(count(losses, 'weaknesses'))}</div>`;
  html += `<div class="card"><h3>✅ Points forts dans les victoires</h3>${tagHtml(count(wins, 'strengths'))}</div>`;

  // Adversaires les plus rencontrés
  const opp = [...groupBy(all, m => m.oppName)].filter(([, l]) => l.length > 1).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  if (opp.length) html += `<div class="card"><h3>Adversaires rencontrés plusieurs fois</h3>${opp.map(([k, l]) => statRow(k, l)).join('')}</div>`;

  $('#stats').innerHTML = html;
}

/* ================== Export / Import / IA ================== */
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

$('#exportJsonBtn').addEventListener('click', async () => {
  const data = JSON.stringify({ app: 'carnet-ping', version: APP_VERSION, exportedAt: new Date().toISOString(), settings, matches }, null, 2);
  const filename = `carnet-ping-${today()}.json`;
  // Sur mobile, le partage permet d'envoyer directement vers Drive/iCloud/mail
  const file = new File([data], filename, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Sauvegarde Carnet Ping' }); markBackup(); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  download(filename, data, 'application/json');
  markBackup();
});

function markBackup() {
  settings.lastBackup = new Date().toISOString();
  saveSettings();
  renderDataInfo();
}

$('#exportCsvBtn').addEventListener('click', () => {
  const cols = ['date', 'context', 'competitionDetail', 'myPoints', 'oppName', 'oppPoints', 'oppClub', 'oppHand', 'oppStyle', 'oppMaterial',
    'result', 'setsWon', 'setsLost', 'sets', 'tightness', 'strengths', 'weaknesses', ...RATINGS.map(r => r[0]),
    'whyResult', 'doDifferently', 'comment', 'conditions'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = sortedMatches().map(m => cols.map(c => {
    if (c === 'sets') return cell((m.sets || []).map(s => s.join('-')).join(' '));
    if (c === 'strengths' || c === 'weaknesses') return cell((m[c] || []).join(', '));
    if (RATINGS.some(r => r[0] === c)) return cell(m.ratings && m.ratings[c]);
    return cell(m[c]);
  }).join(';'));
  download(`carnet-ping-${today()}.csv`, '﻿' + [cols.join(';'), ...rows].join('\n'), 'text/csv;charset=utf-8');
});

$('#importInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const incoming = Array.isArray(data) ? data : data.matches;
    if (!Array.isArray(incoming)) throw new Error('format');
    const ids = new Set(matches.map(m => m.id));
    const fresh = incoming.filter(m => m && m.id && !ids.has(m.id));
    if (!confirm(`${incoming.length} matchs dans le fichier, dont ${fresh.length} nouveaux. Importer les nouveaux ?`)) return;
    matches.push(...fresh);
    saveMatches();
    if (data.settings && data.settings.myPoints && !settings.myPoints) { settings.myPoints = data.settings.myPoints; saveSettings(); }
    toast(`${fresh.length} matchs importés ✓`);
    renderDataInfo();
  } catch {
    toast('Fichier invalide');
  } finally {
    e.target.value = '';
  }
});

function buildAiText() {
  const q = $('#aiQuestion').value.trim();
  const compact = sortedMatches().reverse().map(m => {
    const o = {
      date: m.date, contexte: m.context, detail: m.competitionDetail || undefined,
      mesPoints: m.myPoints ?? undefined, adversaire: m.oppName, ptsAdv: m.oppPoints ?? undefined,
      main: m.oppHand || undefined, style: m.oppStyle || undefined, materiel: m.oppMaterial || undefined,
      resultat: m.result === 'V' ? 'Victoire' : 'Défaite', score: `${m.setsWon}-${m.setsLost}`,
      sets: (m.sets || []).length ? m.sets.map(s => s.join('-')).join(' ') : undefined,
      type: m.tightness || undefined,
      ok: (m.strengths || []).length ? m.strengths : undefined,
      ko: (m.weaknesses || []).length ? m.weaknesses : undefined,
      ressenti: Object.keys(m.ratings || {}).length ? m.ratings : undefined,
      pourquoi: m.whyResult || undefined, aFaireDifferemment: m.doDifferently || undefined,
      commentaire: m.comment || undefined, conditions: m.conditions || undefined,
    };
    return JSON.stringify(o);
  });
  return `Tu es un entraîneur de tennis de table expérimenté. Voici l'historique de mes matchs (un objet JSON par ligne, du plus ancien au plus récent).
Légende : "ok" = ce qui a marché, "ko" = ce qui n'a pas marché, "ressenti" = notes de 1 à 5, points = classement FFTT au moment du match.

Analyse ces données et donne-moi :
1. Mes tendances (résultats selon le contexte, l'écart de classement, le profil d'adversaire, gaucher/droitier, matériel).
2. Mes points forts et mes faiblesses récurrentes, en t'appuyant sur les tags et les commentaires.
3. Les liens entre mon ressenti (concentration, confiance, physique…) et mes résultats.
4. Mon évolution dans le temps.
5. 3 à 5 axes de travail concrets et prioritaires pour l'entraînement, et des conseils tactiques selon les types d'adversaires.
Sois concret, cite des matchs en exemple et signale quand l'échantillon est trop petit pour conclure.
${q ? `\nQuestion particulière : ${q}\n` : ''}
DONNÉES (${compact.length} matchs) :
${compact.join('\n')}`;
}

$('#aiCopyBtn').addEventListener('click', async () => {
  if (!matches.length) { toast('Aucun match à analyser'); return; }
  const text = buildAiText();
  try {
    await navigator.clipboard.writeText(text);
    toast('Copié ! Colle-le dans Claude 🤖');
  } catch {
    download(`carnet-ping-ia-${today()}.txt`, text, 'text/plain');
  }
});

$('#aiShareBtn').addEventListener('click', async () => {
  if (!matches.length) { toast('Aucun match à analyser'); return; }
  const text = buildAiText();
  if (navigator.share) {
    try { await navigator.share({ title: 'Mes matchs de ping', text }); } catch { /* annulé */ }
  } else {
    download(`carnet-ping-ia-${today()}.txt`, text, 'text/plain');
  }
});

function renderDataInfo() {
  const lb = settings.lastBackup ? new Date(settings.lastBackup).toLocaleDateString('fr-FR') : 'jamais';
  $('#dataInfo').textContent = `${matches.length} matchs enregistrés · Dernière sauvegarde : ${lb}`;
  $('#aboutInfo').textContent = `Carnet Ping v${APP_VERSION} – fonctionne hors ligne.`;
}

/* ================== Démarrage ================== */
window.openForm = openForm;
showView('list');

// Rappel de sauvegarde si plus de 10 matchs ajoutés depuis la dernière
if (matches.length >= 5) {
  const since = matches.filter(m => !settings.lastBackup || m.updatedAt > Date.parse(settings.lastBackup)).length;
  if (since >= 10) setTimeout(() => toast(`💾 ${since} matchs non sauvegardés – pense à exporter (onglet IA & données)`), 800);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
