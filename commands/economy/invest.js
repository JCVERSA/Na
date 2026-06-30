/**
 * Invest Command — Investir des coins (retour en 24h, gain/perte aléatoire)
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

module.exports = {
  name: 'invest',
  aliases: ['investir', 'placer', 'investment'],
  category: 'economy',
  description: 'Investir des coins (retour 24h, entre -30% et +80%)',
  usage: '.invest <montant> | .invest collect',
  async execute(sock, msg, args, extra) {
    try {
      const user = eco.getUser(extra.sender);
      const sub  = (args[0] || '').toLowerCase();

      if (sub === 'collect' || sub === 'récupérer' || sub === 'retirer') {
        if (!user.invest || !user.investAt) return extra.reply('❌ T\'as pas d\'investissement en cours!');
        const result = eco.collectInvest(extra.sender);
        if (result?.wait) return extra.reply(`⏳ Investissement pas encore mûr !\n\nAttends encore : *${eco.formatTime(result.wait)}*`);
        if (!result) return extra.reply('❌ Erreur lors de la récupération');
        const after = eco.getUser(extra.sender);
        return extra.reply(
          `📈 *INVESTISSEMENT TERMINÉ !*\n\n` +
          `💰 Investi : *${result.invested} 🪙*\n` +
          (result.profit >= 0
            ? `✅ Profit : *+${result.profit} 🪙* (+${result.pct}%)`
            : `❌ Perte : *${result.profit} 🪙* (${result.pct}%)`) + '\n' +
          `💵 Récupéré : *${result.total} 🪙*\n` +
          `💰 Solde : *${after.coins.toLocaleString()} 🪙*`
        );
      }

      // Status investissement
      if (user.invest && user.investAt) {
        const elapsed = Date.now() - user.investAt;
        const remaining = Math.max(0, eco.COOLDOWNS.invest - elapsed);
        return extra.reply(
          `📈 *INVESTISSEMENT EN COURS*\n\n` +
          `💵 Placé : *${user.invest.toLocaleString()} 🪙*\n` +
          `⏳ ${remaining > 0 ? `Récupérable dans : *${eco.formatTime(remaining)}*` : '✅ *PRÊT À RÉCUPÉRER !* Tape *.invest collect*'}`
        );
      }

      const amount = args[0] === 'all' ? user.coins : parseInt(args[0]);
      if (!amount || amount < 100) return extra.reply('❌ Minimum *100 🪙*\nEx: *.invest 1000*');
      if (amount > 50000) return extra.reply('❌ Maximum *50,000 🪙*');

      const result = eco.startInvest(extra.sender, amount);
      if (!result) return extra.reply('❌ Solde insuffisant ou investissement déjà actif!');

      await extra.reply(
        `📈 *INVESTISSEMENT LANCÉ !*\n\n` +
        `💵 Placé : *${amount.toLocaleString()} 🪙*\n` +
        `📊 Retour possible : entre *-30%* et *+80%*\n` +
        `⏳ Récupérable dans : *24h*\n` +
        `💰 Solde restant : *${result.coins.toLocaleString()} 🪙*\n\n` +
        `_Tape .invest collect dans 24h !_`
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
