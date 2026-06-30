/**
 * Family Command — Arbre généalogique
 * Nebula Bot by Dark Neon
 */
const np = require('../../utils/neonparty');

module.exports = {
  name: 'family',
  aliases: ['famille', 'arbre', 'tree'],
  category: 'economy',
  description: 'Voir ton arbre généalogique',
  usage: '.family [@joueur]',

  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetId  = mentioned[0] || extra.sender;

      if (!np.isRegistered(targetId)) {
        if (targetId === extra.sender) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");
        return await sock.sendMessage(extra.from, {
          text: `❌ @${targetId.split('@')[0]} n'est pas dans NeonParty!`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      const tree    = np.getFamilyTree(targetId);
      const allIds  = [targetId];

      let text = `🌳 *ARBRE GÉNÉALOGIQUE*\n`;
      text += `${'═'.repeat(30)}\n\n`;
      text += `👤 @${targetId.split('@')[0]} 『 *${tree.self.username}* 』\n\n`;

      if (tree.parents.length > 0) {
        text += `👨‍👩 *Parents :*\n`;
        for (const p of tree.parents) {
          text += `  └ @${p.id.split('@')[0]} 『 *${p.username || '?'}* 』\n`;
          allIds.push(p.id);
        }
        text += '\n';
      }

      if (tree.spouse) {
        text += `💍 *Marié(e) à :*\n`;
        text += `  └ @${tree.spouse.id.split('@')[0]} 『 *${tree.spouse.username || '?'}* 』\n\n`;
        allIds.push(tree.spouse.id);
      } else {
        text += `💔 Célibataire\n\n`;
      }

      if (tree.children.length > 0) {
        text += `👶 *Enfants (${tree.children.length}) :*\n`;
        for (const c of tree.children) {
          text += `  └ @${c.id.split('@')[0]} 『 *${c.username || '?'}* 』\n`;
          allIds.push(c.id);
        }
      } else {
        text += `👶 Pas d'enfants\n`;
      }

      const totalFamily = tree.parents.length + (tree.spouse ? 1 : 0) + tree.children.length;
      text += `\n_Famille totale : *${totalFamily}* membres_`;

      await sock.sendMessage(extra.from, { text, mentions: allIds }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
