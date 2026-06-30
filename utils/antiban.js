/**
 * Anti-Ban Protection System — Nebula Bot by Dark Neon
 * Version 2.0 — Protection avancée multi-couches
 *
 * Protections incluses :
 *  1. Délais humains gaussiens (plus réalistes qu'un délai uniforme)
 *  2. Rate limiter avec backoff progressif (strikes)
 *  3. Cooldowns par commande
 *  4. Throttle global des messages sortants (max 25/min)
 *  5. Queue intelligente pour actions en masse
 *  6. Gestion de présence humaine
 *  7. Broadcast sécurisé avec pauses par batch
 *  8. Circuit Breaker (stoppe tout si trop d'erreurs consécutives)
 *  9. Night Mode (ralentit le bot entre 00h-07h)
 */

// ─── 1. DÉLAIS HUMAINS ────────────────────────────────────────────────────────

const randomDelay = (min = 500, max = 1500) =>
  new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));

/**
 * Délai gaussien — plus réaliste. Centré sur `mean`, variance `stdDev`.
 */
function gaussianDelay(mean = 1000, stdDev = 300) {
  const u1 = Math.random(), u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const ms = Math.max(200, Math.round(mean + z * stdDev));
  return new Promise(r => setTimeout(r, ms));
}

const shortDelay  = () => gaussianDelay(600,  150);
const mediumDelay = () => gaussianDelay(1200, 300);
const longDelay   = () => gaussianDelay(2200, 500);
const heavyDelay  = () => gaussianDelay(4000, 800); // pour actions en masse

// ─── 2. NIGHT MODE ────────────────────────────────────────────────────────────

function getNightModeFactor() {
  const h = new Date().getHours();
  if (h >= 0  && h < 7)  return 2.5; // nuit profonde
  if (h >= 23 || h < 9)  return 1.5; // tard/tôt
  return 1.0;                         // journée normale
}

const adaptiveDelay = (min, max) => {
  const f = getNightModeFactor();
  return randomDelay(min * f, max * f);
};

// ─── 3. THROTTLE GLOBAL MESSAGES SORTANTS ─────────────────────────────────────

const outbound = {
  count: 0,
  windowStart: Date.now(),
  WINDOW_MS: 60 * 1000,
  MAX_PER_MIN: 25,
  pausedUntil: null
};

async function throttleOutbound() {
  const now = Date.now();
  if (now - outbound.windowStart > outbound.WINDOW_MS) {
    outbound.count = 0;
    outbound.windowStart = now;
  }
  if (outbound.pausedUntil && now < outbound.pausedUntil) {
    const wait = outbound.pausedUntil - now;
    console.warn(`[Anti-Ban] Throttle pause ${Math.round(wait/1000)}s...`);
    await new Promise(r => setTimeout(r, wait));
    outbound.count = 0; outbound.windowStart = Date.now(); outbound.pausedUntil = null;
    return;
  }
  outbound.count++;
  if (outbound.count >= outbound.MAX_PER_MIN * 0.8) {
    const over = outbound.count - (outbound.MAX_PER_MIN * 0.8);
    await new Promise(r => setTimeout(r, Math.min(over * 1500, 15000)));
  }
  if (outbound.count >= outbound.MAX_PER_MIN) {
    const pause = 2 * 60 * 1000;
    outbound.pausedUntil = Date.now() + pause;
    console.warn('[Anti-Ban] Limite outbound ! Pause 2 minutes.');
    await new Promise(r => setTimeout(r, pause));
    outbound.count = 0; outbound.windowStart = Date.now(); outbound.pausedUntil = null;
  }
}

// ─── 4. RATE LIMITER GLOBAL (avec backoff progressif) ────────────────────────

const rateLimitMap = new Map();
const RATE = { MAX: 8, WINDOW: 10000, BASE_COOLDOWN: 30000, MAX_COOLDOWN: 300000 };

function isRateLimited(userId) {
  const now = Date.now();
  let e = rateLimitMap.get(userId) || { count: 0, firstTs: now, blockedUntil: null, strikes: 0 };

  if (e.blockedUntil) {
    if (now < e.blockedUntil) return true;
    e.blockedUntil = null; e.count = 0; e.firstTs = now;
  }
  if (now - e.firstTs > RATE.WINDOW) { e.count = 1; e.firstTs = now; rateLimitMap.set(userId, e); return false; }

  e.count++;
  if (e.count > RATE.MAX) {
    e.strikes++;
    // Backoff : 30s → 60s → 120s → ... max 5min
    const cd = Math.min(RATE.BASE_COOLDOWN * Math.pow(2, e.strikes - 1), RATE.MAX_COOLDOWN);
    e.blockedUntil = now + cd;
    console.warn(`[Anti-Ban] Strike ${e.strikes} pour ${userId} — bloqué ${Math.round(cd/1000)}s`);
    rateLimitMap.set(userId, e); return true;
  }
  rateLimitMap.set(userId, e); return false;
}

function getRateLimitRemaining(userId) {
  const e = rateLimitMap.get(userId);
  if (!e?.blockedUntil) return 0;
  return Math.max(0, Math.ceil((e.blockedUntil - Date.now()) / 1000));
}

setInterval(() => {
  const now = Date.now();
  for (const [id, e] of rateLimitMap.entries()) {
    if (now - e.firstTs > RATE.WINDOW * 3 && (!e.blockedUntil || now > e.blockedUntil))
      rateLimitMap.delete(id);
  }
}, 5 * 60 * 1000);

// ─── 5. COOLDOWNS PAR COMMANDE ────────────────────────────────────────────────

const cooldownMap = new Map();

function isOnCooldown(userId, cmd, secs = 5) {
  const key = `${userId}_${cmd}`;
  const last = cooldownMap.get(key) || 0;
  if (Date.now() - last < secs * 1000) return true;
  cooldownMap.set(key, Date.now()); return false;
}

function getCooldownRemaining(userId, cmd, secs = 5) {
  const key = `${userId}_${cmd}`;
  return Math.max(0, Math.ceil(secs - (Date.now() - (cooldownMap.get(key) || 0)) / 1000));
}

// ─── 6. CIRCUIT BREAKER ───────────────────────────────────────────────────────

const cb = { errors: 0, lastError: null, openUntil: null, THRESHOLD: 5, RESET: 60000, PAUSE: 30000 };

function recordError() {
  const now = Date.now();
  if (cb.lastError && now - cb.lastError > cb.RESET) cb.errors = 0;
  cb.errors++; cb.lastError = now;
  if (cb.errors >= cb.THRESHOLD) {
    const pause = Math.min(cb.PAUSE * Math.ceil(cb.errors / cb.THRESHOLD), 5 * 60 * 1000);
    cb.openUntil = now + pause;
    console.warn(`[Anti-Ban] Circuit Breaker ! Pause ${Math.round(pause/1000)}s (${cb.errors} erreurs)`);
  }
}

async function checkCircuitBreaker() {
  const now = Date.now();
  if (cb.openUntil && now < cb.openUntil) {
    await new Promise(r => setTimeout(r, cb.openUntil - now));
    cb.errors = 0; cb.openUntil = null;
  }
}

// ─── 7. QUEUE POUR ACTIONS EN MASSE ───────────────────────────────────────────

async function executeQueue(tasks, { minDelay = 1000, maxDelay = 3000, batchSize = 10, batchPause = 8000 } = {}) {
  const results = { success: 0, failed: 0, errors: [] };
  for (let i = 0; i < tasks.length; i++) {
    if (i > 0 && i % batchSize === 0) {
      console.log(`[Queue] Batch pause après ${i} tâches...`);
      await randomDelay(batchPause, batchPause * 1.5);
    }
    try {
      await checkCircuitBreaker();
      await throttleOutbound();
      await tasks[i]();
      results.success++;
    } catch (err) {
      results.failed++; results.errors.push(err.message);
      recordError(err.message);
      await randomDelay(minDelay * 2, maxDelay * 2);
      continue;
    }
    await randomDelay(minDelay * getNightModeFactor(), maxDelay * getNightModeFactor());
  }
  return results;
}

// ─── 8. PRÉSENCE ─────────────────────────────────────────────────────────────

async function simulateTyping(sock, jid, goOfflineAfter = true) {
  try {
    await sock.sendPresenceUpdate('composing', jid);
    await gaussianDelay(1200, 400);
    if (goOfflineAfter) await sock.sendPresenceUpdate('unavailable', jid);
  } catch {}
}

async function goOffline(sock) {
  try { await sock.sendPresenceUpdate('unavailable'); } catch {}
}

// ─── 9. BROADCAST SÉCURISÉ ───────────────────────────────────────────────────

async function safeBroadcast(sock, jids, content, minDelay = 4000, maxDelay = 9000) {
  const tasks = jids.map(jid => async () => { await sock.sendMessage(jid, content); });
  console.log(`[SafeBroadcast] Envoi vers ${jids.length} destinations...`);
  const r = await executeQueue(tasks, { minDelay, maxDelay, batchSize: 8, batchPause: 15000 });
  console.log(`[SafeBroadcast] ${r.success} succès, ${r.failed} échecs`);
  return r;
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

module.exports = {
  randomDelay, gaussianDelay,
  shortDelay, mediumDelay, longDelay, heavyDelay, adaptiveDelay,
  getNightModeFactor,
  throttleOutbound,
  isRateLimited, getRateLimitRemaining,
  isOnCooldown, getCooldownRemaining,
  recordError, checkCircuitBreaker,
  executeQueue,
  simulateTyping, goOffline,
  safeBroadcast
};
