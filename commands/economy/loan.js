/**
 * Loan Command — Emprunter des coins avec intérêts
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

module.exports = {
  name: 'loan',
  aliases: ['emprunt', 'emprunter', 'pret', 'prêt'],
  category: 'economy',
  description: 'Emprunter des coins (à rembourser dans 48h +25%)',
  usage: '.loan <montant> | .loan repay',
  async execute(sock, msg, args, extra) {
    try {
      const user = eco.getUser(extra.sender);
      const sub  = (args[0] || '').toLowerCase();

      if (sub === 'repay' || sub === 'rembourser' || sub === 'payer') {
        if (!user.loan) return extra.reply('✅ T\'as pas de prêt en cours go !');
        const result = eco.repayLoan(extra.sender);
        if (!result.ok && result.reason === 'insufficient') {
          return extra.reply(
            `❌ *Solde insuffisant pour rembourser !*\n\n` +
            `💸 À rembourser : *${result.needed.toLocaleString()} 🪙*\n` +
            `💰 Ton solde : *${result.have.toLocaleString()} 🪙*\n` +
            `📉 Il te manque : *${(result.needed - result.have).toLocaleString()} 🪙*\n\n` +
            `_Fais .work, .crime ou .slots pour trouver les coins !_`
          );
        }
        const after = eco.getUser(extra.sender);
        return extra.reply(
          `✅ *PRÊT REMBOURSÉ !*\n\n` +
          `💸 Payé : *${result.paid.toLocaleString()} 🪙*\n` +
          `💰 Solde restant : *${after.coins.toLocaleString()} 🪙*\n\n` +
          `_T\'es libre go, plus de dettes !_ 🎉`
        );
      }

      // Afficher la situation du prêt
      if (sub === 'status' || sub === 'info' || !args[0]) {
        if (user.loan) {
          const due  = user.loanDue ? new Date(user.loanDue).toLocaleString('fr-FR') : '?';
          const late = user.loanDue && Date.now() > user.loanDue;
          return extra.reply(
            `💳 *TON PRÊT EN COURS*\n\n` +
            `💸 À rembourser : *${(user.loan).toLocaleString()} 🪙*\n` +
            `📅 Deadline : ${due}\n` +
            `${late ? '⚠️ *EN RETARD !* Des frais supplémentaires s\'appliquent' : '✅ Dans les temps'}\n\n` +
            `Tape *.loan repay* pour rembourser`
          );
        }
        return extra.reply(
          `💳 *SYSTÈME DE PRÊT*\n\n` +
          `Max : *5,000 🪙*\n` +
          `Intérêts : *+25%*\n` +
          `Délai : *48h*\n\n` +
          `Ex : *.loan 1000*`
        );
      }

      // Prendre un prêt
      if (user.loan) return extra.reply(`❌ T\'as déjà un prêt en cours de *${user.loan} 🪙* à rembourser !\nTape *.loan repay*`);

      const amount = parseInt(args[0]);
      if (!amount || amount < 100) return extra.reply('❌ Minimum *100 🪙*');

      const result = eco.takeLoan(extra.sender, amount);
      if (!result) return extra.reply('❌ Prêt impossible (déjà un prêt actif ou montant trop élevé)');

      const toRepay = Math.floor(amount * 1.25);
      await extra.reply(
        `💳 *PRÊT ACCORDÉ !*\n\n` +
        `💵 Reçu : *+${amount.toLocaleString()} 🪙*\n` +
        `💸 À rembourser : *${toRepay.toLocaleString()} 🪙* (+25%)\n` +
        `📅 Délai : *48 heures*\n` +
        `💰 Solde : *${result.coins.toLocaleString()} 🪙*\n\n` +
        `_Tape .loan repay quand t\'as l\'argent !_`
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
