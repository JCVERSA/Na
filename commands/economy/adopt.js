/**
 * Adopt Command — Adoption de joueurs
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');
const ADOPT_MIN = 800;

module.exports = {
  name: 'adopt',
  aliases: ['adopter', 'adoption'],
  category: 'economy',
  description: 'Adopter un joueur comme enfant',
  usage: '.adopt @joueur | .adopt accept',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");

      const sub      = (args[0] || '').toLowerCase();
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (sub === 'accept' || sub === 'oui') {
        const req = np.getAdoptionRequest(extra.sender);
        if (!req) return extra.reply("❌ Pas de demande d'adoption en attente!");

        const result = np.acceptAdoption(extra.sender);
        if (!result) return extra.reply("❌ Impossible.");

        const parentTag = np.tag(result.parentId);
        const childTag  = np.tag(extra.sender);

        return await sock.sendMessage(extra.from, {
          text:
            `👨‍👧 *ADOPTION OFFICIELLE !* 🎊\n\n` +
            `@${parentTag.wa} 『 *${parentTag.gn}* 』 adopte officiellement\n` +
            `@${childTag.wa}  『 *${childTag.gn}* 』 !\n\n` +
            `_Bienvenue dans la famille !_ 🏡`,
          mentions: [result.parentId, extra.sender]
        }, { quoted: msg });
      }

      if (!mentioned[0]) return extra.reply("❌ Mentionne quelqu'un!\n*.adopt @joueur*");
      const targetId = mentioned[0];
      if (targetId === extra.sender) return extra.reply("😂 T'adoptes toi-même ?");

      // Vérifier le solde minimum pour adopter
      const myEco = eco.getUser(extra.sender);
      if (myEco.coins < ADOPT_MIN) {
        return extra.reply(
          `❌ Il te faut au minimum *${ADOPT_MIN.toLocaleString()} 🪙* pour adopter et subvenir aux besoins de ta famille !\n` +
          `💰 Ton solde : *${myEco.coins.toLocaleString()} 🪙*\n` +
          `📉 Manque : *${(ADOPT_MIN - myEco.coins).toLocaleString()} 🪙*`
        );
      }
      if (!np.isRegistered(targetId)) {
        return await sock.sendMessage(extra.from, {
          text: `❌ @${targetId.split('@')[0]} n'est pas dans NeonParty!`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      const me     = np.getPlayer(extra.sender);
      const target = np.getPlayer(targetId);

      // Vérifier pas déjà parent
      if ((me.children || []).some(c => c.id === targetId))
        return extra.reply("❌ C'est déjà ton enfant!");

      np.proposeAdoption(extra.sender, targetId);
      const myTag  = np.tag(extra.sender);
      const defTag = np.tag(targetId);

      await sock.sendMessage(extra.from, {
        text:
          `👨‍👧 *DEMANDE D'ADOPTION !*\n\n` +
          `@${myTag.wa} 『 *${myTag.gn}* 』 veut adopter\n` +
          `@${defTag.wa} 『 *${defTag.gn}* 』 !\n\n` +
          `@${defTag.wa} : tape *.adopt accept* pour accepter\n` +
          `_⏳ 2 minutes pour répondre_`,
        mentions: [extra.sender, targetId]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
