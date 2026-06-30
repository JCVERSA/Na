/**
 * Scratch Card Command — Carte à gratter (cooldown 1h)
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');
const PRICE = 50;
const SYMBOLS = ['🍒','🍋','⭐','💎','🔔','🍀'];

module.exports = {
  name: 'scratch',
  aliases: ['gratter', 'carte', 'scratchcard'],
  category: 'economy',
  description: `Acheter une carte à gratter (${PRICE} 🪙, cooldown 1h)`,
  usage: '.scratch',
  async execute(sock, msg, args, extra) {
    try {
      if (!eco.isAvailable(extra.sender, 'scratch')) {
        return extra.reply(`🎫 *T\'as déjà gratte récemment !*\n\nAttends : *${eco.formatTime(eco.timeUntil(extra.sender, 'scratch'))}*`);
      }
      const user = eco.getUser(extra.sender);
      if (user.coins < PRICE) return extra.reply(`❌ Coûte *${PRICE} 🪙* ! T\'as que ${user.coins} 🪙`);

      eco.removeCoins(extra.sender, PRICE);
      eco.updateUser(extra.sender, { lastScratch: Date.now() });

      const grid = Array.from({ length: 9 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);

      // Compter les occurrences
      const counts = {};
      for (const s of grid) counts[s] = (counts[s] || 0) + 1;
      const max   = Math.max(...Object.values(counts));
      const topSym = Object.keys(counts).find(k => counts[k] === max);

      let prize = 0;
      if (max >= 3 && topSym === '💎') prize = 1000;
      else if (max >= 3 && topSym === '⭐') prize = 500;
      else if (max >= 3 && topSym === '🍀') prize = 300;
      else if (max >= 3 && topSym === '🔔') prize = 150;
      else if (max >= 3 && topSym === '🍋') prize = 100;
      else if (max >= 3 && topSym === '🍒') prize = 60;
      else if (max >= 2 && topSym === '💎') prize = 80;
      else if (max >= 2 && topSym === '⭐') prize = 40;

      const display =
        `${grid[0]} ${grid[1]} ${grid[2]}\n` +
        `${grid[3]} ${grid[4]} ${grid[5]}\n` +
        `${grid[6]} ${grid[7]} ${grid[8]}`;

      if (prize > 0) {
        eco.addCoins(extra.sender, prize);
        eco.addXP(extra.sender, 10);
        const after = eco.getUser(extra.sender);
        return extra.reply(
          `🎫 *CARTE À GRATTER*\n\n${display}\n\n` +
          `🏆 *${max}x ${topSym} — GAGNÉ !*\n` +
          `✅ Prix : *+${prize} 🪙*\n` +
          `💰 Solde : *${after.coins.toLocaleString()} 🪙*`
        );
      }

      const after = eco.getUser(extra.sender);
      return extra.reply(
        `🎫 *CARTE À GRATTER*\n\n${display}\n\n` +
        `❌ Rien cette fois...\n` +
        `💸 Coûte : *-${PRICE} 🪙*\n` +
        `💰 Solde : *${after.coins.toLocaleString()} 🪙*`
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
