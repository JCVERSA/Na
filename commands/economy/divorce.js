/**
 * Divorce Command
 * Nebula Bot by Dark Neon
 */
const np = require('../../utils/neonparty');

module.exports = {
  name: 'divorce',
  aliases: ['separation', 'quitter'],
  category: 'economy',
  description: 'Divorcer de votre partenaire',
  usage: '.divorce',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");
      const p = np.getPlayer(extra.sender);
      if (!p.marriedTo) return extra.reply("❌ T'es pas marié(e) go 😭");

      const spouseTag = np.tag(p.marriedTo);
      np.divorce(extra.sender);

      await sock.sendMessage(extra.from, {
        text:
          `💔 *DIVORCE*\n\n` +
          `@${extra.sender.split('@')[0]} 『 *${p.username}* 』 et @${spouseTag.wa} 『 *${spouseTag.gn}* 』\n` +
          `sont maintenant séparés...\n\n_C'est la vie go_ 😔`,
        mentions: [extra.sender, p.marriedTo]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
