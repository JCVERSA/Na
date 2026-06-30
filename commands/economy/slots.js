/**
 * Slots Command — Machine à sous 🎰
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');

const SYMBOLS = ['🍒', '🍋', '🍊', '⭐', '💎', '7️⃣', '🎰'];
const WEIGHTS  = [ 30,   25,   20,   12,   8,    3,    2 ]; // % de probabilité

const PAYOUTS = {
  '7️⃣7️⃣7️⃣': { mult: 50,  name: 'JACKPOT LÉGENDAIRE' },
  '🎰🎰🎰': { mult: 25,  name: 'MEGA JACKPOT' },
  '💎💎💎': { mult: 15,  name: 'SUPER JACKPOT' },
  '⭐⭐⭐': { mult: 8,   name: 'GRANDE VICTOIRE' },
  '🍊🍊🍊': { mult: 5,   name: 'BELLE COMBINAISON' },
  '🍋🍋🍋': { mult: 3,   name: 'BONNE COMBINAISON' },
  '🍒🍒🍒': { mult: 2,   name: 'PETITE VICTOIRE' },
};

function spin() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  const pick  = () => {
    let r = Math.random() * total;
    for (let i = 0; i < SYMBOLS.length; i++) {
      r -= WEIGHTS[i];
      if (r <= 0) return SYMBOLS[i];
    }
    return SYMBOLS[0];
  };
  return [pick(), pick(), pick()];
}

module.exports = {
  name: 'slots',
  aliases: ['slot', 'machine', 'casino'],
  category: 'economy',
  description: 'Machine à sous — mise des coins!',
  usage: '.slots <mise>',

  async execute(sock, msg, args, extra) {
    try {
      if (!eco.isAvailable(extra.sender, 'slots')) {
        const remaining = eco.timeUntil(extra.sender, 'slots');
        return extra.reply(`🎰 *Machine occupée !*\n\nAttends : *${eco.formatTime(remaining)}*`);
      }

      const user = eco.getUser(extra.sender);

      if (!args[0]) {
        return extra.reply(
          `🎰 *MACHINE À SOUS*\n\n` +
          `Usage : *.slots <mise>*\n` +
          `Ex: *.slots 100*\n\n` +
          `*Combinaisons gagnantes :*\n` +
          `7️⃣7️⃣7️⃣ = x50  💎💎💎 = x15\n` +
          `🎰🎰🎰 = x25  ⭐⭐⭐ = x8\n` +
          `🍊🍊🍊 = x5   🍋🍋🍋 = x3\n` +
          `🍒🍒🍒 = x2\n\n` +
          `⏳ Cooldown : 5 minutes`
        );
      }

      const bet = args[0] === 'all' ? user.coins : parseInt(args[0]);
      if (!bet || bet <= 0) return extra.reply('❌ Mise invalide!');
      if (bet > 5000) return extra.reply('❌ Mise maximale : *5,000 🪙*');
      if (user.coins < bet) return extra.reply(`❌ Solde insuffisant ! Tu as *${user.coins.toLocaleString()} 🪙*`);

      eco.updateUser(extra.sender, { lastSlots: Date.now() });
      eco.removeCoins(extra.sender, bet);

      const hasLucky = eco.hasItem(extra.sender, 'lucky');
      // Trèfle chanceux : relance si toutes différentes
      let reels = spin();
      if (hasLucky && new Set(reels).size === 3) reels = spin();

      const key    = reels.join('');
      const payout = PAYOUTS[key];

      if (payout) {
        const won = bet * payout.mult;
        eco.addCoins(extra.sender, won);
        eco.addXP(extra.sender, 20);
        const after = eco.getUser(extra.sender);

        await extra.reply(
          `🎰 *MACHINE À SOUS*\n\n` +
          `┌─────────────────┐\n` +
          `│  ${reels[0]}  ${reels[1]}  ${reels[2]}  │\n` +
          `└─────────────────┘\n\n` +
          `🏆 *${payout.name} !*\n` +
          `💰 Mise : ${bet.toLocaleString()} 🪙 × *${payout.mult}*\n` +
          `✅ Gain : *+${won.toLocaleString()} 🪙*\n` +
          `💵 Solde : *${after.coins.toLocaleString()} 🪙*` +
          (hasLucky ? '\n\n🍀 _Trèfle chanceux activé !_' : '')
        );
      } else {
        // Vérifier si 2 symboles pareils (petit gain)
        const counts = {};
        for (const s of reels) counts[s] = (counts[s] || 0) + 1;
        const pair = Object.entries(counts).find(([, v]) => v === 2);

        let text =
          `🎰 *MACHINE À SOUS*\n\n` +
          `┌─────────────────┐\n` +
          `│  ${reels[0]}  ${reels[1]}  ${reels[2]}  │\n` +
          `└─────────────────┘\n\n`;

        if (pair) {
          const halfBet = Math.floor(bet * 0.5);
          eco.addCoins(extra.sender, halfBet);
          const after = eco.getUser(extra.sender);
          text +=
            `🤏 *Presque !* (paire de ${pair[0]})\n` +
            `💸 Remboursement : *+${halfBet.toLocaleString()} 🪙* (50%)\n` +
            `💵 Solde : *${after.coins.toLocaleString()} 🪙*`;
        } else {
          const after = eco.getUser(extra.sender);
          text +=
            `❌ *Perdu !*\n` +
            `💸 Perte : *-${bet.toLocaleString()} 🪙*\n` +
            `💵 Solde : *${after.coins.toLocaleString()} 🪙*`;
        }

        await extra.reply(text);
      }

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
