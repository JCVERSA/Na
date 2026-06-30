/**
 * Bank Command — Dépôt / Retrait / Solde banque
 * Nebula Bot by Dark Neon
 * Les coins en banque sont protégés du .rob
 */

const eco = require('../../utils/economy');

module.exports = {
  name: 'bank',
  aliases: ['banque', 'coffre'],
  category: 'economy',
  description: 'Gérer ta banque (protège du .rob)',
  usage: '.bank | .bank deposit <montant> | .bank withdraw <montant>',

  async execute(sock, msg, args, extra) {
    try {
      const user = eco.getUser(extra.sender);
      const sub  = (args[0] || '').toLowerCase();

      // ── .bank deposit ──────────────────────────────────────────
      if (sub === 'deposit' || sub === 'dep' || sub === 'put' || sub === 'mettre') {
        const amount = args[1] === 'all' ? user.coins : parseInt(args[1]);
        if (!amount || amount <= 0) return extra.reply('❌ Montant invalide!\nEx: *.bank deposit 500* ou *.bank deposit all*');

        const result = eco.deposit(extra.sender, amount);
        if (!result) return extra.reply(`❌ Solde insuffisant ! Tu as *${user.coins.toLocaleString()} 🪙* en poche.`);

        return extra.reply(
          `🏦 *DÉPÔT EFFECTUÉ*\n\n` +
          `📥 Déposé : *+${amount.toLocaleString()} 🪙*\n` +
          `💵 Poche  : *${result.coins.toLocaleString()} 🪙*\n` +
          `🏦 Banque : *${result.bank.toLocaleString()} 🪙*\n\n` +
          `_Tes coins sont protégés du .rob_ 🛡️`
        );
      }

      // ── .bank withdraw ─────────────────────────────────────────
      if (sub === 'withdraw' || sub === 'wdw' || sub === 'retirer' || sub === 'retrait') {
        const amount = args[1] === 'all' ? user.bank : parseInt(args[1]);
        if (!amount || amount <= 0) return extra.reply('❌ Montant invalide!\nEx: *.bank withdraw 500* ou *.bank withdraw all*');

        const result = eco.withdraw(extra.sender, amount);
        if (!result) return extra.reply(`❌ Solde banque insuffisant ! Tu as *${(user.bank || 0).toLocaleString()} 🪙* en banque.`);

        return extra.reply(
          `🏦 *RETRAIT EFFECTUÉ*\n\n` +
          `📤 Retiré : *${amount.toLocaleString()} 🪙*\n` +
          `💵 Poche  : *${result.coins.toLocaleString()} 🪙*\n` +
          `🏦 Banque : *${result.bank.toLocaleString()} 🪙*`
        );
      }

      // ── .bank (afficher solde) ─────────────────────────────────
      const total = (user.coins || 0) + (user.bank || 0);
      await extra.reply(
        `🏦 *TA BANQUE*\n` +
        `${'─'.repeat(26)}\n` +
        `💵 En poche : *${(user.coins || 0).toLocaleString()} 🪙*\n` +
        `🔒 En banque : *${(user.bank || 0).toLocaleString()} 🪙*\n` +
        `━━━━━━━━━━━━━━\n` +
        `💎 Fortune totale : *${total.toLocaleString()} 🪙*\n\n` +
        `📌 *Commandes :*\n` +
        `  • *.bank deposit <montant|all>*\n` +
        `  • *.bank withdraw <montant|all>*\n\n` +
        `_Les coins en banque sont protégés du .rob_ 🛡️`
      );

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
