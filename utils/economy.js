/**
 * Economy System — Nebula Bot by Dark Neon
 * v2.0 — Streak, Banque, Titres, Inventaire, Cooldowns étendus
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH  = path.join(__dirname, '../database');
const ECO_FILE = path.join(DB_PATH, 'economy.json');

if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
if (!fs.existsSync(ECO_FILE)) fs.writeFileSync(ECO_FILE, '{}');

// ── Write-through in-memory cache (eliminates blocking disk I/O on every command) ──
let _ecoCache = null;
let _ecoDirty = false;

function readEco() {
  if (!_ecoCache) {
    try { _ecoCache = JSON.parse(fs.readFileSync(ECO_FILE, 'utf8')); }
    catch { _ecoCache = {}; }
  }
  return _ecoCache;
}

function writeEco(data) {
  _ecoCache = data;
  _ecoDirty = true;
}

// Flush dirty cache to disk every 10 seconds instead of on every write
setInterval(() => {
  if (_ecoDirty && _ecoCache) {
    try {
      fs.writeFileSync(ECO_FILE, JSON.stringify(_ecoCache, null, 2));
      _ecoDirty = false;
    } catch(e) { console.error('[Economy] Flush error:', e.message); }
  }
}, 10000);

// Flush on process exit so no data is lost on clean shutdown
process.on('exit', () => {
  if (_ecoDirty && _ecoCache) {
    try { fs.writeFileSync(ECO_FILE, JSON.stringify(_ecoCache, null, 2)); } catch(e) {}
  }
});

const DEFAULT_PROFILE = () => ({
  coins: 0, bank: 0, xp: 0, level: 1, streak: 0,
  lastDaily: null, lastWork: null, lastCrime: null, lastRob: null, lastSlots: null,
  lastFish: null, lastMine: null, lastHunt: null, lastCollect: null,
  lastBeg: null, lastScratch: null, lastInvest: null, lastWheel: null,
  lastDice: null, lastBlackjack: null,
  loan: 0, loanDue: null,
  invest: 0, investAt: null,
  passiveBase: 10,
  inventory: [], totalEarned: 0, createdAt: Date.now()
});

function getUser(userId) {
  const data = readEco();
  if (!data[userId]) data[userId] = DEFAULT_PROFILE();
  const def = DEFAULT_PROFILE();
  let changed = false;
  for (const key of Object.keys(def)) {
    if (data[userId][key] === undefined) { data[userId][key] = def[key]; changed = true; }
  }
  if (changed) writeEco(data);
  return data[userId];
}

function updateUser(userId, patch) {
  const data = readEco();
  if (!data[userId]) data[userId] = DEFAULT_PROFILE();
  data[userId] = { ...data[userId], ...patch };
  writeEco(data);
  return data[userId];
}

function addCoins(userId, amount) {
  if (isNaN(amount) || amount < 0) return null;
  const u = getUser(userId);
  u.coins += amount;
  if (amount > 0) u.totalEarned = (u.totalEarned || 0) + amount;
  return updateUser(userId, { coins: u.coins, totalEarned: u.totalEarned });
}

function removeCoins(userId, amount) {
  const u = getUser(userId);
  if (u.coins < amount) return null;
  u.coins -= amount;
  return updateUser(userId, { coins: u.coins });
}

function deposit(userId, amount) {
  const u = getUser(userId);
  if (u.coins < amount) return null;
  return updateUser(userId, { coins: u.coins - amount, bank: (u.bank || 0) + amount });
}

function withdraw(userId, amount) {
  const u = getUser(userId);
  if ((u.bank || 0) < amount) return null;
  return updateUser(userId, { bank: u.bank - amount, coins: u.coins + amount });
}

function addXP(userId, xpAmount) {
  const u = getUser(userId);
  u.xp = (u.xp || 0) + xpAmount;
  const xpReq = (lvl) => lvl * 100;
  let leveledUp = false;
  while (u.xp >= xpReq(u.level)) {
    u.xp -= xpReq(u.level);
    u.level++;
    leveledUp = true;
  }
  updateUser(userId, { xp: u.xp, level: u.level });
  return { leveledUp, newLevel: u.level };
}

function getTitle(level) {
  if (level >= 50) return '👑 Légende';
  if (level >= 30) return '💎 Diamant';
  if (level >= 20) return '🏆 Champion';
  if (level >= 15) return '🥇 Expert';
  if (level >= 10) return '⚡ Avancé';
  if (level >= 5)  return '🌟 Confirmé';
  if (level >= 3)  return '🔥 Apprenti';
  return '🌱 Débutant';
}

function updateStreak(userId) {
  const u   = getUser(userId);
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const TWO_DAYS = 2 * ONE_DAY;
  let streak = u.streak || 0;
  if (!u.lastDaily) {
    streak = 1;
  } else {
    const elapsed = now - u.lastDaily;
    if (elapsed >= ONE_DAY && elapsed < TWO_DAYS) streak += 1;
    else if (elapsed >= TWO_DAYS) streak = 1;
  }
  updateUser(userId, { streak, lastDaily: now });
  return streak;
}

function getStreakBonus(streak) {
  if (streak >= 30) return 500;
  if (streak >= 14) return 300;
  if (streak >= 7)  return 150;
  if (streak >= 3)  return 75;
  if (streak >= 2)  return 30;
  return 0;
}

// ── Durées des armures (armorDuration) ───────────────────────────────────────
// null = PERMANENT | nombre (ms) = temporaire
const ARMOR_DURATIONS = {
  leather:   null,              // ♾️  PERMANENT
  helmet:    null,              // ♾️  PERMANENT
  shield2:   7  * 86400000,    // ⏳ 7 jours
  armor:     14 * 86400000,    // ⏳ 14 jours
  titanium:  30 * 86400000,    // ⏳ 30 jours
  godshield: null,              // ♾️  PERMANENT (légendaire)
};

// ── Durées des armes (weaponDuration) ────────────────────────────────────────
// null = PERMANENT jusqu'à épuisement des charges | nombre (ms) = expiration auto
const WEAPON_DURATIONS = {
  dagger:   null,              // ♾️  PERMANENT (10 charges)
  sword:    null,              // ♾️  PERMANENT (8 charges)
  axe:      null,              // ♾️  PERMANENT (6 charges)
  katana:   null,              // ♾️  PERMANENT (5 charges)
  pistol:   null,              // ♾️  PERMANENT (8 charges)
  ak47:     7 * 86400000,     // ⏳ 7 jours (6 charges ou expire)
  sniper:   null,              // charges seulement (3 tirs)
  grenade:  null,              // charges seulement (4 tirs)
  bazooka:  null,              // charges seulement (2 tirs)
  rasengan: null,              // charges seulement (3 utilisations)
  atomic:   null,              // charge unique (1 tir)
};

const SHOP_ITEMS = {
  // ── Économie ──────────────────────────────────────────────────────────────
  pickaxe:   { name: '⛏️ Pioche',           price: 300,   desc: 'Double les gains de .work .fish .mine (5 utilisations)', uses: 5, category: 'eco' },
  lucky:     { name: '🍀 Trèfle chanceux',  price: 800,   desc: '⏳ 1h — Augmente les gains des slots',       duration: 3600000,   category: 'eco' },
  boost:     { name: '⚡ Boost XP',         price: 400,   desc: '⏳ 1h — Double XP gagné',                    duration: 3600000,   category: 'eco' },
  robbery:   { name: '🎭 Masque de voleur', price: 600,   desc: '+20% chances de .rob (3 utilisations)',      uses: 3,             category: 'eco' },

  // ── Protection économie ──────────────────────────────────────────────────
  shield:    { name: '🛡️ Bouclier Eco',     price: 500,   desc: '⏳ 24h — Protège d\'un .rob',               duration: 86400000,  category: 'defense' },
  vault:     { name: '🏦 Coffre-fort',      price: 2000,  desc: '♾️ PERMANENT — Réduit le vol max à 5% au lieu de 35%', permanent: true, category: 'defense' },

  // ── Armes (combat .kill) ──────────────────────────────────────────────────
  dagger:    { name: '🗡️ Dague',            price: 400,   desc: '♾️ 10 charges — +15 ATK',                   uses: 10, category: 'weapon', weaponId: 'dagger' },
  sword:     { name: '⚔️ Épée',             price: 800,   desc: '♾️ 8 charges — +25 ATK',                    uses: 8,  category: 'weapon', weaponId: 'sword' },
  axe:       { name: '🪓 Hache',            price: 900,   desc: '♾️ 6 charges — +30 ATK',                    uses: 6,  category: 'weapon', weaponId: 'axe' },
  katana:    { name: '🗡️ Katana',           price: 1500,  desc: '♾️ 5 charges — +45 ATK (arme de ninja)',     uses: 5,  category: 'weapon', weaponId: 'katana' },
  pistol:    { name: '🔫 Pistol',           price: 1000,  desc: '♾️ 8 charges — +35 ATK',                    uses: 8,  category: 'weapon', weaponId: 'pistol' },
  ak47:      { name: '🔫 AK-47',            price: 2500,  desc: '⏳ 7j / 6 charges — +50 ATK',               uses: 6,  duration: 604800000, category: 'weapon', weaponId: 'ak47' },
  sniper:    { name: '🎯 Sniper',           price: 4000,  desc: '3 charges — +75 ATK (tir précision)',        uses: 3,  category: 'weapon', weaponId: 'sniper' },
  grenade:   { name: '💣 Grenade',          price: 1800,  desc: '4 charges — +55 ATK (explosion)',            uses: 4,  category: 'weapon', weaponId: 'grenade' },
  bazooka:   { name: '🚀 Bazooka',          price: 6000,  desc: '2 charges — +80 ATK (destruction massive)',  uses: 2,  category: 'weapon', weaponId: 'bazooka' },

  // ── Armures ────────────────────────────────────────────────────────────────
  leather:   { name: '🧥 Veste en cuir',    price: 500,   desc: '♾️ PERMANENT — -10 dégâts reçus',            permanent: true, category: 'armor', armorId: 'leather' },
  helmet:    { name: '⛑️ Casque',           price: 700,   desc: '♾️ PERMANENT — -15 dégâts reçus',            permanent: true, category: 'armor', armorId: 'helmet' },
  shield2:   { name: '🛡️ Bouclier Renforcé',price: 1200,  desc: '⏳ 7j — -25 dégâts reçus',                   duration: 604800000,  category: 'armor', armorId: 'shield2' },
  armor:     { name: '🦺 Armure Complète',  price: 2500,  desc: '⏳ 14j — -35 dégâts reçus',                  duration: 1209600000, category: 'armor', armorId: 'armor' },
  titanium:  { name: '🔰 Armure Titane',    price: 5000,  desc: '⏳ 30j — -50 dégâts reçus',                  duration: 2592000000, category: 'armor', armorId: 'titanium' },
  godshield: { name: '🌟 Bouclier Divin',   price: 12000, desc: '♾️ PERMANENT — -70 dégâts (légendaire)',     permanent: true, category: 'armor', armorId: 'godshield' },

  // ── Pouvoirs ──────────────────────────────────────────────────────────────
  healing:      { name: '💊 Potion de Soin',   price: 1000,  desc: '1 charge — +50 HP instantané',              uses: 1, category: 'power', powerId: 'healing' },
  super_heal:   { name: '🧬 Potion Suprême',   price: 3000,  desc: '1 charge — +100 HP + immunité 10min',        uses: 1, duration: 600000, category: 'power', powerId: 'super_heal' },
  revive_power: { name: '💫 Revive',           price: 3000,  desc: '1 charge — Ressusciter soi ou un allié',     uses: 1, category: 'power', powerId: 'revive_power' },
  chance_power: { name: '🎯 Chance',           price: 1500,  desc: '⏳ 1h — +20% dégâts infligés',               duration: 3600000,  category: 'power', powerId: 'chance' },
  sharingan:    { name: '👁️ Sharingan',        price: 3500,  desc: '2 charges — 35% esquive sur attaque reçue',  uses: 2, category: 'power', powerId: 'sharingan' },
  invisible:    { name: '👻 Invisibilité',     price: 2000,  desc: '1 charge — Immunité totale prochaine attaque',uses: 1, category: 'power', powerId: 'invisible' },
  poison_power: { name: '☠️ Poison',          price: 1800,  desc: '3 charges — +20 dégâts bonus / attaque',      uses: 3, category: 'power', powerId: 'poison' },
  regeneration: { name: '🌿 Régénération',    price: 2200,  desc: '⏳ 2h — +5 HP par attaque reçue (passive)',   duration: 7200000,  category: 'power', powerId: 'regeneration' },
  berserker:    { name: '😤 Mode Berserk',    price: 4000,  desc: '⏳ 30min — +50% dégâts mais -30% défense',    duration: 1800000,  category: 'power', powerId: 'berserker' },
  barrier:      { name: '🔮 Barrière Magique',price: 5000,  desc: '⏳ 3h — Absorbe les 30 premiers dégâts de chaque attaque', duration: 10800000, category: 'power', powerId: 'barrier' },
  time_stop:    { name: '⏱️ Time Stop',       price: 6000,  desc: '1 charge — Immunité totale pendant 5min',     uses: 1, duration: 300000, category: 'power', powerId: 'time_stop' },

  // ── Attaques spéciales ────────────────────────────────────────────────────
  rasengan:  { name: '🌀 Rasengan',           price: 8000,  desc: '3 charges — +90 ATK (jutsu de Naruto)',      uses: 3, category: 'weapon', weaponId: 'rasengan' },
  chidori:   { name: '⚡ Chidori',            price: 9000,  desc: '3 charges — +95 ATK + 15% paralysie cible', uses: 3, category: 'weapon', weaponId: 'chidori' },
  getsuga:   { name: '🌙 Getsuga Tensho',     price: 10000, desc: '2 charges — +110 ATK (attaque de Ichigo)',   uses: 2, category: 'weapon', weaponId: 'getsuga' },
  atomic:    { name: '☢️ I AM ATOMIC',        price: 50000, desc: '1 charge — +200 ATK. Dévaste tout',          uses: 1, category: 'weapon', weaponId: 'atomic' },
  caca:      { name: '💩 Caca',               price: 1500,  desc: '5 charges — +30 ATK (l\'arme ultime 💀)',    uses: 5, category: 'weapon', weaponId: 'caca' },
};

function getInventory(userId) { return getUser(userId).inventory || []; }

function addItem(userId, itemId) {
  if (!SHOP_ITEMS[itemId]) return false;
  const u = getUser(userId);
  const item = SHOP_ITEMS[itemId];
  const inv  = u.inventory || [];
  inv.push({ id: itemId, name: item.name, acquiredAt: Date.now(), uses: item.uses || null, expiresAt: item.duration ? Date.now() + item.duration : null });
  updateUser(userId, { inventory: inv });
  return true;
}

function hasItem(userId, itemId) {
  return getInventory(userId).some(i => {
    if (i.id !== itemId) return false;
    if (i.expiresAt && Date.now() > i.expiresAt) return false;
    if (i.uses !== null && i.uses <= 0) return false;
    return true;
  });
}

function useItem(userId, itemId) {
  const u   = getUser(userId);
  const inv = u.inventory || [];
  const idx = inv.findIndex(i => {
    if (i.id !== itemId) return false;
    if (i.expiresAt && Date.now() > i.expiresAt) return false;
    if (i.uses !== null && i.uses <= 0) return false;
    return true;
  });
  if (idx === -1) return false;
  if (inv[idx].uses !== null) {
    inv[idx].uses--;
    if (inv[idx].uses <= 0) inv.splice(idx, 1);
  }
  updateUser(userId, { inventory: inv });
  return true;
}

function getLeaderboard(limit = 10, by = 'coins') {
  const data = readEco();
  return Object.entries(data)
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => (b[by] || 0) - (a[by] || 0))
    .slice(0, limit);
}

const COOLDOWNS = {
  daily: 86400000, work: 1800000, crime: 3600000, rob: 2700000, slots: 300000,
  fish: 600000,    mine: 900000,  hunt: 1200000,  collect: 7200000,
  beg:  300000,    scratch: 3600000, invest: 86400000, wheel: 600000,
  dice: 60000,     blackjack: 30000,
};

function isAvailable(userId, action) {
  const u    = getUser(userId);
  const last = u['last' + action.charAt(0).toUpperCase() + action.slice(1)];
  if (!last) return true;
  return Date.now() - last >= COOLDOWNS[action];
}

function timeUntil(userId, action) {
  const u    = getUser(userId);
  const last = u['last' + action.charAt(0).toUpperCase() + action.slice(1)];
  if (!last) return 0;
  return Math.max(0, COOLDOWNS[action] - (Date.now() - last));
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${sec}s`;
  return `${sec}s`;
}

function formatTimeDate(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  } catch { return '?'; }
}

const isDailyAvailable = (id) => isAvailable(id, 'daily');
const isWorkAvailable  = (id) => isAvailable(id, 'work');
const timeUntilDaily   = (id) => timeUntil(id, 'daily');
const timeUntilWork    = (id) => timeUntil(id, 'work');

// ── Prêt / Emprunt ──────────────────────────────────────────────────────────

function takeLoan(userId, amount) {
  const u = getUser(userId);
  if ((u.loan || 0) > 0) return null; // déjà un prêt en cours
  if (amount > 5000) return null;
  u.coins += amount;
  u.loan   = Math.floor(amount * 1.25); // 25% d'intérêts
  u.loanDue = Date.now() + 48 * 60 * 60 * 1000; // 48h pour rembourser
  return updateUser(userId, { coins: u.coins, loan: u.loan, loanDue: u.loanDue });
}

function repayLoan(userId) {
  const u = getUser(userId);
  if (!u.loan) return { ok: false, reason: 'no_loan' };
  if (u.coins < u.loan) return { ok: false, reason: 'insufficient', needed: u.loan, have: u.coins };
  u.coins -= u.loan;
  const paid = u.loan;
  u.loan = 0;
  u.loanDue = null;
  updateUser(userId, { coins: u.coins, loan: u.loan, loanDue: u.loanDue });
  return { ok: true, paid };
}

// ── Investissement ────────────────────────────────────────────────────────────

function startInvest(userId, amount) {
  const u = getUser(userId);
  if ((u.invest || 0) > 0) return null;
  if (u.coins < amount) return null;
  u.coins  -= amount;
  u.invest  = amount;
  u.investAt = Date.now();
  return updateUser(userId, { coins: u.coins, invest: u.invest, investAt: u.investAt });
}

function collectInvest(userId) {
  const u = getUser(userId);
  if (!u.invest || !u.investAt) return null;
  const elapsed = Date.now() - u.investAt;
  if (elapsed < COOLDOWNS.invest) return { wait: COOLDOWNS.invest - elapsed };
  // Retour : entre -30% et +80%
  const pct    = (Math.random() * 110) - 30; // -30 à +80
  const profit = Math.floor(u.invest * pct / 100);
  const total  = u.invest + profit;
  u.coins += total;
  if (total > 0) u.totalEarned = (u.totalEarned || 0) + (profit > 0 ? profit : 0);
  u.invest   = 0;
  u.investAt = null;
  updateUser(userId, { coins: u.coins, totalEarned: u.totalEarned, invest: u.invest, investAt: u.investAt });
  return { invested: u.invest + profit - profit, profit, total, pct: Math.round(pct) };
}

// ── Loterie ───────────────────────────────────────────────────────────────────

const LOTTERY_FILE = require('path').join(__dirname, '../database/lottery.json');
function readLottery()      { try { return JSON.parse(require('fs').readFileSync(LOTTERY_FILE, 'utf8')); } catch { return { tickets: {}, pot: 0, lastDraw: null }; } }
function writeLottery(data) { require('fs').writeFileSync(LOTTERY_FILE, JSON.stringify(data, null, 2)); }

function buyTicket(userId, count = 1) {
  const price = 100;
  const u     = getUser(userId);
  const total = price * count;
  if (u.coins < total) return null;
  removeCoins(userId, total);
  const lot = readLottery();
  lot.pot = (lot.pot || 0) + total;
  if (!lot.tickets[userId]) lot.tickets[userId] = 0;
  lot.tickets[userId] += count;
  writeLottery(lot);
  return { tickets: lot.tickets[userId], pot: lot.pot };
}

function drawLottery(sock, groupId) {
  const lot = readLottery();
  const entries = [];
  for (const [uid, count] of Object.entries(lot.tickets)) {
    for (let i = 0; i < count; i++) entries.push(uid);
  }
  if (!entries.length) return null;
  const winner = entries[Math.floor(Math.random() * entries.length)];
  const prize  = lot.pot;
  addCoins(winner, prize);
  addXP(winner, 50);
  writeLottery({ tickets: {}, pot: 0, lastDraw: Date.now() });
  return { winner, prize };
}

function getLotteryInfo() { return readLottery(); }

// ── Bounty ───────────────────────────────────────────────────────────────────

const BOUNTY_FILE = require('path').join(__dirname, '../database/bounties.json');
function readBounties()      { try { return JSON.parse(require('fs').readFileSync(BOUNTY_FILE, 'utf8')); } catch { return {}; } }
function writeBounties(data) { require('fs').writeFileSync(BOUNTY_FILE, JSON.stringify(data, null, 2)); }

function addBounty(fromId, targetId, amount) {
  const u = getUser(fromId);
  if (u.coins < amount) return null;
  removeCoins(fromId, amount);
  const b = readBounties();
  b[targetId] = (b[targetId] || 0) + amount;
  writeBounties(b);
  return b[targetId];
}

function claimBounty(claimerId, targetId) {
  const b = readBounties();
  if (!b[targetId]) return null;
  const prize = b[targetId];
  addCoins(claimerId, prize);
  delete b[targetId];
  writeBounties(b);
  return prize;
}

function getBounty(targetId) { return readBounties()[targetId] || 0; }

// ── Dette de braquage banque ───────────────────────────────────────────────────
// Quand un joueur est pris en flag sur .rob bank, il accumule une dette
// qui est prélevée automatiquement sur chaque .work
function addBankDebt(userId, amount) {
  const u = getUser(userId);
  const current = u.bankDebt || 0;
  return updateUser(userId, { bankDebt: current + amount });
}

function getBankDebt(userId) {
  return getUser(userId).bankDebt || 0;
}

// Rembourse depuis les gains de .work — retourne le montant prélevé
function repayBankDebt(userId, earned) {
  const debt = getBankDebt(userId);
  if (!debt || debt <= 0) return 0;
  const deduct = Math.min(earned, debt);
  const newDebt = debt - deduct;
  updateUser(userId, { bankDebt: newDebt });
  return deduct;
}

// ── Owner admin helpers ────────────────────────────────────────────────────────
function setLevel(userId, level) {
  const u = getUser(userId);
  const newLevel = Math.max(1, Math.floor(level));
  return updateUser(userId, { level: newLevel, xp: 0 });
}

function setXP(userId, xp) {
  const u = getUser(userId);
  return updateUser(userId, { xp: Math.max(0, xp) });
}

module.exports = {
  getUser, updateUser, addCoins, removeCoins, deposit, withdraw,
  addXP, getTitle, updateStreak, getStreakBonus,
  getInventory, addItem, hasItem, useItem, SHOP_ITEMS,
  getLeaderboard, isAvailable, timeUntil,
  isDailyAvailable, isWorkAvailable, timeUntilDaily, timeUntilWork,
  formatTime, formatTimeDate, COOLDOWNS,
  takeLoan, repayLoan, startInvest, collectInvest,
  buyTicket, drawLottery, getLotteryInfo,
  addBounty, claimBounty, getBounty,
  addBankDebt, getBankDebt, repayBankDebt,
  setLevel, setXP,
};
