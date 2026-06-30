/**
 * Drop System — Nebula Bot by Dark Neon
 * Gérer les items/coins jetés au sol (1 minute pour ramasser)
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH   = path.join(__dirname, '../database');
const DROP_FILE = path.join(DB_PATH, 'drops.json');

if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
if (!fs.existsSync(DROP_FILE)) fs.writeFileSync(DROP_FILE, '[]');

// ── I/O ───────────────────────────────────────────────────────────────────────

function readDrops()      { try { return JSON.parse(fs.readFileSync(DROP_FILE, 'utf8')); } catch { return []; } }
function writeDrops(data) { fs.writeFileSync(DROP_FILE, JSON.stringify(data, null, 2)); }

// ── Créer un drop ─────────────────────────────────────────────────────────────

const DROP_TTL = 60 * 1000; // 1 minute

function createDrop(groupId, ownerId, type, data) {
  const drops = readDrops().filter(d => Date.now() < d.expiresAt); // purge expirés
  const drop  = {
    id:        `drop_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    groupId,
    ownerId,
    type,      // 'coins' | 'item'
    data,      // { amount } ou { itemId, itemName }
    droppedAt: Date.now(),
    expiresAt: Date.now() + DROP_TTL,
    pickedBy:  null,
  };
  drops.push(drop);
  writeDrops(drops);
  return drop;
}

// ── Ramasser un drop ──────────────────────────────────────────────────────────

function pickupDrop(dropId, pickerId) {
  const drops = readDrops();
  const now   = Date.now();
  const idx   = drops.findIndex(d => d.id === dropId);

  if (idx === -1)                    return { ok: false, reason: 'not_found' };
  if (now > drops[idx].expiresAt)    return { ok: false, reason: 'expired' };
  if (drops[idx].pickedBy)           return { ok: false, reason: 'already_taken' };

  drops[idx].pickedBy  = pickerId;
  drops[idx].pickedAt  = now;
  writeDrops(drops);
  return { ok: true, drop: drops[idx] };
}

// ── Lister les drops actifs dans un groupe ────────────────────────────────────

function getActiveDrops(groupId) {
  const now = Date.now();
  return readDrops().filter(d =>
    d.groupId === groupId &&
    now < d.expiresAt &&
    !d.pickedBy
  );
}

// ── Nettoyer les drops expirés ────────────────────────────────────────────────

function cleanExpiredDrops() {
  const now   = Date.now();
  const drops = readDrops().filter(d => now < d.expiresAt || d.pickedBy);
  writeDrops(drops);
  return drops;
}

module.exports = { createDrop, pickupDrop, getActiveDrops, cleanExpiredDrops, DROP_TTL };
