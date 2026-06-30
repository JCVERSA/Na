/**
 * GiveCoins Command — Owner donne des coins à un joueur
 * Nebula Bot by Dark Neon
 * Réservé au owner du bot — solde illimité
 */
const eco = require('../../utils/economy');
const np  = require('../../utils/neonparty');

module.exports = {
  name: 'givecoins',
  aliases: ['give_coins', 'addcoins', 'donner', 'gc'],
  category: 'economy',
  description: '[OWNER] Donner des coins à un joueur',
  usage: '.givecoins @joueur <montant>',

  async execute(sock, msg, args, extra) {
    try {
      const config = require('../../config');
      const isOwner = (config.ownerNumber || []).some(n => extra.sender.includes(n));
      if (!isOwner) return extra.reply("❌ Commande réservée au *owner* du bot!");

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (!mentioned[0]) {
        return extra.reply(
          `💰 *GIVE COINS — OWNER*\n\n` +
          `Usage : *.givecoins @joueur <montant>*\n` +
          `Ex : *.givecoins @dark 10000*\n\n` +
          `_Ton solde est illimité. Tu peux nourrir toute la terre et même plus_ 👑`
        );
      }

      const targetId = mentioned[0];
      const amount   = parseInt(args.find(a => /^\d+$/.test(a)));
      if (!amount || amount <= 0) return extra.reply("❌ Indique un montant valide!");

      eco.addCoins(targetId, amount);
      const after    = eco.getUser(targetId);
      const defTag   = np.isRegistered(targetId) ? np.tag(targetId) : { wa: targetId.split('@')[0], gn: '' };

      await sock.sendMessage(extra.from, {
        text:
          `👑 *DON ROYAL DU OWNER*\n` +
          `${'═'.repeat(28)}\n\n` +
          `💰 @${defTag.wa} ${defTag.gn} reçoit *+${amount.toLocaleString()} 🪙* !\n\n` +
          `💵 Nouveau solde : *${after.coins.toLocaleString()} 🪙*\n\n` +
          `> _Dark Neon a parlé_ 👑`,
        mentions: [targetId]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
