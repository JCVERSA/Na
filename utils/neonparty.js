/**
 * NeonParty — Moteur du jeu RPG
 * Système complet : inscription, HP, combat, mort, mariage, famille
 * Nebula Bot by Dark Neon
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH    = path.join(__dirname, '../database');
const PARTY_FILE = path.join(DB_PATH, 'neonparty.json');

if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
if (!fs.existsSync(PARTY_FILE)) fs.writeFileSync(PARTY_FILE, '{}');

// ── I/O ──────────────────────────────────────────────────────────────────────

function readDB()      { try { return JSON.parse(fs.readFileSync(PARTY_FILE, 'utf8')); } catch { return {}; } }
function writeDB(data) { fs.writeFileSync(PARTY_FILE, JSON.stringify(data, null, 2)); }

// ── Profil par défaut ─────────────────────────────────────────────────────────

const DEFAULT = () => ({
  username:    null,
  registered:  false,
  hp:          100,
  maxHp:       100,
  alive:       true,
  deadUntil:   null,
  deathCount:  0,
  killCount:   0,
  // ── Combat XP & Rang ─────────────────────────────────────────────────────
  gameXp:      0,      // XP de combat (gagné en killant, prenant des dégâts)
  gameLevel:   1,      // Niveau de combat (affecte les dégâts)
  // ── Équipement actif ──────────────────────────────────────────────────────
  weapon:      null,
  weaponExpiry:null,
  weaponUses:  null,
  armor:       null,
  armorExpiry: null,
  powers:      [],
  // ── Prison ───────────────────────────────────────────────────────────────
  inPrison:    false,
  prisonUntil: null,
  prisonWarns: 0,      // warnings de plainte injustifiée
  // ── Famille ───────────────────────────────────────────────────────────────
  marriedTo:   null,
  spouseName:  null,
  children:    [],
  parents:     [],
  // ── Stats ─────────────────────────────────────────────────────────────────
  totalDmgDealt:    0,
  totalDmgReceived: 0,
  createdAt: Date.now(),
  // ── Avatar ────────────────────────────────────────────────────────────────
  avatar:    null,   // emoji ou URL base64 image
});

// ── CRUD joueur ───────────────────────────────────────────────────────────────

function getPlayer(userId) {
  const db = readDB();
  if (!db[userId]) db[userId] = DEFAULT();
  // Migration
  const def = DEFAULT();
  let changed = false;
  for (const k of Object.keys(def)) {
    if (db[userId][k] === undefined) { db[userId][k] = def[k]; changed = true; }
  }
  if (changed) writeDB(db);
  return db[userId];
}

function updatePlayer(userId, patch) {
  const db = readDB();
  if (!db[userId]) db[userId] = DEFAULT();
  db[userId] = { ...db[userId], ...patch };
  writeDB(db);
  return db[userId];
}

function isRegistered(userId) {
  return getPlayer(userId).registered === true;
}

function isAlive(userId) {
  const p = getPlayer(userId);
  if (!p.alive && p.deadUntil && Date.now() >= p.deadUntil) {
    // Auto-revive à l'expiration
    updatePlayer(userId, { alive: true, deadUntil: null, hp: Math.floor(p.maxHp * 0.3) });
    return true;
  }
  return p.alive !== false;
}

function timeUntilRevive(userId) {
  const p = getPlayer(userId);
  if (!p.deadUntil) return 0;
  return Math.max(0, p.deadUntil - Date.now());
}

// ── Inscription ───────────────────────────────────────────────────────────────

function register(userId, username) {
  if (isRegistered(userId)) return { ok: false, reason: 'already_registered' };
  const db = readDB();
  // Vérifier unicité du pseudo
  const taken = Object.values(db).some(p => p.username?.toLowerCase() === username.toLowerCase());
  if (taken) return { ok: false, reason: 'name_taken' };
  if (username.length < 2 || username.length > 16) return { ok: false, reason: 'invalid_length' };
  if (!/^[\w\-\.]+$/.test(username)) return { ok: false, reason: 'invalid_chars' };

  const player = { ...DEFAULT(), username, registered: true };
  db[userId] = player;
  writeDB(db);
  return { ok: true, player };
}

// ── Recherche par pseudo ──────────────────────────────────────────────────────

function findByUsername(name) {
  const db = readDB();
  return Object.entries(db).find(([, p]) => p.username?.toLowerCase() === name.toLowerCase()) || null;
}

// ── Affichage du pseudo ───────────────────────────────────────────────────────

function displayName(userId) {
  const p = getPlayer(userId);
  return p.username || userId.split('@')[0];
}

// Format "tag + pseudo bold" pour les messages
function tag(userId) {
  const p  = getPlayer(userId);
  const wa = userId.split('@')[0];
  const gn = p.username ? `『 ${p.username} 』` : '';
  return { wa, gn, full: `@${wa} ${gn}` };
}

// ── Calcul des dégâts ─────────────────────────────────────────────────────────

// ── Rangs joueurs NeonParty (20 niveaux) ─────────────────────────────────────
const PLAYER_RANKS = [
  { level: 1,  name: '🪨 Mineur',          xpRequired: 0,    dmgMult: 1.0  },
  { level: 2,  name: '⚒️ Majeur',          xpRequired: 50,   dmgMult: 1.05 },
  { level: 3,  name: '🗡️ Apprenti',        xpRequired: 120,  dmgMult: 1.10 },
  { level: 4,  name: '⚔️ Combattant',      xpRequired: 250,  dmgMult: 1.15 },
  { level: 5,  name: '🛡️ Garde',           xpRequired: 450,  dmgMult: 1.20 },
  { level: 6,  name: '🔱 Soldat',          xpRequired: 700,  dmgMult: 1.30 },
  { level: 7,  name: '💪 Vétéran',         xpRequired: 1000, dmgMult: 1.40 },
  { level: 8,  name: '🌟 Élite',           xpRequired: 1400, dmgMult: 1.50 },
  { level: 9,  name: '🔥 Assassin',        xpRequired: 1900, dmgMult: 1.65 },
  { level: 10, name: '💀 Chasseur',        xpRequired: 2500, dmgMult: 1.80 },
  { level: 11, name: '🦅 Faucon',          xpRequired: 3300, dmgMult: 1.95 },
  { level: 12, name: '🐯 Tigre',           xpRequired: 4300, dmgMult: 2.10 },
  { level: 13, name: '🦁 Roi des bêtes',   xpRequired: 5500, dmgMult: 2.30 },
  { level: 14, name: '⚡ Foudre',          xpRequired: 7000, dmgMult: 2.50 },
  { level: 15, name: '🌀 Ninja',           xpRequired: 9000, dmgMult: 2.75 },
  { level: 16, name: '🔮 Sorcier',         xpRequired: 11500,dmgMult: 3.00 },
  { level: 17, name: '🌙 Spectre',         xpRequired: 14500,dmgMult: 3.30 },
  { level: 18, name: '☢️ Démon',           xpRequired: 18000,dmgMult: 3.70 },
  { level: 19, name: '🌌 Dieu du combat',  xpRequired: 22500,dmgMult: 4.20 },
  { level: 20, name: '👑 DARK LEGEND',     xpRequired: 28000,dmgMult: 5.00 },
];

function getPlayerRank(gameXp) {
  let rank = PLAYER_RANKS[0];
  for (const r of PLAYER_RANKS) {
    if (gameXp >= r.xpRequired) rank = r;
    else break;
  }
  return rank;
}

function getNextPlayerRank(gameXp) {
  for (const r of PLAYER_RANKS) {
    if (gameXp < r.xpRequired) return r;
  }
  return null;
}

function addGameXp(userId, amount) {
  const p    = getPlayer(userId);
  const newXp = (p.gameXp || 0) + amount;
  const newRank = getPlayerRank(newXp);
  updatePlayer(userId, { gameXp: newXp, gameLevel: newRank.level });
  const oldRank = getPlayerRank(p.gameXp || 0);
  return { newXp, rankUp: newRank.level > oldRank.level, newRank };
}

// ── Prison ────────────────────────────────────────────────────────────────────

function isInPrison(userId) {
  const p = getPlayer(userId);
  if (!p.inPrison) return false;
  if (p.prisonUntil && Date.now() >= p.prisonUntil) {
    updatePlayer(userId, { inPrison: false, prisonUntil: null });
    return false;
  }
  return true;
}

function timeUntilRelease(userId) {
  const p = getPlayer(userId);
  if (!p.prisonUntil) return 0;
  return Math.max(0, p.prisonUntil - Date.now());
}

function sendToPrison(userId, durationMs) {
  const until = Date.now() + durationMs;
  updatePlayer(userId, { inPrison: true, prisonUntil: until });
  return until;
}

function releaseFromPrison(userId) {
  updatePlayer(userId, { inPrison: false, prisonUntil: null });
}

// ── Suivi des crimes (pour les plaintes dans les 5s) ─────────────────────────

const RECENT_CRIMES = new Map(); // targetId -> { attackerId, timestamp, type }

function recordCrime(attackerId, targetId, type = 'kill') {
  RECENT_CRIMES.set(targetId, { attackerId, timestamp: Date.now(), type });
  setTimeout(() => RECENT_CRIMES.delete(targetId), 35000); // purge après 35s
}

function getRecentCrime(targetId) {
  const crime = RECENT_CRIMES.get(targetId);
  if (!crime) return null;
  if (Date.now() - crime.timestamp > 30000) return null; // seulement dans les 30s
  return crime;
}

const WEAPON_STATS = {
  // Armes basiques
  dagger:   { atk: 15,  emoji: '🗡️',  name: 'Dague' },
  sword:    { atk: 25,  emoji: '⚔️',  name: 'Épée' },
  axe:      { atk: 30,  emoji: '🪓',  name: 'Hache' },
  // Armes à feu
  pistol:   { atk: 35,  emoji: '🔫',  name: 'Pistolet' },
  ak47:     { atk: 50,  emoji: '🔫',  name: 'AK-47' },
  sniper:   { atk: 75,  emoji: '🎯',  name: 'Sniper' },
  // Armes spéciales
  katana:   { atk: 45,  emoji: '🗡️',  name: 'Katana' },
  grenade:  { atk: 55,  emoji: '💣',  name: 'Grenade' },
  bazooka:  { atk: 80,  emoji: '🚀',  name: 'Bazooka' },
  // Pouvoirs d'attaque
  rasengan: { atk: 90,  emoji: '🌀',  name: 'Rasengan' },
  atomic:   { atk: 200, emoji: '☢️',  name: 'I AM ATOMIC' },
  caca:     { atk: 30,  emoji: '💩',  name: 'Caca' },
};

const ARMOR_STATS = {
  leather:  { def: 10, emoji: '🧥',  name: 'Veste en cuir',      permanent: true  },
  helmet:   { def: 15, emoji: '⛑️',  name: 'Casque',             permanent: true  },
  shield2:  { def: 25, emoji: '🛡️',  name: 'Bouclier Renforcé',  permanent: false },
  armor:    { def: 35, emoji: '🦺',  name: 'Armure Complète',    permanent: false },
  titanium: { def: 50, emoji: '🔰',  name: 'Armure Titane',      permanent: false },
  godshield:{ def: 70, emoji: '🌟',  name: 'Bouclier Divin',     permanent: true  },
};

function calculateDamage(attackerId, defenderId) {
  const atk = getPlayer(attackerId);
  const def = getPlayer(defenderId);
  const now = Date.now();

  // ── Multiplicateur de niveau de combat ────────────────────────────────────
  const atkPlayer = getPlayer(attackerId);
  const atkRank   = getPlayerRank(atkPlayer.gameXp || 0);
  let baseDmg = Math.floor((Math.random() * 20 + 10) * atkRank.dmgMult); // multiplié par rang
  let specialEffect = null;

  // ── Arme équipée (vérifier expiration) ───────────────────────────────────
  if (atk.weapon && WEAPON_STATS[atk.weapon]) {
    const w = WEAPON_STATS[atk.weapon];
    // Vérifier expiration temporelle
    if (atk.weaponExpiry && now > atk.weaponExpiry) {
      updatePlayer(attackerId, { weapon: null, weaponExpiry: null, weaponUses: null });
      console.log(`[NeonParty] Arme expirée pour ${attackerId}`);
    } else {
      const var_ = Math.floor(w.atk * 0.2);
      baseDmg += w.atk + Math.floor(Math.random() * var_ * 2) - var_;
      // Effet Chidori : paralysie
      if (atk.weapon === 'chidori' && w.paralyze && Math.random() < w.paralyze) {
        specialEffect = 'paralyze';
      }
    }
  }

  // ── Pouvoirs offensifs ────────────────────────────────────────────────────
  if (hasPower(attackerId, 'chance'))    baseDmg = Math.floor(baseDmg * 1.2);
  if (hasPower(attackerId, 'berserker')) baseDmg = Math.floor(baseDmg * 1.5);

  // ── Immunités défenseur ───────────────────────────────────────────────────
  // Time Stop
  if (hasPower(defenderId, 'time_stop')) {
    usePower(defenderId, 'time_stop');
    return { dmg: 0, dodged: true, timeStop: true, reduction: 0 };
  }
  // Invisibilité
  if (hasPower(defenderId, 'invisible')) {
    usePower(defenderId, 'invisible');
    return { dmg: 0, dodged: true, invisible: true, reduction: 0 };
  }
  // Super Heal (immunité 10min)
  if (hasPower(defenderId, 'super_heal_immunity')) {
    return { dmg: 0, dodged: true, superHeal: true, reduction: 0 };
  }
  // Sharingan
  if (hasPower(defenderId, 'sharingan') && Math.random() < 0.35) {
    usePower(defenderId, 'sharingan');
    return { dmg: 0, dodged: true, sharingan: true, reduction: 0 };
  }

  // ── Armure défenseur (vérifier expiration) ────────────────────────────────
  let reduction = 0;
  if (def.armor && ARMOR_STATS[def.armor]) {
    if (def.armorExpiry && now > def.armorExpiry) {
      // Armure expirée
      updatePlayer(defenderId, { armor: null, armorExpiry: null });
      console.log(`[NeonParty] Armure expirée pour ${defenderId}`);
    } else {
      reduction = ARMOR_STATS[def.armor].def;
    }
  }

  // ── Barrière magique ──────────────────────────────────────────────────────
  let barrierAbsorbed = 0;
  if (hasPower(defenderId, 'barrier')) {
    barrierAbsorbed = Math.min(30, baseDmg - reduction);
    reduction += barrierAbsorbed;
  }

  // ── Berserk : pénalité défense ────────────────────────────────────────────
  if (hasPower(defenderId, 'berserker')) {
    reduction = Math.max(0, reduction - Math.floor(reduction * 0.3));
  }

  const finalDmg = Math.max(5, baseDmg - reduction);
  return { dmg: finalDmg, dodged: false, reduction, baseDmg, specialEffect, barrierAbsorbed };
}

// ── Application des dégâts ────────────────────────────────────────────────────

function applyDamage(userId, dmg) {
  const p   = getPlayer(userId);
  let actualDmg = dmg;

  // Régénération : récupère 5 HP par coup reçu
  let regenHeal = 0;
  if (hasPower(userId, 'regeneration')) {
    regenHeal = 5;
    actualDmg = Math.max(0, dmg - 5);
  }

  const newHp = Math.max(0, (p.hp || 100) - actualDmg);
  const died  = newHp <= 0;

  let deadUntil = null;
  if (died) {
    const minMs = 3  * 60 * 1000;
    const maxMs = 15 * 60 * 1000;
    const ratio = Math.min(1, actualDmg / 100);
    deadUntil = Date.now() + Math.floor(minMs + ratio * (maxMs - minMs));
  }

  updatePlayer(userId, {
    hp: died ? 0 : newHp,
    alive: !died,
    deadUntil,
    deathCount: died ? (p.deathCount || 0) + 1 : p.deathCount,
    totalDmgReceived: (p.totalDmgReceived || 0) + actualDmg,
  });

  return { died, newHp, deadUntil, regenHeal, actualDmg };
}

function applyKill(killerId) {
  const p = getPlayer(killerId);
  updatePlayer(killerId, { killCount: (p.killCount || 0) + 1 });
}

// ── HP / Heal ─────────────────────────────────────────────────────────────────

function heal(userId, amount) {
  const p     = getPlayer(userId);
  const newHp = Math.min(p.maxHp || 100, (p.hp || 0) + amount);
  updatePlayer(userId, { hp: newHp });
  return newHp;
}

function revive(targetId, forcedHp = null) {
  const p  = getPlayer(targetId);
  const hp = forcedHp || Math.floor((p.maxHp || 100) * 0.4);
  updatePlayer(targetId, { alive: true, deadUntil: null, hp });
  return hp;
}

// ── Pouvoirs ──────────────────────────────────────────────────────────────────

function hasPower(userId, powerId) {
  const p   = getPlayer(userId);
  const now = Date.now();
  return (p.powers || []).some(pw => {
    if (pw.id !== powerId) return false;
    if (pw.expiresAt && now > pw.expiresAt) return false;
    if (pw.usesLeft !== undefined && pw.usesLeft !== null && pw.usesLeft <= 0) return false;
    return true;
  });
}

function usePower(userId, powerId) {
  const p   = getPlayer(userId);
  const now = Date.now();
  const pws = (p.powers || []).map(pw => {
    if (pw.id !== powerId) return pw;
    if (pw.expiresAt && now > pw.expiresAt) return pw;
    if (pw.usesLeft !== null && pw.usesLeft !== undefined) {
      return { ...pw, usesLeft: pw.usesLeft - 1 };
    }
    return pw;
  }).filter(pw => {
    if (pw.id !== powerId) return true;
    if (pw.usesLeft !== null && pw.usesLeft !== undefined && pw.usesLeft <= 0) return false;
    return true;
  });
  updatePlayer(userId, { powers: pws });
}

function addPower(userId, powerId, powerData) {
  const p = getPlayer(userId);
  const pws = (p.powers || []).filter(pw => pw.id !== powerId);
  pws.push({ id: powerId, ...powerData });
  updatePlayer(userId, { powers: pws });
}

function getPowers(userId) {
  const p   = getPlayer(userId);
  const now = Date.now();
  return (p.powers || []).filter(pw => {
    if (pw.expiresAt && now > pw.expiresAt) return false;
    if (pw.usesLeft !== null && pw.usesLeft !== undefined && pw.usesLeft <= 0) return false;
    return true;
  });
}

// ── Mariage ───────────────────────────────────────────────────────────────────

const MARRY_REQUESTS = new Map(); // targetId -> { from, timeout }

function proposeMarriage(fromId, targetId) {
  return MARRY_REQUESTS.set(targetId, { from: fromId, time: Date.now() });
}

function getProposal(userId) {
  const req = MARRY_REQUESTS.get(userId);
  if (!req) return null;
  if (Date.now() - req.time > 120000) { MARRY_REQUESTS.delete(userId); return null; }
  return req;
}

function acceptMarriage(userId) {
  const req = getProposal(userId);
  if (!req) return null;
  MARRY_REQUESTS.delete(userId);

  const p1 = getPlayer(req.from);
  const p2 = getPlayer(userId);

  updatePlayer(req.from, { marriedTo: userId,   spouseName: p2.username });
  updatePlayer(userId,   { marriedTo: req.from, spouseName: p1.username });

  return { p1: req.from, p2: userId };
}

function divorce(userId) {
  const p = getPlayer(userId);
  if (!p.marriedTo) return false;
  const spouseId = p.marriedTo;
  updatePlayer(userId,   { marriedTo: null, spouseName: null });
  updatePlayer(spouseId, { marriedTo: null, spouseName: null });
  return true;
}

// ── Adoption ──────────────────────────────────────────────────────────────────

const ADOPT_REQUESTS = new Map();

function proposeAdoption(parentId, childId) {
  ADOPT_REQUESTS.set(childId, { parentId, time: Date.now() });
}

function getAdoptionRequest(userId) {
  const req = ADOPT_REQUESTS.get(userId);
  if (!req) return null;
  if (Date.now() - req.time > 120000) { ADOPT_REQUESTS.delete(userId); return null; }
  return req;
}

function acceptAdoption(childId) {
  const req = getAdoptionRequest(childId);
  if (!req) return null;
  ADOPT_REQUESTS.delete(childId);

  const parent = getPlayer(req.parentId);
  const child  = getPlayer(childId);

  const newChildren = [...(parent.children || []).filter(c => c.id !== childId), { id: childId, username: child.username }];
  const newParents  = [...(child.parents  || []).filter(p => p.id !== req.parentId), { id: req.parentId, username: parent.username }];

  updatePlayer(req.parentId, { children: newChildren });
  updatePlayer(childId,      { parents: newParents });
  return { parentId: req.parentId, childId };
}

// ── Arbre généalogique ───────────────────────────────────────────────────────

function getFamilyTree(userId) {
  const p = getPlayer(userId);
  return {
    self:     { id: userId, username: p.username, hp: p.hp, alive: p.alive },
    spouse:   p.marriedTo ? { id: p.marriedTo, username: p.spouseName } : null,
    children: (p.children || []),
    parents:  (p.parents  || []),
  };
}

// ── Classement PVP ───────────────────────────────────────────────────────────

function getPvpLeaderboard(limit = 10) {
  const db = readDB();
  return Object.entries(db)
    .filter(([, p]) => p.registered)
    .map(([id, p]) => ({ id, username: p.username, kills: p.killCount || 0, deaths: p.deathCount || 0 }))
    .sort((a, b) => b.kills - a.kills)
    .slice(0, limit);
}

// ── Formatage ─────────────────────────────────────────────────────────────────

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}min`;
  if (m > 0) return `${m}min ${s % 60}s`;
  return `${s}s`;
}

function hpBar(hp, maxHp = 100) {
  const pct   = Math.max(0, Math.min(10, Math.round((hp / maxHp) * 10)));
  const color = pct > 6 ? '🟩' : pct > 3 ? '🟨' : '🟥';
  return color.repeat(pct) + '⬛'.repeat(10 - pct);
}

// ── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  getPlayer, updatePlayer, isRegistered, isAlive, timeUntilRevive,
  register, findByUsername, displayName, tag,
  WEAPON_STATS, ARMOR_STATS,
  PLAYER_RANKS, getPlayerRank, getNextPlayerRank, addGameXp,
  calculateDamage, applyDamage, applyKill, heal, revive,
  hasPower, usePower, addPower, getPowers,
  isInPrison, timeUntilRelease, sendToPrison, releaseFromPrison,
  recordCrime, getRecentCrime,
  proposeMarriage, getProposal, acceptMarriage, divorce,
  proposeAdoption, getAdoptionRequest, acceptAdoption,
  getFamilyTree, getPvpLeaderboard,
  formatTime, hpBar,
};
