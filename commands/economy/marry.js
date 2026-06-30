/**
 * Marry Command — Système de mariage
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');
const MARRY_COST = 1000;

module.exports = {
  name: 'marry',
  aliases: ['marier', 'mariage', 'propose'],
  category: 'economy',
  description: 'Faire une demande en mariage',
  usage: '.marry @joueur | .marry accept | .marry refuse',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) {
        return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");
      }

      const sub      = (args[0] || '').toLowerCase();
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (sub === 'accept' || sub === 'oui') {
        const proposal = np.getProposal(extra.sender);
        if (!proposal) return extra.reply("❌ Tu n'as pas de demande en mariage en attente!");

        const fromPlayer = np.getPlayer(proposal.from);
        // Déduire les coins du demandeur
        const fromEco = eco.getUser(proposal.from);
        if (fromEco.coins < MARRY_COST) {
          return extra.reply(`❌ @${proposal.from.split('@')[0]} n'a plus assez de coins pour le mariage!`);
        }
        eco.removeCoins(proposal.from, MARRY_COST);
        // Les coins vont au partenaire
        eco.addCoins(extra.sender, MARRY_COST);

        const result     = np.acceptMarriage(extra.sender);
        if (!result) return extra.reply("❌ Impossible d'accepter la demande.");

        const myTag  = np.tag(extra.sender);
        const hisTag = np.tag(proposal.from);

        return await sock.sendMessage(extra.from, {
          text:
            `💍 *MARIAGE CÉLÉBRÉ !* 🎊\n` +
            `${'═'.repeat(30)}\n\n` +
            `💑 @${hisTag.wa} 『 *${hisTag.gn}* 』\n` +
            `       &\n` +
            `💑 @${myTag.wa}  『 *${myTag.gn}* 』\n\n` +
            `Sont maintenant officiellement mariés !\n\n` +
            `_Que votre aventure commence !_ ❤️`,
          mentions: [proposal.from, extra.sender]
        }, { quoted: msg });
      }

      if (sub === 'refuse' || sub === 'non') {
        const proposal = np.getProposal(extra.sender);
        if (!proposal) return extra.reply("❌ Tu n'as pas de demande en attente.");
        const fromTag = np.tag(proposal.from);
        // Clear the proposal
        np.proposeMarriage(extra.sender, extra.sender); // hack to clear
        return await sock.sendMessage(extra.from, {
          text: `💔 @${extra.sender.split('@')[0]} a refusé la demande de @${fromTag.wa} 『 ${fromTag.gn} 』... 😢`,
          mentions: [extra.sender, proposal.from]
        }, { quoted: msg });
      }

      // Faire une demande
      if (!mentioned[0]) return extra.reply("❌ Mentionne quelqu'un!\nEx: *.marry @joueur*");
      const targetId = mentioned[0];
      if (targetId === extra.sender) return extra.reply("😂 Tu veux te marier avec toi-même ?!");

      if (!np.isRegistered(targetId)) {
        return await sock.sendMessage(extra.from, {
          text: `❌ @${targetId.split('@')[0]} n'est pas dans NeonParty!`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      const me     = np.getPlayer(extra.sender);
      const target = np.getPlayer(targetId);

      // Vérifier les coins
      const meEco = eco.getUser(extra.sender);
      if (meEco.coins < MARRY_COST) {
        return extra.reply(
          `❌ Te marier coûte *${MARRY_COST.toLocaleString()} 🪙* !\n` +
          `💰 Ton solde : *${meEco.coins.toLocaleString()} 🪙*\n` +
          `📉 Manque : *${(MARRY_COST - meEco.coins).toLocaleString()} 🪙*`
        );
      }

      if (me.marriedTo)     return extra.reply(`❌ T'es déjà marié(e) avec *${me.spouseName}* ! Divorce d'abord : *.divorce*`);
      if (target.marriedTo) {
        return await sock.sendMessage(extra.from, {
          text: `❌ @${targetId.split('@')[0]} 『 ${target.username} 』 est déjà marié(e) avec *${target.spouseName}* !`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      np.proposeMarriage(extra.sender, targetId);
      const myTag  = np.tag(extra.sender);
      const defTag = np.tag(targetId);

      await sock.sendMessage(extra.from, {
        text:
          `💍 *DEMANDE EN MARIAGE !*\n\n` +
          `@${myTag.wa} 『 *${myTag.gn}* 』\n` +
          `demande en mariage\n` +
          `@${defTag.wa} 『 *${defTag.gn}* 』 💕\n\n` +
          `@${defTag.wa} : tape *.marry accept* pour accepter\n` +
          `ou *.marry refuse* pour refuser\n\n` +
          `_⏳ 2 minutes pour répondre_`,
        mentions: [extra.sender, targetId]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
