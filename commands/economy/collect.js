/**
 * Collect Command — Revenu passif toutes les 2h
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

module.exports = {
  name: 'collect',
  aliases: ['collecter', 'revenu', 'income', 'passive'],
  category: 'economy',
  description: 'Collecter ton revenu passif (toutes les 2h)',
  usage: '.collect',
  async execute(sock, msg, args, extra) {
    try {
      if (!eco.isAvailable(extra.sender, 'collect')) {
        const r = eco.timeUntil(extra.sender, 'collect');
        return extra.reply(`💼 *Revenu pas encore disponible !*\n\nProchain dans : *${eco.formatTime(r)}*`);
      }

      const user   = eco.getUser(extra.sender);
      const base   = (user.passiveBase || 10) + (user.level || 1) * 5;
      const bonus  = eco.hasItem(extra.sender, 'boost') ? base : 0;
      const earned = base + bonus;

      eco.addCoins(extra.sender, earned);
      eco.updateUser(extra.sender, { lastCollect: Date.now() });
      const after = eco.getUser(extra.sender);

      await extra.reply(
        `💼 *REVENU PASSIF COLLECTÉ !*\n\n` +
        `💵 Base (Niv.${user.level}) : *+${base} 🪙*\n` +
        (bonus > 0 ? `⚡ Boost XP : *+${bonus} 🪙*\n` : '') +
        `✅ Total : *+${earned} 🪙*\n` +
        `💰 Solde : *${after.coins.toLocaleString()} 🪙*\n\n` +
        `⏳ Prochain revenu dans : *2h*\n` +
        `_Monte de niveau pour augmenter ton revenu !_`
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
