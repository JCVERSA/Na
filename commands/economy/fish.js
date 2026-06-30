/**
 * Fish Command — Pêche avec catches variés (cooldown 10min)
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

const CATCHES = [
  { name: 'sardine',       emoji: '🐟', min: 10,  max: 30,   chance: 30, xp: 3  },
  { name: 'tilapia',       emoji: '🐠', min: 30,  max: 80,   chance: 25, xp: 5  },
  { name: 'capitaine',     emoji: '🎣', min: 80,  max: 150,  chance: 20, xp: 8  },
  { name: 'carpe',         emoji: '🐡', min: 100, max: 200,  chance: 12, xp: 10 },
  { name: 'silure géant',  emoji: '🦈', min: 200, max: 400,  chance: 8,  xp: 15 },
  { name: 'vieille botte', emoji: '👟', min: 0,   max: 5,    chance: 4,  xp: 1  },
  { name: 'trésor englouti', emoji: '💎', min: 500, max: 1000, chance: 1, xp: 30 },
];

const MISS_MSGS = [
  'Le poisson a mangé ton appât et s\'est barré 😭',
  'L\'hameçon s\'est décroché au dernier moment...',
  'Tu t\'es endormi en attendant, rien de rien 😴',
  'Le lac est vide aujourd\'hui, essaie ailleurs',
];

module.exports = {
  name: 'fish',
  aliases: ['peche', 'pêche', 'fishing'],
  category: 'economy',
  description: 'Pêcher des poissons pour gagner des coins (10min)',
  usage: '.fish',
  async execute(sock, msg, args, extra) {
    try {
      if (!eco.isAvailable(extra.sender, 'fish')) {
        const r = eco.timeUntil(extra.sender, 'fish');
        return extra.reply(`🎣 *La ligne est encore dans l'eau !*\n\nAttends : *${eco.formatTime(r)}*`);
      }

      eco.updateUser(extra.sender, { lastFish: Date.now() });

      // Tirage pondéré
      const roll = Math.random() * 100;
      let cumul = 0;
      let catch_ = null;
      for (const c of CATCHES) {
        cumul += c.chance;
        if (roll <= cumul) { catch_ = c; break; }
      }
      if (!catch_) catch_ = CATCHES[0];

      // Raté (20% de chance totale)
      if (Math.random() < 0.20) {
        const missMsg = MISS_MSGS[Math.floor(Math.random() * MISS_MSGS.length)];
        return extra.reply(`🎣 *Pêche terminée*\n\n❌ _${missMsg}_\n\n⏳ Réessaie dans : *10 min*`);
      }

      const hasPick  = eco.hasItem(extra.sender, 'pickaxe');
      const earned   = hasPick
        ? Math.floor(Math.random() * (catch_.max * 2 - catch_.min * 2 + 1)) + catch_.min * 2
        : Math.floor(Math.random() * (catch_.max - catch_.min + 1)) + catch_.min;

      if (hasPick) eco.useItem(extra.sender, 'pickaxe');
      eco.addCoins(extra.sender, earned);
      const { leveledUp, newLevel } = eco.addXP(extra.sender, catch_.xp);
      const user = eco.getUser(extra.sender);

      let text =
        `🎣 *PÊCHE TERMINÉE !*\n\n` +
        `${catch_.emoji} Tu as pêché : *${catch_.name}*\n` +
        `💵 Vendu : *+${earned} 🪙*${hasPick ? ' _(x2 Pioche)_' : ''}\n` +
        `💰 Solde : *${user.coins.toLocaleString()} 🪙*\n\n` +
        `⏳ Prochain lancer dans : *10 min*`;
      if (leveledUp) text += `\n\n🚀 *NIVEAU ${newLevel} !* ${eco.getTitle(newLevel)}`;

      await extra.reply(text);
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
