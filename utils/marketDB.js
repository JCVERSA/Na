/**
 * Market System — Nebula Bot by Dark Neon
 * Joueurs peuvent vendre leurs items à d'autres joueurs
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH     = path.join(__dirname, '../database');
const MARKET_FILE = path.join(DB_PATH, 'market.json');

if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
if (!fs.existsSync(MARKET_FILE)) fs.writeFileSync(MARKET_FILE, JSON.stringify({ profiles: {}, listings: [] }));

function readDB() {
  try { return JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8')); }
  catch { return { profiles: {}, listings: [] }; }
}
function writeDB(data) { fs.writeFileSync(MARKET_FILE, JSON.stringify(data, null, 2)); }

// ── Profil marché par défaut ───────────────────────────────────────────────────
const DEFAULT_MARKET = () => ({
  open:       false,
  level:      1,
  sales:      0,       // ventes depuis dernier palier (0→3)
  totalSales: 0,       // total ventes toutes durées confondues
  openedAt:   null,
});

// ── Rangs selon niveau ────────────────────────────────────────────────────────
function getMarketRank(level) {
  if (level >= 30) return { emoji: '👑', name: 'Magnat' };
  if (level >= 20) return { emoji: '💎', name: 'Négociant' };
  if (level >= 10) return { emoji: '🏆', name: 'Commerçant' };
  if (level >= 5)  return { emoji: '⭐', name: 'Marchand' };
  if (level >= 2)  return { emoji: '🔥', name: 'Vendeur' };
  return { emoji: '🌱', name: 'Petit Vendeur' };
}

// ── CRUD profil ───────────────────────────────────────────────────────────────
function getMarketProfile(userId) {
  const db = readDB();
  if (!db.profiles[userId]) db.profiles[userId] = DEFAULT_MARKET();
  const def = DEFAULT_MARKET();
  for (const k of Object.keys(def)) {
    if (db.profiles[userId][k] === undefined) db.profiles[userId][k] = def[k];
  }
  return db.profiles[userId];
}

function updateMarketProfile(userId, patch) {
  const db = readDB();
  if (!db.profiles[userId]) db.profiles[userId] = DEFAULT_MARKET();
  db.profiles[userId] = { ...db.profiles[userId], ...patch };
  writeDB(db);
  return db.profiles[userId];
}

function openMarket(userId) {
  return updateMarketProfile(userId, { open: true, openedAt: Date.now() });
}

function hasMarket(userId) {
  return getMarketProfile(userId).open;
}

// ── Listings ──────────────────────────────────────────────────────────────────
function addListing(sellerId, itemId, itemName, price) {
  const db = readDB();
  const id = `mkt_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
  db.listings.push({ id, sellerId, itemId, itemName, price, listedAt: Date.now() });
  writeDB(db);
  return id;
}

function getSellerListings(sellerId) {
  const db = readDB();
  return (db.listings || []).filter(l => l.sellerId === sellerId);
}

function getAllListings() {
  return readDB().listings || [];
}

function getListing(listingId) {
  const db = readDB();
  return (db.listings || []).find(l => l.id === listingId) || null;
}

function removeListing(listingId) {
  const db = readDB();
  const idx = (db.listings || []).findIndex(l => l.id === listingId);
  if (idx === -1) return false;
  db.listings.splice(idx, 1);
  writeDB(db);
  return true;
}

// ── Enregistrer une vente → +2000 coins si multiple de 3, level up ────────────
// Retourne { bonus: bool, newLevel, rank }
function recordSale(userId) {
  const p    = getMarketProfile(userId);
  const sales = (p.sales || 0) + 1;
  const total = (p.totalSales || 0) + 1;
  let level  = p.level || 1;
  let bonus  = false;

  if (sales % 3 === 0) {
    level++;
    bonus = true;
  }

  updateMarketProfile(userId, { sales, totalSales: total, level });
  return { bonus, newLevel: level, rank: getMarketRank(level) };
}

module.exports = {
  getMarketProfile,
  updateMarketProfile,
  openMarket,
  hasMarket,
  getMarketRank,
  addListing,
  getSellerListings,
  getAllListings,
  getListing,
  removeListing,
  recordSale,
};
