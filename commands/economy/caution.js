/**
 * Caution Command — Payer la caution d'un prisonnier
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');

const MIN_CAUTION = 500;

module.exports = {
  name: 'caution',
  aliases: ['bail', 'liberer', 'libérer', 'rançon'],
  category: 'economy',
  description: 'Payer la caution pour libérer un prisonnier',
  usage: '.caution @joueur <montant>',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned[0]) return extra.reply("❌ Mentionne le prisonnier!\n*.caution @joueur <montant>*");

      const targetId = mentioned[0];

      if (!np.isRegistered(targetId)) {
        return await sock.sendMessage(extra.from, {
          text: `❌ @${targetId.split('@')[0]} n'est pas dans NeonParty!`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      if (!np.isInPrison(targetId)) {
        return await sock.sendMessage(extra.from, {
          text: `✅ @${targetId.split('@')[0]} est déjà libre!`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      const amount = parseInt(args.find(a => /^\d+$/.test(a)));
      if (!amount || amount < MIN_CAUTION) {
        return extra.reply(`❌ Caution minimum : *${MIN_CAUTION.toLocaleString()} 🪙*`);
      }

      const payer = eco.getUser(extra.sender);
      if (payer.coins < amount) {
        return extra.reply(`❌ Solde insuffisant ! Tu as *${payer.coins.toLocaleString()} 🪙*`);
      }

      eco.removeCoins(extra.sender, amount);
      np.releaseFromPrison(targetId);

      const payerTag = np.tag(extra.sender);
      const defTag   = np.tag(targetId);

      await sock.sendMessage(extra.from, {
        text:
          `🔓 *CAUTION PAYÉE !*\n` +
          `${'═'.repeat(28)}\n\n` +
          `💰 @${payerTag.wa} 『 *${payerTag.gn}* 』\n` +
          `a payé *${amount.toLocaleString()} 🪙* pour libérer\n` +
          `@${defTag.wa} 『 *${defTag.gn}* 』 !\n\n` +
          `🕊️ ${defTag.gn} est maintenant *LIBRE !*\n\n` +
          `_C'est beau l'amitié 🤝_`,
        mentions: [extra.sender, targetId]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
