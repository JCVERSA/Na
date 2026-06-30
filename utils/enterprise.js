/**
 * Enterprise System — Nebula Bot by Dark Neon
 * Système d'entreprise complet : ouverture, employés, salaires, prison, rangs
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database');
const CO_FILE = path.join(DB_PATH, 'companies.json');

if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
if (!fs.existsSync(CO_FILE))  fs.writeFileSync(CO_FILE, '{}');

// ── I/O ───────────────────────────────────────────────────────────────────────
function readDB()      { try { return JSON.parse(fs.readFileSync(CO_FILE, 'utf8')); } catch { return {}; } }
function writeDB(data) { fs.writeFileSync(CO_FILE, JSON.stringify(data, null, 2)); }

// ── Rangs entreprise (20 niveaux) ─────────────────────────────────────────────
const COMPANY_RANKS = [
  { level: 1,  name: '🏠 Auto-entrepreneur',  xpRequired: 0,     botWorkers: 0, workBonus: 0   },
  { level: 2,  name: '🏪 Micro-entreprise',   xpRequired: 500,   botWorkers: 0, workBonus: 5   },
  { level: 3,  name: '🏬 Petite boutique',    xpRequired: 1200,  botWorkers: 0, workBonus: 10  },
  { level: 4,  name: '🏢 PME émergente',      xpRequired: 2500,  botWorkers: 0, workBonus: 15  },
  { level: 5,  name: '🏦 Société établie',    xpRequired: 5000,  botWorkers: 0, workBonus: 20  },
  { level: 6,  name: '🏭 PME confirmée',      xpRequired: 9000,  botWorkers: 0, workBonus: 25  },
  { level: 7,  name: '🌐 Entreprise régionale',xpRequired: 15000, botWorkers: 0, workBonus: 30  },
  { level: 8,  name: '📦 Holding locale',     xpRequired: 23000, botWorkers: 0, workBonus: 40  },
  { level: 9,  name: '💼 Groupe industriel',  xpRequired: 35000, botWorkers: 0, workBonus: 50  },
  { level: 10, name: '🤖 Corp automatisée',   xpRequired: 50000, botWorkers: 2, workBonus: 60  },
  { level: 11, name: '🌍 Multinationale',     xpRequired: 70000, botWorkers: 3, workBonus: 75  },
  { level: 12, name: '🚀 Tech Giant',         xpRequired: 95000, botWorkers: 4, workBonus: 90  },
  { level: 13, name: '💎 Empire commercial',  xpRequired: 130000,botWorkers: 5, workBonus: 110 },
  { level: 14, name: '⚡ Monopole',           xpRequired: 175000,botWorkers: 6, workBonus: 130 },
  { level: 15, name: '🌟 Conglomérat',        xpRequired: 230000,botWorkers: 7, workBonus: 150 },
  { level: 16, name: '🏆 Titan industriel',   xpRequired: 300000,botWorkers: 8, workBonus: 175 },
  { level: 17, name: '👑 Dynastier',          xpRequired: 400000,botWorkers: 9, workBonus: 200 },
  { level: 18, name: '☢️ Méga-Corp',          xpRequired: 550000,botWorkers:10, workBonus: 250 },
  { level: 19, name: '🌌 Néo-Empire',         xpRequired: 750000,botWorkers:12, workBonus: 300 },
  { level: 20, name: '⚜️ DARK NEON CORP',     xpRequired: 1000000,botWorkers:15, workBonus:400  },
];

function getCompanyRank(xp) {
  let rank = COMPANY_RANKS[0];
  for (const r of COMPANY_RANKS) {
    if (xp >= r.xpRequired) rank = r;
    else break;
  }
  return rank;
}

function getNextRank(xp) {
  for (const r of COMPANY_RANKS) {
    if (xp < r.xpRequired) return r;
  }
  return null;
}

// ── Profil entreprise par défaut ──────────────────────────────────────────────
const DEFAULT_COMPANY = (ownerId, name) => ({
  ownerId,
  name,
  open:        true,
  xp:          0,
  totalEarned: 0,
  employees:   [],     // [{ id, username, hiredAt, missedPayments }]
  botWorkers:  0,      // nombre de bot-workers actifs
  lastBotWork: null,
  pendingPay:  {},     // { workerId: { amount, deadline, msgId } }
  missedStreak:{},     // { workerId: count } — compteur non-paiements consécutifs
  createdAt:   Date.now(),
});

// ── CRUD entreprise ───────────────────────────────────────────────────────────
function getCompany(ownerId)    { return readDB()[ownerId] || null; }
function hasCompany(ownerId)    { return !!getCompany(ownerId); }
function getEmployerOf(userId)  {
  const db = readDB();
  return Object.values(db).find(c => c.open && c.employees.some(e => e.id === userId)) || null;
}

function openCompany(ownerId, name) {
  const db = readDB();
  if (db[ownerId]) return null;
  db[ownerId] = DEFAULT_COMPANY(ownerId, name);
  writeDB(db);
  return db[ownerId];
}

function updateCompany(ownerId, patch) {
  const db = readDB();
  if (!db[ownerId]) return null;
  db[ownerId] = { ...db[ownerId], ...patch };
  writeDB(db);
  return db[ownerId];
}

function closeCompany(ownerId) {
  const db = readDB();
  if (!db[ownerId]) return false;
  db[ownerId].open = false;
  writeDB(db);
  return true;
}

function addXpCompany(ownerId, amount) {
  const co = getCompany(ownerId);
  if (!co) return null;
  const newXp = (co.xp || 0) + amount;
  updateCompany(ownerId, { xp: newXp, totalEarned: (co.totalEarned || 0) + amount });
  return newXp;
}

// ── Employés ──────────────────────────────────────────────────────────────────
function hireEmployee(ownerId, workerId, username) {
  const db = readDB();
  const co = db[ownerId];
  if (!co) return false;
  if (co.employees.some(e => e.id === workerId)) return 'already';
  co.employees.push({ id: workerId, username, hiredAt: Date.now(), missedPayments: 0 });
  writeDB(db);
  return true;
}

function fireEmployee(ownerId, workerId) {
  const db = readDB();
  const co = db[ownerId];
  if (!co) return false;
  co.employees = co.employees.filter(e => e.id !== workerId);
  delete co.pendingPay[workerId];
  delete co.missedStreak[workerId];
  writeDB(db);
  return true;
}

// ── Paiement employé (déclenché par .work d'un employé) ──────────────────────
// Retourne les infos pour notifier le patron
function registerWorkByEmployee(ownerId, workerId, earnedAmount) {
  const db = readDB();
  const co = db[ownerId];
  if (!co || !co.open) return null;

  const rank = getCompanyRank(co.xp || 0);
  // Bonus entreprise sur le gain de base
  const totalOwed = earnedAmount + rank.workBonus;

  co.pendingPay = co.pendingPay || {};
  co.pendingPay[workerId] = {
    amount:    totalOwed,
    deadline:  Date.now() + 2 * 60 * 1000, // 2 minutes
    workedAt:  Date.now(),
  };
  writeDB(db);
  return { totalOwed, deadline: co.pendingPay[workerId].deadline };
}

// Payer un employé
function payEmployee(ownerId, workerId, amount) {
  const db = readDB();
  const co = db[ownerId];
  if (!co) return { ok: false, reason: 'no_company' };

  // Minimum 200
  if (amount < 200) return { ok: false, reason: 'too_low' };

  const pending = (co.pendingPay || {})[workerId];

  delete co.pendingPay[workerId];
  co.missedStreak = co.missedStreak || {};
  co.missedStreak[workerId] = 0; // reset compteur
  addXpCompany(ownerId, Math.floor(amount * 0.1)); // +10% du salaire en XP entreprise
  writeDB(db);
  return { ok: true, paid: amount };
}

// Vérifier les paiements en retard (appelé régulièrement)
function checkOverduePay(ownerId) {
  const db   = readDB();
  const co   = db[ownerId];
  if (!co || !co.open) return [];
  const now  = Date.now();
  const overdue = [];

  for (const [workerId, info] of Object.entries(co.pendingPay || {})) {
    if (now > info.deadline) {
      overdue.push({ workerId, amount: info.amount });
      delete co.pendingPay[workerId];

      co.missedStreak = co.missedStreak || {};
      co.missedStreak[workerId] = (co.missedStreak[workerId] || 0) + 1;
    }
  }

  writeDB(db);
  return overdue;
}

// Vérifier si prison nécessaire (5 manquements consécutifs tous employés confondus)
function checkPrisonThreshold(ownerId) {
  const co = getCompany(ownerId);
  if (!co) return false;
  const streaks = Object.values(co.missedStreak || {});
  return streaks.some(s => s >= 5);
}

// ── Travailleurs bots (niveau 10+) ────────────────────────────────────────────
const BOT_WORK_INTERVAL = 2 * 60 * 60 * 1000; // 2h

function processBotWorkers(ownerId) {
  const co = getCompany(ownerId);
  if (!co || !co.open) return 0;
  const rank = getCompanyRank(co.xp || 0);
  if (rank.level < 10 || rank.botWorkers <= 0) return 0;

  const now  = Date.now();
  const last = co.lastBotWork || 0;
  if (now - last < BOT_WORK_INTERVAL) return 0;

  const maxBots  = rank.botWorkers;
  const activeBots = Math.min(co.botWorkers || 0, maxBots);
  if (activeBots <= 0) return 0;

  // Chaque bot gagne 50-150 coins + bonus de rang
  const perBot  = Math.floor(Math.random() * 100) + 50 + rank.workBonus;
  const total   = perBot * activeBots;

  addXpCompany(ownerId, Math.floor(total * 0.1));
  updateCompany(ownerId, { lastBotWork: now });
  return total;
}

function hireBotWorker(ownerId) {
  const co   = getCompany(ownerId);
  const rank = getCompanyRank(co?.xp || 0);
  if (!co || rank.level < 10) return { ok: false, reason: 'level_required' };
  if ((co.botWorkers || 0) >= rank.botWorkers) return { ok: false, reason: 'max_reached' };
  updateCompany(ownerId, { botWorkers: (co.botWorkers || 0) + 1 });
  return { ok: true, count: (co.botWorkers || 0) + 1 };
}

module.exports = {
  COMPANY_RANKS, getCompanyRank, getNextRank,
  getCompany, hasCompany, getEmployerOf,
  openCompany, updateCompany, closeCompany, addXpCompany,
  hireEmployee, fireEmployee,
  registerWorkByEmployee, payEmployee, checkOverduePay, checkPrisonThreshold,
  processBotWorkers, hireBotWorker,
  BOT_WORK_INTERVAL,
};
