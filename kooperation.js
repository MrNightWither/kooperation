'use strict';

const WORKER = 'https://nwu-anmeldung.nwu-brand.workers.dev';
// Daten kommen aus dem Admin Panel Projekt (nur lesen)
const FIRESTORE = 'https://firestore.googleapis.com/v1/projects/adminpannel-f0aab/databases/(default)/documents/';
const PARTNERS_URL = FIRESTORE + 'partners?pageSize=100';
const STATS_URL = FIRESTORE + 'stats/social';

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
  try {
    const res = await fetch(PARTNERS_URL, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) return;
    const json = await res.json();
    const partners = (json.documents || []).map((d) => readFields(d.fields)).filter((p) => p.name);
    // Ohne Partner bleibt der Bereich ausgeblendet, statt eine leere Box zu zeigen
    if (!partners.length) return;
    $('partnerBlock').replaceChildren(...partners.map(renderPartner));
    $('partnerSection').hidden = false;
  } catch (e) {
    // Bereich bleibt ausgeblendet
  }
}
loadPartners();

// ---------- Reichweite ----------
const STAT_LABELS = [['tiktok', 'TikTok'], ['twitch', 'Twitch'], ['youtube', 'YouTube'], ['instagram', 'Instagram']];

async function loadStats() {
  try {
    const res = await fetch(STATS_URL, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) return;
    const d = readFields((await res.json()).fields);
    const cards = STAT_LABELS.filter(([key]) => d[key]).map(([key, label]) => {
      const card = el('div', 'stat');
      card.append(el('div', 'stat-num', d[key]), el('div', 'stat-label', label));
      return card;
    });
    const infinity = el('div', 'stat');
    infinity.append(el('div', 'stat-num', '∞'), el('div', 'stat-label', 'Schatten'));
    const block = $('statsBlock');
    block.replaceChildren(...cards, infinity);
    const count = Math.min(cards.length + 1, 5);
    block.dataset.count = String(count);
    block.style.setProperty('--count', String(count));
  } catch (e) {
    // Dann bleibt nur die Schatten Karte stehen
  }
}
loadStats();

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

// ---------- Partikel (wie auf der Eventseite) ----------
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let viewW = window.innerWidth;
let viewH = window.innerHeight;
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const particles = [];
function resetParticle(p) {
  p.x = Math.random() * viewW;
  p.y = Math.random() * viewH;
  p.r = p.r || Math.random() * 1.5 + 0.3;
  p.dx = (Math.random() - 0.5) * 0.08;
  p.dy = (Math.random() - 0.5) * 0.08;
  p.life = Math.random();
  p.alpha = Math.random() * 0.8 + 0.2;
  return p;
}
for (let i = 0; i < 120; i++) particles.push(resetParticle({}));

function drawParticles() {
  ctx.clearRect(0, 0, viewW, viewH);
  particles.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(201, 168, 76, ${p.alpha})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(240, 208, 128, ${p.alpha * 0.5})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    p.x += p.dx;
    p.y += p.dy;
    p.life -= 0.004;
    p.alpha = p.life * 0.8;
    if (p.life <= 0) { resetParticle(p); p.life = 1; }
    if (p.x < -p.r) p.x = viewW + p.r;
    if (p.x > viewW + p.r) p.x = -p.r;
    if (p.y < -p.r) p.y = viewH + p.r;
    if (p.y > viewH + p.r) p.y = -p.r;
  });
  if (!reduceMotion) requestAnimationFrame(drawParticles);
}
drawParticles();
