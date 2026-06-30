/**
 * Lottery Command — Loterie communautaire
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

module.exports = {
  name: 'lottery',
  aliases: ['loto', 'loterie', 'ticket'],
  category: 'economy',
  description: 'Acheter des tickets de loterie (100 🪙/ticket)',
  usage: '.lottery [N tickets] | .lottery draw (admin)',
  async execute(sock, msg, args, extra) {
    try {
      const sub = (args[0] || '').toLowerCase();

      if (sub === 'draw' || sub === 'tirer') {
        const config = require('../../config');
        const isOwner = (config.ownerNumber || []).some(n => extra.sender.includes(n));
        if (!isOwner) return extra.reply('❌ Commande réservée au owner!');

        const result = eco.drawLottery(sock, extra.from);
        if (!result) return extra.reply('❌ Pas assez de tickets pour tirer!');

        return await sock.sendMessage(extra.from, {
          text:
            `🎰 *TIRAGE DE LOTERIE !*\n\n` +
            `🏆 *GAGNANT : @${result.winner.split('@')[0]}*\n` +
            `💰 *Prix : ${result.prize.toLocaleString()} 🪙* !\n\n` +
            `_Félicitations ! La prochaine loterie commence maintenant._`,
          mentions: [result.winner]
        }, { quoted: msg });
      }

      const info = eco.getLotteryInfo();
      const pot  = info.pot || 0;

      if (!args[0] || sub === 'info') {
        const myTickets = (info.tickets || {})[extra.sender] || 0;
        const totalTickets = Object.values(info.tickets || {}).reduce((a, b) => a + b, 0);
        const myChance = totalTickets > 0 ? Math.round((myTickets / totalTickets) * 100) : 0;
        return extra.reply(
          `🎰 *LOTERIE COMMUNAUTAIRE*\n\n` +
          `💰 Pot actuel : *${pot.toLocaleString()} 🪙*\n` +
          `🎫 Total tickets : *${totalTickets}*\n` +
          `🎫 Tes tickets : *${myTickets}* (${myChance}% de chances)\n\n` +
          `Prix : *100 🪙* / ticket\n` +
          `Ex : *.lottery 3* — achète 3 tickets\n` +
          `_Le winner est tiré manuellement par le owner_`
        );
      }

      const count = parseInt(args[0]) || 1;
      if (count < 1 || count > 20) return extra.reply('❌ Entre 1 et 20 tickets à la fois!');

      const result = eco.buyTicket(extra.sender, count);
      if (!result) return extra.reply(`❌ Solde insuffisant ! Il te faut *${count * 100} 🪙*`);

      await extra.reply(
        `🎫 *TICKETS ACHETÉS !*\n\n` +
        `🎟️ Tickets achetés : *${count}*\n` +
        `🎫 Total tes tickets : *${result.tickets}*\n` +
        `💰 Pot actuel : *${result.pot.toLocaleString()} 🪙*\n\n` +
        `_Bonne chance ! 🍀_`
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
