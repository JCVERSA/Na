/**
 * Pay Command — Transférer des coins à un autre utilisateur
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');

module.exports = {
  name: 'pay',
  aliases: ['give', 'send', 'transfer'],
  category: 'economy',
  description: 'Envoyer des coins à quelqu\'un',
  usage: '.pay @user <montant>',

  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (!mentioned[0]) {
        return extra.reply('❌ Mentionne quelqu\'un!\nEx: *.pay @user 500*');
      }

      const target = mentioned[0];

      if (target === extra.sender) {
        return extra.reply('❌ Tu ne peux pas t\'envoyer des coins à toi-même!');
      }

      const amount = parseInt(args.find(a => /^\d+$/.test(a)));
      if (!amount || amount <= 0) {
        return extra.reply('❌ Indique un montant valide!\nEx: *.pay @user 500*');
      }

      if (amount > 1000000) {
        return extra.reply('❌ Montant maximum : *1,000,000 🪙*');
      }

      const sender = eco.getUser(extra.sender);
      if (sender.coins < amount) {
        return extra.reply(
          `❌ Solde insuffisant!\n\n` +
          `💰 Ton solde : *${sender.coins.toLocaleString()} 🪙*\n` +
          `💸 Montant demandé : *${amount.toLocaleString()} 🪙*`
        );
      }

      eco.removeCoins(extra.sender, amount);
      eco.addCoins(target, amount);

      const senderAfter = eco.getUser(extra.sender);
      const targetAfter = eco.getUser(target);

      await sock.sendMessage(extra.from, {
        text:
          `💸 *TRANSFERT EFFECTUÉ*\n\n` +
          `📤 De : @${extra.sender.split('@')[0]}\n` +
          `📥 À : @${target.split('@')[0]}\n` +
          `💰 Montant : *${amount.toLocaleString()} 🪙*\n\n` +
          `📊 Nouveaux soldes:\n` +
          `  • @${extra.sender.split('@')[0]} : ${senderAfter.coins.toLocaleString()} 🪙\n` +
          `  • @${target.split('@')[0]} : ${targetAfter.coins.toLocaleString()} 🪙`,
        mentions: [extra.sender, target]
      }, { quoted: msg });

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
