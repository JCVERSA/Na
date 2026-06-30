/**
 * Mine Command — Minage de ressources (cooldown 15min)
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

const RESOURCES = [
  { name: 'pierre ordinaire',  emoji: '🪨', min: 5,   max: 20,  chance: 35, xp: 2  },
  { name: 'charbon',           emoji: '⚫', min: 20,  max: 60,  chance: 25, xp: 5  },
  { name: 'fer',               emoji: '🔩', min: 50,  max: 120, chance: 18, xp: 8  },
  { name: 'or',                emoji: '🥇', min: 100, max: 250, chance: 12, xp: 12 },
  { name: 'diamant',           emoji: '💎', min: 300, max: 600, chance: 6,  xp: 20 },
  { name: 'nétherite',         emoji: '🌑', min: 600, max: 1200,chance: 3,  xp: 35 },
  { name: 'cristal légendaire',emoji: '✨', min: 1000,max: 2000, chance: 1, xp: 50 },
];

module.exports = {
  name: 'mine',
  aliases: ['miner', 'creuser', 'dig'],
  category: 'economy',
  description: 'Miner des ressources pour gagner des coins (15min)',
  usage: '.mine',
  async execute(sock, msg, args, extra) {
    try {
      if (!eco.isAvailable(extra.sender, 'mine')) {
        const r = eco.timeUntil(extra.sender, 'mine');
        return extra.reply(`⛏️ *Tu es épuisé après le minage !*\n\nRepose-toi : *${eco.formatTime(r)}*`);
      }

      eco.updateUser(extra.sender, { lastMine: Date.now() });

      const hasPick = eco.hasItem(extra.sender, 'pickaxe');
      const bonusChance = hasPick ? 10 : 0;

      const roll = Math.random() * 100;
      let cumul  = 0;
      let res    = null;
      for (const r of RESOURCES) {
        cumul += r.chance + (r === RESOURCES[RESOURCES.length-1] ? bonusChance : 0);
        if (roll <= cumul) { res = r; break; }
      }
      if (!res) res = RESOURCES[0];

      if (hasPick) eco.useItem(extra.sender, 'pickaxe');

      const earned = Math.floor(Math.random() * (res.max - res.min + 1)) + res.min;
      eco.addCoins(extra.sender, earned);
      const { leveledUp, newLevel } = eco.addXP(extra.sender, res.xp);
      const user = eco.getUser(extra.sender);

      let text =
        `⛏️ *MINAGE TERMINÉ !*\n\n` +
        `${res.emoji} Tu as trouvé : *${res.name}*\n` +
        `💵 Vendu : *+${earned} 🪙*${hasPick ? ' _(Pioche utilisée)_' : ''}\n` +
        `💰 Solde : *${user.coins.toLocaleString()} 🪙*\n\n` +
        `⏳ Prochain minage dans : *15 min*`;
      if (leveledUp) text += `\n\n🚀 *NIVEAU ${newLevel} !* ${eco.getTitle(newLevel)}`;

      await extra.reply(text);
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
