/**
 * Prison Command — Voir son statut en prison + se justifier
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');

const FREE_CHANCE_MIN = 0.20; // 20%
const FREE_CHANCE_MAX = 0.25; // 25%
const JUSTIFY_COOLDOWN = new Map(); // userId -> lastJustifyTime

module.exports = {
  name: 'prison',
  aliases: ['jail', 'cellule', 'prisonnier'],
  category: 'economy',
  description: 'Voir le statut de prison',
  usage: '.prison | .prison @joueur',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetId  = mentioned[0] || extra.sender;
      const p = np.getPlayer(targetId);

      if (!np.isInPrison(targetId)) {
        if (targetId === extra.sender) return extra.reply("✅ T'es pas en prison go! Tu es libre 🕊️");
        return await sock.sendMessage(extra.from, {
          text: `✅ @${targetId.split('@')[0]} 『 ${p.username || '?'} 』 est libre !`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      const remaining = np.timeUntilRelease(targetId);
      const pTag = np.tag(targetId);

      await sock.sendMessage(extra.from, {
        text:
          `🔒 *EN PRISON*\n\n` +
          `👤 @${pTag.wa} 『 *${pTag.gn}* 』\n\n` +
          `⏳ Libéré dans : *${np.formatTime(remaining)}*\n\n` +
          `*Pendant l'emprisonnement tu peux :*\n` +
          `• *.justify* — Tenter d'être libéré(e) (20-25% de chances)\n` +
          `• *.caution @toi <montant>* — Demander à quelqu'un de payer ta caution`,
        mentions: [targetId]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
