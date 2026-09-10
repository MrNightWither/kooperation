'use strict';

const WORKER = 'https://nwu-anmeldung.nwu-brand.workers.dev';
// Eigenes Firebase Projekt der Partnerliste (nur lesen)
const PARTNERS_URL = 'https://firestore.googleapis.com/v1/projects/gen-lang-client-0269598757/databases/ai-studio-e11fd13d-64b0-437c-8906-e6481c206003/documents/partners?pageSize=100';

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

// Nur echte https Adressen zulassen, keine javascript: oder sonstigen Tricks
function safeUrl(value) {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'https:' ? u.href : null;
  } catch (e) {
    return null;
  }
}

function readFields(fields) {
  const out = {};
  for (const [key, val] of Object.entries(fields || {})) {
    if ('stringValue' in val) out[key] = val.stringValue;
  }
  return out;
}

// ---------- Partner ----------
function renderPartner(p) {
  const card = el('div', 'partner-card');

  const icon = el('div', 'partner-icon');
  const logo = safeUrl(p.logo);
  if (logo) {
    const img = document.createElement('img');
    img.src = logo;
    img.alt = p.name || 'Partner';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    icon.append(img);
  } else {
    icon.textContent = '🤝';
  }

  const text = el('div');
  text.append(el('div', 'partner-name', p.name || 'Partner'), el('div', 'partner-cat', p.category || ''));
  card.append(icon, text);

  const link = safeUrl(p.url);
  if (link) {
    const a = el('a', 'partner-link', '→ Link');
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    card.append(a);
  }
  return card;
}

async function loadPartners() {
  const block = $('partnerBlock');
  try {
    const res = await fetch(PARTNERS_URL, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error('Status ' + res.status);
    const json = await res.json();
    const partners = (json.documents || []).map((d) => readFields(d.fields));
    block.replaceChildren(...(partners.length ? partners.map(renderPartner) : [el('div', 'empty-box', 'Noch keine Partner eingetragen')]));
  } catch (e) {
    block.replaceChildren(el('div', 'empty-box', 'Fehler beim Laden'));
  }
}
loadPartners();

// ---------- Anfrage ----------
function showError(text) {
  $('bizSuccess').style.display = 'none';
  $('bizError').textContent = text;
  $('bizError').style.display = 'block';
}

$('bizSendBtn').addEventListener('click', async () => {
  const name = $('bizName').value.trim();
  const email = $('bizEmail').value.trim();
  const msg = $('bizMsg').value.trim();
  $('bizError').style.display = 'none';
  $('bizSuccess').style.display = 'none';

  if (name.length < 2 || !email || msg.length < 10) { showError('Bitte alle Felder ausfüllen.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showError('Bitte eine gültige E Mail Adresse eingeben.'); return; }
  if (!$('bizConsent').checked) { showError('Bitte der Datenübermittlung zustimmen.'); return; }

  const btn = $('bizSendBtn');
  btn.textContent = 'Wird gesendet...';
  btn.disabled = true;
  try {
    const res = await fetch(WORKER + '/kooperation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({
        name: name.slice(0, 80),
        email: email.slice(0, 120),
        message: msg.slice(0, 2000),
        consent: true,
        website: $('bizWebsite').value
      })
    });
    if (!res.ok) throw new Error('Status ' + res.status);
    $('bizSuccess').style.display = 'block';
    $('bizName').value = '';
    $('bizEmail').value = '';
    $('bizMsg').value = '';
    $('bizConsent').checked = false;
  } catch (e) {
    showError('Fehler beim Senden. Bitte später erneut versuchen.');
  } finally {
    btn.textContent = 'Anfrage senden';
    btn.disabled = false;
  }
});
